import Phaser from "phaser";
import { GAME_POSTER_ASSET_KEY } from "../art.js";

export type TitleSplashHost = Phaser.Scene & {
  titleSplashActive: boolean;
};

/**
 * Pantalla inicial con el cartel del juego; bloquea input de gameplay hasta cerrarse.
 */
export function showTitleSplash(scene: TitleSplashHost, onDismiss: () => void): void {
  scene.titleSplashActive = true;

  const root = scene.add.container(0, 0);
  root.setDepth(50_000);

  const backdrop = scene.add.rectangle(0, 0, 1, 1, 0x17261d, 1);
  backdrop.setOrigin(0.5);

  const poster = scene.add.image(0, 0, GAME_POSTER_ASSET_KEY);
  poster.setOrigin(0.5);

  const hint = scene.add.text(0, 0, "Clic o Enter para comenzar", {
    fontFamily: "system-ui, sans-serif",
    fontSize: "15px",
    color: "#c8d6b0",
  });
  hint.setOrigin(0.5);

  root.add([backdrop, poster, hint]);

  const layout = (): void => {
    const w = scene.scale.width;
    const h = scene.scale.height;
    root.setPosition(w / 2, h / 2);
    backdrop.setPosition(0, 0);
    backdrop.setSize(w, h);

    const scale = Math.min(w / poster.width, h / poster.height) * 0.88;
    poster.setScale(scale);

    hint.setPosition(0, poster.displayHeight / 2 + 36);
  };

  layout();

  const resizeHandler = (): void => {
    layout();
  };
  scene.scale.on(Phaser.Scale.Events.RESIZE, resizeHandler);

  let dismissed = false;
  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    scene.scale.off(Phaser.Scale.Events.RESIZE, resizeHandler);
    root.destroy(true);
    scene.titleSplashActive = false;
    onDismiss();
  };

  scene.input.keyboard?.once("keydown-ENTER", dismiss);
  scene.input.keyboard?.once("keydown-SPACE", dismiss);
  scene.input.once("pointerdown", dismiss);
}
