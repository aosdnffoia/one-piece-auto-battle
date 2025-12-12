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
  roundIndex: number;
  roundOrder: ('pve' | 'pvp')[];
  timer?: NodeJS.Timeout;
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
const rateLimitState = new Map<string, { windowStart: number; count: number }>();

seedTierBuckets(units);

const DEFAULT_ROUND_ORDER: ('pve' | 'pvp')[] = ['pve', 'pve', 'pvp', 'pve', 'pvp', 'pvp', 'pvp'];
const ROUND_INTERVAL_MS = 4000;
const RATE_LIMIT_WINDOW_MS = 2000;
const RATE_LIMIT_MAX = 8;

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

function rateLimit(userId: string, key: string, max = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW_MS): boolean {
  const composite = `${userId}:${key}`;
  const now = Date.now();
  const entry = rateLimitState.get(composite);
  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitState.set(composite, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= max) {
    return false;
  }
  entry.count += 1;
  rateLimitState.set(composite, entry);
  return true;
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
  const match: Match = { id: roomId, players: [userId, 'bot'], createdAt: Date.now(), roundIndex: 0, roundOrder: DEFAULT_ROUND_ORDER };
  activeMatches.set(roomId, match);
  socket.join(roomId);
  socket.emit('match_found', {
    roomId,
    opponent: { id: 'bot', username: 'Training Dummy' },
    isBot: true,
  });
  scheduleNextRound(roomId);
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
    const match: Match = { id: roomId, players: [first, second], createdAt: Date.now(), roundIndex: 0, roundOrder: DEFAULT_ROUND_ORDER };
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

    scheduleNextRound(roomId);
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
  if (!rateLimit(user.id, 'set_formation')) {
    return res.status(429).json({ error: 'Too many formation updates' });
  }
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
  if (!rateLimit(user.id, 'lock_formation', 4, 4000)) {
    return res.status(429).json({ error: 'Too many lock attempts' });
  }
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
  if (!rateLimit(user.id, 'pve_start', 3, 5000)) {
    return res.status(429).json({ error: 'Too many PVE starts' });
  }
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

function calculateDamageFromCount(survivors: number) {
  return survivors * 2;
}

app.post('/api/pvp/start', authMiddleware, (req: AuthedRequest, res) => {
  const user = req.user as AuthUser;
  if (!rateLimit(user.id, 'pvp_start', 3, 5000)) {
    return res.status(429).json({ error: 'Too many PVP starts' });
  }
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
    const damage = calculateDamageFromCount(result.survivorsPlayer);
    opponentHp = Math.max(0, opponentUser.hp - damage);
    opponentUser.hp = opponentHp;
  } else if (result.winner === 'enemy') {
    const damage = calculateDamageFromCount(result.survivorsEnemy);
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
  if (!rateLimit(user.id, 'shop_reroll')) {
    return res.status(429).json({ error: 'Too many rerolls, slow down' });
  }
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
  if (!rateLimit(user.id, 'shop_buy')) {
    return res.status(429).json({ error: 'Too many buy attempts' });
  }
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
  if (!rateLimit(user.id, 'shop_sell')) {
    return res.status(429).json({ error: 'Too many sell attempts' });
  }
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
    if (!rateLimit(user.id, 'join_queue')) {
      callback?.({ status: 'error', error: 'Too many queue attempts' });
      return;
    }
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
    if (!rateLimit(user.id, 'set_formation')) {
      callback?.({ status: 'error', error: 'Too many formation updates' });
      return;
    }
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
    if (!rateLimit(user.id, 'lock_formation', 4, 4000)) {
      callback?.({ status: 'error', error: 'Too many lock attempts' });
      return;
    }
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

function endMatch(matchId: string) {
  const match = activeMatches.get(matchId);
  if (!match) return;
  const alive = match.players.filter((id) => (users.get(id)?.hp ?? 0) > 0);
  const winnerId = alive[0];
  const winnerName = winnerId ? users.get(winnerId)?.username ?? 'Winner' : 'Draw';
  for (const userId of match.players) {
    const socket = socketByUser.get(userId);
    socket?.emit('match_end', { winner: winnerName });
  }
  if (match.timer) {
    clearTimeout(match.timer);
  }
  activeMatches.delete(matchId);
}

function scheduleNextRound(matchId: string) {
  const match = activeMatches.get(matchId);
  if (!match) return;
  if (match.timer) clearTimeout(match.timer);
  match.timer = setTimeout(() => runRound(matchId), ROUND_INTERVAL_MS);
  activeMatches.set(matchId, match);
}

function runRound(matchId: string) {
  const match = activeMatches.get(matchId);
  if (!match) return;
  const alivePlayers = match.players.filter((id) => (users.get(id)?.hp ?? 0) > 0);
  if (alivePlayers.length <= 1) {
    endMatch(matchId);
    return;
  }
  const mode = match.roundIndex < match.roundOrder.length ? match.roundOrder[match.roundIndex] : 'pvp';
  if (mode === 'pve') {
    runPveRound(matchId, match.roundIndex + 1);
  } else {
    runPvpRound(matchId);
  }
  match.roundIndex += 1;
  activeMatches.set(matchId, match);
  scheduleNextRound(matchId);
}

function runPveRound(matchId: string, roundNumber: number) {
  const match = activeMatches.get(matchId);
  if (!match) return;
  const wave = getWaveByIndex(Math.min(roundNumber, pveWaves.length)) ?? pveWaves[pveWaves.length - 1];
  for (const playerId of match.players) {
    const user = users.get(playerId);
    if (!user || user.hp <= 0) continue;
    const formation = formationByUser.get(playerId);
    const playerUnits = mapFormationToCombat(
      { slots: (formation?.slots ?? []).map((s) => ({ instanceId: s.instanceId, unitId: s.unitId })) },
      unitsById,
    );
    const enemyUnits = mapPveUnits(wave.units);
    const result = simulateBattle(playerUnits, enemyUnits);

    let coinsEarned = 0;
    let xpEarned = 0;
    const state = getPlayerState(user);
    if (result.winner === 'player') {
      coinsEarned = wave.rewardCoins;
      xpEarned = wave.rewardXp;
      state.coins += coinsEarned;
      state.xp += xpEarned;
      state.pveWave = Math.max(state.pveWave, roundNumber + 1);
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
      round: roundNumber,
    };
    const socket = socketByUser.get(user.id);
    socket?.emit('round_start', { mode: 'pve', wave: wave.id, round: roundNumber });
    socket?.emit('round_result', payload);
  }
}

function runPvpRound(matchId: string) {
  const match = activeMatches.get(matchId);
  if (!match) return;
  const alivePlayers = match.players.filter((id) => (users.get(id)?.hp ?? 0) > 0);
  if (alivePlayers.length <= 1) {
    endMatch(matchId);
    return;
  }
  const playerAId = alivePlayers[0];
  const playerBId = alivePlayers[1] ?? alivePlayers[0];

  const userA = users.get(playerAId);
  const userB = users.get(playerBId);
  if (!userA || !userB) return;

  const formationA = formationByUser.get(playerAId);
  const formationB = formationByUser.get(playerBId);
  const unitsA = mapFormationToCombat(
    { slots: (formationA?.slots ?? []).map((s) => ({ instanceId: s.instanceId, unitId: s.unitId })) },
    unitsById,
  );
  const unitsB = mapFormationToCombat(
    { slots: (formationB?.slots ?? []).map((s) => ({ instanceId: s.instanceId, unitId: s.unitId })) },
    unitsById,
  );

  const result = simulateBattle(unitsA, unitsB);
  let winner: 'playerA' | 'playerB' | 'draw' = 'draw';
  if (result.winner === 'player') winner = 'playerA';
  else if (result.winner === 'enemy') winner = 'playerB';

  if (winner === 'playerA') {
    const damage = calculateDamageFromCount(result.survivorsPlayer);
    userB.hp = Math.max(0, userB.hp - damage);
  } else if (winner === 'playerB') {
    const damage = calculateDamageFromCount(result.survivorsEnemy);
    userA.hp = Math.max(0, userA.hp - damage);
  }

  const socketA = socketByUser.get(playerAId);
  const socketB = socketByUser.get(playerBId);

  socketA?.emit('round_start', { mode: 'pvp', opponent: userB.username });
  socketB?.emit('round_start', { mode: 'pvp', opponent: userA.username });

  socketA?.emit('round_result', {
    opponent: userB.username,
    result: winner === 'playerA' ? 'player' : winner === 'playerB' ? 'enemy' : 'draw',
    survivorsPlayer: result.survivorsPlayer,
    survivorsEnemy: result.survivorsEnemy,
    log: result.log,
    playerHp: userA.hp,
    opponentHp: userB.hp,
  });

  socketB?.emit('round_result', {
    opponent: userA.username,
    result: winner === 'playerB' ? 'player' : winner === 'playerA' ? 'enemy' : 'draw',
    survivorsPlayer: result.survivorsEnemy,
    survivorsEnemy: result.survivorsPlayer,
    log: result.log,
    playerHp: userB.hp,
    opponentHp: userA.hp,
  });

  socketA?.emit('player_hp_update', { hp: userA.hp });
  socketB?.emit('player_hp_update', { hp: userB.hp });

  if (userA.hp <= 0 || userB.hp <= 0) {
    endMatch(matchId);
  }
}

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
