import Phaser from "phaser";
import { CARRY_CAPACITY, WORLD_HEIGHT, WORLD_WIDTH } from "../rules.js";
import type {
  BuildingKind,
  CeremonialCenterData,
  MythicBeast,
  ResourceNode,
  UnitCargo,
  UnitData,
  UnitKind,
  UnitWorkState,
} from "../types.js";
import type { GameScene } from "./gameScene.js";
import { getUnitCargo } from "./units.js";

export type DebugUnitSnapshot = {
  id: string;
  kind: UnitKind;
  x: number;
  y: number;
  cargo: UnitCargo;
  workState: UnitWorkState;
};

export type DebugBuildingSnapshot = {
  id: string;
  kind: BuildingKind;
  ownerId?: string;
  x: number;
  y: number;
  populationBonus: number;
  constructionWorkRemaining: number;
};

export type DebugCeremonialCenterSnapshot = {
  id: string;
  ownerId: string;
  culture: CeremonialCenterData["culture"];
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  destroyed: boolean;
};

export function collectDebugUnits(scene: GameScene): DebugUnitSnapshot[] {
  const unitsOut: DebugUnitSnapshot[] = [];

  scene.children.each((child) => {
    if (!(child instanceof Phaser.GameObjects.Container)) return true;

    const unitData = child.getData("unit") as UnitData | undefined;
    if (!unitData) return true;

    unitsOut.push({
      id: unitData.id,
      kind: unitData.kind,
      x: Math.round(child.x),
      y: Math.round(child.y),
      cargo: getUnitCargo(scene, child),
      workState: child.getData("workState") as UnitWorkState,
    });
    return true;
  });

  return unitsOut;
}

export function collectDebugBuildings(scene: GameScene): DebugBuildingSnapshot[] {
  return scene.buildings.map((building) => ({
    id: building.id,
    kind: building.kind,
    ownerId: building.ownerId,
    x: Math.round(building.x),
    y: Math.round(building.y),
    populationBonus: building.populationBonus,
    constructionWorkRemaining: building.constructionWorkRemaining,
  }));
}

export function collectDebugCeremonialCenters(scene: GameScene): DebugCeremonialCenterSnapshot[] {
  return scene.ceremonialCenters.map((center) => ({
    id: center.id,
    ownerId: center.ownerId,
    culture: center.culture,
    x: Math.round(center.x),
    y: Math.round(center.y),
    health: center.health,
    maxHealth: center.maxHealth,
    destroyed: center.destroyed,
  }));
}

export function syncDomState(scene: GameScene): void {
  document.body.dataset.resources = JSON.stringify(scene.resources);
  document.body.dataset.resourceNodes = JSON.stringify(scene.resourceNodes.map((node: ResourceNode) => ({
    id: node.id,
    resource: node.resource,
    amount: node.amount,
    depleted: node.depleted,
  })));
  document.body.dataset.population = JSON.stringify({
    current: scene.population,
    limit: scene.populationLimit,
  });
  document.body.dataset.buildings = JSON.stringify(collectDebugBuildings(scene));
  document.body.dataset.ceremonialCenters = JSON.stringify(collectDebugCeremonialCenters(scene));
  document.body.dataset.world = JSON.stringify({
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    zoom: scene.cameras.main.zoom,
  });
  document.body.dataset.carryCapacity = JSON.stringify(CARRY_CAPACITY);
  document.body.dataset.units = JSON.stringify(collectDebugUnits(scene));
  document.body.dataset.training = JSON.stringify({
    villager: scene.isTrainingVillager,
    warrior: scene.isTrainingWarrior,
  });
  document.body.dataset.beasts = JSON.stringify(
    scene.mythicBeasts.map((beast: MythicBeast) => ({
      id: beast.id,
      name: beast.name,
      health: beast.health,
      maxHealth: beast.maxHealth,
      dormant: beast.dormant,
      dead: beast.dead,
      reward: beast.reward,
    })),
  );
}
