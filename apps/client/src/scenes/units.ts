import Phaser from "phaser";
import { UNIT_MOVE_ARRIVAL_EPS_PX, type CeremonialCenterCulture } from "@reinos/shared";
import { labelStyle } from "../art.js";
import { CARRY_CAPACITY, TRAINING, UNIT_STATS, WORLD_EDGE_MARGIN, WORLD_HEIGHT, WORLD_LINEAR_SCALE, WORLD_WIDTH, formatResourceName } from "../rules.js";
import type { MythicBeast, ResourceNode, UnitCargo, UnitData, UnitKind, UnitWorkState } from "../types.js";
import {
  createVillagerSkin,
  createVillagerVisuals,
  updateVillagerAnimation,
} from "../villagerAssets.js";
import {
  findCeremonialCenterAt,
  findResourceNodeAt,
  getGatherApproachPoint,
  isPointInCeremonialCenter,
  sendSelectedUnitToManualDeposit,
  updateDeposit,
  updateGathering,
  updateManualDeposit,
} from "./economy.js";
import {
  findBeastAt,
  sendSelectedUnitToAttack,
  updateUnitAttack,
} from "./combat.js";
import {
  canAfford,
  formatCost,
  getOwnCeremonialCenter,
  spendResources,
} from "./economy.js";
import type { GameScene } from "./gameScene.js";
import {
  canVillagerHelpConstruction,
  findConstructionSiteAt,
  getLocalConstructionApproachPoint,
  updateOfflineConstructionWorker,
} from "./buildingConstruction.js";
import {
  sendOnlineAssignConstructionCommand,
  sendOnlineAttackCenterCommand,
  sendOnlineDepositCommand,
  sendOnlineGatherCommand,
  sendOnlineMoveCommand,
} from "./server.js";
import { playUnitOrderFeedback, playUnitSelectionFeedback } from "./unitAudio.js";

export function handleRightClick(scene: GameScene, x: number, y: number): void {
  if (!scene.selectedUnit) return;

  const unitData = scene.selectedUnit.getData("unit") as UnitData;
  const resourceNode = findResourceNodeAt(scene, x, y);
  const center = findCeremonialCenterAt(scene, x, y);
  const beast = findBeastAt(scene, x, y);

  if (beast) {
    scene.selectedUnit.setData("buildingTarget", undefined);
    scene.selectedUnit.setData("constructionTargetId", undefined);
    playUnitOrderFeedback(scene, unitData);
    sendSelectedUnitToAttack(scene, unitData, beast);
    return;
  }

  if (center) {
    if (center.ownerId === unitData.ownerId || (!unitData.ownerId && center.ownerId === scene.playerId)) {
      if (scene.onlineMode && sendOnlineDepositCommand(scene, unitData)) {
        scene.selectedUnit.setData("buildingTarget", undefined);
        scene.selectedUnit.setData("constructionTargetId", undefined);
        playUnitOrderFeedback(scene, unitData);
        return;
      }

      scene.selectedUnit.setData("buildingTarget", undefined);
      scene.selectedUnit.setData("constructionTargetId", undefined);
      playUnitOrderFeedback(scene, unitData);
      sendSelectedUnitToManualDeposit(scene, unitData);
      return;
    }

    if (scene.onlineMode && sendOnlineAttackCenterCommand(scene, unitData, center)) {
      scene.selectedUnit.setData("buildingTarget", undefined);
      scene.selectedUnit.setData("constructionTargetId", undefined);
      playUnitOrderFeedback(scene, unitData);
      return;
    }

    scene.setStatus("El centro ceremonial enemigo solo se puede atacar en modo online.");
    return;
  }

  const constructionSite = findConstructionSiteAt(scene, x, y);
  if (constructionSite && canVillagerHelpConstruction(scene, unitData, constructionSite)) {
    if (scene.onlineMode) {
      if (sendOnlineAssignConstructionCommand(scene, unitData, constructionSite.id)) {
        scene.selectedUnit.setData("buildingTarget", undefined);
        scene.selectedUnit.setData("gatherTarget", undefined);
        scene.selectedUnit.setData("gatherElapsed", 0);
        playUnitOrderFeedback(scene, unitData);
      }
      return;
    }

    scene.selectedUnit.setData("buildingTarget", undefined);
    scene.selectedUnit.setData("gatherTarget", undefined);
    scene.selectedUnit.setData("gatherElapsed", 0);
    scene.selectedUnit.setData("constructionTargetId", constructionSite.id);
    scene.selectedUnit.setData("target", getLocalConstructionApproachPoint(scene.selectedUnit, constructionSite));
    scene.selectedUnit.setData("workState", "moving" satisfies UnitWorkState);
    playUnitOrderFeedback(scene, unitData);
    scene.setStatus(`${unitData.label} ayuda en la obra de ${constructionSite.label}.`);
    return;
  }

  if (resourceNode) {
    if (unitData.kind !== "aldeano") {
      scene.setStatus(`${unitData.label} no recolecta recursos.`);
      return;
    }

    if (scene.onlineMode && sendOnlineGatherCommand(scene, unitData, resourceNode)) {
      scene.selectedUnit.setData("buildingTarget", undefined);
      scene.selectedUnit.setData("constructionTargetId", undefined);
      playUnitOrderFeedback(scene, unitData);
      return;
    }

    scene.selectedUnit.setData("buildingTarget", undefined);
    scene.selectedUnit.setData("constructionTargetId", undefined);
    playUnitOrderFeedback(scene, unitData);
    sendUnitToGather(scene, scene.selectedUnit, resourceNode);
    return;
  }

  if (isPointInCeremonialCenter(scene, x, y)) {
    if (scene.onlineMode && sendOnlineDepositCommand(scene, unitData)) {
      scene.selectedUnit.setData("buildingTarget", undefined);
      scene.selectedUnit.setData("constructionTargetId", undefined);
      playUnitOrderFeedback(scene, unitData);
      return;
    }

    scene.selectedUnit.setData("buildingTarget", undefined);
    scene.selectedUnit.setData("constructionTargetId", undefined);
    playUnitOrderFeedback(scene, unitData);
    sendSelectedUnitToManualDeposit(scene, unitData);
    return;
  }

  if (scene.onlineMode && sendOnlineMoveCommand(scene, unitData, x, y)) {
    scene.selectedUnit.setData("buildingTarget", undefined);
    scene.selectedUnit.setData("constructionTargetId", undefined);
    playUnitOrderFeedback(scene, unitData);
    return;
  }

  scene.selectedUnit.setData("gatherTarget", undefined);
  scene.selectedUnit.setData("gatherElapsed", 0);
  scene.selectedUnit.setData("attackTarget", undefined);
  scene.selectedUnit.setData("buildingTarget", undefined);
  scene.selectedUnit.setData("constructionTargetId", undefined);
  scene.selectedUnit.setData("workState", "moving" satisfies UnitWorkState);
  playUnitOrderFeedback(scene, unitData);
  moveSelectedUnit(scene, x, y);
}

export function moveSelectedUnit(scene: GameScene, x: number, y: number): void {
  if (!scene.selectedUnit) return;

  const unitData = scene.selectedUnit.getData("unit") as UnitData;
  scene.selectedUnit.setData("target", new Phaser.Math.Vector2(x, y));
  scene.selectedUnit.setData("workState", "moving" satisfies UnitWorkState);
  scene.selectedUnit.setData("attackTarget", undefined);
  scene.selectedUnit.setData("constructionTargetId", undefined);
  scene.setStatus(`${unitData.label} avanzando a ${Math.round(x)}, ${Math.round(y)}.`);

  scene.targetMarkers.get(unitData.id)?.destroy();
  const marker = scene.add.circle(x, y, 10, 0xf5d76e, 0.85).setStrokeStyle(2, 0x2b201a).setDepth(8);
  scene.targetMarkers.set(unitData.id, marker);
  scene.tweens.add({
    targets: marker,
    alpha: 0.15,
    scale: 1.8,
    duration: 550,
    yoyo: true,
    repeat: 1,
  });
}

export function sendUnitToGather(scene: GameScene, unit: Phaser.GameObjects.Container, resourceNode: ResourceNode): void {
  const unitData = unit.getData("unit") as UnitData;
  const approach = getGatherApproachPoint(unit, resourceNode);

  unit.setData("gatherTarget", resourceNode);
  unit.setData("gatherElapsed", 0);
  unit.setData("constructionTargetId", undefined);
  unit.setData("target", approach);
  unit.setData("workState", "moving" satisfies UnitWorkState);
  scene.setStatus(`${unitData.label} va hacia ${resourceNode.label.toLowerCase()} para recolectar.`);

  scene.targetMarkers.get(unitData.id)?.destroy();
  const marker = scene.add.circle(resourceNode.x, resourceNode.y, 12, 0x89d26a, 0.85).setStrokeStyle(2, 0x1d281e).setDepth(8);
  scene.targetMarkers.set(unitData.id, marker);
  scene.tweens.add({
    targets: marker,
    alpha: 0.2,
    scale: 2,
    duration: 650,
    yoyo: true,
    repeat: 1,
  });
}

export function updateUnits(scene: GameScene, delta: number): void {
  const seconds = delta / 1000;

  scene.children.each((child) => {
    if (!(child instanceof Phaser.GameObjects.Container)) return true;

    const unitData = child.getData("unit") as UnitData | undefined;
    const target = child.getData("target") as Phaser.Math.Vector2 | undefined;
    const gatherTarget = child.getData("gatherTarget") as ResourceNode | undefined;
    const workState = child.getData("workState") as UnitWorkState | undefined;
    const attackTarget = child.getData("attackTarget") as MythicBeast | undefined;
    if (!unitData) return true;
    updateVillagerAnimation(scene, child, delta);

    if (attackTarget && !attackTarget.dead) {
      updateUnitAttack(scene, child, unitData, attackTarget, delta);
      return true;
    }

    const constructionTargetId = child.getData("constructionTargetId") as string | undefined;
    if (!scene.onlineMode && !target && constructionTargetId && unitData.kind === "aldeano") {
      updateOfflineConstructionWorker(scene, child, constructionTargetId);
      return true;
    }

    if (!target && gatherTarget) {
      if (workState === "returning") {
        updateDeposit(scene, child, unitData, gatherTarget);
      } else {
        updateGathering(scene, child, unitData, gatherTarget, delta);
      }
      return true;
    }

    if (!target && workState === "returning") {
      updateManualDeposit(scene, child, unitData);
      return true;
    }

    if (!target) return true;

    const distance = Phaser.Math.Distance.Between(child.x, child.y, target.x, target.y);
    if (distance < UNIT_MOVE_ARRIVAL_EPS_PX) {
      child.setData("target", undefined);
      scene.targetMarkers.get(unitData.id)?.destroy();
      scene.targetMarkers.delete(unitData.id);
      if (gatherTarget) {
        const nextState = workState === "returning" ? "returning" : "gathering";
        child.setData("workState", nextState satisfies UnitWorkState);
        scene.setStatus(
          nextState === "returning"
            ? `${unitData.label} depositando carga en el centro ceremonial.`
            : `${unitData.label} recolectando ${gatherTarget.label.toLowerCase()}.`,
        );
      } else {
        if (workState === "returning") {
          scene.setStatus(`${unitData.label} depositando carga en el centro ceremonial.`);
        } else {
          child.setData("workState", "idle" satisfies UnitWorkState);
        }
      }
      return true;
    }

    const step = Math.min(distance, unitData.speed * seconds);
    const angle = Phaser.Math.Angle.Between(child.x, child.y, target.x, target.y);
    child.x += Math.cos(angle) * step;
    child.y += Math.sin(angle) * step;
    if (child === scene.selectedUnit && scene.selectionRing) {
      scene.selectionRing.setPosition(child.x, child.y + 8 * WORLD_LINEAR_SCALE);
    }

    return true;
  });
  scene.syncDomState();
}

/** Offsets Y en px de pantalla (ancla en el pie del personaje); no usar WORLD_LINEAR_SCALE aquí. */
const UNIT_LABEL_HEALTH_OFFSET_Y = 38;
const UNIT_LABEL_CARGO_OFFSET_Y = 52;

export function createUnit(scene: GameScene, x: number, y: number, data: UnitData): Phaser.GameObjects.Container {
  const unit = scene.add.container(x, y);
  if (data.kind === "aldeano" && !data.skin) {
    data.skin = createVillagerSkin(data.id, resolveVillagerCulture(scene, data.ownerId));
  }
  unit.setData("unit", data);
  unit.setData("health", UNIT_STATS[data.kind].maxHealth);
  unit.setData("attackElapsed", 0);
  unit.setData("attackTarget", undefined);
  unit.setData("target", undefined);
  unit.setData("gatherTarget", undefined);
  unit.setData("gatherElapsed", 0);
  unit.setData("cargo", { amount: 0 } satisfies UnitCargo);
  unit.setData("workState", "idle" satisfies UnitWorkState);
  unit.setData("constructionTargetId", undefined);
  unit.setSize(52 * WORLD_LINEAR_SCALE, 60 * WORLD_LINEAR_SCALE);
  unit.setInteractive(
    new Phaser.Geom.Circle(0, 0, 34 * WORLD_LINEAR_SCALE),
    Phaser.Geom.Circle.Contains,
  );

  const unitVisuals = createUnitVisuals(scene, data);
  const ownerLabel = data.ownerId && data.ownerId !== scene.playerId ? ` ${data.ownerId.replace("player-", "P")}` : "";
  const label = scene.add.text(
    0,
    UNIT_LABEL_HEALTH_OFFSET_Y,
    `${data.label}${ownerLabel} ${UNIT_STATS[data.kind].maxHealth}/${UNIT_STATS[data.kind].maxHealth}`,
    labelStyle(13),
  ).setOrigin(0.5);
  const cargoLabel = scene.add.text(0, UNIT_LABEL_CARGO_OFFSET_Y, "", labelStyle(12)).setOrigin(0.5);

  unit.add([...unitVisuals.objects, label, cargoLabel]);
  if (unitVisuals.villagerRig) {
    unit.setData("villagerRig", unitVisuals.villagerRig);
  }
  unit.setData("healthLabel", label);
  unit.setData("cargoLabel", cargoLabel);
  updateUnitCargoLabel(scene, unit);

  unit.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (pointer.leftButtonDown()) {
      selectUnit(scene, unit);
      pointer.event.stopPropagation();
    }
  });

  unit.setDepth(10);
  scene.units.push(unit);
  return unit;
}

function createUnitVisuals(scene: GameScene, data: UnitData) {
  if (data.kind === "aldeano") {
    const rig = createVillagerVisuals(scene, data);
    return {
      objects: [rig.root],
      villagerRig: rig,
    };
  }

  const shadow = scene.add.ellipse(0, 28, 48, 18, 0x000000, 0.22);
  const body = scene.add.ellipse(0, 4, 34, 44, data.color);
  const head = scene.add.circle(0, -24, 13, 0xc98957);
  const accent = data.kind === "guerrero"
    ? scene.add.rectangle(20, -2, 7, 56, 0x2b201a).setRotation(-0.45)
    : scene.add.rectangle(-20, 2, 8, 42, 0x6b4328).setRotation(0.35);
  const marker = data.kind === "guerrero"
    ? scene.add.triangle(0, -44, -12, 10, 0, -12, 12, 10, 0x223d63)
    : scene.add.arc(0, -39, 13, 210, 330, false, 0xf0c94a);

  return {
    objects: [shadow, body, head, accent, marker],
  };
}

export function selectUnit(scene: GameScene, unit: Phaser.GameObjects.Container): void {
  scene.selectedUnit = unit;
  scene.selectionRing?.destroy();
  scene.selectionRing = scene.add.ellipse(
    unit.x,
    unit.y + 8 * WORLD_LINEAR_SCALE,
    66 * WORLD_LINEAR_SCALE,
    40 * WORLD_LINEAR_SCALE,
  );
  scene.selectionRing.setStrokeStyle(3, 0xf5d76e, 0.95);
  scene.selectionRing.setDepth(8);
  unit.setDepth(10);

  const unitData = unit.getData("unit") as UnitData;
  playUnitSelectionFeedback(scene, unitData);
  const hint = unitData.kind === "aldeano"
    ? "Clic derecho: recurso, obra en construcción o mover. H casa, T telpochcalli."
    : "Clic derecho para mover o atacar el centro enemigo.";
  scene.setStatus(`${unitData.label} seleccionado. ${hint}`);
}

export function trainVillager(scene: GameScene): void {
  if (scene.isTrainingVillager) {
    scene.setStatus("El centro ceremonial ya esta entrenando un aldeano.");
    return;
  }

  if (!canTrain(scene, "aldeano")) return;

  scene.isTrainingVillager = true;
  spendTrainingCost(scene, "aldeano");
  scene.population += TRAINING.aldeano.population;
  scene.updateHudResources();
  scene.setStatus(`Entrenando aldeano (${TRAINING.aldeano.durationMs / 1000}s).`);

  scene.time.delayedCall(TRAINING.aldeano.durationMs, () => {
    const centerCoords = getOwnCeremonialCenter(scene);
    const spawn = getSpawnPointNear(scene, centerCoords.x, centerCoords.y, 230 * WORLD_LINEAR_SCALE);
    const unit = createUnit(scene, spawn.x, spawn.y, {
      id: `aldeano-${scene.nextUnitId++}`,
      kind: "aldeano",
      label: "Aldeano",
      color: 0xe5c16f,
      speed: 170 * WORLD_LINEAR_SCALE,
      skin: createVillagerSkin(`local:aldeano-${scene.nextUnitId}`, resolveVillagerCulture(scene)),
    });
    scene.isTrainingVillager = false;
    selectUnit(scene, unit);
    scene.setStatus("Aldeano entrenado en el centro ceremonial.");
    scene.updateHudResources();
  });
}

function resolveVillagerCulture(scene: GameScene, ownerId?: string): CeremonialCenterCulture {
  const center = scene.ceremonialCenters.find((candidate) => candidate.ownerId === (ownerId ?? scene.playerId));
  return center?.culture ?? scene.offlineFallbackCenter?.culture ?? "maya";
}

export function trainWarrior(scene: GameScene): void {
  if (scene.isTrainingWarrior) {
    scene.setStatus("El telpochcalli ya esta entrenando un guerrero.");
    return;
  }

  const telpochcalli = scene.buildings.find(
    (building) => building.kind === "telpochcalli" && building.constructionWorkRemaining <= 0,
  );
  if (!telpochcalli) {
    scene.setStatus("Construye un telpochcalli antes de entrenar guerreros.");
    return;
  }

  if (!canTrain(scene, "guerrero")) return;

  scene.isTrainingWarrior = true;
  spendTrainingCost(scene, "guerrero");
  scene.population += TRAINING.guerrero.population;
  scene.updateHudResources();
  scene.setStatus(`Entrenando guerrero (${TRAINING.guerrero.durationMs / 1000}s).`);

  scene.time.delayedCall(TRAINING.guerrero.durationMs, () => {
    const spawn = getSpawnPointNear(scene, telpochcalli.x, telpochcalli.y, 150 * WORLD_LINEAR_SCALE);
    const unit = createUnit(scene, spawn.x, spawn.y, {
      id: `guerrero-${scene.nextUnitId++}`,
      kind: "guerrero",
      label: "Guerrero",
      color: 0xb84a3b,
      speed: 190 * WORLD_LINEAR_SCALE,
    });
    scene.isTrainingWarrior = false;
    selectUnit(scene, unit);
    scene.setStatus("Guerrero entrenado en el telpochcalli.");
    scene.updateHudResources();
  });
}

function spendTrainingCost(scene: GameScene, kind: UnitKind): void {
  spendResources(scene, TRAINING[kind].cost);
}

function canTrain(scene: GameScene, kind: UnitKind): boolean {
  const training = TRAINING[kind];
  if (scene.population + training.population > scene.populationLimit) {
    scene.setStatus(`Limite de poblacion alcanzado: ${scene.population}/${scene.populationLimit}. Construye casas.`);
    return false;
  }

  if (!canAfford(scene, training.cost)) {
    scene.setStatus(`Recursos insuficientes para ${training.label.toLowerCase()}. Necesitas ${formatCost(training.cost)}.`);
    return false;
  }

  return true;
}

function getSpawnPointNear(scene: GameScene, x: number, y: number, distance: number): Phaser.Math.Vector2 {
  const angle = Phaser.Math.DegToRad(35 + scene.units.length * 37);
  return new Phaser.Math.Vector2(
    Phaser.Math.Clamp(x + Math.cos(angle) * distance, WORLD_EDGE_MARGIN, WORLD_WIDTH - WORLD_EDGE_MARGIN),
    Phaser.Math.Clamp(y + Math.sin(angle) * distance, WORLD_EDGE_MARGIN, WORLD_HEIGHT - WORLD_EDGE_MARGIN),
  );
}

export function updateUnitHealthLabel(scene: GameScene, unit: Phaser.GameObjects.Container): void {
  const unitData = unit.getData("unit") as UnitData;
  const healthLabel = unit.getData("healthLabel") as Phaser.GameObjects.Text | undefined;
  if (!healthLabel) return;

  healthLabel.setText(`${unitData.label} ${unit.getData("health")}/${UNIT_STATS[unitData.kind].maxHealth}`);
}

export function getUnitCargo(scene: GameScene, unit: Phaser.GameObjects.Container): UnitCargo {
  return unit.getData("cargo") as UnitCargo;
}

export function updateUnitCargoLabel(scene: GameScene, unit: Phaser.GameObjects.Container): void {
  const cargoLabel = unit.getData("cargoLabel") as Phaser.GameObjects.Text | undefined;
  const cargo = getUnitCargo(scene, unit);
  if (!cargoLabel) return;

  if (!cargo.resource || cargo.amount <= 0) {
    cargoLabel.setText("");
    return;
  }

  cargoLabel.setText(`${formatResourceName(cargo.resource)} ${cargo.amount}/${CARRY_CAPACITY[cargo.resource]}`);
}
