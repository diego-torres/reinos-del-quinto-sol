import type Phaser from "phaser";
import type {
  CeremonialCenterCulture,
  OnlineBuildingKind,
  OnlineCeremonialCenterState,
  Resource,
} from "@reinos/shared";

export type CeremonialCenterData = OnlineCeremonialCenterState & {
  container: Phaser.GameObjects.Container;
  healthLabel: Phaser.GameObjects.Text;
};

export type UnitKind = "aldeano" | "guerrero";

export type VillagerGenderVariant = "masculino" | "femenina";

export type VillagerAnimationState = "idle" | "walk" | "build" | "gather-food" | "carry";

export type VillagerSkin = {
  culture: CeremonialCenterCulture;
  gender: VillagerGenderVariant;
};

export type UnitData = {
  id: string;
  kind: UnitKind;
  label: string;
  color: number;
  speed: number;
  ownerId?: string;
  skin?: VillagerSkin;
};

export type UnitStats = {
  maxHealth: number;
  attack: number;
  range: number;
  cooldownMs: number;
};

export type ResourceNode = {
  id: string;
  resource: Resource;
  label: string;
  x: number;
  y: number;
  radius: number;
  amount: number;
  text: Phaser.GameObjects.Text;
  visuals: Phaser.GameObjects.GameObject[];
  depleted: boolean;
};

export type UnitCargo = {
  resource?: Resource;
  amount: number;
};

export type UnitWorkState = "idle" | "moving" | "gathering" | "returning" | "attacking";

export type BuildingKind = OnlineBuildingKind;

export type DepositAfter = "idle" | "resume-gathering";

export type BuildingData = {
  id: string;
  kind: BuildingKind;
  label: string;
  x: number;
  y: number;
  ownerId?: string;
  populationBonus: number;
  /** Aldeano-segundos restantes; 0 = terminado. */
  constructionWorkRemaining: number;
  container?: Phaser.GameObjects.Container;
  constructionProgressFill?: Phaser.GameObjects.Rectangle;
  constructionProgressMaxWidth?: number;
};

export type TrainingDefinition = {
  label: string;
  cost: Partial<Record<Resource, number>>;
  population: number;
  durationMs: number;
};

export type MythicBeast = {
  id: string;
  name: string;
  x: number;
  y: number;
  container: Phaser.GameObjects.Container;
  health: number;
  maxHealth: number;
  attack: number;
  range: number;
  speed: number;
  cooldownMs: number;
  attackElapsed: number;
  dormant: boolean;
  dead: boolean;
  targetUnit?: Phaser.GameObjects.Container;
  reward: Partial<Record<Resource, number>>;
  healthText: Phaser.GameObjects.Text;
};
