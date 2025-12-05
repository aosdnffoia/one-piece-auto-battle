import { beforeAll, describe, expect, test } from 'vitest';
import { units } from '../gameData';
import { SHOP_SIZE, TIER_COST, REROLL_COST, clampLevel } from './probabilities';
import {
  buyUnit,
  ensurePlayerState,
  generateShop,
  getProbabilitiesForLevel,
  rerollShop,
  seedTierBuckets,
  sellUnit,
} from './shopLogic';

const deterministicRng = (() => {
  let seed = 1;
  return () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
})();

beforeAll(() => {
  seedTierBuckets(units);
});

describe('shop generation', () => {
  test('generates shop of configured size', () => {
    const shop = generateShop(1, deterministicRng);
    expect(shop.length).toBe(SHOP_SIZE);
  });

  test('clamps level and uses probabilities', () => {
    const probs = getProbabilitiesForLevel(10);
    expect(probs[5]).toBeGreaterThan(0);
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(99)).toBeGreaterThanOrEqual(7);
  });
});

describe('player economy', () => {
  test('ensures player state with starting coins and shop', () => {
    const state = ensurePlayerState(undefined, { coins: 8, level: 2 }, deterministicRng);
    expect(state.coins).toBe(8);
    expect(state.shop.length).toBe(SHOP_SIZE);
    expect(state.pveWave).toBe(1);
  });

  test('buy and sell flow updates coins and bench', () => {
    const state = ensurePlayerState(undefined, { coins: 10, level: 3 }, deterministicRng);
    const targetId = state.shop[0].id;
    const unitTier = state.shop[0].tier;
    const cost = TIER_COST[unitTier];

    const { bought } = buyUnit(state, targetId);
    expect(state.coins).toBe(10 - cost);
    expect(state.shop.find((u) => u.id === targetId)).toBeUndefined();
    expect(state.bench.find((b) => b.instanceId === bought.instanceId)).toBeDefined();

    const { refund } = sellUnit(state, bought.instanceId);
    expect(refund).toBe(Math.max(1, cost - 1));
    expect(state.bench.find((b) => b.instanceId === bought.instanceId)).toBeUndefined();
    expect(state.coins).toBe(10 - cost + refund);
  });

  test('reroll deducts coins and increments shop version', () => {
    const state = ensurePlayerState(undefined, { coins: 10, level: 3 }, deterministicRng);
    const originalVersion = state.shopVersion;
    rerollShop(state, deterministicRng);
    expect(state.coins).toBe(10 - REROLL_COST);
    expect(state.shopVersion).toBe(originalVersion + 1);
  });
});
