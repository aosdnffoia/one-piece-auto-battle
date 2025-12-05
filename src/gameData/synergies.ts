import { SynergyConfig } from './types';

export const factionSynergies: SynergyConfig[] = [
  {
    key: 'straw_hat',
    name: 'Straw Hat Pirates',
    type: 'faction',
    thresholds: [
      { count: 2, effect: 'Minor attack buff to all allies', bonus: { attack: 8 } },
      { count: 4, effect: 'Teamwide attack and speed boost', bonus: { attack: 15, speed: 10 } },
      { count: 6, effect: 'Burst of ability power at battle start', bonus: { abilityPower: 20 } },
    ],
  },
  {
    key: 'navy',
    name: 'Navy',
    type: 'faction',
    thresholds: [
      { count: 3, effect: 'Defense buff for Tanks', bonus: { shield: 20 } },
      { count: 5, effect: 'Damage reduction aura', bonus: { health: 120 } },
    ],
  },
  {
    key: 'beast_pirates',
    name: 'Beast Pirates',
    type: 'faction',
    thresholds: [
      { count: 3, effect: 'Frontline gains bonus health', bonus: { health: 150 } },
      { count: 5, effect: 'Rage: bonus attack after first takedown', bonus: { attack: 20 } },
    ],
  },
  {
    key: 'warlords',
    name: 'Warlords',
    type: 'faction',
    thresholds: [
      { count: 2, effect: 'First ally ability triggers twice' },
      { count: 4, effect: 'Lifesteal on attacks', bonus: { health: 80 } },
    ],
  },
  {
    key: 'revolutionary',
    name: 'Revolutionary Army',
    type: 'faction',
    thresholds: [
      { count: 2, effect: 'Start with a shield', bonus: { shield: 25 } },
      { count: 4, effect: 'Periodic heal over time', bonus: { health: 100 } },
    ],
  },
  {
    key: 'supernova',
    name: 'Worst Generation',
    type: 'faction',
    thresholds: [
      { count: 2, effect: 'Bonus crit chance', bonus: { attack: 10 } },
      { count: 4, effect: 'Burst of damage on first hit', bonus: { attack: 18 } },
    ],
  },
  {
    key: 'cp9',
    name: 'CP9',
    type: 'faction',
    thresholds: [
      { count: 2, effect: 'First attack applies slow', bonus: { speed: 8 } },
      { count: 4, effect: 'After dodge, gain attack speed', bonus: { speed: 18 } },
    ],
  },
  {
    key: 'whitebeard',
    name: 'Whitebeard Pirates',
    type: 'faction',
    thresholds: [
      { count: 2, effect: 'Damage reduction while above 50% HP', bonus: { health: 140 } },
      { count: 4, effect: 'Last stand: bonus attack when an ally dies', bonus: { attack: 22 } },
    ],
  },
];

export const roleSynergies: SynergyConfig[] = [
  {
    key: 'attacker',
    name: 'Attackers',
    type: 'role',
    thresholds: [
      { count: 2, effect: 'Bonus attack speed', bonus: { speed: 10 } },
      { count: 4, effect: 'Higher attack speed and attack', bonus: { speed: 18, attack: 12 } },
    ],
  },
  {
    key: 'tank',
    name: 'Tanks',
    type: 'role',
    thresholds: [
      { count: 2, effect: 'Bonus shield', bonus: { shield: 25 } },
      { count: 4, effect: 'Extra health and shield', bonus: { health: 160, shield: 35 } },
    ],
  },
  {
    key: 'support',
    name: 'Supports',
    type: 'role',
    thresholds: [
      { count: 2, effect: 'Periodic healing pulse', bonus: { health: 80 } },
      { count: 4, effect: 'Bigger heals and ability power', bonus: { health: 140, abilityPower: 15 } },
    ],
  },
  {
    key: 'control',
    name: 'Controllers',
    type: 'role',
    thresholds: [
      { count: 2, effect: 'First attack slows target', bonus: { speed: 6 } },
      { count: 4, effect: 'Increased stun chance on hit', bonus: { speed: 12 } },
    ],
  },
];
