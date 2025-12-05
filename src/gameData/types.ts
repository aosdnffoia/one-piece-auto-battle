export type FactionKey =
  | 'straw_hat'
  | 'navy'
  | 'beast_pirates'
  | 'warlords'
  | 'revolutionary'
  | 'supernova'
  | 'cp9'
  | 'whitebeard';

export type RoleKey = 'attacker' | 'tank' | 'support' | 'control';

export type AbilityType = 'passive' | 'on_hit' | 'on_death' | 'cast';

export type UnitDefinition = {
  id: string;
  name: string;
  faction: FactionKey;
  role: RoleKey;
  tier: 1 | 2 | 3 | 4 | 5;
  power: number;
  health: number;
  abilityType: AbilityType;
  abilityValue: number;
  abilityDescription: string;
  image: string;
};

export type SynergyThreshold = {
  count: number;
  effect: string;
  bonus?: {
    attack?: number;
    health?: number;
    shield?: number;
    speed?: number;
    abilityPower?: number;
  };
};

export type SynergyConfig = {
  key: FactionKey | RoleKey;
  name: string;
  type: 'faction' | 'role';
  thresholds: SynergyThreshold[];
};

export type SynergyActivation = {
  key: SynergyConfig['key'];
  name: string;
  type: SynergyConfig['type'];
  count: number;
  activeThresholds: SynergyThreshold[];
};
