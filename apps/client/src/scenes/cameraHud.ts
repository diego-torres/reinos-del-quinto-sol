import Phaser from "phaser";
import { GAME_TITLE } from "@reinos/shared";
import { GAME_ICON_ASSET_KEY } from "../art.js";

export type HudSceneHost = Phaser.Scene & {
  hudRoot?: Phaser.GameObjects.Container;
  hudCamera?: Phaser.Cameras.Scene2D.Camera;
  resourceText?: Phaser.GameObjects.Text;
  carryCapacityText?: Phaser.GameObjects.Text;
  onlineText?: Phaser.GameObjects.Text;
  statusText?: Phaser.GameObjects.Text;
  formatResources: () => string;
  formatCarryCapacities: () => string;
};

export function setupHudCamera(scene: HudSceneHost): void {
  const ui = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
  ui.setScroll(0, 0);
  ui.setZoom(1);
  ui.inputEnabled = false;
  scene.hudCamera = ui;

  scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, (obj: Phaser.GameObjects.GameObject) => {
    if (obj === scene.hudRoot) return;
    ui.ignore(obj);
  });

  scene.scale.on(Phaser.Scale.Events.RESIZE, () => {
    ui.setSize(scene.scale.width, scene.scale.height);
  });
}

export function createHud(scene: HudSceneHost): void {
  const hud = new Phaser.GameObjects.Container(scene, 18, 18);
  scene.hudRoot = hud;
  hud.setDepth(10_000);

  const panel = new Phaser.GameObjects.Rectangle(scene, 0, 0, 780, 152, 0x17261d, 0.86);
  panel.setOrigin(0);
  panel.setStrokeStyle(2, 0xd7bc73, 0.55);

  const iconSize = 40;
  const titleIcon = new Phaser.GameObjects.Image(scene, 18 + iconSize / 2, 12 + 14, GAME_ICON_ASSET_KEY);
  titleIcon.setOrigin(0.5);
  titleIcon.setDisplaySize(iconSize, iconSize);

  const titleText = new Phaser.GameObjects.Text(scene, 18 + iconSize + 10, 12, GAME_TITLE, {
    fontFamily: "Georgia, serif",
    fontSize: "24px",
    color: "#f5e5b0",
  });

  scene.resourceText = new Phaser.GameObjects.Text(scene, 18, 48, scene.formatResources(), {
    fontFamily: "system-ui, sans-serif",
    fontSize: "14px",
    color: "#d9e4c5",
  });

  scene.carryCapacityText = new Phaser.GameObjects.Text(scene, 18, 76, scene.formatCarryCapacities(), {
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
    color: "#c8d6b0",
  });

  scene.onlineText = new Phaser.GameObjects.Text(scene, 502, 12, "online: conectando...", {
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
    color: "#c8d6b0",
  });

  scene.statusText = new Phaser.GameObjects.Text(scene, 18, 104, "Selecciona una unidad.", {
    fontFamily: "system-ui, sans-serif",
    fontSize: "14px",
    color: "#ffffff",
  });

  hud.add([panel, titleIcon, titleText, scene.resourceText, scene.carryCapacityText, scene.onlineText, scene.statusText]);
  scene.add.existing(hud);
  scene.cameras.main.ignore(hud);
}
