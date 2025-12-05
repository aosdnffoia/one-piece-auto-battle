import { describe, expect, test } from 'vitest';
import { units } from '../gameData';
import { buildFormationState, lockFormation, validateFormation } from './validation';

describe('formation validation', () => {
  test('rejects duplicate slots and out of bounds', () => {
    const result1 = validateFormation({ slots: [{ index: -1, instanceId: 'a' }] });
    expect(result1.valid).toBe(false);
    const result2 = validateFormation({ slots: [{ index: 1, instanceId: 'a' }, { index: 1, instanceId: 'b' }] });
    expect(result2.valid).toBe(false);
  });
});

describe('formation build', () => {
  const bench = [
    { instanceId: 'i1', unitId: units[0].id },
    { instanceId: 'i2', unitId: units[1].id },
    { instanceId: 'i3', unitId: units[2].id },
  ];
  const unitsMap = new Map(units.map((u) => [u.id, u]));

  test('builds state with synergies', () => {
    const state = buildFormationState(
      {
        slots: [
          { index: 0, instanceId: 'i1' },
          { index: 1, instanceId: 'i2' },
        ],
      },
      bench,
      unitsMap,
    );
    expect(state.slots.length).toBe(2);
    expect(state.locked).toBe(false);
    expect(state.synergySummary?.faction.length).toBeGreaterThanOrEqual(1);
  });

  test('locking sets locked flag', () => {
    const state = buildFormationState(
      {
        slots: [{ index: 0, instanceId: 'i1' }],
      },
      bench,
      unitsMap,
    );
    const locked = lockFormation(state);
    expect(locked.locked).toBe(true);
  });
});
