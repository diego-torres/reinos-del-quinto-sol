import { WebSocket, WebSocketServer } from "ws";
import {
  CONSTRUCTION_SITE_WORK_RADIUS_PX,
  DEPOSIT_APPROACH_INSET_PX,
  GATHER_APPROACH_OFFSET_PX,
  GATHER_MAX_DISTANCE_BEYOND_RADIUS_PX,
  GAME_TITLE,
  ONLINE_WORLD,
  RESOURCES,
  UNIT_MOVE_ARRIVAL_EPS_PX,
  WORLD_EDGE_MARGIN,
  WORLD_LINEAR_SCALE,
  createInitialResourceNodes,
  getBuildingConstructionTotalWork,
  getBuildingPlacementExclusionRadius,
  getBuildingResourceClearance,
  getConstructionApproachStandoffPx,
  normalizeCeremonialCenterCulture,
  type CeremonialCenterCulture,
  type ClientMessage,
  type OnlineBuildingKind,
  type OnlineBuildingState,
  type OnlineCeremonialCenterState,
  type OnlineGameState,
  type OnlineResourceNodeState,
  type OnlineUnitKind,
  type OnlineUnitState,
  type Resource,
  type ServerMessage,
} from "@reinos/shared";

const port = Number(process.env.PORT ?? 8787);
const server = new WebSocketServer({ port });
const clients = new Map<WebSocket, string>();
let nextPlayerNumber = 1;

const state: OnlineGameState = {
  tick: 0,
  players: [],
  units: [],
  resourceNodes: createInitialResourceNodes(),
  buildings: [],
  ceremonialCenters: [],
};

const CARRY_CAPACITY: Record<Resource, number> = {
  alimento: 30,
  madera: 25,
  piedra: 20,
  obsidiana: 15,
};
const GATHER_AMOUNT = 10;
const GATHER_INTERVAL_MS = 1000;
const CENTER_MAX_HEALTH = 650;
const CENTER_DEPOSIT_RADIUS = 180 * WORLD_LINEAR_SCALE;
const HOUSE_WOOD_COST = 50;
const TELPOCHCALLI_COST: Partial<Record<Resource, number>> = {
  madera: 120,
  piedra: 40,
};
const BASE_POPULATION_LIMIT = 5;
const HOUSE_POPULATION_BONUS = 5;
const TRAIN_ALDEANO_COST: Partial<Record<Resource, number>> = { alimento: 50 };
const TRAIN_GUERRERO_COST: Partial<Record<Resource, number>> = {
  alimento: 60,
  obsidiana: 20,
};
const ALDEANO_TRAIN_SPAWN_RADIUS = 230 * WORLD_LINEAR_SCALE;
const GUERRERO_TRAIN_SPAWN_RADIUS = 150 * WORLD_LINEAR_SCALE;
const WARRIOR_ATTACK = 14;
const WARRIOR_RANGE = 78 * WORLD_LINEAR_SCALE;
const WARRIOR_CENTER_ATTACK_INSET_PX = 12 * WORLD_LINEAR_SCALE;
const WARRIOR_COOLDOWN_MS = 850;
let nextBuildingNumber = 1;

server.on("connection", (socket) => {
  const playerId = assignPlayer(socket);

  send(socket, {
    type: "welcome",
    game: GAME_TITLE,
    playerId,
    state,
  });
  broadcastState();

  socket.on("message", (raw) => {
    handleClientMessage(playerId, raw.toString());
  });

  socket.on("close", () => {
    clients.delete(socket);
    removePlayer(playerId);
    broadcastState();
  });
});

setInterval(() => {
  updateUnits(1000 / 20);
  state.tick += 1;
  broadcastState();
}, 1000 / 20);

console.log(`${GAME_TITLE} server escuchando en puerto ${port}`);

function assignPlayer(socket: WebSocket) {
  const playerId = `player-${nextPlayerNumber++}`;
  clients.set(socket, playerId);

  state.players.push({
    id: playerId,
    slot: state.players.length + 1,
    resources: {
      alimento: 200,
      madera: 200,
      piedra: 200,
      obsidiana: 200,
    },
  });

  return playerId;
}

function removePlayer(playerId: string) {
  state.players = state.players.filter((player) => player.id !== playerId);
  state.players.forEach((player, index) => {
    player.slot = index + 1;
  });
  state.units = state.units.filter((unit) => unit.ownerId !== playerId);
  state.buildings = state.buildings.filter((building) => building.ownerId !== playerId);
  state.ceremonialCenters = state.ceremonialCenters.filter((center) => center.ownerId !== playerId);
}

function ensureStartingUnits(playerId: string) {
  if (state.units.some((unit) => unit.ownerId === playerId)) return;

  const center = getPlayerCenter(playerId);
  const ox = 260 * WORLD_LINEAR_SCALE;
  const oy = 180 * WORLD_LINEAR_SCALE;
  const dx = 100 * WORLD_LINEAR_SCALE;
  const dy = 70 * WORLD_LINEAR_SCALE;
  const startX = center ? center.x + ox : 780 * WORLD_LINEAR_SCALE;
  const startY = center ? center.y + oy : 620 * WORLD_LINEAR_SCALE;

  state.units.push(
    createUnit(`${playerId}-aldeano-1`, playerId, "aldeano", startX, startY),
    createUnit(`${playerId}-guerrero-1`, playerId, "guerrero", startX + dx, startY + dy),
  );
}

function ensureCeremonialCenter(playerId: string, culture: CeremonialCenterCulture) {
  if (state.ceremonialCenters.some((center) => center.ownerId === playerId)) return;

  const slot = state.players.find((player) => player.id === playerId)?.slot ?? 1;
  const position = pickCeremonialCenterPosition(slot);
  const resolvedCulture = normalizeCeremonialCenterCulture(culture);
  state.ceremonialCenters.push({
    id: `${playerId}-centro-ceremonial`,
    ownerId: playerId,
    culture: resolvedCulture,
    x: position.x,
    y: position.y,
    radius: CENTER_DEPOSIT_RADIUS,
    health: CENTER_MAX_HEALTH,
    maxHealth: CENTER_MAX_HEALTH,
    destroyed: false,
  });
}

function createUnit(
  id: string,
  ownerId: string,
  kind: OnlineUnitKind,
  x: number,
  y: number,
): OnlineUnitState {
  const maxHealth = kind === "aldeano" ? 55 : 95;

  return {
    id,
    ownerId,
    kind,
    x,
    y,
    speed: kind === "aldeano" ? 170 * WORLD_LINEAR_SCALE : 190 * WORLD_LINEAR_SCALE,
    health: maxHealth,
    maxHealth,
    cargo: {
      amount: 0,
    },
    workState: "idle",
  };
}

function getPlayerPopulationCapacity(playerId: string): number {
  const completedCasas = state.buildings.filter(
    (building) =>
      building.ownerId === playerId &&
      building.kind === "casa" &&
      building.constructionWorkRemaining <= 0,
  ).length;
  return BASE_POPULATION_LIMIT + completedCasas * HOUSE_POPULATION_BONUS;
}

function populationUsedByPlayer(playerId: string): number {
  return state.units.filter((unit) => unit.ownerId === playerId).length;
}

function allocateUnitId(playerId: string, kind: OnlineUnitKind): string {
  const slug = kind === "aldeano" ? "aldeano" : "guerrero";
  let maxSeq = 0;
  const prefix = `${playerId}-${slug}-`;
  for (const unit of state.units) {
    if (!unit.id.startsWith(prefix)) continue;
    const suffix = Number.parseInt(unit.id.slice(prefix.length), 10);
    if (!Number.isNaN(suffix)) maxSeq = Math.max(maxSeq, suffix);
  }
  return `${prefix}${maxSeq + 1}`;
}

function spawnTrainPoint(centerX: number, centerY: number, distance: number, spawnIndex: number): { x: number; y: number } {
  const angleDeg = 35 + spawnIndex * 37;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: clamp(centerX + Math.cos(rad) * distance, WORLD_EDGE_MARGIN, ONLINE_WORLD.width - WORLD_EDGE_MARGIN),
    y: clamp(centerY + Math.sin(rad) * distance, WORLD_EDGE_MARGIN, ONLINE_WORLD.height - WORLD_EDGE_MARGIN),
  };
}

function tryTrainUnit(playerId: string, kind: OnlineUnitKind): boolean {
  const player = state.players.find((candidate) => candidate.id === playerId);
  const center =
    kind === "aldeano"
      ? getPlayerCenter(playerId)
      : null;
  if (kind === "aldeano" && !center) return false;
  if (!player) return false;

  const cost = kind === "aldeano" ? TRAIN_ALDEANO_COST : TRAIN_GUERRERO_COST;
  if (!canAfford(player.resources, cost)) return false;
  if (populationUsedByPlayer(playerId) + 1 > getPlayerPopulationCapacity(playerId)) return false;

  if (kind === "guerrero") {
    const telpochcalli = state.buildings.find(
      (building) =>
        building.ownerId === playerId &&
        building.kind === "telpochcalli" &&
        building.constructionWorkRemaining <= 0,
    );
    if (!telpochcalli) return false;
    spendResources(player.resources, cost);
    const spawnIndex = populationUsedByPlayer(playerId);
    const { x, y } = spawnTrainPoint(telpochcalli.x, telpochcalli.y, GUERRERO_TRAIN_SPAWN_RADIUS, spawnIndex);
    state.units.push(createUnit(allocateUnitId(playerId, kind), playerId, kind, x, y));
    return true;
  }

  spendResources(player.resources, cost);
  const spawnIndex = populationUsedByPlayer(playerId);
  const { x, y } = spawnTrainPoint(center!.x, center!.y, ALDEANO_TRAIN_SPAWN_RADIUS, spawnIndex);
  state.units.push(createUnit(allocateUnitId(playerId, kind), playerId, kind, x, y));
  return true;
}

function handleClientMessage(playerId: string, raw: string) {
  let message: ClientMessage;
  try {
    message = JSON.parse(raw) as ClientMessage;
  } catch {
    return;
  }

  if (message.type === "join-game") {
    if (!state.players.some((player) => player.id === playerId)) return;
    ensureCeremonialCenter(playerId, message.culture);
    ensureStartingUnits(playerId);
    broadcastState();
    return;
  }

  if (message.type === "move-unit") {
    const unit = state.units.find((candidate) => candidate.id === message.unitId);
    if (!unit || unit.ownerId !== playerId) return;

    unit.target = {
      x: clamp(message.target.x, 0, ONLINE_WORLD.width),
      y: clamp(message.target.y, 0, ONLINE_WORLD.height),
    };
    unit.gatherTargetId = undefined;
    unit.attackTargetId = undefined;
    unit.constructionTargetId = undefined;
    unit.workState = "moving";
  }

  if (message.type === "gather-resource") {
    const unit = state.units.find((candidate) => candidate.id === message.unitId);
    const node = state.resourceNodes.find((candidate) => candidate.id === message.resourceNodeId);
    if (!unit || unit.ownerId !== playerId || unit.kind !== "aldeano" || !node || node.depleted) return;

    unit.gatherTargetId = node.id;
    unit.constructionTargetId = undefined;
    unit.target = getGatherApproachPoint(unit, node);
    unit.workState = "moving";
    unitGatherElapsed.set(unit.id, 0);
  }

  if (message.type === "deposit-resources") {
    const unit = state.units.find((candidate) => candidate.id === message.unitId);
    if (!unit || unit.ownerId !== playerId || unit.kind !== "aldeano" || !unit.cargo.resource || unit.cargo.amount <= 0) return;

    unit.gatherTargetId = undefined;
    unit.constructionTargetId = undefined;
    unit.attackTargetId = undefined;
    unit.target = getDepositApproachPoint(unit);
    unit.workState = "returning";
  }

  if (message.type === "build-structure") {
    buildStructure(playerId, message);
  }

  if (message.type === "assign-construction") {
    assignConstruction(playerId, message.unitId, message.buildingId);
  }

  if (message.type === "attack-center") {
    const unit = state.units.find((candidate) => candidate.id === message.unitId);
    const center = state.ceremonialCenters.find((candidate) => candidate.id === message.centerId);
    if (!unit || unit.ownerId !== playerId || unit.kind !== "guerrero" || !center || center.ownerId === playerId || center.destroyed) return;

    unit.gatherTargetId = undefined;
    unit.constructionTargetId = undefined;
    unit.attackTargetId = center.id;
    unit.target = getCenterApproachPoint(unit, center);
    unit.workState = "attacking";
    unitAttackElapsed.set(unit.id, 0);
    return;
  }

  if (message.type === "train-unit") {
    if (tryTrainUnit(playerId, message.kind)) {
      broadcastState();
    }
    return;
  }
}

const unitGatherElapsed = new Map<string, number>();
const unitAttackElapsed = new Map<string, number>();

function updateUnits(deltaMs: number) {
  const seconds = deltaMs / 1000;

  for (const unit of state.units) {
    if (!unit.target && unit.gatherTargetId && unit.workState === "gathering") {
      updateGathering(unit, deltaMs);
      continue;
    }

    if (!unit.target && unit.workState === "returning") {
      updateDeposit(unit);
      continue;
    }

    if (!unit.target && unit.attackTargetId && unit.workState === "attacking") {
      updateCenterAttack(unit, deltaMs);
      continue;
    }

    if (!unit.target && unit.constructionTargetId && unit.kind === "aldeano") {
      updateConstructionWorkerMotion(unit);
      continue;
    }

    if (!unit.target) continue;

    const distance = Math.hypot(unit.target.x - unit.x, unit.target.y - unit.y);
    if (distance < UNIT_MOVE_ARRIVAL_EPS_PX) {
      unit.target = undefined;
      if (unit.attackTargetId && unit.workState === "attacking") {
        updateCenterAttack(unit, deltaMs);
      } else if (unit.gatherTargetId) {
        unit.workState = unit.workState === "returning" ? "returning" : "gathering";
      } else if (unit.workState === "returning") {
        updateDeposit(unit);
      } else {
        unit.workState = "idle";
      }
      continue;
    }

    const step = Math.min(distance, unit.speed * seconds);
    const angle = Math.atan2(unit.target.y - unit.y, unit.target.x - unit.x);
    unit.x += Math.cos(angle) * step;
    unit.y += Math.sin(angle) * step;
  }

  advanceConstructionBuildings(deltaMs);
}

function updateCenterAttack(unit: OnlineUnitState, deltaMs: number) {
  const center = state.ceremonialCenters.find((candidate) => candidate.id === unit.attackTargetId);
  if (!center || center.destroyed) {
    unit.attackTargetId = undefined;
    unit.workState = "idle";
    return;
  }

  const distance = Math.hypot(center.x - unit.x, center.y - unit.y);
  if (distance > center.radius + WARRIOR_RANGE) {
    unit.target = getCenterApproachPoint(unit, center);
    unit.workState = "attacking";
    return;
  }

  const elapsed = (unitAttackElapsed.get(unit.id) ?? 0) + deltaMs;
  if (elapsed < WARRIOR_COOLDOWN_MS) {
    unitAttackElapsed.set(unit.id, elapsed);
    return;
  }

  center.health = Math.max(0, center.health - WARRIOR_ATTACK);
  unitAttackElapsed.set(unit.id, 0);

  if (center.health <= 0) {
    center.destroyed = true;
    unit.attackTargetId = undefined;
    unit.workState = "idle";
    state.winnerId = unit.ownerId;
  }
}

function updateGathering(unit: OnlineUnitState, deltaMs: number) {
  const node = state.resourceNodes.find((candidate) => candidate.id === unit.gatherTargetId);
  if (!node || node.depleted) {
    unit.gatherTargetId = undefined;
    unit.workState = "idle";
    return;
  }

  const distance = Math.hypot(node.x - unit.x, node.y - unit.y);
  if (distance > node.radius + GATHER_MAX_DISTANCE_BEYOND_RADIUS_PX) {
    unit.target = getGatherApproachPoint(unit, node);
    unit.workState = "moving";
    return;
  }

  const elapsed = (unitGatherElapsed.get(unit.id) ?? 0) + deltaMs;
  if (elapsed < GATHER_INTERVAL_MS) {
    unitGatherElapsed.set(unit.id, elapsed);
    return;
  }

  if (unit.cargo.resource && unit.cargo.resource !== node.resource && unit.cargo.amount > 0) {
    unit.target = getDepositApproachPoint(unit);
    unit.workState = "returning";
    unitGatherElapsed.set(unit.id, 0);
    return;
  }

  const capacity = CARRY_CAPACITY[node.resource];
  const remainingCapacity = capacity - unit.cargo.amount;
  if (remainingCapacity <= 0) {
    unit.target = getDepositApproachPoint(unit);
    unit.workState = "returning";
    unitGatherElapsed.set(unit.id, 0);
    return;
  }

  const gathered = Math.min(GATHER_AMOUNT, node.amount, remainingCapacity);
  node.amount -= gathered;
  node.depleted = node.amount <= 0;
  unit.cargo = {
    resource: node.resource,
    amount: unit.cargo.amount + gathered,
  };
  unitGatherElapsed.set(unit.id, 0);

  if (unit.cargo.amount >= capacity || node.depleted) {
    unit.target = getDepositApproachPoint(unit);
    unit.workState = "returning";
  }
}

function updateDeposit(unit: OnlineUnitState) {
  const center = getPlayerCenter(unit.ownerId);
  if (!center || center.destroyed) {
    unit.workState = "idle";
    return;
  }

  const distance = Math.hypot(center.x - unit.x, center.y - unit.y);
  if (distance > center.radius) {
    unit.target = getDepositApproachPoint(unit);
    unit.workState = "returning";
    return;
  }

  if (unit.cargo.resource && unit.cargo.amount > 0) {
    const player = state.players.find((candidate) => candidate.id === unit.ownerId);
    if (player) {
      player.resources[unit.cargo.resource] += unit.cargo.amount;
    }
    unit.cargo = { amount: 0 };
  }

  const node = state.resourceNodes.find((candidate) => candidate.id === unit.gatherTargetId);
  if (node && !node.depleted) {
    unit.target = getGatherApproachPoint(unit, node);
    unit.workState = "moving";
  } else {
    unit.gatherTargetId = undefined;
    unit.workState = "idle";
  }
}

function getGatherApproachPoint(unit: OnlineUnitState, node: OnlineResourceNodeState) {
  const angle = Math.atan2(unit.y - node.y, unit.x - node.x);
  const distance = node.radius + GATHER_APPROACH_OFFSET_PX;
  return {
    x: node.x + Math.cos(angle) * distance,
    y: node.y + Math.sin(angle) * distance,
  };
}

function getDepositApproachPoint(unit: OnlineUnitState) {
  const center = getPlayerCenter(unit.ownerId);
  if (!center) return { x: unit.x, y: unit.y };

  const angle = Math.atan2(unit.y - center.y, unit.x - center.x);
  const distance = center.radius - DEPOSIT_APPROACH_INSET_PX;
  return {
    x: center.x + Math.cos(angle) * distance,
    y: center.y + Math.sin(angle) * distance,
  };
}

function getCenterApproachPoint(unit: OnlineUnitState, center: OnlineCeremonialCenterState) {
  const angle = Math.atan2(unit.y - center.y, unit.x - center.x);
  const distance = center.radius + WARRIOR_RANGE - WARRIOR_CENTER_ATTACK_INSET_PX;
  return {
    x: center.x + Math.cos(angle) * distance,
    y: center.y + Math.sin(angle) * distance,
  };
}

function getConstructionApproachPoint(unit: OnlineUnitState, building: OnlineBuildingState) {
  const angle = Math.atan2(unit.y - building.y, unit.x - building.x);
  const distance = getConstructionApproachStandoffPx();
  return {
    x: building.x + Math.cos(angle) * distance,
    y: building.y + Math.sin(angle) * distance,
  };
}

function updateConstructionWorkerMotion(unit: OnlineUnitState) {
  const building = state.buildings.find((candidate) => candidate.id === unit.constructionTargetId);
  if (!building || building.constructionWorkRemaining <= 0) {
    unit.constructionTargetId = undefined;
    unit.target = undefined;
    unit.workState = "idle";
    return;
  }

  const distanceToSite = Math.hypot(building.x - unit.x, building.y - unit.y);
  if (distanceToSite > CONSTRUCTION_SITE_WORK_RADIUS_PX) {
    unit.target = getConstructionApproachPoint(unit, building);
    unit.workState = "moving";
    return;
  }

  unit.target = undefined;
  unit.workState = "idle";
}

function advanceConstructionBuildings(deltaMs: number) {
  const seconds = deltaMs / 1000;

  for (const building of state.buildings) {
    if (building.constructionWorkRemaining <= 0) continue;

    const workersPresent = state.units.filter((unit) => {
      if (unit.kind !== "aldeano" || unit.constructionTargetId !== building.id) return false;
      return Math.hypot(building.x - unit.x, building.y - unit.y) <= CONSTRUCTION_SITE_WORK_RADIUS_PX;
    }).length;

    building.constructionWorkRemaining = Math.max(0, building.constructionWorkRemaining - workersPresent * seconds);

    if (building.constructionWorkRemaining <= 0) {
      building.constructionWorkRemaining = 0;
      for (const unit of state.units) {
        if (unit.constructionTargetId === building.id) {
          unit.constructionTargetId = undefined;
        }
      }
    }
  }
}

function getPlayerCenter(playerId: string) {
  return state.ceremonialCenters.find((center) => center.ownerId === playerId);
}

function pickCeremonialCenterPosition(slot: number) {
  const margin = 420 * WORLD_LINEAR_SCALE;
  const minSeparation = 880 * WORLD_LINEAR_SCALE;
  const resourceClearance = 200 * WORLD_LINEAR_SCALE;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const x = margin + Math.random() * (ONLINE_WORLD.width - margin * 2);
    const y = margin + Math.random() * (ONLINE_WORLD.height - margin * 2);
    const farFromCenters = state.ceremonialCenters.every(
      (c) => Math.hypot(x - c.x, y - c.y) >= minSeparation,
    );
    const farFromResources = state.resourceNodes.every(
      (n) => Math.hypot(x - n.x, y - n.y) >= n.radius + resourceClearance,
    );
    if (farFromCenters && farFromResources) {
      return { x: Math.round(x), y: Math.round(y) };
    }
  }

  return getStartingCenterPosition(slot);
}

function getStartingCenterPosition(slot: number) {
  if (slot === 1) return { x: 720 * WORLD_LINEAR_SCALE, y: 680 * WORLD_LINEAR_SCALE };
  if (slot === 2) {
    return {
      x: ONLINE_WORLD.width - 720 * WORLD_LINEAR_SCALE,
      y: ONLINE_WORLD.height - 680 * WORLD_LINEAR_SCALE,
    };
  }

  const angle = ((slot - 1) / 6) * Math.PI * 2;
  return {
    x: ONLINE_WORLD.width / 2 + Math.cos(angle) * 2200 * WORLD_LINEAR_SCALE,
    y: ONLINE_WORLD.height / 2 + Math.sin(angle) * 1400 * WORLD_LINEAR_SCALE,
  };
}

function assignConstruction(playerId: string, unitId: string, buildingId: string) {
  const unit = state.units.find((candidate) => candidate.id === unitId);
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  if (!unit || unit.ownerId !== playerId || unit.kind !== "aldeano") return;
  if (!building || building.ownerId !== playerId || building.constructionWorkRemaining <= 0) return;

  unit.gatherTargetId = undefined;
  unit.attackTargetId = undefined;
  unit.constructionTargetId = building.id;
  unit.target = getConstructionApproachPoint(unit, building);
  unit.workState = "moving";
}

function buildStructure(
  playerId: string,
  message: Extract<ClientMessage, { type: "build-structure" }>,
) {
  const unit = state.units.find((candidate) => candidate.id === message.unitId);
  if (!unit || unit.ownerId !== playerId || unit.kind !== "aldeano") return;
  if (!isBuildingKind(message.kind)) return;

  const x = clamp(message.x, 0, ONLINE_WORLD.width);
  const y = clamp(message.y, 0, ONLINE_WORLD.height);
  if (!canPlaceBuildingAt(x, y, message.kind)) return;

  const player = state.players.find((candidate) => candidate.id === playerId);
  const cost = getBuildingCost(message.kind);
  if (!player || !canAfford(player.resources, cost)) return;

  spendResources(player.resources, cost);

  const buildingId = `${message.kind}-${nextBuildingNumber++}`;
  const constructionWorkRemaining = getBuildingConstructionTotalWork(message.kind);

  state.buildings.push({
    id: buildingId,
    ownerId: playerId,
    kind: message.kind,
    x,
    y,
    constructionWorkRemaining,
  });

  const building = state.buildings[state.buildings.length - 1]!;
  unit.gatherTargetId = undefined;
  unit.attackTargetId = undefined;
  unit.constructionTargetId = buildingId;
  unit.target = getConstructionApproachPoint(unit, building);
  unit.workState = "moving";
}

function canPlaceBuildingAt(x: number, y: number, kind: OnlineBuildingKind) {
  if (
    x < WORLD_EDGE_MARGIN ||
    y < WORLD_EDGE_MARGIN ||
    x > ONLINE_WORLD.width - WORLD_EDGE_MARGIN ||
    y > ONLINE_WORLD.height - WORLD_EDGE_MARGIN
  ) {
    return false;
  }

  const nearResource = state.resourceNodes.some((node) => {
    if (node.depleted) return false;
    return Math.hypot(x - node.x, y - node.y) < node.radius + getBuildingResourceClearance(kind);
  });
  if (nearResource) return false;

  const nearBuilding = state.buildings.some((building) => {
    return Math.hypot(x - building.x, y - building.y) < getBuildingPlacementExclusionRadius(kind);
  });
  if (nearBuilding) return false;

  const placementRadius = getBuildingPlacementExclusionRadius(kind);
  return !state.ceremonialCenters.some(
    (center) => Math.hypot(x - center.x, y - center.y) < center.radius + placementRadius,
  );
}

function getBuildingCost(kind: OnlineBuildingKind): Partial<Record<Resource, number>> {
  if (kind === "casa") return { madera: HOUSE_WOOD_COST };
  return TELPOCHCALLI_COST;
}

function isBuildingKind(kind: string): kind is OnlineBuildingKind {
  return kind === "casa" || kind === "telpochcalli";
}

function canAfford(resources: Record<Resource, number>, cost: Partial<Record<Resource, number>>) {
  return RESOURCES.every((resource) => resources[resource] >= (cost[resource] ?? 0));
}

function spendResources(resources: Record<Resource, number>, cost: Partial<Record<Resource, number>>) {
  RESOURCES.forEach((resource) => {
    resources[resource] -= cost[resource] ?? 0;
  });
}

function broadcastState() {
  const message: ServerMessage = {
    type: "state",
    state,
  };

  const payload = JSON.stringify(message);
  for (const socket of clients.keys()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
