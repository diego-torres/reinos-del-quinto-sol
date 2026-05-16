export const GAME_TITLE = "Reinos del Quinto Sol";

export const RESOURCES = ["maiz", "madera", "piedra", "obsidiana"] as const;

export type Resource = (typeof RESOURCES)[number];

export type OnlineUnitKind = "aldeano" | "guerrero";

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
};

export type OnlinePlayerState = {
  id: string;
  slot: number;
};

export type OnlineGameState = {
  tick: number;
  players: OnlinePlayerState[];
  units: OnlineUnitState[];
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
    };
