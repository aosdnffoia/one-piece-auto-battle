import { randomUUID } from 'crypto';
import { UnitDefinition } from '../gameData';
import { SHOP_PROBABILITIES, SHOP_SIZE, TIER_COST, REROLL_COST, clampLevel } from './probabilities';
import { BenchUnit, PlayerState, TierProbabilities } from './types';

type RNG = () => number;

const tierBuckets = new Map<number, UnitDefinition[]>();

export function seedTierBuckets(units: UnitDefinition[]) {
  tierBuckets.clear();
  for (const unit of units) {
    const bucket = tierBuckets.get(unit.tier) ?? [];
    bucket.push(unit);
    tierBuckets.set(unit.tier, bucket);
  }
}

function pickTier(level: number, rng: RNG): UnitDefinition['tier'] {
  const probs = SHOP_PROBABILITIES[clampLevel(level)];
  const entries = Object.entries(probs) as [string, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const roll = rng() * total;
  let cumulative = 0;
  for (const [tierStr, weight] of entries) {
    cumulative += weight;
    if (roll <= cumulative) {
      return Number(tierStr) as UnitDefinition['tier'];
    }
  }
  return Number(entries[entries.length - 1][0]) as UnitDefinition['tier'];
}

function pickUnitOfTier(tier: UnitDefinition['tier'], rng: RNG): UnitDefinition {
  const bucket = tierBuckets.get(tier);
  if (!bucket || bucket.length === 0) {
    throw new Error(`No units available for tier ${tier}`);
  }
  const idx = Math.floor(rng() * bucket.length);
  return bucket[idx];
}

export function generateShop(level: number, rng: RNG = Math.random): UnitDefinition[] {
  const shop: UnitDefinition[] = [];
  for (let i = 0; i < SHOP_SIZE; i++) {
    const tier = pickTier(level, rng);
    shop.push(pickUnitOfTier(tier, rng));
  }
  return shop;
}

export function ensurePlayerState(
  existing: PlayerState | undefined,
  opts: { coins?: number; level?: number },
  rng: RNG = Math.random,
): PlayerState {
  if (existing) return existing;
  const level = opts.level ?? 1;
  return {
    level: clampLevel(level),
    xp: 0,
    coins: opts.coins ?? 10,
    bench: [],
    shop: generateShop(level, rng),
    shopVersion: 1,
  };
}

export function rerollShop(state: PlayerState, rng: RNG = Math.random): PlayerState {
  if (state.coins < REROLL_COST) {
    throw new Error('Not enough coins to reroll');
  }
  state.coins -= REROLL_COST;
  state.shop = generateShop(state.level, rng);
  state.shopVersion += 1;
  return state;
}

export function buyUnit(state: PlayerState, unitId: string): { bought: BenchUnit; cost: number } {
  const unit = state.shop.find((u) => u.id === unitId);
  if (!unit) {
    throw new Error('Unit not available in shop');
  }
  const cost = TIER_COST[unit.tier];
  if (state.coins < cost) {
    throw new Error('Not enough coins');
  }
  state.coins -= cost;
  state.shop = state.shop.filter((u) => u.id !== unitId);
  const instance: BenchUnit = { instanceId: randomUUID(), unitId: unit.id };
  state.bench.push(instance);
  return { bought: instance, cost };
}

export function sellUnit(state: PlayerState, instanceId: string): { refund: number } {
  const index = state.bench.findIndex((b) => b.instanceId === instanceId);
  if (index === -1) {
    throw new Error('Unit not found on bench');
  }
  const [benchUnit] = state.bench.splice(index, 1);
  const unit = [...tierBuckets.values()].flat().find((u) => u.id === benchUnit.unitId);
  if (!unit) {
    throw new Error('Unit definition missing');
  }
  const refund = Math.max(1, TIER_COST[unit.tier] - 1);
  state.coins += refund;
  return { refund };
}

export function serializePlayerState(state: PlayerState) {
  return {
    level: state.level,
    xp: state.xp,
    coins: state.coins,
    bench: state.bench,
    shop: state.shop,
    shopVersion: state.shopVersion,
  };
}

export function getProbabilitiesForLevel(level: number): TierProbabilities {
  return SHOP_PROBABILITIES[clampLevel(level)];
}
