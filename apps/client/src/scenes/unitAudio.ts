import type Phaser from "phaser";
import type { UnitData } from "../types.js";
import type { GameScene } from "./gameScene.js";

const UNIT_FEEDBACK_VOLUME = 0.14;
const SELECTION_COOLDOWN_MS = 220;
const ORDER_COOLDOWN_MS = 180;
const MAX_ORDER_BURSTS_PER_WINDOW = 3;
const ORDER_BURST_WINDOW_MS = 700;

let lastSelectionAt = 0;
let lastOrderAt = 0;
let orderBurstStartedAt = 0;
let orderBurstCount = 0;

export function playUnitSelectionFeedback(scene: GameScene, unitData: UnitData): void {
  if (!canPlay(lastSelectionAt, SELECTION_COOLDOWN_MS)) return;
  lastSelectionAt = performance.now();
  playUnitTone(scene, unitData, "select");
}

export function playUnitOrderFeedback(scene: GameScene, unitData: UnitData): void {
  const now = performance.now();
  if (!canPlay(lastOrderAt, ORDER_COOLDOWN_MS)) return;
  if (now - orderBurstStartedAt > ORDER_BURST_WINDOW_MS) {
    orderBurstStartedAt = now;
    orderBurstCount = 0;
  }
  if (orderBurstCount >= MAX_ORDER_BURSTS_PER_WINDOW) return;

  orderBurstCount += 1;
  lastOrderAt = now;
  playUnitTone(scene, unitData, "order");
}

function canPlay(lastPlayedAt: number, cooldownMs: number): boolean {
  return performance.now() - lastPlayedAt >= cooldownMs;
}

function playUnitTone(scene: GameScene, unitData: UnitData, intent: "select" | "order"): void {
  const context = getAudioContext(scene);
  if (!context) return;

  // Audio procedural temporal: evita licencias externas y diferencia selección de obedecer orden.
  const baseFrequency = getBaseFrequency(unitData);
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  oscillator.type = intent === "select" ? "triangle" : "square";
  oscillator.frequency.setValueAtTime(baseFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(
    intent === "select" ? baseFrequency * 1.22 : baseFrequency * 0.82,
    now + 0.12,
  );
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(intent === "select" ? 900 : 720, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(UNIT_FEEDBACK_VOLUME, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.18);
}

function getAudioContext(scene: GameScene): AudioContext | undefined {
  const manager = scene.sound as Phaser.Sound.WebAudioSoundManager | Phaser.Sound.HTML5AudioSoundManager;
  if (!("context" in manager)) return undefined;
  const context = manager.context;
  if (context.state === "suspended") {
    void context.resume();
  }
  return context;
}

function getBaseFrequency(unitData: UnitData): number {
  if (unitData.kind !== "aldeano") return 320;

  const cultureOffset = {
    maya: 0,
    mexica: 34,
    tlaxcalteca: 58,
    inca: 82,
  }[unitData.skin?.culture ?? "maya"];
  const genderOffset = unitData.skin?.gender === "femenina" ? 48 : 0;
  return 260 + cultureOffset + genderOffset;
}
