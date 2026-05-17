export const GAME_TITLE = "Reinos del Quinto Sol";

export const RESOURCES = ["alimento", "madera", "piedra", "obsidiana"] as const;

export type Resource = (typeof RESOURCES)[number];

/** Origen jugable del recurso alimento (un solo contador; se distingue en datos y mapa). */
export const FOOD_SOURCES = ["milpa", "caza"] as const;

export type FoodSource = (typeof FOOD_SOURCES)[number];

/**
 * Escala lineal del mundo respecto al prototipo base (6800×4500).
 * Recursos, radios de gameplay y velocidades en px/s escalan con este factor para
 * mantener ritmo similar en un mapa más grande.
 */
export const WORLD_LINEAR_SCALE = 4 as const;

const BASE_WORLD_WIDTH = 6800;
const BASE_WORLD_HEIGHT = 4500;

export const ONLINE_WORLD = {
  width: BASE_WORLD_WIDTH * WORLD_LINEAR_SCALE,
  height: BASE_WORLD_HEIGHT * WORLD_LINEAR_SCALE,
} as const;

/** Distancia mínima al borde del mundo para colocación y clamps (antes 80 px en mapa base). */
export const WORLD_EDGE_MARGIN = 80 * WORLD_LINEAR_SCALE;

export type OnlineUnitKind = "aldeano" | "guerrero";

/**
 * Radio en píxeles del mundo de revelado por exploración (niebla persistente propia).
 * Valores más altos = mejor exploración; aldeano modesto, guerrero rango de patrulla.
 * Cliente (y futuro servidor autoritativo) deben usar la misma tabla.
 */
export const UNIT_EXPLORATION_VISION_RADIUS_PX: Record<OnlineUnitKind, number> = {
  aldeano: 250 * WORLD_LINEAR_SCALE,
  guerrero: 400 * WORLD_LINEAR_SCALE,
};

export type OnlineBuildingKind = "casa" | "telpochcalli";

/**
 * Trabajo total en "aldeano-segundos": un aldeano solo tarda este tiempo en pared;
 * N aldeanos en sitio reducen el tiempo total ~ N veces.
 */
export const BUILDING_CONSTRUCTION_WORK_VILLAGER_SECONDS: Record<OnlineBuildingKind, number> = {
  casa: 90,
  telpochcalli: 200,
};

/** Radio en píxeles: aldeanos dentro cuentan como trabajando en la obra. */
export const CONSTRUCTION_SITE_WORK_RADIUS_PX = 72 * WORLD_LINEAR_SCALE;

/** Separación al acercarse al punto de construcción o movimiento (mapa base 16 / 24 px). */
export const CONSTRUCTION_APPROACH_MIN_OFFSET_PX = 16 * WORLD_LINEAR_SCALE;
export const CONSTRUCTION_APPROACH_INSET_FROM_WORK_RADIUS_PX = 24 * WORLD_LINEAR_SCALE;

export function getConstructionApproachStandoffPx(): number {
  return Math.max(
    CONSTRUCTION_APPROACH_MIN_OFFSET_PX,
    CONSTRUCTION_SITE_WORK_RADIUS_PX - CONSTRUCTION_APPROACH_INSET_FROM_WORK_RADIUS_PX,
  );
}

/** Cliente/servidor: al acercarse a un destino de movimiento (mapa base 4 px). */
export const UNIT_MOVE_ARRIVAL_EPS_PX = 4 * WORLD_LINEAR_SCALE;

export const GATHER_APPROACH_OFFSET_PX = 26 * WORLD_LINEAR_SCALE;
export const GATHER_MAX_DISTANCE_BEYOND_RADIUS_PX = 42 * WORLD_LINEAR_SCALE;
export const DEPOSIT_APPROACH_INSET_PX = 28 * WORLD_LINEAR_SCALE;

/** Colocación de edificios (radios de exclusión; mapa base igual que servidor previo). */
export const ONLINE_BUILDING_PLACEMENT = {
  casa: {
    exclusionRadius: 112 * WORLD_LINEAR_SCALE,
    resourceClearance: 54 * WORLD_LINEAR_SCALE,
  },
  telpochcalli: {
    exclusionRadius: 146 * WORLD_LINEAR_SCALE,
    resourceClearance: 82 * WORLD_LINEAR_SCALE,
  },
} as const;

export function getBuildingPlacementExclusionRadius(kind: OnlineBuildingKind): number {
  return ONLINE_BUILDING_PLACEMENT[kind].exclusionRadius;
}

export function getBuildingResourceClearance(kind: OnlineBuildingKind): number {
  return ONLINE_BUILDING_PLACEMENT[kind].resourceClearance;
}

export function getBuildingConstructionTotalWork(kind: OnlineBuildingKind): number {
  return BUILDING_CONSTRUCTION_WORK_VILLAGER_SECONDS[kind];
}

/** Avance 0–1 hacia el edificio terminado (1 = obra lista). */
export function buildingConstructionProgressRatio(
  remainingVillagerSeconds: number,
  kind: OnlineBuildingKind,
): number {
  const total = getBuildingConstructionTotalWork(kind);
  if (total <= 0) return 1;
  const ratio = 1 - remainingVillagerSeconds / total;
  return Math.max(0, Math.min(1, ratio));
}

export type OnlineUnitState = {
  id: string;
  ownerId: string;
  kind: OnlineUnitKind;
  x: number;
  y: number;
  target?: {
    x: number;
    y: number;
  };
  speed: number;
  health: number;
  maxHealth: number;
  cargo: {
    resource?: Resource;
    amount: number;
  };
  workState: "idle" | "moving" | "gathering" | "returning" | "attacking";
  gatherTargetId?: string;
  attackTargetId?: string;
  /** Sitio de construcción (building.id) al que este aldeano aporta mano de obra. */
  constructionTargetId?: string;
};

export type OnlinePlayerState = {
  id: string;
  slot: number;
  resources: Record<Resource, number>;
};

export type OnlineResourceNodeState = {
  id: string;
  resource: Resource;
  label: string;
  /** Solo cuando resource es "alimento"; indica milpa/maizal o cacería. */
  foodSource?: FoodSource;
  x: number;
  y: number;
  radius: number;
  amount: number;
  depleted: boolean;
};

export type OnlineBuildingState = {
  id: string;
  ownerId: string;
  kind: OnlineBuildingKind;
  x: number;
  y: number;
  /** Trabajo restante en aldeano-segundos; 0 = edificio terminado. */
  constructionWorkRemaining: number;
};

export const CEREMONIAL_CENTER_CULTURES = ["mexica", "tlaxcalteca", "inca", "maya"] as const;

export type CeremonialCenterCulture = (typeof CEREMONIAL_CENTER_CULTURES)[number];

export function normalizeCeremonialCenterCulture(value: unknown): CeremonialCenterCulture {
  if (
    typeof value === "string" &&
    (CEREMONIAL_CENTER_CULTURES as readonly string[]).includes(value)
  ) {
    return value as CeremonialCenterCulture;
  }
  return "maya";
}

export type OnlineCeremonialCenterState = {
  id: string;
  ownerId: string;
  culture: CeremonialCenterCulture;
  x: number;
  y: number;
  radius: number;
  health: number;
  maxHealth: number;
  destroyed: boolean;
};

export type OnlineGameState = {
  tick: number;
  players: OnlinePlayerState[];
  units: OnlineUnitState[];
  resourceNodes: OnlineResourceNodeState[];
  buildings: OnlineBuildingState[];
  ceremonialCenters: OnlineCeremonialCenterState[];
  winnerId?: string;
};

const INITIAL_RESOURCE_NODE_AMOUNT = 500;

/** Blueprint row-major on a 6x3 grid covering the whole map (ids stable for cliente/servidor). */
const INITIAL_RESOURCE_BLUEPRINTS: Array<
  Pick<OnlineResourceNodeState, "id" | "resource" | "label" | "radius" | "foodSource">
> = [
  { id: "maiz-1", resource: "alimento", foodSource: "milpa", label: "Maizal", radius: 94 * WORLD_LINEAR_SCALE },
  { id: "maiz-2", resource: "alimento", foodSource: "milpa", label: "Maizal", radius: 94 * WORLD_LINEAR_SCALE },
  { id: "maiz-3", resource: "alimento", foodSource: "milpa", label: "Maizal", radius: 94 * WORLD_LINEAR_SCALE },
  { id: "madera-4", resource: "madera", label: "Bosque", radius: 118 * WORLD_LINEAR_SCALE },
  { id: "madera-5", resource: "madera", label: "Bosque", radius: 118 * WORLD_LINEAR_SCALE },
  { id: "piedra-6", resource: "piedra", label: "Piedra", radius: 74 * WORLD_LINEAR_SCALE },
  { id: "piedra-7", resource: "piedra", label: "Piedra", radius: 74 * WORLD_LINEAR_SCALE },
  { id: "obsidiana-8", resource: "obsidiana", label: "Obsidiana", radius: 72 * WORLD_LINEAR_SCALE },
  { id: "obsidiana-9", resource: "obsidiana", label: "Obsidiana", radius: 72 * WORLD_LINEAR_SCALE },
  { id: "maiz-10", resource: "alimento", foodSource: "caza", label: "Zona de caza", radius: 94 * WORLD_LINEAR_SCALE },
  { id: "maiz-11", resource: "alimento", foodSource: "caza", label: "Zona de caza", radius: 94 * WORLD_LINEAR_SCALE },
  { id: "maiz-12", resource: "alimento", foodSource: "milpa", label: "Maizal", radius: 94 * WORLD_LINEAR_SCALE },
  { id: "madera-13", resource: "madera", label: "Bosque", radius: 118 * WORLD_LINEAR_SCALE },
  { id: "madera-14", resource: "madera", label: "Bosque", radius: 118 * WORLD_LINEAR_SCALE },
  { id: "piedra-15", resource: "piedra", label: "Piedra", radius: 74 * WORLD_LINEAR_SCALE },
  { id: "piedra-16", resource: "piedra", label: "Piedra", radius: 74 * WORLD_LINEAR_SCALE },
  { id: "obsidiana-17", resource: "obsidiana", label: "Obsidiana", radius: 72 * WORLD_LINEAR_SCALE },
  { id: "obsidiana-18", resource: "obsidiana", label: "Obsidiana", radius: 72 * WORLD_LINEAR_SCALE },
];

/**
 * Nodos de recurso repartidos en una malla sobre todo el mapa (mismo orden e ids en cliente y servidor).
 */
export function createInitialResourceNodes(): OnlineResourceNodeState[] {
  const pad = 380 * WORLD_LINEAR_SCALE;
  const innerW = ONLINE_WORLD.width - pad * 2;
  const innerH = ONLINE_WORLD.height - pad * 2;
  const cols = 6;
  const rows = 3;

  if (INITIAL_RESOURCE_BLUEPRINTS.length !== cols * rows) {
    throw new Error("INITIAL_RESOURCE_BLUEPRINTS debe tener exactamente 18 entradas");
  }

  return INITIAL_RESOURCE_BLUEPRINTS.map((bp, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cx = pad + ((col + 0.5) / cols) * innerW;
    const cy = pad + ((row + 0.5) / rows) * innerH;
    const jitter = 71 * WORLD_LINEAR_SCALE;
    const jx = Math.round(((index * 47) % jitter) - jitter / 2);
    const jy = Math.round(((index * 89) % jitter) - jitter / 2);

    return {
      ...bp,
      x: Math.round(cx + jx),
      y: Math.round(cy + jy),
      amount: INITIAL_RESOURCE_NODE_AMOUNT,
      depleted: false,
    };
  });
}

export type ServerMessage =
  | {
      type: "welcome";
      game: string;
      playerId: string;
      state: OnlineGameState;
    }
  | {
      type: "state";
      state: OnlineGameState;
    };

export type ClientMessage =
  | {
      type: "join-game";
      culture: CeremonialCenterCulture;
    }
  | {
      type: "move-unit";
      unitId: string;
      target: {
        x: number;
        y: number;
      };
    }
  | {
      type: "gather-resource";
      unitId: string;
      resourceNodeId: string;
    }
  | {
      type: "deposit-resources";
      unitId: string;
    }
  | {
      type: "build-structure";
      unitId: string;
      kind: OnlineBuildingKind;
      x: number;
      y: number;
    }
  | {
      type: "assign-construction";
      unitId: string;
      buildingId: string;
    }
  | {
      type: "attack-center";
      unitId: string;
      centerId: string;
    };
