import Phaser from "phaser";
import { ZOOM_STEP } from "../rules.js";
import type { GameScene } from "./gameScene.js";

function pointerWorldXY(scene: GameScene, pointer: Phaser.Input.Pointer): { x: number; y: number } {
  return scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
}

/** En pointerdown, algunos navegadores no marcan aún rightButtonDown(); usar DOM button. */
function isRightClickPointer(pointer: Phaser.Input.Pointer): boolean {
  if (pointer.rightButtonDown()) return true;
  if (pointer.button === 2) return true;
  const ev = pointer.event as MouseEvent | undefined;
  return !!ev && ev.button === 2;
}

export function bindGameplayInput(scene: GameScene): void {
  scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    const { x: worldX, y: worldY } = pointerWorldXY(scene, pointer);

    if (pointer.leftButtonDown() && scene.buildMode) {
      scene.placeBuilding(worldX, worldY);
      return;
    }

    if (isRightClickPointer(pointer)) {
      scene.handleRightClick(worldX, worldY);
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
