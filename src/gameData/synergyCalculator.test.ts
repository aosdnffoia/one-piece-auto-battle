import { describe, expect, test } from 'vitest';
import { computeSynergies } from './synergyCalculator';
import { factionSynergies, roleSynergies, units } from './index';

describe('unit seeds', () => {
  test('has at least 40 unique units', () => {
    expect(units.length).toBeGreaterThanOrEqual(40);
    const ids = new Set(units.map((u) => u.id));
    expect(ids.size).toBe(units.length);
  });
});

describe('synergy configs', () => {
  test('faction and role synergies exist', () => {
    expect(factionSynergies.length).toBeGreaterThanOrEqual(5);
    expect(roleSynergies.length).toBeGreaterThanOrEqual(3);
  });
});

describe('computeSynergies', () => {
  test('activates faction thresholds when counts match', () => {
    const strawHats = units.filter((u) => u.faction === 'straw_hat').slice(0, 4);
    const result = computeSynergies(strawHats);
    const strawHatSynergy = result.factionActivations.find((s) => s.key === 'straw_hat');
    expect(strawHatSynergy).toBeDefined();
    expect(strawHatSynergy?.count).toBe(4);
    // Should activate 2 and 4 thresholds
    expect(strawHatSynergy?.activeThresholds.map((t) => t.count)).toContain(2);
    expect(strawHatSynergy?.activeThresholds.map((t) => t.count)).toContain(4);
  });

  test('activates role thresholds for attackers', () => {
    const attackers = units.filter((u) => u.role === 'attacker').slice(0, 4);
    const result = computeSynergies(attackers);
    const attackerSynergy = result.roleActivations.find((s) => s.key === 'attacker');
    expect(attackerSynergy).toBeDefined();
    expect(attackerSynergy?.activeThresholds.map((t) => t.count)).toContain(2);
    expect(attackerSynergy?.activeThresholds.map((t) => t.count)).toContain(4);
  });

  test('returns empty activations when counts are below thresholds', () => {
    const soloUnit = [units[0]];
    const result = computeSynergies(soloUnit);
    expect(result.factionActivations.length).toBe(0);
    expect(result.roleActivations.length).toBe(0);
  });
});
