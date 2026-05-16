import type { Resource } from "@reinos/shared";
import type { BuildingKind, TrainingDefinition, UnitKind, UnitStats } from "./types.js";

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1600;
export const TILE_SIZE = 96;

export const GATHER_INTERVAL_MS = 1000;
export const GATHER_AMOUNT = 10;

export const CEREMONIAL_CENTER = {
  x: 520,
  y: 470,
  depositRadius: 180,
};

export const CARRY_CAPACITY: Record<Resource, number> = {
  maiz: 30,
  madera: 25,
  piedra: 20,
  obsidiana: 15,
};

export const HOUSE_WOOD_COST = 50;
export const HOUSE_POPULATION_BONUS = 5;

export const TELPOCHCALLI_COST: Partial<Record<Resource, number>> = {
  madera: 120,
  piedra: 40,
};

export const UNIT_STATS: Record<UnitKind, UnitStats> = {
  aldeano: {
    maxHealth: 55,
    attack: 2,
    range: 34,
    cooldownMs: 1200,
  },
  guerrero: {
    maxHealth: 95,
    attack: 14,
    range: 58,
    cooldownMs: 850,
  },
};

export const TRAINING: Record<UnitKind, TrainingDefinition> = {
  aldeano: {
    label: "Aldeano",
    cost: { maiz: 50 },
    population: 1,
    durationMs: 1400,
  },
  guerrero: {
    label: "Guerrero",
    cost: { maiz: 60, obsidiana: 20 },
    population: 1,
    durationMs: 1700,
  },
};

export function getBuildingCost(kind: BuildingKind): Partial<Record<Resource, number>> {
  if (kind === "casa") return { madera: HOUSE_WOOD_COST };
  return TELPOCHCALLI_COST;
}
