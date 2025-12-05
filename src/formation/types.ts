import { UnitDefinition } from '../gameData';
import { BenchUnit } from '../shop/types';

export type FormationSlot = {
  index: number; // 0-6 for 1x7 row
  instanceId: string; // reference to BenchUnit.instanceId
  unitId: string; // helpful for client render/cache
};

export type FormationState = {
  slots: FormationSlot[]; // positions that are occupied
  locked: boolean;
  synergySummary?: {
    faction: string[];
    role: string[];
  };
};

export type FormationPayload = {
  slots: { index: number; instanceId: string }[];
};

export type ResolvedUnit = {
  slotIndex: number;
  unit: UnitDefinition;
  benchUnit: BenchUnit;
};
