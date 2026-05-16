import { WebSocket, WebSocketServer } from "ws";
import {
  GAME_TITLE,
  type ClientMessage,
  type OnlineGameState,
  type OnlineUnitKind,
  type OnlineUnitState,
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
};

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
  });

  return playerId;
}

function removePlayer(playerId: string) {
  state.players = state.players.filter((player) => player.id !== playerId);
  state.players.forEach((player, index) => {
    player.slot = index + 1;
  });
  state.units = state.units.filter((unit) => unit.ownerId !== playerId);
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
  }
}

function updateUnits(deltaMs: number) {
  const seconds = deltaMs / 1000;

  for (const unit of state.units) {
    if (!unit.target) continue;

    const distance = Math.hypot(unit.target.x - unit.x, unit.target.y - unit.y);
    if (distance < 4) {
      unit.target = undefined;
      continue;
    }

    const step = Math.min(distance, unit.speed * seconds);
    const angle = Math.atan2(unit.target.y - unit.y, unit.target.x - unit.x);
    unit.x += Math.cos(angle) * step;
    unit.y += Math.sin(angle) * step;
  }
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
