import { factionSynergies, roleSynergies } from './synergies';
import { SynergyActivation, SynergyConfig, UnitDefinition } from './types';

function getActiveThresholds(config: SynergyConfig, count: number) {
  return config.thresholds.filter((threshold) => count >= threshold.count);
}

function resolveActivations(configs: SynergyConfig[], counts: Map<string, number>): SynergyActivation[] {
  return configs
    .map((config) => {
      const count = counts.get(config.key) ?? 0;
      const activeThresholds = getActiveThresholds(config, count);
      if (activeThresholds.length === 0) return null;
      return {
        key: config.key,
        name: config.name,
        type: config.type,
        count,
        activeThresholds,
      } as SynergyActivation;
    })
    .filter((entry): entry is SynergyActivation => entry !== null)
    .sort((a, b) => b.count - a.count);
}

export function computeSynergies(units: UnitDefinition[]): {
  factionActivations: SynergyActivation[];
  roleActivations: SynergyActivation[];
} {
  const factionCounts = new Map<string, number>();
  const roleCounts = new Map<string, number>();

  for (const unit of units) {
    factionCounts.set(unit.faction, (factionCounts.get(unit.faction) ?? 0) + 1);
    roleCounts.set(unit.role, (roleCounts.get(unit.role) ?? 0) + 1);
  }

  return {
    factionActivations: resolveActivations(factionSynergies, factionCounts),
    roleActivations: resolveActivations(roleSynergies, roleCounts),
  };
}

export function serializeUnit(unit: UnitDefinition) {
  // Serializer keeps gameplay-relevant fields and omits sensitive data (none for now).
  return {
    id: unit.id,
    name: unit.name,
    faction: unit.faction,
    role: unit.role,
    tier: unit.tier,
    power: unit.power,
    health: unit.health,
    abilityType: unit.abilityType,
    abilityValue: unit.abilityValue,
    abilityDescription: unit.abilityDescription,
    image: unit.image,
  };
}
