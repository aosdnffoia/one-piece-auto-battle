import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import { computeSynergies, factionSynergies, roleSynergies, serializeUnit, units, getWaveByIndex, pveWaves } from './gameData';
import { mapFormationToCombat, mapPveUnits, simulateBattle } from './battle/simulator';
import { buildFormationState, lockFormation, serializeFormation } from './formation/validation';
import { FormationState } from './formation/types';
import { REROLL_COST, TIER_COST } from './shop/probabilities';
import { buyUnit, ensurePlayerState, rerollShop, seedTierBuckets, sellUnit, serializePlayerState } from './shop/shopLogic';
import { PlayerState } from './shop/types';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const BOT_WAIT_MS = 1000;

type AuthPayload = {
  sub: string;
  username: string;
};

type AuthUser = {
  id: string;
  username: string;
  hp: number;
  coins: number;
  xp: number;
  mmr: number;
};

type Match = {
  id: string;
  players: string[];
  createdAt: number;
};

type AuthedRequest = Request & { user?: AuthUser };

const users = new Map<string, AuthUser>(); // userId -> user
const usernameToId = new Map<string, string>(); // username -> userId
const waitingQueue: string[] = [];
const socketByUser = new Map<string, Socket>();
const activeMatches = new Map<string, Match>();
const botTimeouts = new Map<string, NodeJS.Timeout>();
const unitsById = new Map(units.map((u) => [u.id, u]));
const playerStateByUser = new Map<string, PlayerState>();
const formationByUser = new Map<string, FormationState>();

seedTierBuckets(units);

function getJwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Set it in your environment (.env).');
  }
  return JWT_SECRET;
}

function createUser(username: string): AuthUser {
  const id = randomUUID();
  const user: AuthUser = {
    id,
    username,
    hp: 30,
    coins: 10,
    xp: 0,
    mmr: 1000,
  };
  users.set(id, user);
  usernameToId.set(username, id);
  return user;
}

function getOrCreateUser(username: string): AuthUser {
  const existingId = usernameToId.get(username);
  if (existingId) {
    const existingUser = users.get(existingId);
    if (existingUser) {
      return existingUser;
    }
  }
  return createUser(username);
}

function getPlayerState(user: AuthUser): PlayerState {
  const existing = playerStateByUser.get(user.id);
  const state = ensurePlayerState(existing, { coins: user.coins, level: 1 });
  playerStateByUser.set(user.id, state);
  return state;
}

function getFormation(userId: string): FormationState | undefined {
  return formationByUser.get(userId);
}

function issueToken(user: AuthUser) {
  const secret = getJwtSecret();
  return jwt.sign({ sub: user.id, username: user.username }, secret, {
    expiresIn: '12h',
  });
}

function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid Authorization format' });
  }
  const token = parts[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (typeof decoded !== 'object' || decoded === null || !('sub' in decoded) || !('username' in decoded)) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    const payload = decoded as jwt.JwtPayload & AuthPayload;
    const user = users.get(payload.sub) || createUser(payload.username);
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function removeFromQueue(userId: string) {
  const index = waitingQueue.indexOf(userId);
  if (index >= 0) {
    waitingQueue.splice(index, 1);
  }
  const existingTimer = botTimeouts.get(userId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    botTimeouts.delete(userId);
  }
}

function emitShopUpdate(userId: string, state: PlayerState) {
  const socket = socketByUser.get(userId);
  if (!socket) return;
  socket.emit('shop_update', {
    shop: state.shop.map(serializeUnit),
    coins: state.coins,
    level: state.level,
    shopVersion: state.shopVersion,
    bench: state.bench,
  });
}

function emitFormationUpdate(userId: string, state: FormationState) {
  const socket = socketByUser.get(userId);
  if (!socket) return;
  socket.emit('formation_update', {
    formation: serializeFormation(state),
  });
  socket.emit('synergy_update', {
    formation: serializeFormation(state),
  });
}

function scheduleBotMatch(userId: string) {
  if (botTimeouts.has(userId)) {
    return;
  }
  const timeout = setTimeout(() => {
    if (!waitingQueue.includes(userId)) return;
    pairWithBot(userId);
  }, BOT_WAIT_MS);
  botTimeouts.set(userId, timeout);
}

function pairWithBot(userId: string) {
  removeFromQueue(userId);
  const socket = socketByUser.get(userId);
  if (!socket) return;
  const roomId = randomUUID();
  const match: Match = { id: roomId, players: [userId, 'bot'], createdAt: Date.now() };
  activeMatches.set(roomId, match);
  socket.join(roomId);
  socket.emit('match_found', {
    roomId,
    opponent: { id: 'bot', username: 'Training Dummy' },
    isBot: true,
  });
  socket.emit('round_start', { roomId, mode: 'pve', message: 'Bot placeholder battle' });
}

function pairPlayersIfReady() {
  while (waitingQueue.length >= 2) {
    const first = waitingQueue.shift();
    const second = waitingQueue.shift();
    if (!first || !second) break;

    botTimeouts.delete(first);
    botTimeouts.delete(second);

    const firstSocket = socketByUser.get(first);
    const secondSocket = socketByUser.get(second);
    if (!firstSocket || !secondSocket) {
      if (firstSocket) scheduleBotMatch(first);
      if (secondSocket) scheduleBotMatch(second);
      continue;
    }

    const roomId = randomUUID();
    const match: Match = { id: roomId, players: [first, second], createdAt: Date.now() };
    activeMatches.set(roomId, match);

    firstSocket.join(roomId);
    secondSocket.join(roomId);

    const firstUser = users.get(first);
    const secondUser = users.get(second);
    firstSocket.emit('match_found', {
      roomId,
      opponent: { id: second, username: secondUser?.username ?? 'Pirate' },
      isBot: false,
    });
    secondSocket.emit('match_found', {
      roomId,
      opponent: { id: first, username: firstUser?.username ?? 'Pirate' },
      isBot: false,
    });
  }
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/', (_req, res) => {
  res.send('One Piece Auto Battler server is running.');
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/api/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }
  const user = getOrCreateUser(username);
  const state = getPlayerState(user);
  const token = issueToken(user);
  return res.json({ token, user, state: serializePlayerState(state) });
});

app.get('/api/me', authMiddleware, (req: AuthedRequest, res) => {
  const user = req.user as AuthUser;
  const state = getPlayerState(user);
  return res.json({ user, state: serializePlayerState(state) });
});

app.get('/api/lobby', (_req, res) => {
  res.json({
    message: 'Lobby placeholder ready. Connect via WebSocket to join_queue.',
  });
});

app.get('/api/units', (_req, res) => {
  res.json({ units: units.map(serializeUnit) });
});

app.get('/api/synergies', (_req, res) => {
  res.json({ factions: factionSynergies, roles: roleSynergies });
});

app.post('/api/synergy-preview', (req, res) => {
  const ids = Array.isArray(req.body?.unitIds) ? (req.body.unitIds as string[]) : [];
  const selected = ids
    .map((id) => unitsById.get(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
  const synergies = computeSynergies(selected);
  res.json({ count: selected.length, synergies });
});

app.get('/api/pve/waves', (_req, res) => {
  res.json({ waves: pveWaves });
});

app.get('/api/formation', authMiddleware, (req: AuthedRequest, res) => {
  const user = req.user as AuthUser;
  const state = getFormation(user.id);
  res.json({ formation: state ? serializeFormation(state) : { slots: [], locked: false } });
});

app.post('/api/formation', authMiddleware, (req: AuthedRequest, res) => {
  const user = req.user as AuthUser;
  const bench = getPlayerState(user).bench;
  const payload = req.body as { slots: { index: number; instanceId: string }[] };
  try {
    const formation = buildFormationState(payload, bench, unitsById);
    formationByUser.set(user.id, formation);
    emitFormationUpdate(user.id, formation);
    res.json({ formation: serializeFormation(formation) });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Invalid formation' });
  }
});

app.post('/api/formation/lock', authMiddleware, (req: AuthedRequest, res) => {
  const user = req.user as AuthUser;
  const formation = formationByUser.get(user.id);
  if (!formation) {
    return res.status(400).json({ error: 'No formation set' });
  }
  const locked = lockFormation(formation);
  formationByUser.set(user.id, locked);
  emitFormationUpdate(user.id, locked);
  res.json({ formation: serializeFormation(locked) });
});

app.post('/api/pve/start', authMiddleware, (req: AuthedRequest, res) => {
  const user = req.user as AuthUser;
  const state = getPlayerState(user);
  const formation = formationByUser.get(user.id);
  if (!formation || formation.slots.length === 0) {
    return res.status(400).json({ error: 'Set a formation first' });
  }
  const wave = getWaveByIndex(state.pveWave) || getWaveByIndex(1);
  if (!wave) return res.status(400).json({ error: 'No PVE wave configured' });

  const playerUnits = mapFormationToCombat(
    {
      slots: formation.slots.map((s) => ({ instanceId: s.instanceId, unitId: s.unitId })),
    },
    unitsById,
  );
  const enemyUnits = mapPveUnits(wave.units);
  const result = simulateBattle(playerUnits, enemyUnits);

  let coinsEarned = 0;
  let xpEarned = 0;
  if (result.winner === 'player') {
    coinsEarned = wave.rewardCoins;
    xpEarned = wave.rewardXp;
    state.coins += coinsEarned;
    state.xp += xpEarned;
    state.pveWave += 1;
    emitShopUpdate(user.id, state);
  }

  const payload = {
    wave: wave.id,
    name: wave.name,
    result: result.winner,
    coinsEarned,
    xpEarned,
    survivorsPlayer: result.survivorsPlayer,
    survivorsEnemy: result.survivorsEnemy,
    log: result.log,
    nextWave: state.pveWave,
  };
  const socket = socketByUser.get(user.id);
  socket?.emit('round_start', { mode: 'pve', wave: wave.id });
  socket?.emit('round_result', payload);
  res.json(payload);
});

function calculateDamage(survivorIds: string[], unitLookup: Map<string, ReturnType<typeof unitsById.get>>) {
  let tierBonus = 0;
  for (const id of survivorIds) {
    const unit = Array.from(unitLookup.values()).find((u) => u?.id === id);
    if (unit) tierBonus += Math.max(0, unit.tier - 1);
  }
  return survivorIds.length * 2 + tierBonus;
}

app.post('/api/pvp/start', authMiddleware, (req: AuthedRequest, res) => {
  const user = req.user as AuthUser;
  const opponentId = String(req.body?.opponentId || '');
  const userFormation = formationByUser.get(user.id);
  if (!userFormation || userFormation.slots.length === 0) {
    return res.status(400).json({ error: 'No formation set' });
  }

  let opponentFormation = opponentId ? formationByUser.get(opponentId) : undefined;
  let opponentUser = opponentId ? users.get(opponentId) : undefined;
  let opponentName = opponentUser?.username ?? 'Training Dummy';

  if (!opponentFormation) {
    // fallback bot using first PVE wave
    const wave = getWaveByIndex(1);
    if (!wave) return res.status(400).json({ error: 'No bot formation available' });
    opponentFormation = {
      slots: wave.units.map((u, idx) => ({ index: idx, instanceId: `bot-${u.id}-${idx}`, unitId: u.id })),
      locked: true,
      synergySummary: { faction: [], role: [] },
    };
    opponentName = 'Training Dummy';
  }

  const playerUnits = mapFormationToCombat(
    { slots: userFormation.slots.map((s) => ({ instanceId: s.instanceId, unitId: s.unitId })) },
    unitsById,
  );
  const enemyUnits = mapFormationToCombat(
    { slots: opponentFormation.slots.map((s) => ({ instanceId: s.instanceId, unitId: s.unitId })) },
    unitsById,
  );
  if (enemyUnits.length === 0) return res.status(400).json({ error: 'Opponent has no units placed' });

  const result = simulateBattle(playerUnits, enemyUnits);

  let playerHp = user.hp;
  let opponentHp = opponentUser?.hp ?? 0;

  if (result.winner === 'player' && opponentUser) {
    const damage = calculateDamage(result.survivorsPlayerIds, unitsById);
    opponentHp = Math.max(0, opponentUser.hp - damage);
    opponentUser.hp = opponentHp;
  } else if (result.winner === 'enemy') {
    const damage = calculateDamage(result.survivorsEnemyIds, unitsById);
    playerHp = Math.max(0, user.hp - damage);
    user.hp = playerHp;
  }

  const payload = {
    opponent: opponentName,
    result: result.winner,
    survivorsPlayer: result.survivorsPlayer,
    survivorsEnemy: result.survivorsEnemy,
    log: result.log,
    playerHp,
    opponentHp,
  };

  const userSocket = socketByUser.get(user.id);
  const oppSocket = opponentUser ? socketByUser.get(opponentUser.id) : undefined;
  userSocket?.emit('round_start', { mode: 'pvp', opponent: opponentName });
  oppSocket?.emit('round_start', { mode: 'pvp', opponent: user.username });
  userSocket?.emit('round_result', payload);
  oppSocket?.emit('round_result', {
    ...payload,
    opponent: user.username,
    result: result.winner === 'player' ? 'enemy' : result.winner === 'enemy' ? 'player' : 'draw',
  });
  userSocket?.emit('player_hp_update', { hp: playerHp });
  oppSocket?.emit('player_hp_update', { hp: opponentHp });

  res.json(payload);
});

app.get('/api/shop', authMiddleware, (req: AuthedRequest, res) => {
  const user = req.user as AuthUser;
  const state = getPlayerState(user);
  res.json({ shop: state.shop.map(serializeUnit), coins: state.coins, level: state.level, shopVersion: state.shopVersion, pveWave: state.pveWave });
});

app.post('/api/shop/reroll', authMiddleware, (req: AuthedRequest, res) => {
  const user = req.user as AuthUser;
  const state = getPlayerState(user);
  try {
    rerollShop(state);
    emitShopUpdate(user.id, state);
    res.json({ shop: state.shop.map(serializeUnit), coins: state.coins, shopVersion: state.shopVersion, cost: REROLL_COST });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Unable to reroll' });
  }
});

app.post('/api/shop/buy', authMiddleware, (req: AuthedRequest, res) => {
  const user = req.user as AuthUser;
  const state = getPlayerState(user);
  const unitId = String(req.body?.unitId || '');
  if (!unitId) {
    return res.status(400).json({ error: 'unitId is required' });
  }
  try {
    const { bought, cost } = buyUnit(state, unitId);
    emitShopUpdate(user.id, state);
    res.json({
      bought,
      cost,
      coins: state.coins,
      shop: state.shop.map(serializeUnit),
      bench: state.bench,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Unable to buy unit' });
  }
});

app.post('/api/shop/sell', authMiddleware, (req: AuthedRequest, res) => {
  const user = req.user as AuthUser;
  const state = getPlayerState(user);
  const instanceId = String(req.body?.instanceId || '');
  if (!instanceId) {
    return res.status(400).json({ error: 'instanceId is required' });
  }
  try {
    const { refund } = sellUnit(state, instanceId);
    emitShopUpdate(user.id, state);
    res.json({
      refund,
      coins: state.coins,
      bench: state.bench,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Unable to sell unit' });
  }
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token || typeof token !== 'string') {
    return next(new Error('Missing auth token'));
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (typeof decoded !== 'object' || decoded === null || !('sub' in decoded) || !('username' in decoded)) {
      return next(new Error('Invalid auth token'));
    }
    const payload = decoded as jwt.JwtPayload & AuthPayload;
    const user = users.get(payload.sub) || createUser(payload.username);
    (socket.data as { user: AuthUser }).user = user;
    return next();
  } catch (err) {
    return next(new Error('Invalid auth token'));
  }
});

io.on('connection', (socket) => {
  const user = (socket.data as { user?: AuthUser }).user;
  if (!user) {
    socket.disconnect(true);
    return;
  }

  const existingSocket = socketByUser.get(user.id);
  if (existingSocket && existingSocket.id !== socket.id) {
    existingSocket.disconnect();
  }
  socketByUser.set(user.id, socket);

  socket.on('join_queue', (payload?: { allowBot?: boolean }, callback?: (data: any) => void) => {
    if (waitingQueue.includes(user.id)) {
      callback?.({ status: 'queued', position: waitingQueue.indexOf(user.id) + 1 });
      return;
    }
    waitingQueue.push(user.id);
    if (payload?.allowBot) {
      scheduleBotMatch(user.id);
    }
    pairPlayersIfReady();
    callback?.({ status: 'queued', position: waitingQueue.length });
  });

  socket.on('leave_queue', (callback?: (data: any) => void) => {
    removeFromQueue(user.id);
    callback?.({ status: 'left' });
  });

  socket.on('set_formation', (payload: { slots: { index: number; instanceId: string }[] }, callback?: (data: any) => void) => {
    const bench = getPlayerState(user).bench;
    try {
      const formation = buildFormationState(payload, bench, unitsById);
      formationByUser.set(user.id, formation);
      emitFormationUpdate(user.id, formation);
      callback?.({ status: 'ok', formation: serializeFormation(formation) });
    } catch (err: any) {
      callback?.({ status: 'error', error: err.message ?? 'Invalid formation' });
    }
  });

  socket.on('lock_formation', (callback?: (data: any) => void) => {
    const formation = formationByUser.get(user.id);
    if (!formation) {
      callback?.({ status: 'error', error: 'No formation set' });
      return;
    }
    const locked = lockFormation(formation);
    formationByUser.set(user.id, locked);
    emitFormationUpdate(user.id, locked);
    callback?.({ status: 'ok', formation: serializeFormation(locked) });
  });

  socket.on('disconnect', () => {
    removeFromQueue(user.id);
    socketByUser.delete(user.id);
  });
});

let started = false;

function startServer(port = PORT, host = '0.0.0.0'): Promise<number> {
  return new Promise((resolve) => {
    if (started) {
      const addr = httpServer.address();
      if (addr && typeof addr === 'object') {
        resolve(addr.port);
        return;
      }
    }
    httpServer.listen(port, host, () => {
      started = true;
      const addr = httpServer.address();
      const resolvedPort = addr && typeof addr === 'object' ? addr.port : port;
      console.log(`Server listening on port ${resolvedPort}`);
      resolve(resolvedPort);
    });
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    io.close();
    httpServer.close(() => {
      started = false;
      resolve();
    });
  });
}

if (process.env.NODE_ENV !== 'test') {
  void startServer();
}

export { app, httpServer, io, startServer, stopServer, getOrCreateUser, issueToken, authMiddleware };
