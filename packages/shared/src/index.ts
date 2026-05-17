export const GAME_TITLE = "Reinos del Quinto Sol";

export const RESOURCES = ["maiz", "madera", "piedra", "obsidiana"] as const;

export type Resource = (typeof RESOURCES)[number];

export const ONLINE_WORLD = {
  width: 6800,
  height: 4500,
} as const;

export type OnlineUnitKind = "aldeano" | "guerrero";

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

export type OnlineCeremonialCenterState = {
  id: string;
  ownerId: string;
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
