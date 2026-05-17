import Phaser from "phaser";
import { MAX_CAMERA_ZOOM, MIN_CAMERA_ZOOM, WORLD_HEIGHT, WORLD_LINEAR_SCALE, WORLD_WIDTH } from "../rules.js";
import type { GameScene } from "./gameScene.js";

export function pickWorldPointAwayFrom(ox: number, oy: number, minDist: number, margin: number): { x: number; y: number } {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const x = margin + Math.random() * (WORLD_WIDTH - margin * 2);
    const y = margin + Math.random() * (WORLD_HEIGHT - margin * 2);
    if (Math.hypot(x - ox, y - oy) >= minDist) return { x, y };
  }
  return { x: margin + 120 * WORLD_LINEAR_SCALE, y: margin + 120 * WORLD_LINEAR_SCALE };
}

export function focusCameraOnWorldPoint(scene: GameScene, x: number, y: number): void {
  const camera = scene.cameras.main;
  camera.centerOn(x, y);
  camera.scrollX = Phaser.Math.Clamp(camera.scrollX, 0, Math.max(0, WORLD_WIDTH - camera.width / camera.zoom));
  camera.scrollY = Phaser.Math.Clamp(camera.scrollY, 0, Math.max(0, WORLD_HEIGHT - camera.height / camera.zoom));
}

export function maybeFocusCameraOnOwnCenter(scene: GameScene): void {
  if (!scene.playerId || scene.didInitialCameraFocus) return;
  const mine = scene.ceremonialCenters.find((c) => c.ownerId === scene.playerId && !c.destroyed);
  if (!mine) return;
  scene.didInitialCameraFocus = true;
  focusCameraOnWorldPoint(scene, mine.x, mine.y);
}

export function updateCamera(scene: GameScene, delta: number): void {
  const camera = scene.cameras.main;
  const speed = ((620 * WORLD_LINEAR_SCALE) / camera.zoom) * (delta / 1000);
  const left = scene.cursors?.left?.isDown || scene.wasd?.A?.isDown;
  const right = scene.cursors?.right?.isDown || scene.wasd?.D?.isDown;
  const up = scene.cursors?.up?.isDown || scene.wasd?.W?.isDown;
  const down = scene.cursors?.down?.isDown || scene.wasd?.S?.isDown;

  if (left) camera.scrollX -= speed;
  if (right) camera.scrollX += speed;
  if (up) camera.scrollY -= speed;
  if (down) camera.scrollY += speed;

  camera.scrollX = Phaser.Math.Clamp(camera.scrollX, 0, Math.max(0, WORLD_WIDTH - camera.width / camera.zoom));
  camera.scrollY = Phaser.Math.Clamp(camera.scrollY, 0, Math.max(0, WORLD_HEIGHT - camera.height / camera.zoom));
}

export function adjustCameraZoom(scene: GameScene, delta: number): void {
  const camera = scene.cameras.main;
  const nextZoom = Phaser.Math.Clamp(
    Math.round((camera.zoom + delta) * 100) / 100,
    MIN_CAMERA_ZOOM,
    MAX_CAMERA_ZOOM,
  );
  camera.setZoom(nextZoom);
  camera.scrollX = Phaser.Math.Clamp(camera.scrollX, 0, Math.max(0, WORLD_WIDTH - camera.width / camera.zoom));
  camera.scrollY = Phaser.Math.Clamp(camera.scrollY, 0, Math.max(0, WORLD_HEIGHT - camera.height / camera.zoom));
  scene.setStatus(`Zoom ${Math.round(nextZoom * 100)}%. Q/E o rueda para acercar y alejar.`);
}
