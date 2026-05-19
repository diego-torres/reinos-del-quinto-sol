import { normalizeCeremonialCenterCulture, type CeremonialCenterCulture } from "@reinos/shared";
import { WORLD_LINEAR_SCALE } from "@reinos/shared";
import { createCamazotz, drawCeremonialCenter, drawResourceClusters, drawTerrain } from "../art.js";
import { CEREMONIAL_CENTER, WORLD_HEIGHT, WORLD_WIDTH } from "../rules.js";
import { createVillagerSkin } from "../villagerAssets.js";
import {
  createExplorationFog,
  redrawExplorationFogIfDirty,
  revealFromLocalPlayerUnits,
  revealOwnedCeremonialAreasForLocalPlayer,
} from "./explorationFog.js";
import type { GameScene } from "./gameScene.js";

export function bootstrapOfflineStartingArea(scene: GameScene, culture: CeremonialCenterCulture): void {
  drawTerrain(scene);
  createExplorationFog(scene);
  drawResourceClusters(scene, scene.registerResourceNode.bind(scene));

  const mapMargin = 480 * WORLD_LINEAR_SCALE;
  const cx = mapMargin + Math.random() * (WORLD_WIDTH - mapMargin * 2);
  const cy = mapMargin + Math.random() * (WORLD_HEIGHT - mapMargin * 2);
  const offlineCulture = normalizeCeremonialCenterCulture(culture);
  const centerContainer = drawCeremonialCenter(scene, cx, cy, offlineCulture);
  scene.offlineFallbackCenter = {
    x: cx,
    y: cy,
    radius: CEREMONIAL_CENTER.depositRadius,
    culture: offlineCulture,
    container: centerContainer,
  };

  const beastA = scene.pickWorldPointAwayFrom(cx, cy, 520 * WORLD_LINEAR_SCALE, mapMargin);
  let beastB = scene.pickWorldPointAwayFrom(cx, cy, 520 * WORLD_LINEAR_SCALE, mapMargin);
  for (let n = 0; n < 40 && Math.hypot(beastB.x - beastA.x, beastB.y - beastA.y) < 420 * WORLD_LINEAR_SCALE; n += 1) {
    beastB = scene.pickWorldPointAwayFrom(cx, cy, 520 * WORLD_LINEAR_SCALE, mapMargin);
  }
  scene.mythicBeasts = [
    createCamazotz(scene, beastA.x, beastA.y, { id: "bestia-1", name: "Camazotz" }),
    createCamazotz(scene, beastB.x, beastB.y, { id: "bestia-2", name: "Balam" }),
  ];

  const startX = cx + 260 * WORLD_LINEAR_SCALE;
  const startY = cy + 180 * WORLD_LINEAR_SCALE;
  const aldeano = scene.createUnit(startX, startY, {
    id: "aldeano-1",
    kind: "aldeano",
    label: "Aldeano",
    color: 0xe5c16f,
    speed: 170 * WORLD_LINEAR_SCALE,
    skin: createVillagerSkin("offline:aldeano-1", offlineCulture),
  });

  scene.createUnit(startX + 100 * WORLD_LINEAR_SCALE, startY + 70 * WORLD_LINEAR_SCALE, {
    id: "guerrero-1",
    kind: "guerrero",
    label: "Guerrero",
    color: 0xb84a3b,
    speed: 190 * WORLD_LINEAR_SCALE,
  });

  scene.focusCameraOnWorldPoint(cx, cy);
  scene.selectUnit(aldeano);

  revealOwnedCeremonialAreasForLocalPlayer(scene);
  revealFromLocalPlayerUnits(scene);
  redrawExplorationFogIfDirty(scene);
}
