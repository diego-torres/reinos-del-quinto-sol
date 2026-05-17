import Phaser from "phaser";
import { findBeastAt } from "./combat.js";
import { findConstructionSiteAt } from "./buildingConstruction.js";
import { CEREMONIAL_CENTER_LABELS } from "./constants.js";
import { findResourceNodeAt, getOwnCeremonialCenter } from "./economy.js";
import type { GameScene } from "./gameScene.js";
import {
  CEREMONIAL_CENTER_POINTER_RADIUS_PX,
  CONSTRUCTION_SITE_POINTER_RADIUS_PX,
  getResourcePointerHitRadiusPx,
} from "../rules.js";

/**
 * Tooltip junto al cursor y contorno del objetivo bajo el puntero (recursos, obras, centro).
 */
export function setupPointerHover(scene: GameScene): void {
  const hint = scene.add
    .text(0, 0, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      color: "#fff8e7",
      backgroundColor: "#1d281ef2",
      padding: { left: 8, right: 8, top: 5, bottom: 5 },
    })
    .setScrollFactor(0)
    .setDepth(10002)
    .setVisible(false);

  const ring = scene.add.graphics();
  ring.setDepth(9);

  const clearHover = () => {
    ring.clear();
    hint.setVisible(false);
    scene.input.setDefaultCursor("default");
  };

  scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
    if (!scene.input.manager.isOver) {
      clearHover();
      return;
    }

    hint.setPosition(pointer.x + 14, pointer.y + 18);

    const wx = pointer.worldX;
    const wy = pointer.worldY;

    ring.clear();

    const node = findResourceNodeAt(scene, wx, wy);
    if (node) {
      const r = getResourcePointerHitRadiusPx(node.radius);
      ring.lineStyle(3, 0xf5d76e, 0.95);
      ring.strokeCircle(node.x, node.y, r);
      hint.setText(`${node.label} · ${node.resource} (${node.amount})`);
      hint.setVisible(true);
      scene.input.setDefaultCursor("pointer");
      return;
    }

    const construction = findConstructionSiteAt(scene, wx, wy);
    if (construction) {
      ring.lineStyle(3, 0xe8c468, 0.9);
      ring.strokeCircle(construction.x, construction.y, CONSTRUCTION_SITE_POINTER_RADIUS_PX);
      hint.setText(`${construction.label} · en construcción`);
      hint.setVisible(true);
      scene.input.setDefaultCursor("pointer");
      return;
    }

    const listedCenter = scene.ceremonialCenters.find(
      (c) =>
        !c.destroyed && Phaser.Math.Distance.Between(wx, wy, c.x, c.y) <= CEREMONIAL_CENTER_POINTER_RADIUS_PX,
    );
    if (listedCenter) {
      ring.lineStyle(3, 0xc8e7ff, 0.92);
      ring.strokeCircle(listedCenter.x, listedCenter.y, CEREMONIAL_CENTER_POINTER_RADIUS_PX);
      const cult = CEREMONIAL_CENTER_LABELS[listedCenter.culture];
      hint.setText(`Centro ceremonial (${cult})`);
      hint.setVisible(true);
      scene.input.setDefaultCursor("pointer");
      return;
    }

    const own = getOwnCeremonialCenter(scene);
    if (Phaser.Math.Distance.Between(wx, wy, own.x, own.y) <= CEREMONIAL_CENTER_POINTER_RADIUS_PX) {
      ring.lineStyle(3, 0xc8e7ff, 0.92);
      ring.strokeCircle(own.x, own.y, CEREMONIAL_CENTER_POINTER_RADIUS_PX);
      const cult = scene.offlineFallbackCenter?.culture;
      hint.setText(cult ? `Centro ceremonial (${CEREMONIAL_CENTER_LABELS[cult]})` : "Centro ceremonial");
      hint.setVisible(true);
      scene.input.setDefaultCursor("pointer");
      return;
    }

    const beast = findBeastAt(scene, wx, wy);
    if (beast && !beast.dead) {
      hint.setText(beast.dormant ? `${beast.name} (en reposo)` : `${beast.name}`);
      hint.setVisible(true);
      scene.input.setDefaultCursor("pointer");
      return;
    }

    clearHover();
  });

  const canvas = scene.game.canvas;
  if (canvas) {
    canvas.addEventListener("mouseleave", clearHover);
  }
}
