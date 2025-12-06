import { useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

type Unit = {
  id: string;
  name: string;
  faction: string;
  role: string;
  tier: number;
  power: number;
  health: number;
  abilityType: string;
  abilityValue: number;
  abilityDescription: string;
  image?: string;
};

type BenchUnit = { instanceId: string; unitId: string };
type FormationSlot = { index: number; instanceId: string };
type FormationState = {
  slots: FormationSlot[];
  locked: boolean;
  synergySummary?: { faction: string[]; role: string[] };
};

type PveWave = {
  id: string;
  name: string;
  rewardCoins: number;
  rewardXp: number;
  units: { id: string; name: string; power: number; health: number; role: string }[];
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

function App() {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const [units, setUnits] = useState<Unit[]>([]);
  const unitsById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const [shop, setShop] = useState<Unit[]>([]);
  const [bench, setBench] = useState<BenchUnit[]>([]);
  const [formation, setFormation] = useState<FormationState>({ slots: [], locked: false });
  const [formationDraft, setFormationDraft] = useState<FormationSlot[]>([]);
  const [coins, setCoins] = useState(0);
  const [level, setLevel] = useState(1);
  const [pveWave, setPveWave] = useState(1);
  const [waves, setWaves] = useState<PveWave[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [queueStatus, setQueueStatus] = useState<string>('not queued');
  const [selectedBenchId, setSelectedBenchId] = useState<string | null>(null);

  const appendLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 80));
  };

  async function api<T = any>(path: string, options: any = {}) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
      body:
        options.body && !(options.body instanceof FormData)
          ? typeof options.body === 'string'
            ? options.body
            : JSON.stringify(options.body)
          : options.body,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  useEffect(() => {
    // load unit definitions once
    api<{ units: Unit[] }>('/api/units')
      .then((data) => setUnits(data.units))
      .catch((err) => appendLog(`Failed to load units: ${err.message}`));
    api<{ waves: PveWave[] }>('/api/pve/waves')
      .then((data) => setWaves(data.waves))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    const s = io(API_BASE, { auth: { token } });
    setSocket(s);
    s.on('connect', () => appendLog('Socket connected'));
    s.on('shop_update', (data: any) => {
      setShop(data.shop);
      setBench(data.bench);
      setCoins(data.coins);
      setLevel(data.level);
      appendLog('Shop updated');
    });
    s.on('formation_update', (data: any) => {
      setFormation(data.formation);
      setFormationDraft(data.formation.slots);
      appendLog('Formation updated');
    });
    s.on('synergy_update', (data: any) => {
      setFormation(data.formation);
      setFormationDraft(data.formation.slots);
    });
    s.on('match_found', (data: any) => {
      appendLog(`Match found vs ${data.opponent.username} ${data.isBot ? '(bot)' : ''}`);
    });
    s.on('round_start', (data: any) => {
      appendLog(`Round start: ${data.mode}`);
    });
    s.on('round_result', (data: any) => {
      appendLog(`Round result: ${data.result} (wave ${data.wave || ''})`);
    });
    return () => {
      s.disconnect();
    };
  }, [token]);

  async function handleLogin() {
    if (!username.trim()) {
      alert('Enter a username');
      return;
    }
    try {
      const data = await api<{ token: string; user: any; state: any }>('/api/login', {
        method: 'POST',
        body: { username },
      });
      setToken(data.token);
      setCoins(data.state.coins);
      setBench(data.state.bench || []);
      appendLog(`Logged in as ${data.user.username}`);
      await Promise.all([loadShop(data.token || token), loadFormation(data.token || token)]);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function loadShop(authToken?: string | null) {
    try {
      const res = await api<{ shop: Unit[]; coins: number; level: number; shopVersion: number; pveWave?: number }>('/api/shop', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      setShop(res.shop);
      setCoins(res.coins);
      setLevel(res.level);
      if (res.pveWave) setPveWave(res.pveWave);
    } catch (err: any) {
      appendLog(`Load shop failed: ${err.message}`);
    }
  }

  async function loadFormation(authToken?: string | null) {
    try {
      const res = await api<{ formation: FormationState }>('/api/formation', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      setFormation(res.formation);
      setFormationDraft(res.formation.slots || []);
    } catch (err: any) {
      appendLog(`Load formation failed: ${err.message}`);
    }
  }

  async function handleReroll() {
    try {
      await api('/api/shop/reroll', { method: 'POST' });
      appendLog('Rerolled shop (-2 coins)');
      await loadShop();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleBuy(unitId: string) {
    try {
      const res = await api<{ bench: BenchUnit[]; coins: number; shop: Unit[] }>('/api/shop/buy', {
        method: 'POST',
        body: { unitId },
      });
      setBench(res.bench);
      setCoins(res.coins);
      setShop(res.shop);
      appendLog(`Bought unit ${unitId}`);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleSell(instanceId: string) {
    try {
      const res = await api<{ bench: BenchUnit[]; coins: number }>('/api/shop/sell', {
        method: 'POST',
        body: { instanceId },
      });
      setBench(res.bench);
      setCoins(res.coins);
      // remove from draft if sold
      setFormationDraft((prev) => prev.filter((s) => s.instanceId !== instanceId));
      appendLog(`Sold ${instanceId}`);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function saveFormation() {
    try {
      const res = await api<{ formation: FormationState }>('/api/formation', {
        method: 'POST',
        body: { slots: formationDraft },
      });
      setFormation(res.formation);
      setFormationDraft(res.formation.slots);
      appendLog('Formation saved');
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function lockFormation() {
    try {
      const res = await api<{ formation: FormationState }>('/api/formation/lock', { method: 'POST' });
      setFormation(res.formation);
      setFormationDraft(res.formation.slots);
      appendLog('Formation locked');
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function startPve() {
    try {
      const res = await api<any>('/api/pve/start', { method: 'POST' });
      appendLog(`PVE ${res.wave} ${res.result}: +${res.coinsEarned}c +${res.xpEarned}xp`);
      setPveWave(res.nextWave);
      await loadShop();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function startPvp() {
    try {
      const res = await api<any>('/api/pvp/start', { method: 'POST' });
      appendLog(`PVP vs ${res.opponent}: ${res.result}, HP: you ${res.playerHp} opp ${res.opponentHp}`);
    } catch (err: any) {
      alert(err.message);
    }
  }

  function benchName(b: BenchUnit) {
    return unitsById.get(b.unitId)?.name || b.unitId;
  }

  function unitImage(u: Unit) {
    if (!u.image) return '';
    if (u.image.startsWith('http')) return u.image;
    return `${API_BASE}${u.image.startsWith('/') ? u.image : '/' + u.image}`;
  }

  function handleSlotClick(index: number) {
    if (!selectedBenchId) {
      alert('Select a bench unit to place');
      return;
    }
    const filtered = formationDraft.filter((s) => s.index !== index && s.instanceId !== selectedBenchId);
    setFormationDraft([...filtered, { index, instanceId: selectedBenchId }]);
  }

  function clearSlot(index: number) {
    setFormationDraft((prev) => prev.filter((s) => s.index !== index));
  }

  function joinQueue() {
    if (!socket) return alert('Login first');
    socket.emit('join_queue', { allowBot: true }, (ack: any) => {
      setQueueStatus(ack?.status || 'queued');
      appendLog(`Queue: ${JSON.stringify(ack)}`);
    });
  }

  function leaveQueue() {
    socket?.emit('leave_queue', (ack: any) => {
      setQueueStatus('not queued');
      appendLog(`Left queue: ${JSON.stringify(ack)}`);
    });
  }

  const synergyText = formation.synergySummary
    ? `Factions: ${formation.synergySummary.faction.join(', ') || 'none'} | Roles: ${formation.synergySummary.role.join(', ') || 'none'}`
    : 'No synergies yet';

  const draftSlots = useMemo(() => {
    const validBenchIds = new Set(bench.map((b) => b.instanceId));
    return formationDraft.filter((s) => validBenchIds.has(s.instanceId));
  }, [bench, formationDraft]);

  useEffect(() => {
    // sync draft if bench changed (e.g., after sell)
    const valid = new Set(bench.map((b) => b.instanceId));
    setFormationDraft((prev) => prev.filter((s) => valid.has(s.instanceId)));
  }, [bench]);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <div className="pill">One Piece TFT</div>
          <div className="muted">Phase 1-4 prototype</div>
        </div>
        <div className="controls">
          <input
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input"
          />
          <button onClick={handleLogin} className="btn primary">
            Login
          </button>
          <button onClick={joinQueue} className="btn">
            Join Queue
          </button>
          <button onClick={leaveQueue} className="btn ghost">
            Leave Queue
          </button>
        </div>
        <div className="status">
          <div>Coins: {coins}</div>
          <div>Level: {level}</div>
          <div>Queue: {queueStatus}</div>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Shop</h2>
            <button onClick={handleReroll} className="btn small">
              Reroll (-2)
            </button>
          </div>
          <div className="shop-grid">
            {shop.map((u) => (
              <div key={u.id} className="card">
                <div className="card-head">
                  <div>
                    <div className="title">{u.name}</div>
                    <div className="muted">
                      {u.faction} · {u.role}
                    </div>
                  </div>
                  <div className="badge tier">Tier {u.tier}</div>
                </div>
                {unitImage(u) && <img className="portrait" src={unitImage(u)} alt={u.name} onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                <div className="stats">
                  <span>Power {u.power}</span>
                  <span>HP {u.health}</span>
                </div>
                <div className="ability">{u.abilityDescription}</div>
                <button className="btn full" onClick={() => handleBuy(u.id)}>
                  Buy ({u.tier}g)
                </button>
              </div>
            ))}
            {!shop.length && <div className="muted">No shop loaded</div>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Bench</h2>
            <div className="muted">Select a unit then click a formation slot.</div>
          </div>
          <div className="bench">
            {bench.map((b) => (
              <div
                key={b.instanceId}
                className={`chip ${selectedBenchId === b.instanceId ? 'active' : ''}`}
                onClick={() => setSelectedBenchId(b.instanceId)}
              >
                <div>{benchName(b)}</div>
                <div className="muted">{b.instanceId.slice(0, 6)}</div>
                <button className="btn tiny ghost" onClick={(e) => { e.stopPropagation(); handleSell(b.instanceId); }}>
                  Sell
                </button>
              </div>
            ))}
            {!bench.length && <div className="muted">Empty bench</div>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Formation (1x7)</h2>
            <div className="actions">
              <button className="btn small" onClick={saveFormation}>
                Save
              </button>
              <button className="btn small ghost" onClick={lockFormation}>
                Lock
              </button>
            </div>
          </div>
          <div className="muted">{synergyText}</div>
          <div className="formation">
            {Array.from({ length: 7 }).map((_, idx) => {
              const slot = draftSlots.find((s) => s.index === idx);
              const benchUnit = slot && bench.find((b) => b.instanceId === slot.instanceId);
              return (
                <div key={idx} className="slot" onClick={() => handleSlotClick(idx)} onContextMenu={(e) => { e.preventDefault(); clearSlot(idx); }}>
                  <div className="muted">Slot {idx + 1}</div>
                  {benchUnit ? (
                    <>
                      <div className="title">{benchName(benchUnit)}</div>
                      <div className="muted">{benchUnit.instanceId.slice(0, 6)}</div>
                    </>
                  ) : (
                    <div className="muted">Empty</div>
                  )}
                </div>
              );
            })}
          </div>
          {formation.locked && <div className="notice">Formation locked</div>}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>PVE Waves</h2>
            <button className="btn small primary" onClick={startPve}>
              Start Wave {pveWave}
            </button>
            <button className="btn small ghost" onClick={startPvp}>
              Quick PVP (bot)
            </button>
          </div>
          <div className="muted">Current wave: {pveWave}</div>
          <div className="bench">
            {waves.map((w) => (
              <div key={w.id} className={`chip ${w.id === `wave${pveWave}` ? 'active' : ''}`}>
                <div className="title">{w.name}</div>
                <div className="muted">Rewards: {w.rewardCoins}c / {w.rewardXp}xp</div>
                <div className="muted">Units: {w.units.map((u) => u.name).join(', ')}</div>
              </div>
            ))}
            {!waves.length && <div className="muted">No waves loaded</div>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Events & Logs</h2>
          </div>
          <div className="log">
            {logs.map((l, idx) => (
              <div key={idx}>{l}</div>
            ))}
            {!logs.length && <div className="muted">No activity yet.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
