import { UnitDefinition } from '../gameData';

export type BenchUnit = {
  instanceId: string;
  unitId: string;
};

export type PlayerState = {
  level: number;
  xp: number;
  coins: number;
  shop: UnitDefinition[];
  bench: BenchUnit[];
  shopVersion: number;
};

export type TierProbabilities = {
  [tier in UnitDefinition['tier']]?: number;
};
