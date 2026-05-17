import type { Resource } from "@reinos/shared";
import { CARRY_CAPACITY } from "../rules.js";
import type { MythicBeast, ResourceNode, UnitData } from "../types.js";
import * as construction from "./construction.js";
import { collectDebugBuildings, collectDebugUnits } from "./domSync.js";
import { updateResourceNodeLabel } from "./economy.js";
import type { GameScene } from "./gameScene.js";
import * as units from "./units.js";

export function installDebugApi(scene: GameScene): void {
  const debugApi = {
    getResources: () => ({ ...scene.resources }),
    getResourceNodes: () => scene.resourceNodes.map((node: ResourceNode) => ({
      id: node.id,
      resource: node.resource,
      label: node.label,
      amount: node.amount,
      depleted: node.depleted,
      x: node.x,
      y: node.y,
    })),
    getSelectedUnit: () => {
      const unitData = scene.selectedUnit?.getData("unit") as UnitData | undefined;
      return unitData?.id;
    },
    getCarryCapacity: () => ({ ...CARRY_CAPACITY }),
    getUnits: () => collectDebugUnits(scene),
    getBeast: () => {
      const beast = scene.mythicBeasts.find((b: MythicBeast) => !b.dead);
      return beast
        ? {
            id: beast.id,
            name: beast.name,
            health: beast.health,
            dormant: beast.dormant,
            dead: beast.dead,
          }
        : undefined;
    },
    getBeasts: () => scene.mythicBeasts.map((beast: MythicBeast) => ({
      id: beast.id,
      name: beast.name,
      health: beast.health,
      dormant: beast.dormant,
      dead: beast.dead,
    })),
    trainVillager: () => {
      units.trainVillager(scene);
      return {
        resources: { ...scene.resources },
        population: {
          current: scene.population,
          limit: scene.populationLimit,
        },
        training: {
          villager: scene.isTrainingVillager,
          warrior: scene.isTrainingWarrior,
        },
      };
    },
    trainWarrior: () => {
      units.trainWarrior(scene);
      return {
        resources: { ...scene.resources },
        population: {
          current: scene.population,
          limit: scene.populationLimit,
        },
        training: {
          villager: scene.isTrainingVillager,
          warrior: scene.isTrainingWarrior,
        },
      };
    },
    gatherFirst: (resource: Resource) => {
      const node = scene.resourceNodes.find((candidate: ResourceNode) => candidate.resource === resource);
      if (!scene.selectedUnit || !node) return false;

      const unitData = scene.selectedUnit.getData("unit") as UnitData;
      if (unitData.kind !== "aldeano") return false;

      units.sendUnitToGather(scene, scene.selectedUnit, node);
      return true;
    },
    buildHouseAt: (x: number, y: number) => {
      construction.startHousePlacement(scene);
      construction.placeBuilding(scene, x, y);
      return {
        resources: { ...scene.resources },
        population: {
          current: scene.population,
          limit: scene.populationLimit,
        },
        buildings: collectDebugBuildings(scene),
      };
    },
    exhaustFirst: (resource: Resource) => {
      const node = scene.resourceNodes.find((candidate: ResourceNode) => candidate.resource === resource && !candidate.depleted);
      if (!node) return false;

      node.amount = 0;
      updateResourceNodeLabel(scene, node);
      return true;
    },
  };

  (globalThis as typeof globalThis & { __RQSDebug?: typeof debugApi }).__RQSDebug = debugApi;
  (window as typeof window & { __RQSDebug?: typeof debugApi }).__RQSDebug = debugApi;
}
