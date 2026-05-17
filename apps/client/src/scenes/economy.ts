import Phaser from "phaser";
import {
  DEPOSIT_APPROACH_INSET_PX,
  GATHER_APPROACH_OFFSET_PX,
  GATHER_MAX_DISTANCE_BEYOND_RADIUS_PX,
  RESOURCES,
  type FoodSource,
  type Resource,
} from "@reinos/shared";
import {
  CARRY_CAPACITY,
  CEREMONIAL_CENTER,
  CEREMONIAL_CENTER_POINTER_RADIUS_PX,
  GATHER_AMOUNT,
  GATHER_INTERVAL_MS,
  WORLD_LINEAR_SCALE,
  formatResourceName,
  getResourcePointerHitRadiusPx,
} from "../rules.js";
import type {
  DepositAfter,
  ResourceNode,
  UnitCargo,
  UnitData,
  UnitWorkState,
} from "../types.js";
import type { GameScene } from "./gameScene.js";

export function registerResourceNode(
  scene: GameScene,
  id: string,
  resource: Resource,
  label: string,
  x: number,
  y: number,
  radius: number,
  text: Phaser.GameObjects.Text,
  visuals: Phaser.GameObjects.GameObject[],
  foodSource?: FoodSource,
): void {
  const node: ResourceNode = {
    id,
    resource,
    label,
    foodSource,
    x,
    y,
    radius,
    amount: 500,
    text,
    visuals,
    depleted: false,
  };

  scene.resourceNodes.push(node);
  updateResourceNodeLabel(scene, node);
}

export function findResourceNodeAt(scene: GameScene, x: number, y: number): ResourceNode | undefined {
  return scene.resourceNodes.find((node) => {
    if (node.depleted || node.amount <= 0) return false;
    const pickR = getResourcePointerHitRadiusPx(node.radius);
    const distance = Phaser.Math.Distance.Between(x, y, node.x, node.y);
    return distance <= pickR;
  });
}

export function getGatherApproachPoint(unit: Phaser.GameObjects.Container, node: ResourceNode): Phaser.Math.Vector2 {
  const angle = Phaser.Math.Angle.Between(node.x, node.y, unit.x, unit.y);
  const distance = node.radius + GATHER_APPROACH_OFFSET_PX;
  return new Phaser.Math.Vector2(
    node.x + Math.cos(angle) * distance,
    node.y + Math.sin(angle) * distance,
  );
}

export function updateGathering(
  scene: GameScene,
  unit: Phaser.GameObjects.Container,
  unitData: UnitData,
  node: ResourceNode,
  delta: number,
): void {
  if (node.amount <= 0) {
    unit.setData("gatherTarget", undefined);
    unit.setData("gatherElapsed", 0);
    scene.setStatus(`${node.label} agotado. ${unitData.label} espera nuevas ordenes.`);
    return;
  }

  const distance = Phaser.Math.Distance.Between(unit.x, unit.y, node.x, node.y);
  if (distance > node.radius + GATHER_MAX_DISTANCE_BEYOND_RADIUS_PX) {
    unit.setData("target", getGatherApproachPoint(unit, node));
    unit.setData("workState", "moving" satisfies UnitWorkState);
    return;
  }

  const elapsed = (unit.getData("gatherElapsed") as number) + delta;
  if (elapsed < GATHER_INTERVAL_MS) {
    unit.setData("gatherElapsed", elapsed);
    return;
  }

  const cargo = scene.getUnitCargo(unit);
  if (cargo.resource && cargo.resource !== node.resource && cargo.amount > 0) {
    sendUnitToDeposit(scene, unit, node);
    return;
  }

  const capacity = CARRY_CAPACITY[node.resource];
  const remainingCapacity = capacity - cargo.amount;
  if (remainingCapacity <= 0) {
    sendUnitToDeposit(scene, unit, node);
    return;
  }

  const gathered = Math.min(GATHER_AMOUNT, node.amount, remainingCapacity);
  node.amount -= gathered;
  unit.setData("cargo", {
    resource: node.resource,
    amount: cargo.amount + gathered,
  } satisfies UnitCargo);
  unit.setData("gatherElapsed", 0);
  scene.updateUnitCargoLabel(unit);
  scene.syncDomState();
  updateResourceNodeLabel(scene, node);
  scene.pulseResourceGain(unit.x, unit.y - 42 * WORLD_LINEAR_SCALE, `carga +${gathered} ${formatResourceName(node.resource)}`);

  const updatedCargo = scene.getUnitCargo(unit);
  if (updatedCargo.amount >= capacity || node.amount <= 0) {
    sendUnitToDeposit(scene, unit, node);
  }
}

export function sendUnitToDeposit(scene: GameScene, unit: Phaser.GameObjects.Container, node: ResourceNode): void {
  const unitData = unit.getData("unit") as UnitData;
  unit.setData("gatherTarget", node);
  sendUnitToDepositPoint(scene, unit, "resume-gathering");
  scene.setStatus(`${unitData.label} vuelve al centro ceremonial para depositar su carga.`);
}

export function updateDeposit(scene: GameScene, unit: Phaser.GameObjects.Container, unitData: UnitData, node: ResourceNode): void {
  const center = getOwnCeremonialCenter(scene);
  const distance = Phaser.Math.Distance.Between(unit.x, unit.y, center.x, center.y);
  if (distance > center.radius) {
    unit.setData("target", getDepositApproachPoint(unit, scene));
    unit.setData("workState", "returning" satisfies UnitWorkState);
    return;
  }

  const cargo = scene.getUnitCargo(unit);
  if (!cargo.resource || cargo.amount <= 0) {
    finishDepositOrder(scene, unit, node);
    return;
  }

  scene.resources[cargo.resource] += cargo.amount;
  scene.pulseResourceGain(unit.x, unit.y - 46 * WORLD_LINEAR_SCALE, `+${cargo.amount} ${formatResourceName(cargo.resource)}`);
  scene.setStatus(`${unitData.label} deposito ${cargo.amount} ${formatResourceName(cargo.resource)}.`);
  unit.setData("cargo", { amount: 0 } satisfies UnitCargo);
  unit.setData("gatherElapsed", 0);
  scene.updateUnitCargoLabel(unit);

  finishDepositOrder(scene, unit, node);
  scene.updateHudResources();
}

export function finishDepositOrder(scene: GameScene, unit: Phaser.GameObjects.Container, node: ResourceNode): void {
  const depositAfter = unit.getData("depositAfter") as DepositAfter | undefined;

  if (depositAfter === "resume-gathering" && node.amount > 0) {
    unit.setData("workState", "moving" satisfies UnitWorkState);
    unit.setData("target", getGatherApproachPoint(unit, node));
  } else {
    unit.setData("gatherTarget", undefined);
    unit.setData("workState", "idle" satisfies UnitWorkState);
  }

  unit.setData("depositAfter", undefined);
}

export function getDepositApproachPoint(unit: Phaser.GameObjects.Container, scene: GameScene): Phaser.Math.Vector2 {
  const center = getOwnCeremonialCenter(scene);
  const angle = Phaser.Math.Angle.Between(center.x, center.y, unit.x, unit.y);
  const distance = center.radius - DEPOSIT_APPROACH_INSET_PX;
  return new Phaser.Math.Vector2(
    center.x + Math.cos(angle) * distance,
    center.y + Math.sin(angle) * distance,
  );
}

export function sendSelectedUnitToManualDeposit(scene: GameScene, unitData: UnitData): void {
  if (!scene.selectedUnit) return;

  if (unitData.kind !== "aldeano") {
    scene.setStatus(`${unitData.label} no puede depositar recursos.`);
    return;
  }

  const cargo = scene.getUnitCargo(scene.selectedUnit);
  if (!cargo.resource || cargo.amount <= 0) {
    scene.setStatus(`${unitData.label} no trae recursos para depositar.`);
    return;
  }

  scene.selectedUnit.setData("gatherTarget", undefined);
  sendUnitToDepositPoint(scene, scene.selectedUnit, "idle");
  scene.setStatus(`${unitData.label} va al centro ceremonial para depositar ${cargo.amount} ${formatResourceName(cargo.resource)}.`);
}

export function sendUnitToDepositPoint(scene: GameScene, unit: Phaser.GameObjects.Container, depositAfter: DepositAfter): void {
  unit.setData("target", getDepositApproachPoint(unit, scene));
  unit.setData("workState", "returning" satisfies UnitWorkState);
  unit.setData("depositAfter", depositAfter);
  unit.setData("gatherElapsed", 0);
}

export function updateManualDeposit(scene: GameScene, unit: Phaser.GameObjects.Container, unitData: UnitData): void {
  const center = getOwnCeremonialCenter(scene);
  const distance = Phaser.Math.Distance.Between(unit.x, unit.y, center.x, center.y);
  if (distance > center.radius) {
    unit.setData("target", getDepositApproachPoint(unit, scene));
    unit.setData("workState", "returning" satisfies UnitWorkState);
    return;
  }

  const cargo = scene.getUnitCargo(unit);
  if (!cargo.resource || cargo.amount <= 0) {
    unit.setData("workState", "idle" satisfies UnitWorkState);
    unit.setData("depositAfter", undefined);
    scene.setStatus(`${unitData.label} no trae recursos para depositar.`);
    return;
  }

  scene.resources[cargo.resource] += cargo.amount;
  scene.pulseResourceGain(unit.x, unit.y - 46 * WORLD_LINEAR_SCALE, `+${cargo.amount} ${formatResourceName(cargo.resource)}`);
  scene.setStatus(`${unitData.label} deposito ${cargo.amount} ${formatResourceName(cargo.resource)}.`);
  unit.setData("cargo", { amount: 0 } satisfies UnitCargo);
  unit.setData("workState", "idle" satisfies UnitWorkState);
  unit.setData("depositAfter", undefined);
  scene.updateUnitCargoLabel(unit);
  scene.updateHudResources();
}

export function isPointInCeremonialCenter(scene: GameScene, x: number, y: number): boolean {
  const center = getOwnCeremonialCenter(scene);
  return Phaser.Math.Distance.Between(x, y, center.x, center.y) <= CEREMONIAL_CENTER_POINTER_RADIUS_PX;
}

export function findCeremonialCenterAt(scene: GameScene, x: number, y: number) {
  return scene.ceremonialCenters.find((center) => {
    return (
      !center.destroyed &&
      Phaser.Math.Distance.Between(x, y, center.x, center.y) <= CEREMONIAL_CENTER_POINTER_RADIUS_PX
    );
  });
}

export function getOwnCeremonialCenter(scene: GameScene): { x: number; y: number; radius: number } {
  const center = scene.ceremonialCenters.find((candidate) => candidate.ownerId === scene.playerId);
  if (center && !center.destroyed) return center;

  if (scene.offlineFallbackCenter) {
    return {
      x: scene.offlineFallbackCenter.x,
      y: scene.offlineFallbackCenter.y,
      radius: scene.offlineFallbackCenter.radius,
    };
  }

  return {
    x: CEREMONIAL_CENTER.x,
    y: CEREMONIAL_CENTER.y,
    radius: CEREMONIAL_CENTER.depositRadius,
  };
}

export function updateResourceNodeLabel(scene: GameScene, node: ResourceNode): void {
  if (node.amount <= 0) {
    depleteResourceNode(scene, node);
    return;
  }

  node.text.setText(`${node.label} (${node.amount})`);
  scene.syncDomState();
}

export function depleteResourceNode(scene: GameScene, node: ResourceNode): void {
  if (node.depleted) return;

  node.depleted = true;
  node.amount = 0;
  node.visuals.forEach((visual) => visual.destroy());
  scene.setStatus(`${node.label} agotado.`);
  scene.syncDomState();
}

export function canAfford(scene: GameScene, cost: Partial<Record<Resource, number>>): boolean {
  return RESOURCES.every((resource) => scene.resources[resource] >= (cost[resource] ?? 0));
}

export function spendResources(scene: GameScene, cost: Partial<Record<Resource, number>>): void {
  RESOURCES.forEach((resource) => {
    scene.resources[resource] -= cost[resource] ?? 0;
  });
}

export function formatCost(cost: Partial<Record<Resource, number>>): string {
  return RESOURCES
    .filter((resource) => (cost[resource] ?? 0) > 0)
    .map((resource) => `${cost[resource]} ${formatResourceName(resource)}`)
    .join(", ");
}
