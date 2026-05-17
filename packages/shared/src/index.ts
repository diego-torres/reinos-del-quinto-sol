export const GAME_TITLE = "Reinos del Quinto Sol";

export const RESOURCES = ["maiz", "madera", "piedra", "obsidiana"] as const;

export type Resource = (typeof RESOURCES)[number];

export const ONLINE_WORLD = {
  width: 6800,
  height: 4500,
} as const;

export type OnlineUnitKind = "aldeano" | "guerrero";

/**
 * Radio en píxeles del mundo de revelado por exploración (niebla persistente propia).
 * Valores más altos = mejor exploración; aldeano modesto, guerrero rango de patrulla.
 * Cliente (y futuro servidor autoritativo) deben usar la misma tabla.
 */
export const UNIT_EXPLORATION_VISION_RADIUS_PX: Record<OnlineUnitKind, number> = {
  aldeano: 250,
  guerrero: 400,
};

export type OnlineBuildingKind = "casa" | "telpochcalli";

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
const INITIAL_RESOURCE_BLUEPRINTS: Array<Pick<OnlineResourceNodeState, "id" | "resource" | "label" | "radius">> = [
  { id: "maiz-1", resource: "maiz", label: "Maizal", radius: 94 },
  { id: "maiz-2", resource: "maiz", label: "Maizal", radius: 94 },
  { id: "maiz-3", resource: "maiz", label: "Maizal", radius: 94 },
  { id: "madera-4", resource: "madera", label: "Bosque", radius: 118 },
  { id: "madera-5", resource: "madera", label: "Bosque", radius: 118 },
  { id: "piedra-6", resource: "piedra", label: "Piedra", radius: 74 },
  { id: "piedra-7", resource: "piedra", label: "Piedra", radius: 74 },
  { id: "obsidiana-8", resource: "obsidiana", label: "Obsidiana", radius: 72 },
  { id: "obsidiana-9", resource: "obsidiana", label: "Obsidiana", radius: 72 },
  { id: "maiz-10", resource: "maiz", label: "Maizal", radius: 94 },
  { id: "maiz-11", resource: "maiz", label: "Maizal", radius: 94 },
  { id: "maiz-12", resource: "maiz", label: "Maizal", radius: 94 },
  { id: "madera-13", resource: "madera", label: "Bosque", radius: 118 },
  { id: "madera-14", resource: "madera", label: "Bosque", radius: 118 },
  { id: "piedra-15", resource: "piedra", label: "Piedra", radius: 74 },
  { id: "piedra-16", resource: "piedra", label: "Piedra", radius: 74 },
  { id: "obsidiana-17", resource: "obsidiana", label: "Obsidiana", radius: 72 },
  { id: "obsidiana-18", resource: "obsidiana", label: "Obsidiana", radius: 72 },
];

/**
 * Nodos de recurso repartidos en una malla sobre todo el mapa (mismo orden e ids en cliente y servidor).
 */
export function createInitialResourceNodes(): OnlineResourceNodeState[] {
  const pad = 380;
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
    const jitter = 71;
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
      type: "attack-center";
      unitId: string;
      centerId: string;
    };
