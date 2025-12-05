import { computeSynergies, UnitDefinition } from '../gameData';
import { BenchUnit } from '../shop/types';
import { FormationPayload, FormationSlot, FormationState, ResolvedUnit } from './types';

const FORMATION_SIZE = 7;

export function validateFormation(payload: FormationPayload): { valid: boolean; error?: string } {
  if (!Array.isArray(payload.slots)) return { valid: false, error: 'slots must be an array' };
  const seen = new Set<number>();
  for (const slot of payload.slots) {
    if (typeof slot.index !== 'number' || slot.index < 0 || slot.index >= FORMATION_SIZE) {
      return { valid: false, error: 'slot index out of bounds' };
    }
    if (!slot.instanceId || typeof slot.instanceId !== 'string') {
      return { valid: false, error: 'instanceId is required' };
    }
    if (seen.has(slot.index)) {
      return { valid: false, error: 'duplicate slot index' };
    }
    seen.add(slot.index);
  }
  return { valid: true };
}

export function resolveFormationUnits(
  payload: FormationPayload,
  bench: BenchUnit[],
  unitsById: Map<string, UnitDefinition>,
): ResolvedUnit[] {
  const benchMap = new Map<string, BenchUnit>(bench.map((b) => [b.instanceId, b]));
  const resolved: ResolvedUnit[] = [];
  for (const slot of payload.slots) {
    const benchUnit = benchMap.get(slot.instanceId);
    if (!benchUnit) {
      throw new Error(`bench unit not found: ${slot.instanceId}`);
    }
    const unitDef = unitsById.get(benchUnit.unitId);
    if (!unitDef) {
      throw new Error(`unit definition missing for ${benchUnit.unitId}`);
    }
    resolved.push({ slotIndex: slot.index, unit: unitDef, benchUnit });
  }
  return resolved;
}

export function buildFormationState(
  payload: FormationPayload,
  bench: BenchUnit[],
  unitsById: Map<string, UnitDefinition>,
): FormationState {
  const validation = validateFormation(payload);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid formation');
  }

  const resolved = resolveFormationUnits(payload, bench, unitsById);
  const unitDefs = resolved.map((r) => r.unit);
  const synergies = computeSynergies(unitDefs);

  const slots: FormationSlot[] = resolved.map((r) => ({
    index: r.slotIndex,
    instanceId: r.benchUnit.instanceId,
    unitId: r.benchUnit.unitId,
  }));

  return {
    slots,
    locked: false,
    synergySummary: {
      faction: synergies.factionActivations.map((s) => s.name),
      role: synergies.roleActivations.map((s) => s.name),
    },
  };
}

export function lockFormation(state: FormationState): FormationState {
  return { ...state, locked: true };
}

export function serializeFormation(state: FormationState) {
  return {
    slots: state.slots,
    locked: state.locked,
    synergySummary: state.synergySummary,
  };
}
