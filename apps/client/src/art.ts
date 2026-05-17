import Phaser from "phaser";
import type { CeremonialCenterCulture, OnlineResourceNodeState, Resource } from "@reinos/shared";
import { createInitialResourceNodes, normalizeCeremonialCenterCulture } from "@reinos/shared";
import type { MythicBeast } from "./types.js";
import { TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "./rules.js";

export const HOUSE_ASSET_KEY = "building-house-flat";
export const VILLAGER_ASSET_KEY = "unit-villager-flat";

export const CEREMONIAL_CENTER_DISPLAY_SIZE = 280;

export const CEREMONIAL_CENTER_TEXTURE_KEYS: Record<CeremonialCenterCulture, string> = {
  mexica: "ceremonial-center-mexica",
  tlaxcalteca: "ceremonial-center-tlaxcalteca",
  inca: "ceremonial-center-inca",
  maya: "ceremonial-center-maya",
};

function resolveCeremonialCenterTextureKey(scene: Phaser.Scene, culture: CeremonialCenterCulture): string {
  const normalized = normalizeCeremonialCenterCulture(culture);
  const primary = CEREMONIAL_CENTER_TEXTURE_KEYS[normalized];
  if (scene.textures.exists(primary)) return primary;
  const fallback = CEREMONIAL_CENTER_TEXTURE_KEYS.maya;
  if (scene.textures.exists(fallback)) return fallback;
  return primary;
}

type RegisterResourceNode = (
  id: string,
  resource: Resource,
  label: string,
  x: number,
  y: number,
  radius: number,
  text: Phaser.GameObjects.Text,
  visuals: Phaser.GameObjects.GameObject[],
) => void;

export function labelStyle(fontSize = 14): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: "system-ui, sans-serif",
    fontSize: `${fontSize}px`,
    color: "#fff4cf",
    stroke: "#1d281e",
    strokeThickness: 4,
  };
}

export function drawTerrain(scene: Phaser.Scene) {
  const graphics = scene.add.graphics();
  const earthTiles = [0xb96542, 0xc47a4e, 0xa9573b, 0xb86f49];

  for (let y = 0; y < WORLD_HEIGHT; y += TILE_SIZE) {
    for (let x = 0; x < WORLD_WIDTH; x += TILE_SIZE) {
      const tileIndex = (x / TILE_SIZE + y / TILE_SIZE * 2) % earthTiles.length;
      const shade = earthTiles[tileIndex];
      graphics.fillStyle(shade, 1);
      graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }
  }

  graphics.lineStyle(1, 0x743d2e, 0.24);
  for (let x = 0; x <= WORLD_WIDTH; x += TILE_SIZE) {
    graphics.lineBetween(x, 0, x, WORLD_HEIGHT);
  }
  for (let y = 0; y <= WORLD_HEIGHT; y += TILE_SIZE) {
    graphics.lineBetween(0, y, WORLD_WIDTH, y);
  }
}

export function drawResourceClusters(scene: Phaser.Scene, registerResourceNode: RegisterResourceNode) {
  for (const node of createInitialResourceNodes()) {
    if (node.resource === "maiz") drawMaizeField(scene, node, registerResourceNode);
    else if (node.resource === "madera") drawForest(scene, node, registerResourceNode);
    else if (node.resource === "piedra") drawStoneOutcrop(scene, node, registerResourceNode);
    else drawObsidianDeposit(scene, node, registerResourceNode);
  }
}

export function drawCeremonialCenter(scene: Phaser.Scene, x: number, y: number, culture: CeremonialCenterCulture) {
  const base = scene.add.container(x, y);
  base.setDepth(2);
  const textureKey = resolveCeremonialCenterTextureKey(scene, culture);

  if (scene.textures.exists(textureKey)) {
    base.add(
      scene.add
        .image(0, 0, textureKey)
        .setDisplaySize(CEREMONIAL_CENTER_DISPLAY_SIZE, CEREMONIAL_CENTER_DISPLAY_SIZE),
    );
  } else {
    base.add(scene.add.rectangle(0, 88, 260, 84, 0xb9a66f).setStrokeStyle(4, 0x735f38));
    base.add(scene.add.rectangle(0, 35, 210, 74, 0xc8b77a).setStrokeStyle(4, 0x735f38));
    base.add(scene.add.rectangle(0, -12, 152, 58, 0xd5c585).setStrokeStyle(4, 0x735f38));
    base.add(scene.add.rectangle(0, -52, 76, 38, 0x7d3f2b).setStrokeStyle(4, 0x4d2c21));
    base.add(scene.add.rectangle(0, 58, 42, 142, 0x8e7445, 0.45));
  }

  const labelY = CEREMONIAL_CENTER_DISPLAY_SIZE / 2 + 26;
  base.add(scene.add.text(0, labelY, "Centro ceremonial", labelStyle(15)).setOrigin(0.5));
  return base;
}

export function drawHouse(scene: Phaser.Scene, x: number, y: number) {
  if (scene.textures.exists(HOUSE_ASSET_KEY)) {
    const house = scene.add.container(x, y);
    house.setDepth(2);
    house.add(scene.add.image(0, 10, HOUSE_ASSET_KEY).setDisplaySize(128, 128));
    house.add(scene.add.text(0, 82, "Casa", labelStyle(13)).setOrigin(0.5));
    return house;
  }

  const house = scene.add.container(x, y);
  house.setDepth(2);
  house.add(scene.add.ellipse(0, 38, 92, 24, 0x000000, 0.18));
  house.add(scene.add.rectangle(0, 22, 86, 52, 0xb98a58).setStrokeStyle(4, 0x5a3a24));
  house.add(scene.add.triangle(0, -26, -52, 20, 0, -60, 52, 20, 0x7d3f2b).setStrokeStyle(4, 0x4d2c21));
  house.add(scene.add.rectangle(0, 36, 24, 28, 0x3c281d).setStrokeStyle(2, 0x20140f));
  house.add(scene.add.rectangle(-24, 18, 16, 14, 0xf0c94a, 0.45).setStrokeStyle(2, 0x5a3a24));
  house.add(scene.add.text(0, 82, "Casa", labelStyle(13)).setOrigin(0.5));
  return house;
}

export function drawTelpochcalli(scene: Phaser.Scene, x: number, y: number) {
  const building = scene.add.container(x, y);
  building.setDepth(2);
  building.add(scene.add.ellipse(0, 54, 144, 28, 0x000000, 0.18));
  building.add(scene.add.rectangle(0, 28, 126, 72, 0x9b6b42).setStrokeStyle(4, 0x4d2c21));
  building.add(scene.add.rectangle(0, -20, 148, 36, 0x7d3f2b).setStrokeStyle(4, 0x351d17));
  building.add(scene.add.triangle(-46, -44, -20, -16, -46, -76, -72, -16, 0xd7bc73).setStrokeStyle(3, 0x4d2c21));
  building.add(scene.add.triangle(46, -44, 72, -16, 46, -76, 20, -16, 0xd7bc73).setStrokeStyle(3, 0x4d2c21));
  building.add(scene.add.rectangle(0, 38, 34, 48, 0x271913).setStrokeStyle(2, 0x120b08));
  building.add(scene.add.rectangle(-36, 26, 18, 18, 0x223d63, 0.75).setStrokeStyle(2, 0x111c2d));
  building.add(scene.add.rectangle(36, 26, 18, 18, 0x223d63, 0.75).setStrokeStyle(2, 0x111c2d));
  building.add(scene.add.text(0, 104, "Telpochcalli", labelStyle(13)).setOrigin(0.5));
  return building;
}

export function createCamazotz(
  scene: Phaser.Scene,
  x: number,
  y: number,
  options?: { id?: string; name?: string },
): MythicBeast {
  const id = options?.id ?? "camazotz-1";
  const name = options?.name ?? "Camazotz";
  const container = scene.add.container(x, y);
  container.setDepth(3);

  container.add(scene.add.ellipse(0, 48, 150, 26, 0x000000, 0.25));
  container.add(scene.add.triangle(-44, -4, -138, 34, -26, 22, -66, -72, 0x211827).setStrokeStyle(3, 0x5c2745));
  container.add(scene.add.triangle(44, -4, 138, 34, 26, 22, 66, -72, 0x211827).setStrokeStyle(3, 0x5c2745));
  container.add(scene.add.ellipse(0, 8, 70, 86, 0x37213a).setStrokeStyle(4, 0x130d19));
  container.add(scene.add.circle(-18, -20, 8, 0xf5d76e));
  container.add(scene.add.circle(18, -20, 8, 0xf5d76e));
  container.add(scene.add.triangle(0, -2, -8, 14, 0, 30, 8, 14, 0xe8e0c8));
  container.add(scene.add.triangle(-20, -52, -8, -28, -30, -28, -26, -76, 0x2b1d33));
  container.add(scene.add.triangle(20, -52, 8, -28, 30, -28, 26, -76, 0x2b1d33));

  const healthText = scene.add.text(0, 92, `${name} dormido 90/90`, labelStyle(13)).setOrigin(0.5);
  container.add(healthText);

  return {
    id,
    name,
    x,
    y,
    container,
    health: 90,
    maxHealth: 90,
    attack: 10,
    range: 66,
    speed: 115,
    cooldownMs: 1100,
    attackElapsed: 0,
    dormant: true,
    dead: false,
    reward: {
      maiz: 100,
      piedra: 80,
      obsidiana: 50,
    },
    healthText,
  };
}

function drawMaizeField(scene: Phaser.Scene, node: OnlineResourceNodeState, registerResourceNode: RegisterResourceNode) {
  const x = node.x - 56;
  const y = node.y - 34;
  const group = scene.add.container(x, y);
  for (let i = 0; i < 18; i++) {
    const px = (i % 6) * 24;
    const py = Math.floor(i / 6) * 30;
    const stalk = scene.add.rectangle(px, py, 5, 34, 0x73a942);
    const cob = scene.add.ellipse(px + 5, py - 4, 11, 22, 0xf0c94a);
    group.add([stalk, cob]);
  }
  const label = scene.add.text(x - 8, y + 92, node.label, labelStyle()).setOrigin(0.5);
  registerResourceNode(node.id, node.resource, node.label, node.x, node.y, node.radius, label, [group, label]);
}

function drawForest(scene: Phaser.Scene, node: OnlineResourceNodeState, registerResourceNode: RegisterResourceNode) {
  const x = node.x - 66;
  const y = node.y - 52;
  const group = scene.add.container(x, y);
  for (let i = 0; i < 12; i++) {
    const px = (i % 4) * 44;
    const py = Math.floor(i / 4) * 44;
    group.add(scene.add.rectangle(px, py + 22, 12, 42, 0x6b4328));
    group.add(scene.add.triangle(px, py, -25, 30, 0, -28, 25, 30, 0x1c6b3f));
    group.add(scene.add.triangle(px, py - 18, -21, 22, 0, -30, 21, 22, 0x23824a));
  }
  const label = scene.add.text(x + 62, y + 142, node.label, labelStyle()).setOrigin(0.5);
  registerResourceNode(node.id, node.resource, node.label, node.x, node.y, node.radius, label, [group, label]);
}

function drawStoneOutcrop(scene: Phaser.Scene, node: OnlineResourceNodeState, registerResourceNode: RegisterResourceNode) {
  const x = node.x - 8;
  const y = node.y - 8;
  const graphics = scene.add.graphics();
  graphics.fillStyle(0xb7b59e, 1);
  graphics.fillCircle(x, y, 38);
  graphics.fillStyle(0x8d8b78, 1);
  graphics.fillCircle(x + 34, y + 22, 30);
  graphics.fillStyle(0xd5d1b8, 1);
  graphics.fillCircle(x - 26, y + 28, 24);
  const label = scene.add.text(x + 10, y + 70, node.label, labelStyle()).setOrigin(0.5);
  registerResourceNode(node.id, node.resource, node.label, node.x, node.y, node.radius, label, [graphics, label]);
}

function drawObsidianDeposit(scene: Phaser.Scene, node: OnlineResourceNodeState, registerResourceNode: RegisterResourceNode) {
  const x = node.x - 5;
  const y = node.y - 2;
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x17141d, 1);
  graphics.fillTriangle(x, y - 52, x - 38, y + 42, x + 38, y + 42);
  graphics.fillStyle(0x372f4d, 1);
  graphics.fillTriangle(x + 18, y - 28, x - 8, y + 42, x + 44, y + 42);
  graphics.lineStyle(3, 0x81d8d0, 0.45);
  graphics.lineBetween(x, y - 42, x - 10, y + 34);
  const label = scene.add.text(x + 4, y + 72, node.label, labelStyle()).setOrigin(0.5);
  registerResourceNode(node.id, node.resource, node.label, node.x, node.y, node.radius, label, [graphics, label]);
}
