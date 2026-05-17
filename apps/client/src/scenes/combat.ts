import Phaser from "phaser";
import { RESOURCES } from "@reinos/shared";
import { TRAINING, UNIT_STATS } from "../rules.js";
import type { MythicBeast, UnitData, UnitWorkState } from "../types.js";
import { formatCost } from "./economy.js";
import type { GameScene } from "./gameScene.js";

export function sendSelectedUnitToAttack(scene: GameScene, unitData: UnitData, beast: MythicBeast): void {
  if (!scene.selectedUnit || beast.dead) return;

  if (unitData.kind !== "guerrero") {
    const warrior = scene.units.find((unit: Phaser.GameObjects.Container) => {
      const candidate = unit.getData("unit") as UnitData | undefined;
      return candidate?.kind === "guerrero";
    });

    if (!warrior) {
      scene.setStatus("Necesitas un guerrero para atacar a la bestia mitica.");
      return;
    }

    scene.selectUnit(warrior);
  }

  const attacker = scene.selectedUnit;
  attacker.setData("gatherTarget", undefined);
  attacker.setData("gatherElapsed", 0);
  attacker.setData("attackTarget", beast);
  attacker.setData("workState", "moving" satisfies UnitWorkState);
  beast.dormant = false;
  beast.targetUnit = attacker;
  updateBeastLabel(beast);
  scene.setStatus(`${beast.name} ha despertado. El guerrero ataca.`);
}

export function updateUnitAttack(
  scene: GameScene,
  unit: Phaser.GameObjects.Container,
  unitData: UnitData,
  beast: MythicBeast,
  delta: number,
): void {
  const stats = UNIT_STATS[unitData.kind];
  const distance = Phaser.Math.Distance.Between(unit.x, unit.y, beast.x, beast.y);

  if (distance > stats.range) {
    unit.setData("target", getApproachPoint(unit.x, unit.y, beast.x, beast.y, stats.range - 6));
    moveUnitTowardTarget(scene, unit, unitData, delta);
    return;
  }

  unit.setData("target", undefined);
  const elapsed = (unit.getData("attackElapsed") as number) + delta;
  if (elapsed < stats.cooldownMs) {
    unit.setData("attackElapsed", elapsed);
    return;
  }

  beast.health = Math.max(0, beast.health - stats.attack);
  unit.setData("attackElapsed", 0);
  scene.pulseResourceGain(beast.x, beast.y - 72, `-${stats.attack}`);
  updateBeastLabel(beast);

  if (beast.health <= 0) {
    killBeast(scene, beast);
  }
}

export function updateBeast(scene: GameScene, delta: number): void {
  for (const beast of scene.mythicBeasts) {
    if (beast.dead || beast.dormant) continue;

    const target = findBeastTarget(scene, beast);
    if (!target) {
      beast.targetUnit = undefined;
      continue;
    }

    beast.targetUnit = target;
    const distance = Phaser.Math.Distance.Between(beast.x, beast.y, target.x, target.y);
    if (distance > beast.range) {
      const point = getApproachPoint(beast.x, beast.y, target.x, target.y, beast.range - 8);
      const step = Math.min(distance, beast.speed * (delta / 1000));
      const angle = Phaser.Math.Angle.Between(beast.x, beast.y, point.x, point.y);
      beast.x += Math.cos(angle) * step;
      beast.y += Math.sin(angle) * step;
      beast.container.setPosition(beast.x, beast.y);
      continue;
    }

    beast.attackElapsed += delta;
    if (beast.attackElapsed < beast.cooldownMs) continue;

    beast.attackElapsed = 0;
    damageUnit(scene, target, beast.attack);
  }
}

export function findBeastTarget(scene: GameScene, beast: MythicBeast): Phaser.GameObjects.Container | undefined {
  if (beast.targetUnit && scene.units.includes(beast.targetUnit)) return beast.targetUnit;

  return scene.units.find((unit: Phaser.GameObjects.Container) => {
    const unitData = unit.getData("unit") as UnitData | undefined;
    if (!unitData || unitData.kind !== "guerrero") return false;
    return Phaser.Math.Distance.Between(unit.x, unit.y, beast.x, beast.y) < 380;
  });
}

export function damageUnit(scene: GameScene, unit: Phaser.GameObjects.Container, damage: number): void {
  const unitData = unit.getData("unit") as UnitData;
  const health = Math.max(0, (unit.getData("health") as number) - damage);
  unit.setData("health", health);
  scene.updateUnitHealthLabel(unit);
  scene.pulseResourceGain(unit.x, unit.y - 44, `-${damage}`);

  if (health > 0) return;

  killUnit(scene, unit, unitData);
}

export function killUnit(scene: GameScene, unit: Phaser.GameObjects.Container, unitData: UnitData): void {
  scene.units = scene.units.filter((candidate) => candidate !== unit);
  scene.population = Math.max(0, scene.population - TRAINING[unitData.kind].population);
  if (scene.selectedUnit === unit) {
    scene.selectedUnit = undefined;
    scene.selectionRing?.destroy();
    scene.selectionRing = undefined;
  }
  unit.destroy();
  scene.setStatus(`${unitData.label} ha caido en combate.`);
  scene.updateHudResources();
}

export function killBeast(scene: GameScene, beast: MythicBeast): void {
  beast.dead = true;
  beast.container.destroy();
  scene.units.forEach((unit: Phaser.GameObjects.Container) => {
    if (unit.getData("attackTarget") === beast) {
      unit.setData("attackTarget", undefined);
      unit.setData("workState", "idle" satisfies UnitWorkState);
    }
  });
  RESOURCES.forEach((resource) => {
    scene.resources[resource] += beast.reward[resource] ?? 0;
  });
  scene.setStatus(`${beast.name} fue derrotado. Botin: ${formatCost(beast.reward)}.`);
  scene.updateHudResources();
}

export function findBeastAt(scene: GameScene, x: number, y: number): MythicBeast | undefined {
  for (const beast of scene.mythicBeasts) {
    if (beast.dead) continue;
    if (Phaser.Math.Distance.Between(x, y, beast.x, beast.y) <= 100) return beast;
  }
  return undefined;
}

export function getApproachPoint(fromX: number, fromY: number, toX: number, toY: number, range: number) {
  const angle = Phaser.Math.Angle.Between(toX, toY, fromX, fromY);
  return new Phaser.Math.Vector2(
    toX + Math.cos(angle) * range,
    toY + Math.sin(angle) * range,
  );
}

export function moveUnitTowardTarget(
  scene: GameScene,
  unit: Phaser.GameObjects.Container,
  unitData: UnitData,
  delta: number,
): void {
  const target = unit.getData("target") as Phaser.Math.Vector2 | undefined;
  if (!target) return;

  const distance = Phaser.Math.Distance.Between(unit.x, unit.y, target.x, target.y);
  if (distance < 4) {
    unit.setData("target", undefined);
    return;
  }

  const step = Math.min(distance, unitData.speed * (delta / 1000));
  const angle = Phaser.Math.Angle.Between(unit.x, unit.y, target.x, target.y);
  unit.x += Math.cos(angle) * step;
  unit.y += Math.sin(angle) * step;

  if (unit === scene.selectedUnit && scene.selectionRing) {
    scene.selectionRing.setPosition(unit.x, unit.y + 8);
  }
}

export function updateBeastLabel(beast: MythicBeast): void {
  const state = beast.dormant ? "dormido" : "despierto";
  beast.healthText.setText(`${beast.name} ${state} ${beast.health}/${beast.maxHealth}`);
}
