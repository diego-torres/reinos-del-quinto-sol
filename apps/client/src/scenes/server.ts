import {
  CEREMONIAL_CENTER_CULTURES,
  normalizeCeremonialCenterCulture,
  WORLD_LINEAR_SCALE,
  type CeremonialCenterCulture,
  type ClientMessage,
  type OnlineGameState,
  type ServerMessage,
} from "@reinos/shared";
import {
  CEREMONIAL_CENTER_DISPLAY_SIZE,
  drawCeremonialCenter,
  drawHouse,
  drawTelpochcalli,
  labelStyle,
  telpochcalliDisplayLabel,
} from "../art.js";
import { resolveBuildingCultureFromState } from "../buildingCulture.js";
import {
  createUnderConstructionVisual,
  refreshBuildingConstructionVisual,
  replaceBuildingWithCompleteVisual,
} from "./buildingConstruction.js";
import type { BuildingData, CeremonialCenterData, ResourceNode, UnitData } from "../types.js";
import { CEREMONIAL_CENTER_LABELS } from "./constants.js";
import {
  redrawExplorationFogIfDirty,
  resetExplorationFog,
  revealFromLocalPlayerUnits,
  revealOwnedCeremonialAreasForLocalPlayer,
} from "./explorationFog.js";
import type { GameScene } from "./gameScene.js";

export function sendOnlineMoveCommand(scene: GameScene, unitData: UnitData, x: number, y: number): boolean {
  if (!unitData.ownerId) {
    return false;
  }
  if (!scene.socket || scene.socket.readyState !== WebSocket.OPEN) return false;

  if (unitData.ownerId !== scene.playerId) {
    scene.setStatus("Esa unidad pertenece a otro jugador.");
    return true;
  }

  scene.socket.send(JSON.stringify({
    type: "move-unit",
    unitId: unitData.id,
    target: { x, y },
  }));
  scene.setStatus(`${unitData.label} recibe orden online a ${Math.round(x)}, ${Math.round(y)}.`);
  return true;
}

export function sendOnlineGatherCommand(scene: GameScene, unitData: UnitData, resourceNode: ResourceNode): boolean {
  if (!unitData.ownerId) {
    return false;
  }
  if (!scene.socket || scene.socket.readyState !== WebSocket.OPEN) return false;

  if (unitData.ownerId !== scene.playerId) {
    scene.setStatus("Esa unidad pertenece a otro jugador.");
    return true;
  }

  scene.socket.send(JSON.stringify({
    type: "gather-resource",
    unitId: unitData.id,
    resourceNodeId: resourceNode.id,
  }));
  scene.setStatus(`${unitData.label} recibe orden online de recolectar ${resourceNode.label.toLowerCase()}.`);
  return true;
}

export function sendOnlineDepositCommand(scene: GameScene, unitData: UnitData): boolean {
  if (!unitData.ownerId) {
    return false;
  }
  if (!scene.socket || scene.socket.readyState !== WebSocket.OPEN) return false;

  if (unitData.ownerId !== scene.playerId) {
    scene.setStatus("Esa unidad pertenece a otro jugador.");
    return true;
  }

  const cargo = scene.getUnitCargo(scene.selectedUnit!);
  if (!cargo.resource || cargo.amount <= 0) {
    scene.setStatus(`${unitData.label} no trae recursos para depositar.`);
    return true;
  }

  scene.socket.send(JSON.stringify({
    type: "deposit-resources",
    unitId: unitData.id,
  }));
  scene.setStatus(`${unitData.label} recibe orden online de depositar.`);
  return true;
}

export function sendOnlineAttackCenterCommand(
  scene: GameScene,
  unitData: UnitData,
  center: CeremonialCenterData,
): boolean {
  if (!unitData.ownerId) {
    return false;
  }
  if (!scene.socket || scene.socket.readyState !== WebSocket.OPEN) return false;

  if (unitData.ownerId !== scene.playerId) {
    scene.setStatus("Esa unidad pertenece a otro jugador.");
    return true;
  }

  if (unitData.kind !== "guerrero") {
    scene.setStatus("Necesitas un guerrero para atacar el centro ceremonial enemigo.");
    return true;
  }

  scene.socket.send(JSON.stringify({
    type: "attack-center",
    unitId: unitData.id,
    centerId: center.id,
  }));
  scene.setStatus(`${unitData.label} ataca el centro ceremonial enemigo.`);
  return true;
}

export function sendOnlineAssignConstructionCommand(
  scene: GameScene,
  unitData: UnitData,
  buildingId: string,
): boolean {
  if (!unitData.ownerId) {
    return false;
  }
  if (!scene.socket || scene.socket.readyState !== WebSocket.OPEN) return false;

  if (unitData.ownerId !== scene.playerId) {
    scene.setStatus("Esa unidad pertenece a otro jugador.");
    return true;
  }

  if (unitData.kind !== "aldeano") {
    scene.setStatus("Solo los aldeanos pueden trabajar en la obra.");
    return true;
  }

  scene.socket.send(JSON.stringify({
    type: "assign-construction",
    unitId: unitData.id,
    buildingId,
  }));
  scene.setStatus(`${unitData.label} se une a la obra online.`);
  return true;
}

export function sendOnlineBuildCommand(scene: GameScene, unitData: UnitData, kind: BuildingData["kind"], x: number, y: number): boolean {
  if (!unitData.ownerId) {
    return false;
  }
  if (!scene.socket || scene.socket.readyState !== WebSocket.OPEN) return false;

  if (unitData.ownerId !== scene.playerId) {
    scene.setStatus("Esa unidad pertenece a otro jugador.");
    return true;
  }

  scene.socket.send(JSON.stringify({
    type: "build-structure",
    unitId: unitData.id,
    kind,
    x,
    y,
  }));
  const requestingCulture =
    scene.playerId !== undefined
      ? resolveBuildingCultureFromState(scene.onlineState, scene.playerId)
      : "maya";
  const structureLabel =
    kind === "casa" ? "Casa" : telpochcalliDisplayLabel(requestingCulture);
  scene.setStatus(`${structureLabel} enviada al servidor.`);
  return true;
}

export function connectToGameServer(scene: GameScene): void {
  const socket = new WebSocket("ws://127.0.0.1:8787");
  scene.socket = socket;

  socket.addEventListener("open", () => {
    scene.onlineText?.setText("online: conectado");
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data as string) as ServerMessage;
    if (message.type === "welcome") {
      scene.playerId = message.playerId;
      scene.onlineMode = true;
      scene.onlineText?.setText(`online: ${scene.playerId}`);
      resetExplorationFog(scene);
      applyOnlineState(scene, message.state);
      return;
    }

    if (message.type === "state") {
      applyOnlineState(scene, message.state);
    }
  });

  socket.addEventListener("close", () => {
    scene.onlineMode = false;
    scene.didInitialCameraFocus = false;
    scene.onlineText?.setText("online: desconectado");
    hideCulturePicker(scene);
  });

  socket.addEventListener("error", () => {
    scene.onlineMode = false;
    scene.didInitialCameraFocus = false;
    scene.onlineText?.setText("online: servidor no disponible");
    hideCulturePicker(scene);
  });
}

export function sendJoinGame(scene: GameScene, culture: CeremonialCenterCulture): void {
  if (!scene.socket || scene.socket.readyState !== WebSocket.OPEN || !scene.playerId) return;
  const message: ClientMessage = { type: "join-game", culture };
  scene.socket.send(JSON.stringify(message));
}

function ensureCulturePickerDom(scene: GameScene): void {
  if (scene.culturePickerRoot) return;

  const root = document.createElement("div");
  root.className = "culture-picker-root";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Elegir cultura");

  const inner = document.createElement("div");
  inner.className = "culture-picker-panel";

  const title = document.createElement("h2");
  title.className = "culture-picker-title";
  title.textContent = "Elige tu cultura";

  const hint = document.createElement("p");
  hint.className = "culture-picker-hint";
  hint.textContent =
    "Tu centro ceremonial aparece en una posición aleatoria del mapa; la cultura define su arte.";

  for (const culture of CEREMONIAL_CENTER_CULTURES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "culture-picker-option";
    btn.textContent = CEREMONIAL_CENTER_LABELS[culture];
    btn.addEventListener("click", () => sendJoinGame(scene, culture));
    inner.appendChild(btn);
  }

  root.appendChild(title);
  root.appendChild(hint);
  root.appendChild(inner);
  document.body.appendChild(root);
  scene.culturePickerRoot = root;
}

function hideCulturePicker(scene: GameScene): void {
  if (!scene.culturePickerRoot) return;
  scene.culturePickerRoot.style.display = "none";
}

function syncCulturePicker(scene: GameScene): void {
  if (!scene.onlineMode || !scene.playerId) {
    hideCulturePicker(scene);
    return;
  }

  const hasCenter = scene.onlineState?.ceremonialCenters.some((c) => c.ownerId === scene.playerId) ?? false;
  if (hasCenter) {
    hideCulturePicker(scene);
    if (!scene.onlineState?.winnerId) {
      scene.setStatus("Selecciona una unidad.");
    }
    return;
  }

  ensureCulturePickerDom(scene);
  scene.culturePickerRoot!.style.display = "flex";
  scene.setStatus("Elige tu cultura para entrar al mapa.");
}

export function applyOnlineState(scene: GameScene, state: OnlineGameState): void {
  scene.onlineState = state;

  if (!scene.initializedOnlineUnits) {
    scene.clearLocalUnits();
    scene.initializedOnlineUnits = true;
  }

  state.units.forEach((unitState) => {
    let unit = scene.findUnitById(unitState.id);
    if (!unit) {
      const culture = state.ceremonialCenters.find((center) => center.ownerId === unitState.ownerId)?.culture;
      unit = scene.createUnit(unitState.x, unitState.y, scene.onlineUnitData(unitState, culture));
    }

    unit.setPosition(unitState.x, unitState.y);
    unit.setData("health", unitState.health);
    unit.setData("target", undefined);
    unit.setData("cargo", unitState.cargo);
    unit.setData("workState", unitState.workState);
    unit.setData("gatherTarget", scene.resourceNodes.find((node) => node.id === unitState.gatherTargetId));
    unit.setData("attackCenterId", unitState.attackTargetId);
    unit.setData("constructionTargetId", unitState.constructionTargetId);
    scene.updateUnitHealthLabel(unit);
    scene.updateUnitCargoLabel(unit);
  });

  const activeIds = new Set(state.units.map((unit) => unit.id));
  scene.units
    .filter((unit) => {
      const unitData = unit.getData("unit") as UnitData;
      return unitData.ownerId && !activeIds.has(unitData.id);
    })
    .forEach((unit) => {
      scene.units = scene.units.filter((candidate) => candidate !== unit);
      unit.destroy();
    });

  if (!scene.selectedUnit && scene.playerId) {
    const ownUnit = scene.units.find((unit) => {
      const unitData = unit.getData("unit") as UnitData;
      return unitData.ownerId === scene.playerId;
    });
    if (ownUnit) scene.selectUnit(ownUnit);
  }

  if (scene.selectedUnit && scene.selectionRing) {
    scene.selectionRing.setPosition(scene.selectedUnit.x, scene.selectedUnit.y + 8 * WORLD_LINEAR_SCALE);
  }

  applyOnlineResources(scene, state);
  applyOnlineCeremonialCenters(scene, state);
  applyOnlineBuildings(scene, state);
  applyWinnerState(scene, state);
  scene.onlineText?.setText(`online: ${scene.playerId ?? "conectado"} | jugadores ${state.players.length}`);
  revealOwnedCeremonialAreasForLocalPlayer(scene);
  revealFromLocalPlayerUnits(scene);
  redrawExplorationFogIfDirty(scene);
  scene.syncDomState();
  syncCulturePicker(scene);
  scene.maybeFocusCameraOnOwnCenter();
}

function applyOnlineCeremonialCenters(scene: GameScene, state: OnlineGameState): void {
  state.ceremonialCenters.forEach((centerState) => {
    const culture = normalizeCeremonialCenterCulture(centerState.culture);
    let center = scene.ceremonialCenters.find((candidate) => candidate.id === centerState.id);
    if (!center) {
      const container = drawCeremonialCenter(scene, centerState.x, centerState.y, culture);
      const healthLabel = scene.add.text(
        centerState.x,
        centerState.y + CEREMONIAL_CENTER_DISPLAY_SIZE / 2 + 52,
        "",
        labelStyle(14),
      ).setOrigin(0.5);
      healthLabel.setDepth(4);
      center = { ...centerState, culture, container, healthLabel };
      scene.ceremonialCenters.push(center);
    } else if (center.culture !== culture) {
      center.container.destroy();
      center.container = drawCeremonialCenter(scene, centerState.x, centerState.y, culture);
      center.culture = culture;
    }

    center.x = centerState.x;
    center.y = centerState.y;
    center.health = centerState.health;
    center.maxHealth = centerState.maxHealth;
    center.destroyed = centerState.destroyed;
    center.container.setPosition(centerState.x, centerState.y);
    center.container.setAlpha(center.destroyed ? 0.35 : 1);
    center.healthLabel.setPosition(centerState.x, centerState.y + CEREMONIAL_CENTER_DISPLAY_SIZE / 2 + 52);
    center.healthLabel.setText(`${center.ownerId === scene.playerId ? "Tu centro" : "Centro rival"} ${center.health}/${center.maxHealth}`);
  });

  const activeIds = new Set(state.ceremonialCenters.map((center) => center.id));
  scene.ceremonialCenters
    .filter((center) => !activeIds.has(center.id))
    .forEach((center) => {
      center.container.destroy();
      center.healthLabel.destroy();
      scene.ceremonialCenters = scene.ceremonialCenters.filter((candidate) => candidate !== center);
    });

  if (scene.playerId && state.ceremonialCenters.some((c) => c.ownerId === scene.playerId) && scene.offlineFallbackCenter) {
    scene.offlineFallbackCenter.container.destroy();
    scene.offlineFallbackCenter = undefined;
  }
}

function applyWinnerState(scene: GameScene, state: OnlineGameState): void {
  if (!state.winnerId) return;

  scene.setStatus(state.winnerId === scene.playerId
    ? "Victoria: destruiste el centro ceremonial enemigo."
    : "Derrota: tu centro ceremonial fue destruido.");
}

function applyOnlineResources(scene: GameScene, state: OnlineGameState): void {
  const player = state.players.find((candidate) => candidate.id === scene.playerId);
  if (player) {
    scene.resources = { ...player.resources };
    scene.updateHudResources();
  }

  state.resourceNodes.forEach((serverNode) => {
    const node = scene.resourceNodes.find((candidate) => candidate.id === serverNode.id);
    if (!node) return;

    node.amount = serverNode.amount;
    if (serverNode.depleted) {
      scene.depleteResourceNode(node);
    } else {
      node.depleted = false;
      node.text.setText(`${node.label} (${node.amount})`);
    }
  });
}

function applyOnlineBuildings(scene: GameScene, state: OnlineGameState): void {
  state.buildings.forEach((buildingState) => {
    let building = scene.buildings.find((candidate) => candidate.id === buildingState.id);
    if (!building) {
      building = scene.onlineBuildingData(buildingState);
      if (buildingState.constructionWorkRemaining > 0) {
        createUnderConstructionVisual(scene, building);
      } else {
        building.container = building.kind === "casa"
          ? drawHouse(scene, building.x, building.y, building.culture)
          : drawTelpochcalli(scene, building.x, building.y, building.culture);
      }
      scene.buildings.push(building);
    } else {
      building.culture = resolveBuildingCultureFromState(scene.onlineState, buildingState.ownerId);
      building.constructionWorkRemaining = buildingState.constructionWorkRemaining;
      if (building.constructionWorkRemaining > 0) {
        if (!building.constructionProgressFill) {
          building.container?.destroy();
          createUnderConstructionVisual(scene, building);
        }
        refreshBuildingConstructionVisual(scene, building);
      } else if (building.constructionProgressFill) {
        replaceBuildingWithCompleteVisual(scene, building);
      }
    }
  });

  const activeIds = new Set(state.buildings.map((building) => building.id));
  scene.buildings
    .filter((building) => building.ownerId && !activeIds.has(building.id))
    .forEach((building) => {
      building.container?.destroy();
      scene.buildings = scene.buildings.filter((candidate) => candidate !== building);
    });

  scene.populationLimit = 5 + scene.buildings
    .filter(
      (building) => building.ownerId === scene.playerId
        && building.kind === "casa"
        && building.constructionWorkRemaining <= 0,
    )
    .reduce((total, building) => total + building.populationBonus, 0);
  scene.updateHudResources();
}
