import Phaser from "phaser";
import { ZOOM_STEP } from "../rules.js";
import type { GameScene } from "./gameScene.js";

export function bindGameplayInput(scene: GameScene): void {
  scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (pointer.leftButtonDown() && scene.buildMode) {
      scene.placeBuilding(pointer.worldX, pointer.worldY);
      return;
    }

    if (pointer.rightButtonDown()) {
      scene.handleRightClick(pointer.worldX, pointer.worldY);
    }
  });

  scene.input.on("wheel", (_pointer: Phaser.Input.Pointer, _objects: unknown, _deltaX: number, deltaY: number) => {
    scene.adjustCameraZoom(deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP);
  });

  scene.input.mouse?.disableContextMenu();

  scene.cursors = scene.input.keyboard?.createCursorKeys();
  scene.wasd = scene.input.keyboard?.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
  scene.input.keyboard?.on("keydown-H", () => scene.startHousePlacement());
  scene.input.keyboard?.on("keydown-T", () => scene.startTelpochcalliPlacement());
  scene.input.keyboard?.on("keydown-V", () => scene.trainVillager());
  scene.input.keyboard?.on("keydown-G", () => scene.trainWarrior());
  scene.input.keyboard?.on("keydown-Q", () => scene.adjustCameraZoom(-ZOOM_STEP));
  scene.input.keyboard?.on("keydown-E", () => scene.adjustCameraZoom(ZOOM_STEP));
}
