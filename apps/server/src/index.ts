import { WebSocket, WebSocketServer } from "ws";
import {
  GAME_TITLE,
  ONLINE_WORLD,
  RESOURCES,
  normalizeCeremonialCenterCulture,
  type CeremonialCenterCulture,
  type ClientMessage,
  type OnlineBuildingKind,
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
  resourceNodes: createResourceNodes(),
  buildings: [],
  ceremonialCenters: [],
};

const CARRY_CAPACITY: Record<Resource, number> = {
  maiz: 30,
  madera: 25,
  piedra: 20,
  obsidiana: 15,
};
const GATHER_AMOUNT = 10;
const GATHER_INTERVAL_MS = 1000;
const CENTER_MAX_HEALTH = 650;
const CENTER_DEPOSIT_RADIUS = 180;
const HOUSE_WOOD_COST = 50;
const TELPOCHCALLI_COST: Partial<Record<Resource, number>> = {
  madera: 120,
  piedra: 40,
};
const BUILDING_RADIUS: Record<OnlineBuildingKind, number> = {
  casa: 112,
  telpochcalli: 146,
};
const RESOURCE_CLEARANCE: Record<OnlineBuildingKind, number> = {
  casa: 54,
  telpochcalli: 82,
};
const WARRIOR_ATTACK = 14;
const WARRIOR_RANGE = 78;
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
      maiz: 200,
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
  const startX = center ? center.x + 260 : 780;
  const startY = center ? center.y + 180 : 620;

  state.units.push(
    createUnit(`${playerId}-aldeano-1`, playerId, "aldeano", startX, startY),
    createUnit(`${playerId}-guerrero-1`, playerId, "guerrero", startX + 100, startY + 70),
  );
}

function ensureCeremonialCenter(playerId: string, culture: CeremonialCenterCulture) {
  if (state.ceremonialCenters.some((center) => center.ownerId === playerId)) return;

  const slot = state.players.find((player) => player.id === playerId)?.slot ?? 1;
  const position = getStartingCenterPosition(slot);
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
    speed: kind === "aldeano" ? 170 : 190,
    health: maxHealth,
    maxHealth,
    cargo: {
      amount: 0,
    },
    workState: "idle",
  };
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
    unit.workState = "moving";
  }

  if (message.type === "gather-resource") {
    const unit = state.units.find((candidate) => candidate.id === message.unitId);
    const node = state.resourceNodes.find((candidate) => candidate.id === message.resourceNodeId);
    if (!unit || unit.ownerId !== playerId || unit.kind !== "aldeano" || !node || node.depleted) return;

    unit.gatherTargetId = node.id;
    unit.target = getGatherApproachPoint(unit, node);
    unit.workState = "moving";
    unitGatherElapsed.set(unit.id, 0);
  }

  if (message.type === "deposit-resources") {
    const unit = state.units.find((candidate) => candidate.id === message.unitId);
    if (!unit || unit.ownerId !== playerId || unit.kind !== "aldeano" || !unit.cargo.resource || unit.cargo.amount <= 0) return;

    unit.gatherTargetId = undefined;
    unit.attackTargetId = undefined;
    unit.target = getDepositApproachPoint(unit);
    unit.workState = "returning";
  }

  if (message.type === "build-structure") {
    buildStructure(playerId, message);
  }

  if (message.type === "attack-center") {
    const unit = state.units.find((candidate) => candidate.id === message.unitId);
    const center = state.ceremonialCenters.find((candidate) => candidate.id === message.centerId);
    if (!unit || unit.ownerId !== playerId || unit.kind !== "guerrero" || !center || center.ownerId === playerId || center.destroyed) return;

    unit.gatherTargetId = undefined;
    unit.attackTargetId = center.id;
    unit.target = getCenterApproachPoint(unit, center);
    unit.workState = "attacking";
    unitAttackElapsed.set(unit.id, 0);
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

    if (!unit.target) continue;

    const distance = Math.hypot(unit.target.x - unit.x, unit.target.y - unit.y);
    if (distance < 4) {
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
  if (distance > node.radius + 42) {
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
  const distance = node.radius + 26;
  return {
    x: node.x + Math.cos(angle) * distance,
    y: node.y + Math.sin(angle) * distance,
  };
}

function getDepositApproachPoint(unit: OnlineUnitState) {
  const center = getPlayerCenter(unit.ownerId);
  if (!center) return { x: unit.x, y: unit.y };

  const angle = Math.atan2(unit.y - center.y, unit.x - center.x);
  const distance = center.radius - 28;
  return {
    x: center.x + Math.cos(angle) * distance,
    y: center.y + Math.sin(angle) * distance,
  };
}

function getCenterApproachPoint(unit: OnlineUnitState, center: OnlineCeremonialCenterState) {
  const angle = Math.atan2(unit.y - center.y, unit.x - center.x);
  const distance = center.radius + WARRIOR_RANGE - 12;
  return {
    x: center.x + Math.cos(angle) * distance,
    y: center.y + Math.sin(angle) * distance,
  };
}

function getPlayerCenter(playerId: string) {
  return state.ceremonialCenters.find((center) => center.ownerId === playerId);
}

function getStartingCenterPosition(slot: number) {
  if (slot === 1) return { x: 720, y: 680 };
  if (slot === 2) return { x: ONLINE_WORLD.width - 720, y: ONLINE_WORLD.height - 680 };

  const angle = ((slot - 1) / 6) * Math.PI * 2;
  return {
    x: ONLINE_WORLD.width / 2 + Math.cos(angle) * 2200,
    y: ONLINE_WORLD.height / 2 + Math.sin(angle) * 1400,
  };
}

function createResourceNodes(): OnlineResourceNodeState[] {
  return [
    createResourceNode("maiz-1", "maiz", "Maizal", 676, 554, 94),
    createResourceNode("maiz-2", "maiz", "Maizal", 336, 814, 94),
    createResourceNode("maiz-3", "maiz", "Maizal", 1136, 594, 94),
    createResourceNode("madera-4", "madera", "Bosque", 1426, 402, 118),
    createResourceNode("madera-5", "madera", "Bosque", 1826, 792, 118),
    createResourceNode("piedra-6", "piedra", "Piedra", 698, 1038, 74),
    createResourceNode("piedra-7", "piedra", "Piedra", 1658, 1128, 74),
    createResourceNode("obsidiana-8", "obsidiana", "Obsidiana", 1125, 1122, 72),
    createResourceNode("obsidiana-9", "obsidiana", "Obsidiana", 2055, 432, 72),
    createResourceNode("maiz-10", "maiz", "Maizal", ONLINE_WORLD.width - 676, ONLINE_WORLD.height - 554, 94),
    createResourceNode("maiz-11", "maiz", "Maizal", ONLINE_WORLD.width - 336, ONLINE_WORLD.height - 814, 94),
    createResourceNode("maiz-12", "maiz", "Maizal", ONLINE_WORLD.width - 1136, ONLINE_WORLD.height - 594, 94),
    createResourceNode("madera-13", "madera", "Bosque", ONLINE_WORLD.width - 1426, ONLINE_WORLD.height - 402, 118),
    createResourceNode("madera-14", "madera", "Bosque", ONLINE_WORLD.width - 1826, ONLINE_WORLD.height - 792, 118),
    createResourceNode("piedra-15", "piedra", "Piedra", ONLINE_WORLD.width - 698, ONLINE_WORLD.height - 1038, 74),
    createResourceNode("piedra-16", "piedra", "Piedra", ONLINE_WORLD.width - 1658, ONLINE_WORLD.height - 1128, 74),
    createResourceNode("obsidiana-17", "obsidiana", "Obsidiana", ONLINE_WORLD.width - 1125, ONLINE_WORLD.height - 1122, 72),
    createResourceNode("obsidiana-18", "obsidiana", "Obsidiana", ONLINE_WORLD.width - 2055, ONLINE_WORLD.height - 432, 72),
  ];
}

function createResourceNode(
  id: string,
  resource: Resource,
  label: string,
  x: number,
  y: number,
  radius: number,
): OnlineResourceNodeState {
  return {
    id,
    resource,
    label,
    x,
    y,
    radius,
    amount: 500,
    depleted: false,
  };
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
  unit.target = undefined;
  unit.gatherTargetId = undefined;
  unit.workState = "idle";

  state.buildings.push({
    id: `${message.kind}-${nextBuildingNumber++}`,
    ownerId: playerId,
    kind: message.kind,
    x,
    y,
  });
}

function canPlaceBuildingAt(x: number, y: number, kind: OnlineBuildingKind) {
  if (x < 80 || y < 80 || x > ONLINE_WORLD.width - 80 || y > ONLINE_WORLD.height - 80) return false;

  const nearResource = state.resourceNodes.some((node) => {
    if (node.depleted) return false;
    return Math.hypot(x - node.x, y - node.y) < node.radius + RESOURCE_CLEARANCE[kind];
  });
  if (nearResource) return false;

  const nearBuilding = state.buildings.some((building) => {
    return Math.hypot(x - building.x, y - building.y) < BUILDING_RADIUS[kind];
  });
  if (nearBuilding) return false;

  return !state.ceremonialCenters.some((center) => Math.hypot(x - center.x, y - center.y) < center.radius + BUILDING_RADIUS[kind]);
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
