import { WebSocketServer } from "ws";
import { GAME_TITLE } from "@reinos/shared";

const port = Number(process.env.PORT ?? 8787);
const server = new WebSocketServer({ port });

server.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "welcome", game: GAME_TITLE }));
});

console.log(`${GAME_TITLE} server escuchando en puerto ${port}`);

