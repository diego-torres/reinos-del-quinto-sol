import Phaser from "phaser";
import type {
  CeremonialCenterCulture,
  FoodSource,
  OnlineBuildingKind,
  OnlineResourceNodeState,
  Resource,
} from "@reinos/shared";
import { createInitialResourceNodes, normalizeCeremonialCenterCulture, WORLD_LINEAR_SCALE } from "@reinos/shared";
import type { MythicBeast } from "./types.js";
import { TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "./rules.js";

export const HOUSE_ASSET_KEY = "building-house-flat";
export const VILLAGER_ASSET_KEY = "unit-villager-flat";

/** Silueta de edificios respecto a aldeanos (~3× lectura RTS; issue #7). */
export const BUILDING_VISUAL_SCALE = 2.5;

const B = BUILDING_VISUAL_SCALE;
const M = WORLD_LINEAR_SCALE;

/** Sprite cuadrado de casa terminada (px lógicos antes de ×B). */
const HOUSE_COMPLETE_TEX_PX = 128;
/** Telpochcalli terminado: ~2× la casa en pantalla (misma regla de suelo que la casa). */
const TELPOCHCALLI_COMPLETE_TEX_PX = HOUSE_COMPLETE_TEX_PX * 2;
const HOUSE_COMPLETE_TEX_CENTER_Y = 10;

/** Obra en construcción: misma relación 2× para telpochcalli respecto a casa. */
const HOUSE_CONSTRUCTION_TEX_PX = 118;
const TELPOCHCALLI_CONSTRUCTION_TEX_PX = HOUSE_CONSTRUCTION_TEX_PX * 2;
const HOUSE_CONSTRUCTION_TEX_CENTER_Y = 8;
/** Base del placeholder del telpochcalli 1× antes de scale(2): pie del óvalo de sombra (≈54+14 en coords locales × B). */
const TELPOCHCALLI_PLACEHOLDER_UNSCALED_FOOT = 68;

export const CEREMONIAL_CENTER_DISPLAY_SIZE = 280 * B;

export const CEREMONIAL_CENTER_TEXTURE_KEYS: Record<CeremonialCenterCulture, string> = {
  mexica: "ceremonial-center-mexica",
  tlaxcalteca: "ceremonial-center-tlaxcalteca",
  inca: "ceremonial-center-inca",
  maya: "ceremonial-center-maya",
};

/** Casas por cultura (PNG en `assets/sprites/casas/`). */
export const HOUSE_TEXTURE_KEYS: Record<CeremonialCenterCulture, string> = {
  mexica: "house-culture-mexica",
  tlaxcalteca: "house-culture-tlaxcalteca",
  inca: "house-culture-inca",
  maya: "house-culture-maya",
};

/** Telpochcalli terminado por cultura (`assets/sprites/telpochcalli/`). Tipos jugables siguen siendo `telpochcalli` en código compartido. */
export const TELPOCHCALLI_TEXTURE_KEYS: Record<CeremonialCenterCulture, string> = {
  mexica: "telpochcalli-culture-mexica",
  tlaxcalteca: "telpochcalli-culture-tlaxcalteca",
  inca: "telpochcalli-culture-inca",
  maya: "telpochcalli-culture-maya",
};

/** Sprites de obra por cultura (`assets/sprites/construccion/`): casa y telpochcalli. */
export const CONSTRUCTION_TEXTURE_KEYS: Record<CeremonialCenterCulture, string> = {
  mexica: "construction-culture-mexica",
  tlaxcalteca: "construction-culture-tlaxcalteca",
  inca: "construction-culture-inca",
  maya: "construction-culture-maya",
};

function resolveCeremonialCenterTextureKey(scene: Phaser.Scene, culture: CeremonialCenterCulture): string {
  const normalized = normalizeCeremonialCenterCulture(culture);
  const primary = CEREMONIAL_CENTER_TEXTURE_KEYS[normalized];
  if (scene.textures.exists(primary)) return primary;
  const fallback = CEREMONIAL_CENTER_TEXTURE_KEYS.maya;
  if (scene.textures.exists(fallback)) return fallback;
  return primary;
}

function resolveHouseTextureKey(scene: Phaser.Scene, culture: CeremonialCenterCulture): string | undefined {
  const normalized = normalizeCeremonialCenterCulture(culture);
  const primary = HOUSE_TEXTURE_KEYS[normalized];
  if (scene.textures.exists(primary)) return primary;
  const fallback = HOUSE_TEXTURE_KEYS.maya;
  if (scene.textures.exists(fallback)) return fallback;
  if (scene.textures.exists(HOUSE_ASSET_KEY)) return HOUSE_ASSET_KEY;
  return undefined;
}

function resolveTelpochcalliTextureKey(scene: Phaser.Scene, culture: CeremonialCenterCulture): string | undefined {
  const normalized = normalizeCeremonialCenterCulture(culture);
  const primary = TELPOCHCALLI_TEXTURE_KEYS[normalized];
  if (scene.textures.exists(primary)) return primary;
  const fallback = TELPOCHCALLI_TEXTURE_KEYS.maya;
  if (scene.textures.exists(fallback)) return fallback;
  return undefined;
}

/** Nombre corto que ve el jugador; el tipo de reglas sigue siendo `telpochcalli` (`docs/diseno/nombres-edificios.md`). */
export function telpochcalliDisplayLabel(culture: CeremonialCenterCulture): string {
  const normalized = normalizeCeremonialCenterCulture(culture);
  if (normalized === "maya") return "Popol na";
  if (normalized === "inca") return "Kallanka";
  return "Telpochcalli";
}

function resolveConstructionTextureKey(scene: Phaser.Scene, culture: CeremonialCenterCulture): string | undefined {
  const normalized = normalizeCeremonialCenterCulture(culture);
  const primary = CONSTRUCTION_TEXTURE_KEYS[normalized];
  if (scene.textures.exists(primary)) return primary;
  const fallback = CONSTRUCTION_TEXTURE_KEYS.maya;
  if (scene.textures.exists(fallback)) return fallback;
  return undefined;
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
  foodSource?: FoodSource,
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
    if (node.resource === "alimento") {
      if (node.foodSource === "caza") drawHuntingGround(scene, node, registerResourceNode);
      else drawMaizeField(scene, node, registerResourceNode);
    } else if (node.resource === "madera") drawForest(scene, node, registerResourceNode);
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
    base.add(scene.add.rectangle(0, 88 * B, 260 * B, 84 * B, 0xb9a66f).setStrokeStyle(4, 0x735f38));
    base.add(scene.add.rectangle(0, 35 * B, 210 * B, 74 * B, 0xc8b77a).setStrokeStyle(4, 0x735f38));
    base.add(scene.add.rectangle(0, -12 * B, 152 * B, 58 * B, 0xd5c585).setStrokeStyle(4, 0x735f38));
    base.add(scene.add.rectangle(0, -52 * B, 76 * B, 38 * B, 0x7d3f2b).setStrokeStyle(4, 0x4d2c21));
    base.add(scene.add.rectangle(0, 58 * B, 42 * B, 142 * B, 0x8e7445, 0.45));
  }

  const labelY = CEREMONIAL_CENTER_DISPLAY_SIZE / 2 + 26;
  base.add(scene.add.text(0, labelY, "Centro ceremonial", labelStyle(15)).setOrigin(0.5));
  return base;
}

export function drawHouse(scene: Phaser.Scene, x: number, y: number, culture: CeremonialCenterCulture) {
  const cultureNorm = normalizeCeremonialCenterCulture(culture);
  const house = scene.add.container(x, y);
  house.setDepth(2);
  const h = HOUSE_COMPLETE_TEX_PX * B;
  const texKey = resolveHouseTextureKey(scene, cultureNorm);
  if (texKey) {
    house.add(scene.add.image(0, HOUSE_COMPLETE_TEX_CENTER_Y * B, texKey).setDisplaySize(h, h));
  } else {
    house.add(scene.add.ellipse(0, 38 * B, 92 * B, 24 * B, 0x000000, 0.18));
    house.add(scene.add.rectangle(0, 22 * B, 86 * B, 52 * B, 0xb98a58).setStrokeStyle(4, 0x5a3a24));
    house.add(
      scene.add.triangle(0, -26 * B, -52 * B, 20 * B, 0, -60 * B, 52 * B, 20 * B, 0x7d3f2b).setStrokeStyle(4, 0x4d2c21),
    );
    house.add(scene.add.rectangle(0, 36 * B, 24 * B, 28 * B, 0x3c281d).setStrokeStyle(2, 0x20140f));
    house.add(
      scene.add.rectangle(-24 * B, 18 * B, 16 * B, 14 * B, 0xf0c94a, 0.45).setStrokeStyle(2, 0x5a3a24),
    );
  }
  house.add(scene.add.text(0, 82 * B, "Casa", labelStyle(13)).setOrigin(0.5));
  return house;
}

export function drawTelpochcalli(scene: Phaser.Scene, x: number, y: number, culture: CeremonialCenterCulture) {
  const cultureNorm = normalizeCeremonialCenterCulture(culture);
  const building = scene.add.container(x, y);
  building.setDepth(2);
  const houseH = HOUSE_COMPLETE_TEX_PX * B;
  const h = TELPOCHCALLI_COMPLETE_TEX_PX * B;
  const houseBottomY = HOUSE_COMPLETE_TEX_CENTER_Y * B + houseH / 2;
  const texCenterY = houseBottomY - h / 2;
  const texKey = resolveTelpochcalliTextureKey(scene, cultureNorm);
  const nameLabel = telpochcalliDisplayLabel(cultureNorm);
  if (texKey) {
    building.add(scene.add.image(0, texCenterY, texKey).setDisplaySize(h, h));
  } else {
    const placeholder = scene.add.container(0, houseBottomY - 2 * TELPOCHCALLI_PLACEHOLDER_UNSCALED_FOOT * B);
    placeholder.add(scene.add.ellipse(0, 54 * B, 144 * B, 28 * B, 0x000000, 0.18));
    placeholder.add(scene.add.rectangle(0, 28 * B, 126 * B, 72 * B, 0x9b6b42).setStrokeStyle(4, 0x4d2c21));
    placeholder.add(scene.add.rectangle(0, -20 * B, 148 * B, 36 * B, 0x7d3f2b).setStrokeStyle(4, 0x351d17));
    placeholder.add(
      scene.add
        .triangle(-46 * B, -44 * B, -20 * B, -16 * B, -46 * B, -76 * B, -72 * B, -16 * B, 0xd7bc73)
        .setStrokeStyle(3, 0x4d2c21),
    );
    placeholder.add(
      scene.add
        .triangle(46 * B, -44 * B, 72 * B, -16 * B, 46 * B, -76 * B, 20 * B, -16 * B, 0xd7bc73)
        .setStrokeStyle(3, 0x4d2c21),
    );
    placeholder.add(scene.add.rectangle(0, 38 * B, 34 * B, 48 * B, 0x271913).setStrokeStyle(2, 0x120b08));
    placeholder.add(scene.add.rectangle(-36 * B, 26 * B, 18 * B, 18 * B, 0x223d63, 0.75).setStrokeStyle(2, 0x111c2d));
    placeholder.add(scene.add.rectangle(36 * B, 26 * B, 18 * B, 18 * B, 0x223d63, 0.75).setStrokeStyle(2, 0x111c2d));
    placeholder.setScale(2);
    building.add(placeholder);
  }
  const labelY = houseBottomY + 28 * B;
  building.add(scene.add.text(0, labelY, nameLabel, labelStyle(13)).setOrigin(0.5));
  return building;
}

/** Obra en curso: sprite `assets/sprites/construccion/` por cultura si existe; si no, andamiaje geométrico. */
export function drawBuildingConstructionSite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  kind: OnlineBuildingKind,
  progress01: number,
  culture: CeremonialCenterCulture,
): {
  container: Phaser.GameObjects.Container;
  progressFill: Phaser.GameObjects.Rectangle;
  progressWidth: number;
} {
  const cultureNorm = normalizeCeremonialCenterCulture(culture);
  const constructionKey = resolveConstructionTextureKey(scene, cultureNorm);
  const useGeometricScaffold = !constructionKey;

  const scaleY = kind === "casa" ? 1 : 2.24;

  const houseConstrHalf = (HOUSE_CONSTRUCTION_TEX_PX * B) / 2;
  const houseConstrBottom = HOUSE_CONSTRUCTION_TEX_CENTER_Y * B + houseConstrHalf;
  const telConstrHalf = (TELPOCHCALLI_CONSTRUCTION_TEX_PX * B) / 2;
  const telConstrImgCenterY = houseConstrBottom - telConstrHalf;

  const container = scene.add.container(x, y);
  container.setDepth(2);

  const baseY = kind === "casa" ? 38 * B : houseConstrBottom - 5 * B;
  container.add(
    scene.add.ellipse(0, baseY, kind === "casa" ? 96 * B : 248 * B, kind === "casa" ? 26 * B : 30 * B, 0x000000, 0.22),
  );

  if (useGeometricScaffold) {
    container.add(
      scene.add.rectangle(0, 8 * B * scaleY, 16 * B, 100 * B * scaleY, 0x6b5344).setStrokeStyle(3, 0x3d2b22),
    );
    container.add(
      scene.add
        .rectangle(-30 * B, -8 * B * scaleY, 15 * B, 78 * B * scaleY, 0x7a5c45)
        .setStrokeStyle(3, 0x3d2b22)
        .setRotation(0.1),
    );
    container.add(
      scene.add
        .rectangle(30 * B, -8 * B * scaleY, 15 * B, 78 * B * scaleY, 0x7a5c45)
        .setStrokeStyle(3, 0x3d2b22)
        .setRotation(-0.1),
    );
    container.add(
      scene.add
        .rectangle(0, -42 * B * scaleY, kind === "casa" ? 70 * B : 92 * B, 9 * B, 0x5c4030)
        .setStrokeStyle(2, 0x2a1a12),
    );
  } else {
    const chHouse = HOUSE_CONSTRUCTION_TEX_PX * B;
    const chTel = TELPOCHCALLI_CONSTRUCTION_TEX_PX * B;
    const img =
      kind === "casa"
        ? scene.add
            .image(0, HOUSE_CONSTRUCTION_TEX_CENTER_Y * B, constructionKey!)
            .setDisplaySize(chHouse, chHouse)
        : scene.add.image(0, telConstrImgCenterY, constructionKey!).setDisplaySize(chTel, chTel);
    container.add(img);
  }

  const kindLabel =
    kind === "casa" ? "Casa" : telpochcalliDisplayLabel(cultureNorm);
  container.add(scene.add.text(0, baseY + 34 * B, `${kindLabel} · obra`, labelStyle(12)).setOrigin(0.5));

  const barW = kind === "casa" ? 102 * B : 244 * B;
  const barH = 11 * B;
  const barY = baseY + 62 * B;
  container.add(scene.add.rectangle(0, barY, barW, barH, 0x1a120d, 0.92).setStrokeStyle(2, 0x3d2b22));

  const fillMax = barW - 4 * B;
  const clamped = Math.max(0, Math.min(1, progress01));
  const fillW = Math.max(2, clamped * fillMax);
  const fill = scene.add
    .rectangle(-fillMax / 2 + 2 * B, barY, fillW, barH - 4 * B, 0xd4a017, 1)
    .setOrigin(0, 0.5);
  container.add(fill);

  return { container, progressFill: fill, progressWidth: fillMax };
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

  container.add(scene.add.ellipse(0, 48 * M, 150 * M, 26 * M, 0x000000, 0.25));
  container.add(
    scene.add
      .triangle(-44 * M, -4 * M, -138 * M, 34 * M, -26 * M, 22 * M, -66 * M, -72 * M, 0x211827)
      .setStrokeStyle(3, 0x5c2745),
  );
  container.add(
    scene.add
      .triangle(44 * M, -4 * M, 138 * M, 34 * M, 26 * M, 22 * M, 66 * M, -72 * M, 0x211827)
      .setStrokeStyle(3, 0x5c2745),
  );
  container.add(scene.add.ellipse(0, 8 * M, 70 * M, 86 * M, 0x37213a).setStrokeStyle(4, 0x130d19));
  container.add(scene.add.circle(-18 * M, -20 * M, 8 * M, 0xf5d76e));
  container.add(scene.add.circle(18 * M, -20 * M, 8 * M, 0xf5d76e));
  container.add(
    scene.add.triangle(0, -2 * M, -8 * M, 14 * M, 0, 30 * M, 8 * M, 14 * M, 0xe8e0c8),
  );
  container.add(
    scene.add.triangle(-20 * M, -52 * M, -8 * M, -28 * M, -30 * M, -28 * M, -26 * M, -76 * M, 0x2b1d33),
  );
  container.add(
    scene.add.triangle(20 * M, -52 * M, 8 * M, -28 * M, 30 * M, -28 * M, 26 * M, -76 * M, 0x2b1d33),
  );

  const healthText = scene.add.text(0, 92 * M, `${name} dormido 90/90`, labelStyle(13)).setOrigin(0.5);
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
    range: 66 * M,
    speed: 115 * M,
    cooldownMs: 1100,
    attackElapsed: 0,
    dormant: true,
    dead: false,
    reward: {
      alimento: 100,
      piedra: 80,
      obsidiana: 50,
    },
    healthText,
  };
}

function drawHuntingGround(scene: Phaser.Scene, node: OnlineResourceNodeState, registerResourceNode: RegisterResourceNode) {
  const x = node.x - 52 * M;
  const y = node.y - 40 * M;
  const group = scene.add.container(x, y);
  group.add(
    scene.add.ellipse(56 * M, 40 * M, 120 * M, 88 * M, 0xc4a574, 0.85).setStrokeStyle(2, 0x6b4a32, 0.7),
  );
  for (let i = 0; i < 9; i++) {
    const px = 22 * M + (i % 3) * 34 * M;
    const py = 18 * M + Math.floor(i / 3) * 30 * M;
    group.add(scene.add.ellipse(px, py, 10 * M, 6 * M, 0x8b5e3c, 0.75));
    group.add(scene.add.ellipse(px + 4 * M, py - 3 * M, 4 * M, 4 * M, 0x4a3224, 0.6));
  }
  for (let i = 0; i < 8; i++) {
    const px = 10 * M + (i % 4) * 28 * M + ((i * 7) % 12) * M;
    const py = 52 * M + Math.floor(i / 4) * 12 * M;
    group.add(scene.add.rectangle(px, py, 3 * M, 1.5 * M, 0x5c3d28, 0.65));
  }
  const label = scene.add.text(x + 52 * M, y + 98 * M, node.label, labelStyle()).setOrigin(0.5);
  registerResourceNode(node.id, node.resource, node.label, node.x, node.y, node.radius, label, [group, label], node.foodSource);
}

function drawMaizeField(scene: Phaser.Scene, node: OnlineResourceNodeState, registerResourceNode: RegisterResourceNode) {
  const x = node.x - 56 * M;
  const y = node.y - 34 * M;
  const group = scene.add.container(x, y);
  for (let i = 0; i < 18; i++) {
    const px = (i % 6) * 24 * M;
    const py = Math.floor(i / 6) * 30 * M;
    const stalk = scene.add.rectangle(px, py, 5 * M, 34 * M, 0x73a942);
    const cob = scene.add.ellipse(px + 5 * M, py - 4 * M, 11 * M, 22 * M, 0xf0c94a);
    group.add([stalk, cob]);
  }
  const label = scene.add.text(x - 8 * M, y + 92 * M, node.label, labelStyle()).setOrigin(0.5);
  registerResourceNode(node.id, node.resource, node.label, node.x, node.y, node.radius, label, [group, label], node.foodSource);
}

function drawForest(scene: Phaser.Scene, node: OnlineResourceNodeState, registerResourceNode: RegisterResourceNode) {
  const x = node.x - 66 * M;
  const y = node.y - 52 * M;
  const group = scene.add.container(x, y);
  for (let i = 0; i < 12; i++) {
    const px = (i % 4) * 44 * M;
    const py = Math.floor(i / 4) * 44 * M;
    group.add(scene.add.rectangle(px, py + 22 * M, 12 * M, 42 * M, 0x6b4328));
    group.add(
      scene.add.triangle(px, py, -25 * M, 30 * M, 0, -28 * M, 25 * M, 30 * M, 0x1c6b3f),
    );
    group.add(
      scene.add.triangle(px, py - 18 * M, -21 * M, 22 * M, 0, -30 * M, 21 * M, 22 * M, 0x23824a),
    );
  }
  const label = scene.add.text(x + 62 * M, y + 142 * M, node.label, labelStyle()).setOrigin(0.5);
  registerResourceNode(node.id, node.resource, node.label, node.x, node.y, node.radius, label, [group, label]);
}

function drawStoneOutcrop(scene: Phaser.Scene, node: OnlineResourceNodeState, registerResourceNode: RegisterResourceNode) {
  const x = node.x - 8 * M;
  const y = node.y - 8 * M;
  const graphics = scene.add.graphics();
  graphics.fillStyle(0xb7b59e, 1);
  graphics.fillCircle(x, y, 38 * M);
  graphics.fillStyle(0x8d8b78, 1);
  graphics.fillCircle(x + 34 * M, y + 22 * M, 30 * M);
  graphics.fillStyle(0xd5d1b8, 1);
  graphics.fillCircle(x - 26 * M, y + 28 * M, 24 * M);
  const label = scene.add.text(x + 10 * M, y + 70 * M, node.label, labelStyle()).setOrigin(0.5);
  registerResourceNode(node.id, node.resource, node.label, node.x, node.y, node.radius, label, [graphics, label]);
}

function drawObsidianDeposit(scene: Phaser.Scene, node: OnlineResourceNodeState, registerResourceNode: RegisterResourceNode) {
  const x = node.x - 5 * M;
  const y = node.y - 2 * M;
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x17141d, 1);
  graphics.fillTriangle(x, y - 52 * M, x - 38 * M, y + 42 * M, x + 38 * M, y + 42 * M);
  graphics.fillStyle(0x372f4d, 1);
  graphics.fillTriangle(x + 18 * M, y - 28 * M, x - 8 * M, y + 42 * M, x + 44 * M, y + 42 * M);
  graphics.lineStyle(3, 0x81d8d0, 0.45);
  graphics.lineBetween(x, y - 42 * M, x - 10 * M, y + 34 * M);
  const label = scene.add.text(x + 4 * M, y + 72 * M, node.label, labelStyle()).setOrigin(0.5);
  registerResourceNode(node.id, node.resource, node.label, node.x, node.y, node.radius, label, [graphics, label]);
}
