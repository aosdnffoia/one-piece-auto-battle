import { TierProbabilities } from './types';

// Probabilities loosely mimic TFT style scaling; values sum to 1 per level.
export const SHOP_PROBABILITIES: Record<number, TierProbabilities> = {
  1: { 1: 0.6, 2: 0.4 },
  2: { 1: 0.5, 2: 0.35, 3: 0.15 },
  3: { 1: 0.5, 2: 0.35, 3: 0.15 },
  4: { 1: 0.35, 2: 0.4, 3: 0.2, 4: 0.05 },
  5: { 1: 0.25, 2: 0.35, 3: 0.25, 4: 0.12, 5: 0.03 },
  6: { 1: 0.2, 2: 0.3, 3: 0.28, 4: 0.17, 5: 0.05 },
  7: { 1: 0.15, 2: 0.25, 3: 0.3, 4: 0.2, 5: 0.1 },
};

export const SHOP_SIZE = 4;
export const LEVEL_CAP = 7;
export const REROLL_COST = 2;
export const TIER_COST: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
};

export function clampLevel(level: number) {
  if (level < 1) return 1;
  if (level > LEVEL_CAP) return LEVEL_CAP;
  return Math.floor(level);
}
