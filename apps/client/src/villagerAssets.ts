import Phaser from "phaser";
import type { CeremonialCenterCulture } from "@reinos/shared";
import type { UnitCargo, UnitData, VillagerAnimationState, VillagerGenderVariant, VillagerSkin } from "./types.js";
import type { GameScene } from "./scenes/gameScene.js";
import incaFemeninaSrc from "@repo-assets/sprites/aldeanos/inca-femenina.png";
import incaMasculinoSrc from "@repo-assets/sprites/aldeanos/inca-masculino.png";
import mayaFemeninaSrc from "@repo-assets/sprites/aldeanos/maya-femenina.png";
import mayaMasculinoSrc from "@repo-assets/sprites/aldeanos/maya-masculino.png";
import mexicaFemeninaSrc from "@repo-assets/sprites/aldeanos/mexica-femenina.png";
import mexicaMasculinoSrc from "@repo-assets/sprites/aldeanos/mexica-masculino.png";
import tlaxcaltecaFemeninaSrc from "@repo-assets/sprites/aldeanos/tlaxcalteca-femenina.png";
import tlaxcaltecaMasculinoSrc from "@repo-assets/sprites/aldeanos/tlaxcalteca-masculino.png";

type VillagerPalette = {
  tunic: number;
  shawl: number;
  accent: number;
  outline: number;
  tool: number;
};

export type VillagerRig = {
  root: Phaser.GameObjects.Container;
  body?: Phaser.GameObjects.Ellipse;
  head?: Phaser.GameObjects.Arc;
  carryBundle?: Phaser.GameObjects.Ellipse;
  tool?: Phaser.GameObjects.Rectangle;
  skirtOrWrap?: Phaser.GameObjects.Rectangle;
  buildProp?: Phaser.GameObjects.Rectangle;
  gatherProp?: Phaser.GameObjects.Arc;
  sprite?: Phaser.GameObjects.Sprite;
  sheetKey?: string;
  state: VillagerAnimationState;
};

const VILLAGER_SHEET_COLUMNS = 6;
const VILLAGER_SHEET_ROWS = 4;
const VILLAGER_SHEET_SIZE = 2048;
const VILLAGER_FRAME_WIDTH = VILLAGER_SHEET_SIZE / VILLAGER_SHEET_COLUMNS;
const VILLAGER_FRAME_HEIGHT = VILLAGER_SHEET_SIZE / VILLAGER_SHEET_ROWS;
const VILLAGER_SPRITE_SCALE = 0.24;

const CULTURE_PALETTES: Record<CeremonialCenterCulture, VillagerPalette> = {
  maya: {
    tunic: 0xe5c16f,
    shawl: 0x2f8f7a,
    accent: 0x2f5fa7,
    outline: 0x4b3524,
    tool: 0x6b4328,
  },
  mexica: {
    tunic: 0xd8b26a,
    shawl: 0xb84a3b,
    accent: 0x223d63,
    outline: 0x4b2a20,
    tool: 0x5b3825,
  },
  tlaxcalteca: {
    tunic: 0xdfc67a,
    shawl: 0x8c3d88,
    accent: 0xf0c94a,
    outline: 0x3a2d31,
    tool: 0x60402a,
  },
  inca: {
    tunic: 0xd99a4a,
    shawl: 0x3d7f4e,
    accent: 0xb92f2f,
    outline: 0x46321f,
    tool: 0x6d4527,
  },
};

const DEFAULT_SKIN: VillagerSkin = {
  culture: "maya",
  gender: "masculino",
};

const VILLAGER_SHEET_SOURCES: Record<CeremonialCenterCulture, Record<VillagerGenderVariant, string>> = {
  maya: {
    femenina: mayaFemeninaSrc,
    masculino: mayaMasculinoSrc,
  },
  mexica: {
    femenina: mexicaFemeninaSrc,
    masculino: mexicaMasculinoSrc,
  },
  tlaxcalteca: {
    femenina: tlaxcaltecaFemeninaSrc,
    masculino: tlaxcaltecaMasculinoSrc,
  },
  inca: {
    femenina: incaFemeninaSrc,
    masculino: incaMasculinoSrc,
  },
};

export function preloadVillagerSpriteSheets(scene: Phaser.Scene): void {
  for (const culture of Object.keys(VILLAGER_SHEET_SOURCES) as CeremonialCenterCulture[]) {
    for (const gender of Object.keys(VILLAGER_SHEET_SOURCES[culture]) as VillagerGenderVariant[]) {
      scene.load.image(getVillagerSheetKey({ culture, gender }), VILLAGER_SHEET_SOURCES[culture][gender]);
    }
  }
}

export function createVillagerSkin(seed: string, culture: CeremonialCenterCulture = "maya"): VillagerSkin {
  return {
    culture,
    gender: chooseGender(seed),
  };
}

export function createVillagerVisuals(scene: Phaser.Scene, data: UnitData): VillagerRig {
  const skin = data.skin ?? DEFAULT_SKIN;
  const sheetKey = getVillagerSheetKey(skin);
  if (scene.textures.exists(sheetKey)) {
    return createSheetVillagerVisuals(scene, sheetKey);
  }

  const palette = CULTURE_PALETTES[skin.culture];
  const root = scene.add.container(0, 0);
  const isFeminine = skin.gender === "femenina";

  const shadow = scene.add.ellipse(0, 30, 52, 18, 0x000000, 0.22);
  const legs = scene.add.rectangle(0, 22, isFeminine ? 24 : 20, 28, palette.outline, 0.9);
  const body = scene.add.ellipse(0, 2, isFeminine ? 36 : 34, isFeminine ? 46 : 44, palette.tunic)
    .setStrokeStyle(3, palette.outline, 0.9);
  const shawl = scene.add.rectangle(isFeminine ? -5 : 6, -2, 12, 44, palette.shawl, 0.92)
    .setRotation(isFeminine ? -0.18 : 0.22);
  const skirtOrWrap = scene.add.rectangle(0, 20, isFeminine ? 34 : 28, isFeminine ? 18 : 14, palette.accent, 0.9)
    .setStrokeStyle(2, palette.outline, 0.75);
  const head = scene.add.circle(0, -25, isFeminine ? 12 : 13, 0xc98957)
    .setStrokeStyle(2, palette.outline, 0.85);
  const hair = scene.add.arc(0, -32, isFeminine ? 15 : 13, 200, 340, false, 0x1b1712, 1);
  const headband = scene.add.rectangle(0, -32, isFeminine ? 26 : 24, 5, palette.accent, 0.95);
  const tool = scene.add.rectangle(-22, 3, 7, 44, palette.tool, 1).setRotation(0.35);
  const buildProp = scene.add.rectangle(22, 4, 10, 38, 0xb7b59e, 1).setRotation(-0.38);
  const gatherProp = scene.add.arc(23, 10, 11, 205, 335, false, 0xf0c94a, 1);
  const carryBundle = scene.add.ellipse(0, -46, 28, 18, palette.accent, 0.95)
    .setStrokeStyle(2, palette.outline, 0.75);

  buildProp.setVisible(false);
  gatherProp.setVisible(false);
  carryBundle.setVisible(false);

  // Placeholder rig: cada cultura cambia silueta/paleta sin alterar velocidad ni reglas de gameplay.
  root.add([shadow, legs, body, shawl, skirtOrWrap, head, hair, headband, tool, buildProp, gatherProp, carryBundle]);

  return {
    root,
    body,
    head,
    carryBundle,
    tool,
    skirtOrWrap,
    buildProp,
    gatherProp,
    state: "idle",
  };
}

export function updateVillagerAnimation(scene: GameScene, unit: Phaser.GameObjects.Container, delta: number): void {
  const data = unit.getData("unit") as UnitData | undefined;
  if (data?.kind !== "aldeano") return;

  const rig = unit.getData("villagerRig") as VillagerRig | undefined;
  if (!rig) return;

  const nextState = getVillagerAnimationState(unit);
  const elapsed = (unit.getData("villagerAnimElapsed") as number | undefined ?? 0) + delta;
  unit.setData("villagerAnimElapsed", elapsed);

  if (rig.sprite) {
    updateSheetVillagerFrame(rig, nextState, elapsed);
    return;
  }

  if (rig.state !== nextState) {
    rig.state = nextState;
    applyVillagerStateProps(rig, nextState);
  }

  const wave = Math.sin(elapsed / (nextState === "idle" ? 360 : 120));
  rig.root.y = nextState === "idle" ? wave * 1.2 : wave * 3.5;
  if (rig.body) rig.body.rotation = nextState === "idle" ? wave * 0.025 : wave * 0.06;
  if (rig.head) rig.head.y = -25 + (nextState === "idle" ? wave * 0.4 : wave * 1.2);
  if (rig.tool) rig.tool.rotation = getToolRotation(nextState, wave);
}

function createSheetVillagerVisuals(scene: Phaser.Scene, sheetKey: string): VillagerRig {
  ensureVillagerSheetFrames(scene, sheetKey);
  const root = scene.add.container(0, 0);
  const shadow = scene.add.ellipse(0, 31, 54, 18, 0x000000, 0.2);
  const sprite = scene.add.sprite(0, -8, sheetKey, getVillagerFrameName(0, 0))
    .setScale(VILLAGER_SPRITE_SCALE);

  // Las hojas importadas son 2048x2048 con grilla 4x6; registramos frames porque 2048/6 no es entero.
  root.add([shadow, sprite]);
  return {
    root,
    sprite,
    sheetKey,
    state: "idle",
  };
}

function updateSheetVillagerFrame(rig: VillagerRig, state: VillagerAnimationState, elapsed: number): void {
  if (!rig.sprite || !rig.sheetKey) return;
  rig.state = state;
  const row = getSheetRow(state);
  const frame = state === "idle" ? 0 : Math.floor(elapsed / 130) % VILLAGER_SHEET_COLUMNS;
  rig.sprite.setFrame(getVillagerFrameName(row, frame));
  rig.root.y = state === "idle" ? Math.sin(elapsed / 360) * 1.2 : Math.sin(elapsed / 120) * 3.5;
}

function ensureVillagerSheetFrames(scene: Phaser.Scene, sheetKey: string): void {
  const texture = scene.textures.get(sheetKey);
  if (texture.has(getVillagerFrameName(0, 0))) return;

  for (let row = 0; row < VILLAGER_SHEET_ROWS; row += 1) {
    for (let col = 0; col < VILLAGER_SHEET_COLUMNS; col += 1) {
      texture.add(
        getVillagerFrameName(row, col),
        0,
        Math.round(col * VILLAGER_FRAME_WIDTH),
        Math.round(row * VILLAGER_FRAME_HEIGHT),
        Math.round(VILLAGER_FRAME_WIDTH),
        Math.round(VILLAGER_FRAME_HEIGHT),
      );
    }
  }
}

function getVillagerFrameName(row: number, col: number): string {
  return `r${row}-c${col}`;
}

function getSheetRow(state: VillagerAnimationState): number {
  if (state === "build") return 1;
  if (state === "gather-food") return 2;
  if (state === "carry") return 3;
  return 0;
}

function getVillagerAnimationState(unit: Phaser.GameObjects.Container): VillagerAnimationState {
  const cargo = unit.getData("cargo") as UnitCargo | undefined;
  if (cargo?.resource && cargo.amount > 0) return "carry";

  const workState = unit.getData("workState") as string | undefined;
  const gatherTarget = unit.getData("gatherTarget");
  const buildingTarget = unit.getData("buildingTarget");

  if (buildingTarget) return "build";
  if (gatherTarget) return "gather-food";
  if (workState === "moving" || unit.getData("target")) return "walk";
  return "idle";
}

function applyVillagerStateProps(rig: VillagerRig, state: VillagerAnimationState): void {
  rig.carryBundle?.setVisible(state === "carry");
  rig.buildProp?.setVisible(state === "build");
  rig.gatherProp?.setVisible(state === "gather-food");
  rig.skirtOrWrap?.setScale(state === "carry" ? 1.08 : 1);
}

function getToolRotation(state: VillagerAnimationState, wave: number): number {
  if (state === "build") return -0.55 + wave * 0.16;
  if (state === "gather-food") return 0.7 + wave * 0.12;
  if (state === "carry") return 1.05 + wave * 0.04;
  if (state === "walk") return 0.35 + wave * 0.14;
  return 0.35 + wave * 0.04;
}

function chooseGender(seed: string): VillagerGenderVariant {
  return hash(seed) % 2 === 0 ? "masculino" : "femenina";
}

function getVillagerSheetKey(skin: VillagerSkin): string {
  return `villager-${skin.culture}-${skin.gender}`;
}

function hash(value: string): number {
  let acc = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    acc ^= value.charCodeAt(i);
    acc = Math.imul(acc, 16777619);
  }
  return acc >>> 0;
}
