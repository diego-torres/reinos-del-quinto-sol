import { ONLINE_WORLD, WORLD_EDGE_MARGIN, WORLD_LINEAR_SCALE, type Resource } from "@reinos/shared";
import type { BuildingKind, TrainingDefinition, UnitKind, UnitStats } from "./types.js";

export const WORLD_WIDTH = ONLINE_WORLD.width;
export const WORLD_HEIGHT = ONLINE_WORLD.height;
export { WORLD_EDGE_MARGIN, WORLD_LINEAR_SCALE };
export const TILE_SIZE = 96 * WORLD_LINEAR_SCALE;
export const MIN_CAMERA_ZOOM = 0.25;
export const MAX_CAMERA_ZOOM = 1;
export const ZOOM_STEP = 0.25;

export const GATHER_INTERVAL_MS = 1000;
export const GATHER_AMOUNT = 10;

export const CEREMONIAL_CENTER = {
  x: 520 * WORLD_LINEAR_SCALE,
  y: 470 * WORLD_LINEAR_SCALE,
  depositRadius: 180 * WORLD_LINEAR_SCALE,
};

/** Clic/hover en centro ceremonial: ~radio de selección de unidad, no el área de depósito. */
export const CEREMONIAL_CENTER_POINTER_RADIUS_PX = 36 * WORLD_LINEAR_SCALE;

/**
 * Clic en obra en construcción: más ajustado que el radio de trabajo compartido en servidor.
 */
export const CONSTRUCTION_SITE_POINTER_RADIUS_PX = 36 * WORLD_LINEAR_SCALE;

const RESOURCE_NODE_POINTER_RADIUS_FACTOR = 0.38;
const RESOURCE_NODE_POINTER_MIN_PX = 56 * WORLD_LINEAR_SCALE;

/** Radio de puntero para elegir un recurso en el mapa (fracción del radio de gameplay). */
export function getResourcePointerHitRadiusPx(gameplayRadius: number): number {
  return Math.max(RESOURCE_NODE_POINTER_MIN_PX, gameplayRadius * RESOURCE_NODE_POINTER_RADIUS_FACTOR);
}

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
    range: 34 * WORLD_LINEAR_SCALE,
    cooldownMs: 1200,
  },
  guerrero: {
    maxHealth: 95,
    attack: 14,
    range: 58 * WORLD_LINEAR_SCALE,
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
