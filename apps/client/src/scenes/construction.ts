import Phaser from "phaser";
import { getBuildingConstructionTotalWork } from "@reinos/shared";
import { getBuildingPlacementExclusionRadius, getBuildingResourceClearance } from "@reinos/shared";
import {
  HOUSE_POPULATION_BONUS,
  HOUSE_WOOD_COST,
  TELPOCHCALLI_COST,
  WORLD_EDGE_MARGIN,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  getBuildingCost,
} from "../rules.js";
import type { BuildingData, BuildingKind, UnitData, UnitWorkState } from "../types.js";
import type { GameScene } from "./gameScene.js";
import { canAfford, formatCost, spendResources } from "./economy.js";
import { sendOnlineBuildCommand } from "./server.js";
import { playUnitOrderFeedback } from "./unitAudio.js";
import {
  createUnderConstructionVisual,
  getLocalConstructionApproachPoint,
} from "./buildingConstruction.js";

export function startHousePlacement(scene: GameScene): void {
  if (!scene.selectedUnit) return;

  const unitData = scene.selectedUnit.getData("unit") as UnitData;
  if (unitData.kind !== "aldeano") {
    scene.setStatus("Selecciona un aldeano para construir casas.");
    return;
  }

  if (scene.resources.madera < HOUSE_WOOD_COST) {
    scene.setStatus(`Madera insuficiente para casa. Necesitas ${HOUSE_WOOD_COST}.`);
    return;
  }

  scene.buildMode = "casa";
  scene.selectedUnit.setData("gatherTarget", undefined);
  scene.selectedUnit.setData("gatherElapsed", 0);
  scene.selectedUnit.setData("target", undefined);
  scene.selectedUnit.setData("constructionTargetId", undefined);
  scene.selectedUnit.setData("buildingTarget", "casa");
  scene.selectedUnit.setData("workState", "idle" satisfies UnitWorkState);
  scene.setStatus(`Modo construccion: casa cuesta ${HOUSE_WOOD_COST} madera. Clic izquierdo para colocar.`);
}

export function startTelpochcalliPlacement(scene: GameScene): void {
  if (!scene.selectedUnit) return;

  const unitData = scene.selectedUnit.getData("unit") as UnitData;
  if (unitData.kind !== "aldeano") {
    scene.setStatus("Selecciona un aldeano para construir un telpochcalli.");
    return;
  }

  if (!canAfford(scene, TELPOCHCALLI_COST)) {
    scene.setStatus(`Recursos insuficientes para telpochcalli. Necesitas ${formatCost(TELPOCHCALLI_COST)}.`);
    return;
  }

  scene.buildMode = "telpochcalli";
  scene.selectedUnit.setData("gatherTarget", undefined);
  scene.selectedUnit.setData("gatherElapsed", 0);
  scene.selectedUnit.setData("target", undefined);
  scene.selectedUnit.setData("constructionTargetId", undefined);
  scene.selectedUnit.setData("buildingTarget", "telpochcalli");
  scene.selectedUnit.setData("workState", "idle" satisfies UnitWorkState);
  scene.setStatus(`Modo construccion: telpochcalli cuesta ${formatCost(TELPOCHCALLI_COST)}. Clic izquierdo para colocar.`);
}

export function placeBuilding(scene: GameScene, x: number, y: number): void {
  if (!scene.buildMode) return;

  if (!scene.selectedUnit) {
    cancelBuildMode(scene, "Selecciona un aldeano para construir.");
    return;
  }

  const unitData = scene.selectedUnit.getData("unit") as UnitData;
  if (unitData.kind !== "aldeano") {
    cancelBuildMode(scene, "Solo los aldeanos pueden construir casas.");
    return;
  }

  const cost = getBuildingCost(scene.buildMode);
  if (!canAfford(scene, cost)) {
    cancelBuildMode(scene, `Recursos insuficientes. Necesitas ${formatCost(cost)}.`);
    return;
  }

  if (!canPlaceBuildingAt(scene, x, y, scene.buildMode)) {
    scene.setStatus("No puedes colocar ese edificio tan cerca de otra estructura o recurso.");
    return;
  }

  if (scene.onlineMode && sendOnlineBuildCommand(scene, unitData, scene.buildMode, x, y)) {
    const label = scene.buildMode === "casa" ? "Casa" : "Telpochcalli";
    scene.selectedUnit.setData("buildingTarget", undefined);
    scene.selectedUnit.setData("constructionTargetId", undefined);
    playUnitOrderFeedback(scene, unitData);
    cancelBuildMode(scene, `${label} solicitada al servidor.`);
    return;
  }

  const totalWork = getBuildingConstructionTotalWork(scene.buildMode);
  const building: BuildingData = {
    id: `${scene.buildMode}-${scene.buildings.length + 1}`,
    kind: scene.buildMode,
    label: scene.buildMode === "casa" ? "Casa" : "Telpochcalli",
    x,
    y,
    populationBonus: scene.buildMode === "casa" ? HOUSE_POPULATION_BONUS : 0,
    constructionWorkRemaining: totalWork,
  };

  spendResources(scene, cost);
  scene.selectedUnit.setData("buildingTarget", undefined);
  playUnitOrderFeedback(scene, unitData);
  createUnderConstructionVisual(scene, building);
  scene.buildings.push(building);

  const approach = getLocalConstructionApproachPoint(scene.selectedUnit, building);
  scene.selectedUnit.setData("gatherTarget", undefined);
  scene.selectedUnit.setData("constructionTargetId", building.id);
  scene.selectedUnit.setData("target", approach);
  scene.selectedUnit.setData("workState", "moving" satisfies UnitWorkState);

  scene.updateHudResources();
  const label = building.kind === "casa" ? "Casa" : "Telpochcalli";
  cancelBuildMode(
    scene,
    `${label}: obra iniciada. Mas aldeanos cerca aceleran el avance. Clic derecho en la obra para asignar.`,
  );
}

export function cancelBuildMode(scene: GameScene, message: string): void {
  scene.selectedUnit?.setData("buildingTarget", undefined);
  scene.buildMode = undefined;
  scene.setStatus(message);
}

export function canPlaceBuildingAt(scene: GameScene, x: number, y: number, kind: BuildingKind): boolean {
  if (
    x < WORLD_EDGE_MARGIN ||
    y < WORLD_EDGE_MARGIN ||
    x > WORLD_WIDTH - WORLD_EDGE_MARGIN ||
    y > WORLD_HEIGHT - WORLD_EDGE_MARGIN
  ) {
    return false;
  }

  const buildingRadius = getBuildingPlacementExclusionRadius(kind);
  const nearResource = scene.resourceNodes.some((node) => {
    if (node.depleted) return false;
    return Phaser.Math.Distance.Between(x, y, node.x, node.y) < node.radius + getBuildingResourceClearance(kind);
  });
  if (nearResource) return false;

  return !scene.buildings.some((building) => {
    return Phaser.Math.Distance.Between(x, y, building.x, building.y) < buildingRadius;
  });
}
