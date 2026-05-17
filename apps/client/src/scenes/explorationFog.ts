import Phaser from "phaser";
import { UNIT_EXPLORATION_VISION_RADIUS_PX, type OnlineUnitKind } from "@reinos/shared";
import { TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "../rules.js";
import type { UnitData } from "../types.js";

/** Por encima del terreno y edificios; por debajo de unidades y HUD. */
export const EXPLORATION_FOG_DEPTH = 5;

/** Color de terreno no explorado (niebla de exploración; no es niebla de visión enemiga). */
const FOG_FILL = 0x120a18;
const FOG_ALPHA = 0.91;

type FogState = {
  tilesX: number;
  tilesY: number;
  revealed: Uint8Array;
  graphics: Phaser.GameObjects.Graphics;
  dirty: boolean;
};

const fogByScene = new WeakMap<Phaser.Scene, FogState>();

export function createExplorationFog(scene: Phaser.Scene): void {
  if (fogByScene.has(scene)) return;

  const tilesX = Math.ceil(WORLD_WIDTH / TILE_SIZE);
  const tilesY = Math.ceil(WORLD_HEIGHT / TILE_SIZE);
  const revealed = new Uint8Array(tilesX * tilesY);
  const graphics = scene.add.graphics();
  graphics.setDepth(EXPLORATION_FOG_DEPTH);

  fogByScene.set(scene, { tilesX, tilesY, revealed, graphics, dirty: true });
}

export function resetExplorationFog(scene: Phaser.Scene): void {
  const state = fogByScene.get(scene);
  if (!state) return;
  state.revealed.fill(0);
  state.dirty = true;
}

export function revealExplorationCircle(scene: Phaser.Scene, worldX: number, worldY: number, radiusPx: number): void {
  const state = fogByScene.get(scene);
  if (!state) return;

  const { tilesX, tilesY, revealed } = state;
  const rTiles = Math.ceil(radiusPx / TILE_SIZE) + 1;
  const cx = Math.floor(worldX / TILE_SIZE);
  const cy = Math.floor(worldY / TILE_SIZE);
  const r2 = radiusPx * radiusPx;

  let changed = false;
  for (let ty = Math.max(0, cy - rTiles); ty <= Math.min(tilesY - 1, cy + rTiles); ty += 1) {
    for (let tx = Math.max(0, cx - rTiles); tx <= Math.min(tilesX - 1, cx + rTiles); tx += 1) {
      const tCenterX = tx * TILE_SIZE + TILE_SIZE / 2;
      const tCenterY = ty * TILE_SIZE + TILE_SIZE / 2;
      const dx = tCenterX - worldX;
      const dy = tCenterY - worldY;
      if (dx * dx + dy * dy <= r2) {
        const i = ty * tilesX + tx;
        if (!revealed[i]) {
          revealed[i] = 1;
          changed = true;
        }
      }
    }
  }
  if (changed) state.dirty = true;
}

function isLocalPlayerUnit(scene: FogSceneHost, unitData: UnitData): boolean {
  if (!unitData.ownerId) {
    return true;
  }
  return scene.playerId != null && unitData.ownerId === scene.playerId;
}

export type FogSceneHost = Phaser.Scene & {
  units: Phaser.GameObjects.Container[];
  ceremonialCenters: Array<{ ownerId: string; x: number; y: number; radius: number }>;
  offlineFallbackCenter?: { x: number; y: number; radius: number };
  playerId?: string;
  onlineMode: boolean;
};

/** Revela el área del centro ceremonial que pertenece al jugador local (o el centro offline). */
export function revealOwnedCeremonialAreasForLocalPlayer(scene: FogSceneHost): void {
  const extraPad = 48;
  const hasServerCenter =
    !!scene.playerId && scene.ceremonialCenters.some((c) => c.ownerId === scene.playerId);

  if (scene.offlineFallbackCenter && (!scene.onlineMode || !hasServerCenter)) {
    const c = scene.offlineFallbackCenter;
    revealExplorationCircle(scene, c.x, c.y, c.radius + extraPad);
    if (!scene.onlineMode) return;
  }

  if (!scene.playerId) return;
  for (const center of scene.ceremonialCenters) {
    if (center.ownerId !== scene.playerId) continue;
    revealExplorationCircle(scene, center.x, center.y, center.radius + extraPad);
  }
}

export function revealFromLocalPlayerUnits(scene: FogSceneHost): void {
  for (const unit of scene.units) {
    const unitData = unit.getData("unit") as UnitData | undefined;
    if (!unitData) continue;
    if (!isLocalPlayerUnit(scene, unitData)) continue;

    const radius = UNIT_EXPLORATION_VISION_RADIUS_PX[unitData.kind as OnlineUnitKind];
    revealExplorationCircle(scene, unit.x, unit.y, radius);
  }
}

export function redrawExplorationFogIfDirty(scene: Phaser.Scene): void {
  const state = fogByScene.get(scene);
  if (!state || !state.dirty) return;

  const { tilesX, tilesY, revealed, graphics } = state;
  graphics.clear();
  graphics.fillStyle(FOG_FILL, FOG_ALPHA);

  for (let ty = 0; ty < tilesY; ty += 1) {
    for (let tx = 0; tx < tilesX; tx += 1) {
      const i = ty * tilesX + tx;
      if (revealed[i]) continue;

      const x0 = tx * TILE_SIZE;
      const y0 = ty * TILE_SIZE;
      const w = Math.min(TILE_SIZE, WORLD_WIDTH - x0);
      const h = Math.min(TILE_SIZE, WORLD_HEIGHT - y0);
      if (w > 0 && h > 0) {
        graphics.fillRect(x0, y0, w, h);
      }
    }
  }

  state.dirty = false;
}

export function getExplorationVisionRadiusForKind(kind: OnlineUnitKind): number {
  return UNIT_EXPLORATION_VISION_RADIUS_PX[kind];
}
