import { GAME_TITLE } from "@reinos/shared";

const root = document.querySelector<HTMLDivElement>("#app");

if (root) {
  root.textContent = `${GAME_TITLE} - prototipo inicial`;
}

