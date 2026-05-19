import Phaser from "phaser";
import faviconUrl from "@repo-assets/sprites/icon.png";
import { GameScene } from "./scenes/gameScene.js";
import "./styles.css";

function installFavicon(href: string): void {
  const existing = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  const link = existing ?? document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.href = href;
  if (!existing) document.head.appendChild(link);
}

installFavicon(faviconUrl);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#B96542",
  scene: GameScene,
  physics: {
    default: "arcade",
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
