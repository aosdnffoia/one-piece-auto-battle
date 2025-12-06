import { describe, expect, test } from 'vitest';
import { mapPveUnits, simulateBattle } from './simulator';

describe('simulateBattle', () => {
  test('player wins when stronger', () => {
    const player = [
      { id: 'a', name: 'A', power: 50, health: 200, role: 'attacker' },
      { id: 'b', name: 'B', power: 40, health: 200, role: 'attacker' },
    ];
    const enemy = [
      { id: 'c', name: 'C', power: 10, health: 50, role: 'attacker' },
    ];
    const result = simulateBattle(player, enemy);
    expect(result.winner).toBe('player');
    expect(result.survivorsPlayer).toBeGreaterThan(0);
    expect(result.survivorsPlayerIds.length).toBeGreaterThan(0);
  });

  test('maps pve units to combat units', () => {
    const pve = [{ id: 'x', name: 'X', power: 10, health: 100, role: 'tank' }];
    const mapped = mapPveUnits(pve);
    expect(mapped[0].name).toBe('X');
    expect(mapped[0].health).toBe(100);
  });
});
