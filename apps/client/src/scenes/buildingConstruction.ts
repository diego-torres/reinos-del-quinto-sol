import {
  CONSTRUCTION_SITE_WORK_RADIUS_PX,
  buildingConstructionProgressRatio,
  getConstructionApproachStandoffPx,
} from "@reinos/shared";
import Phaser from "phaser";
import { drawBuildingConstructionSite, drawHouse, drawTelpochcalli } from "../art.js";
import { CONSTRUCTION_SITE_POINTER_RADIUS_PX } from "../rules.js";
import type { BuildingData, UnitData, UnitWorkState } from "../types.js";
import type { GameScene } from "./gameScene.js";

export function canVillagerHelpConstruction(scene: GameScene, unitData: UnitData, site: BuildingData): boolean {
  if (unitData.kind !== "aldeano") return false;
  if (site.constructionWorkRemaining <= 0) return false;
  if (scene.onlineMode) {
    return unitData.ownerId === scene.playerId && site.ownerId === scene.playerId;
  }
  return !site.ownerId;
}

export function getLocalConstructionApproachPoint(
  unit: Phaser.GameObjects.Container,
  building: BuildingData,
): Phaser.Math.Vector2 {
  const angle = Phaser.Math.Angle.Between(building.x, building.y, unit.x, unit.y);
  const distance = getConstructionApproachStandoffPx();
  return new Phaser.Math.Vector2(
    building.x + Math.cos(angle) * distance,
    building.y + Math.sin(angle) * distance,
  );
}

export function findConstructionSiteAt(scene: GameScene, x: number, y: number): BuildingData | undefined {
  return scene.buildings.find((building) => {
    if (building.constructionWorkRemaining <= 0) return false;
    return Phaser.Math.Distance.Between(x, y, building.x, building.y) <= CONSTRUCTION_SITE_POINTER_RADIUS_PX;
  });
}

export function updateOfflineConstructionWorker(
  scene: GameScene,
  unit: Phaser.GameObjects.Container,
  constructionTargetId: string,
): void {
  const building = scene.buildings.find((candidate) => candidate.id === constructionTargetId);
  if (!building || building.constructionWorkRemaining <= 0) {
    unit.setData("constructionTargetId", undefined);
    unit.setData("target", undefined);
    unit.setData("workState", "idle" satisfies UnitWorkState);
    return;
  }

  const distanceToSite = Phaser.Math.Distance.Between(unit.x, unit.y, building.x, building.y);
  if (distanceToSite > CONSTRUCTION_SITE_WORK_RADIUS_PX) {
    unit.setData("target", getLocalConstructionApproachPoint(unit, building));
    unit.setData("workState", "moving");
    return;
  }

  unit.setData("target", undefined);
  unit.setData("workState", "idle");
}

export function advanceOfflineConstruction(scene: GameScene, deltaMs: number): void {
  if (scene.onlineMode) return;

  const seconds = deltaMs / 1000;
  for (const building of scene.buildings) {
    if (building.constructionWorkRemaining <= 0) continue;

    const workersPresent = scene.units.filter((unit) => {
      const data = unit.getData("unit") as UnitData;
      if (data.kind !== "aldeano") return false;
      const id = unit.getData("constructionTargetId") as string | undefined;
      if (id !== building.id) return false;
      return Phaser.Math.Distance.Between(unit.x, unit.y, building.x, building.y) <= CONSTRUCTION_SITE_WORK_RADIUS_PX;
    }).length;

    building.constructionWorkRemaining = Math.max(0, building.constructionWorkRemaining - workersPresent * seconds);

    if (building.constructionWorkRemaining <= 0) {
      finalizeOfflineBuildingConstruction(scene, building);
    }
  }
}

export function refreshBuildingConstructionVisual(scene: GameScene, building: BuildingData): void {
  if (building.constructionWorkRemaining <= 0) return;
  const fill = building.constructionProgressFill;
  const maxW = building.constructionProgressMaxWidth;
  if (!fill || maxW === undefined) return;
  const ratio = buildingConstructionProgressRatio(building.constructionWorkRemaining, building.kind);
  fill.width = Math.max(2, ratio * maxW);
}

export function refreshAllConstructionVisuals(scene: GameScene): void {
  for (const building of scene.buildings) {
    if (building.constructionWorkRemaining > 0) {
      refreshBuildingConstructionVisual(scene, building);
    }
  }
}

export function createUnderConstructionVisual(scene: GameScene, building: BuildingData): void {
  const ratio = buildingConstructionProgressRatio(building.constructionWorkRemaining, building.kind);
  const { container, progressFill, progressWidth } = drawBuildingConstructionSite(
    scene,
    building.x,
    building.y,
    building.kind,
    ratio,
  );
  building.container = container;
  building.constructionProgressFill = progressFill;
  building.constructionProgressMaxWidth = progressWidth;
}

export function replaceBuildingWithCompleteVisual(scene: GameScene, building: BuildingData): void {
  building.container?.destroy();
  building.constructionProgressFill = undefined;
  building.constructionProgressMaxWidth = undefined;
  building.container = building.kind === "casa"
    ? drawHouse(scene, building.x, building.y)
    : drawTelpochcalli(scene, building.x, building.y);
}

function finalizeOfflineBuildingConstruction(scene: GameScene, building: BuildingData): void {
  building.constructionWorkRemaining = 0;
  replaceBuildingWithCompleteVisual(scene, building);

  if (building.kind === "casa") {
    scene.populationLimit += building.populationBonus;
  }

  for (const unit of scene.units) {
    if (unit.getData("constructionTargetId") === building.id) {
      unit.setData("constructionTargetId", undefined);
    }
  }

  scene.updateHudResources();
  scene.setStatus(`${building.label} terminada.`);
}
