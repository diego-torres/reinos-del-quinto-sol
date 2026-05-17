import Phaser from "phaser";
import type { OnlineGameState } from "@reinos/shared";
import type { MythicBeast } from "../types.js";
import { AUDIO_BATTLE_LOOP_KEY, AUDIO_MILPA_LOOP_KEY, MUSIC_VOLUME } from "./constants.js";
import ambientMilpaSrc from "@repo-assets/audio/milpa_al_amanecer_loop.wav";
import battleCanteraSrc from "@repo-assets/audio/cantera_y_fuego_battle_loop.wav";

export type BackgroundMusicHost = {
  onlineMode: boolean;
  onlineState?: OnlineGameState;
  mythicBeasts: MythicBeast[];
  units: Phaser.GameObjects.Container[];
  milpaMusic?: Phaser.Sound.BaseSound;
  battleMusic?: Phaser.Sound.BaseSound;
  activeMusicMode: "milpa" | "battle";
};

type MusicScene = Phaser.Scene & BackgroundMusicHost;

export function preloadMusicAssets(scene: Phaser.Scene): void {
  scene.load.audio(AUDIO_MILPA_LOOP_KEY, ambientMilpaSrc);
  scene.load.audio(AUDIO_BATTLE_LOOP_KEY, battleCanteraSrc);
}

export function startBackgroundMusic(scene: MusicScene): void {
  scene.milpaMusic = scene.sound.add(AUDIO_MILPA_LOOP_KEY, { loop: true, volume: MUSIC_VOLUME });
  scene.battleMusic = scene.sound.add(AUDIO_BATTLE_LOOP_KEY, { loop: true, volume: MUSIC_VOLUME });
  ensureMusicLoop(scene.milpaMusic);
  ensureMusicLoop(scene.battleMusic);
  attachMusicLoopRestart(scene, scene.milpaMusic, "milpa");
  attachMusicLoopRestart(scene, scene.battleMusic, "battle");
  scene.milpaMusic.play({ loop: true, volume: MUSIC_VOLUME });
  scene.input.once("pointerdown", () => {
    scene.sound.unlock();
  });
}

export function refreshBackgroundMusicState(scene: MusicScene): void {
  const wantBattle = shouldPlayBattleMusic(scene);
  const next: "milpa" | "battle" = wantBattle ? "battle" : "milpa";
  if (next === scene.activeMusicMode) return;
  scene.activeMusicMode = next;

  if (wantBattle) {
    scene.milpaMusic?.pause();
    playMusicLoop(scene.battleMusic);
  } else {
    scene.battleMusic?.pause();
    playMusicLoop(scene.milpaMusic);
  }
}

function shouldPlayBattleMusic(scene: MusicScene): boolean {
  if (scene.onlineMode && scene.onlineState) {
    const attackingCenter = scene.onlineState.units.some(
      (u) => u.workState === "attacking" && Boolean(u.attackTargetId),
    );
    if (attackingCenter) return true;
  }

  for (const beast of scene.mythicBeasts) {
    if (beast.dead) continue;
    if (!beast.dormant) return true;
  }

  for (const unit of scene.units) {
    const beastTarget = unit.getData("attackTarget") as MythicBeast | undefined;
    if (beastTarget && !beastTarget.dead) return true;
  }

  return false;
}

/** Phaser documenta `setLoop(true)` explícito; el flag en el config no siempre basta para el buffer en bucle. */
function ensureMusicLoop(track: Phaser.Sound.BaseSound | undefined) {
  if (!track) return;
  (track as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setLoop(true);
}

/** Si el motor no enlaza el loop (p. ej. WAV largo), volvemos a lanzar solo mientras el modo siga activo. */
function attachMusicLoopRestart(scene: MusicScene, track: Phaser.Sound.BaseSound, mode: "milpa" | "battle") {
  track.on(Phaser.Sound.Events.COMPLETE, () => {
    if (scene.activeMusicMode !== mode) return;
    ensureMusicLoop(track);
    track.play({ loop: true, volume: MUSIC_VOLUME });
  });
}

function playMusicLoop(track: Phaser.Sound.BaseSound | undefined) {
  if (!track || track.isPlaying) return;
  ensureMusicLoop(track);
  const web = track as Phaser.Sound.WebAudioSound;
  if (web.isPaused) web.resume();
  else web.play({ loop: true, volume: MUSIC_VOLUME });
}
