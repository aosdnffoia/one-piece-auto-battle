import { randomUUID } from 'crypto';
import { PveUnit } from '../gameData/pve';
import { UnitDefinition } from '../gameData/types';

export type CombatUnit = {
  id: string;
  name: string;
  power: number;
  health: number;
  role: string;
};

type Team = {
  id: string;
  name: string;
  units: CombatUnit[];
};

export type BattleLogEntry = {
  tick: number;
  actions: { attacker: string; target: string; damage: number; targetRemaining: number }[];
};

export type BattleResult = {
  winner: 'player' | 'enemy' | 'draw';
  ticks: number;
  survivorsPlayer: number;
  survivorsEnemy: number;
  log: BattleLogEntry[];
};

function cloneUnits(units: CombatUnit[]) {
  return units.map((u) => ({ ...u }));
}

function chooseTarget(units: CombatUnit[]): CombatUnit | undefined {
  return units.find((u) => u.health > 0);
}

export function simulateBattle(playerTeam: CombatUnit[], enemyTeam: CombatUnit[]): BattleResult {
  let tick = 0;
  const log: BattleLogEntry[] = [];
  const player = cloneUnits(playerTeam);
  const enemy = cloneUnits(enemyTeam);

  while (player.some((u) => u.health > 0) && enemy.some((u) => u.health > 0) && tick < 30) {
    tick += 1;
    const actions: BattleLogEntry['actions'] = [];

    for (const attacker of player) {
      if (attacker.health <= 0) continue;
      const target = chooseTarget(enemy);
      if (!target) break;
      target.health -= attacker.power;
      actions.push({
        attacker: attacker.name,
        target: target.name,
        damage: attacker.power,
        targetRemaining: Math.max(0, target.health),
      });
    }

    for (const attacker of enemy) {
      if (attacker.health <= 0) continue;
      const target = chooseTarget(player);
      if (!target) break;
      target.health -= attacker.power;
      actions.push({
        attacker: attacker.name,
        target: target.name,
        damage: attacker.power,
        targetRemaining: Math.max(0, target.health),
      });
    }

    log.push({ tick, actions });
  }

  const survivorsPlayer = player.filter((u) => u.health > 0).length;
  const survivorsEnemy = enemy.filter((u) => u.health > 0).length;

  let winner: BattleResult['winner'] = 'draw';
  if (survivorsPlayer > 0 && survivorsEnemy === 0) winner = 'player';
  else if (survivorsEnemy > 0 && survivorsPlayer === 0) winner = 'enemy';

  return { winner, ticks: tick, survivorsPlayer, survivorsEnemy, log };
}

export function mapFormationToCombat(formation: { slots: { instanceId: string; unitId?: string }[] }, unitLookup: Map<string, UnitDefinition>): CombatUnit[] {
  const result: CombatUnit[] = [];
  for (const slot of formation.slots) {
    if (!slot.unitId) continue;
    const def = unitLookup.get(slot.unitId);
    if (!def) continue;
    result.push({
      id: slot.instanceId,
      name: def.name,
      power: def.power,
      health: def.health,
      role: def.role,
    });
  }
  return result;
}

export function mapPveUnits(units: PveUnit[]): CombatUnit[] {
  return units.map((u) => ({
    id: randomUUID(),
    name: u.name,
    power: u.power,
    health: u.health,
    role: u.role,
  }));
}
