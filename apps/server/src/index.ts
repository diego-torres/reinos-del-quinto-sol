import { WebSocket, WebSocketServer } from "ws";
import {
  GAME_TITLE,
  RESOURCES,
  type ClientMessage,
  type OnlineBuildingKind,
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
};

const CARRY_CAPACITY: Record<Resource, number> = {
  maiz: 30,
  madera: 25,
  piedra: 20,
  obsidiana: 15,
};
const GATHER_AMOUNT = 10;
const GATHER_INTERVAL_MS = 1000;
const CEREMONIAL_CENTER = {
  x: 520,
  y: 470,
  depositRadius: 180,
};
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
let nextBuildingNumber = 1;

server.on("connection", (socket) => {
  const playerId = assignPlayer(socket);
  ensureStartingUnits(playerId);

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
}

function ensureStartingUnits(playerId: string) {
  if (state.units.some((unit) => unit.ownerId === playerId)) return;

  const slot = state.players.find((player) => player.id === playerId)?.slot ?? 1;
  const startX = slot === 1 ? 780 : 1240;
  const startY = slot === 1 ? 620 : 620;

  state.units.push(
    createUnit(`${playerId}-aldeano-1`, playerId, "aldeano", startX, startY),
    createUnit(`${playerId}-guerrero-1`, playerId, "guerrero", startX + 100, startY + 70),
  );
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

  if (message.type === "move-unit") {
    const unit = state.units.find((candidate) => candidate.id === message.unitId);
    if (!unit || unit.ownerId !== playerId) return;

    unit.target = {
      x: clamp(message.target.x, 0, 2400),
      y: clamp(message.target.y, 0, 1600),
    };
    unit.gatherTargetId = undefined;
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
    unit.target = getDepositApproachPoint(unit);
    unit.workState = "returning";
  }

  if (message.type === "build-structure") {
    buildStructure(playerId, message);
  }
}

const unitGatherElapsed = new Map<string, number>();

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

    if (!unit.target) continue;

    const distance = Math.hypot(unit.target.x - unit.x, unit.target.y - unit.y);
    if (distance < 4) {
      unit.target = undefined;
      if (unit.gatherTargetId) {
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
  const distance = Math.hypot(CEREMONIAL_CENTER.x - unit.x, CEREMONIAL_CENTER.y - unit.y);
  if (distance > CEREMONIAL_CENTER.depositRadius) {
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
  const angle = Math.atan2(unit.y - CEREMONIAL_CENTER.y, unit.x - CEREMONIAL_CENTER.x);
  const distance = CEREMONIAL_CENTER.depositRadius - 28;
  return {
    x: CEREMONIAL_CENTER.x + Math.cos(angle) * distance,
    y: CEREMONIAL_CENTER.y + Math.sin(angle) * distance,
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

  const x = clamp(message.x, 0, 2400);
  const y = clamp(message.y, 0, 1600);
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
  if (x < 80 || y < 80 || x > 2400 - 80 || y > 1600 - 80) return false;

  const nearResource = state.resourceNodes.some((node) => {
    if (node.depleted) return false;
    return Math.hypot(x - node.x, y - node.y) < node.radius + RESOURCE_CLEARANCE[kind];
  });
  if (nearResource) return false;

  return !state.buildings.some((building) => {
    return Math.hypot(x - building.x, y - building.y) < BUILDING_RADIUS[kind];
  });
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
