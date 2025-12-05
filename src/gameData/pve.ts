import { UnitDefinition } from './types';

export type PveUnit = {
  id: string;
  name: string;
  power: number;
  health: number;
  role: string;
};

export type PveWave = {
  id: string;
  name: string;
  rewardCoins: number;
  rewardXp: number;
  units: PveUnit[];
};

export const pveWaves: PveWave[] = [
  {
    id: 'wave1',
    name: 'Marine Grunts',
    rewardCoins: 4,
    rewardXp: 1,
    units: [
      { id: 'marine_grunt_1', name: 'Marine Grunt', power: 18, health: 200, role: 'attacker' },
      { id: 'marine_grunt_2', name: 'Marine Grunt', power: 18, health: 200, role: 'attacker' },
      { id: 'marine_grunt_3', name: 'Marine Grunt', power: 20, health: 210, role: 'attacker' },
    ],
  },
  {
    id: 'wave2',
    name: 'Pacifista Patrol',
    rewardCoins: 5,
    rewardXp: 1,
    units: [
      { id: 'pacifista_1', name: 'Pacifista', power: 28, health: 320, role: 'tank' },
      { id: 'pacifista_2', name: 'Pacifista', power: 28, health: 320, role: 'tank' },
    ],
  },
  {
    id: 'wave3',
    name: 'Smoker Mini-Boss',
    rewardCoins: 6,
    rewardXp: 2,
    units: [
      { id: 'smoker_boss', name: 'Smoker', power: 45, health: 520, role: 'control' },
      { id: 'marine_support', name: 'Marine Support', power: 22, health: 260, role: 'support' },
    ],
  },
];

export function getWaveByIndex(index: number): PveWave | undefined {
  return pveWaves[index - 1];
}
