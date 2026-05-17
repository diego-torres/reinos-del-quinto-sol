import Phaser from "phaser";
import {
  RESOURCES,
  type OnlineBuildingState,
  type OnlineGameState,
  type OnlineUnitState,
  type CeremonialCenterCulture,
  type Resource,
} from "@reinos/shared";
import {
  CEREMONIAL_CENTER_TEXTURE_KEYS,
  HOUSE_ASSET_KEY,
  VILLAGER_ASSET_KEY,
} from "../art.js";
import { CARRY_CAPACITY, HOUSE_POPULATION_BONUS, WORLD_HEIGHT, WORLD_LINEAR_SCALE, WORLD_WIDTH } from "../rules.js";
import type {
  BuildingData,
  BuildingKind,
  CeremonialCenterData,
  MythicBeast,
  ResourceNode,
  UnitCargo,
  UnitData,
} from "../types.js";
import { adjustCameraZoom as applyCameraZoom, focusCameraOnWorldPoint as centerCameraOnWorldPoint, maybeFocusCameraOnOwnCenter as focusOwnOnlineCenterOnce, pickWorldPointAwayFrom as randomWorldPointAwayFrom, updateCamera as panCamera } from "./cameraMotion.js";
import { createHud, setupHudCamera, type HudSceneHost } from "./cameraHud.js";
import { updateBeast } from "./combat.js";
import * as construction from "./construction.js";
import { depleteResourceNode as depleteResourceNodeEconomy, registerResourceNode as registerResourceNodeEconomy } from "./economy.js";
import { syncDomState as syncSceneStateToDom } from "./domSync.js";
import { installDebugApi } from "./debugApi.js";
import { bindGameplayInput } from "./inputBindings.js";
import { setupPointerHover } from "./pointerHover.js";
import { redrawExplorationFogIfDirty, revealFromLocalPlayerUnits } from "./explorationFog.js";
import { advanceOfflineConstruction, refreshAllConstructionVisuals } from "./buildingConstruction.js";
import { bootstrapOfflineStartingArea } from "./mapInit.js";
import { preloadMusicAssets, refreshBackgroundMusicState, startBackgroundMusic, type BackgroundMusicHost } from "./music.js";
import { connectToGameServer } from "./server.js";
import {
  createUnit as createUnitModule,
  getUnitCargo as getUnitCargoModule,
  handleRightClick as handleRightClickModule,
  selectUnit as selectUnitModule,
  trainVillager as trainVillagerModule,
  trainWarrior as trainWarriorModule,
  updateUnitCargoLabel as updateUnitCargoLabelModule,
  updateUnitHealthLabel as updateUnitHealthLabelModule,
  updateUnits as updateUnitsModule,
} from "./units.js";
import mexicaCeremonialAsset from "@repo-assets/sprites/centro-ceremonial/mexica.png";
import tlaxcaltecaCeremonialAsset from "@repo-assets/sprites/centro-ceremonial/tlaxcalteca.png";
import incaCeremonialAsset from "@repo-assets/sprites/centro-ceremonial/inca.png";
import mayaCeremonialAsset from "@repo-assets/sprites/centro-ceremonial/maya.png";
import { createVillagerSkin, preloadVillagerSpriteSheets } from "../villagerAssets.js";

/** Escena principal del juego (mapa, unidades, economía y sincronización online). */
export class GameScene extends Phaser.Scene implements HudSceneHost, BackgroundMusicHost {
  selectedUnit?: Phaser.GameObjects.Container;
  selectionRing?: Phaser.GameObjects.Ellipse;
  cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  wasd?: Record<string, Phaser.Input.Keyboard.Key>;
  statusText?: Phaser.GameObjects.Text;
  resourceText?: Phaser.GameObjects.Text;
  carryCapacityText?: Phaser.GameObjects.Text;
  onlineText?: Phaser.GameObjects.Text;
  hudRoot?: Phaser.GameObjects.Container;
  hudCamera?: Phaser.Cameras.Scene2D.Camera;
  buildMode?: BuildingKind;
  targetMarkers = new Map<string, Phaser.GameObjects.Arc>();
  resourceNodes: ResourceNode[] = [];
  buildings: BuildingData[] = [];
  ceremonialCenters: CeremonialCenterData[] = [];
  units: Phaser.GameObjects.Container[] = [];
  mythicBeasts: MythicBeast[] = [];
  /** Centro ceremonial local hasta que el servidor asigne uno al jugador. */
  offlineFallbackCenter?: {
    x: number;
    y: number;
    radius: number;
    culture: CeremonialCenterCulture;
    container: Phaser.GameObjects.Container;
  };
  didInitialCameraFocus = false;
  nextUnitId = 2;
  isTrainingVillager = false;
  isTrainingWarrior = false;
  socket?: WebSocket;
  playerId?: string;
  culturePickerRoot?: HTMLDivElement;
  onlineState?: OnlineGameState;
  onlineMode = false;
  milpaMusic?: Phaser.Sound.BaseSound;
  battleMusic?: Phaser.Sound.BaseSound;
  activeMusicMode: "milpa" | "battle" = "milpa";
  initializedOnlineUnits = false;
  population = 2;
  populationLimit = 5;
  resources: Record<Resource, number> = {
    maiz: 200,
    madera: 200,
    piedra: 200,
    obsidiana: 200,
  };

  constructor() {
    super("game");
  }

  preload(): void {
    this.load.image(HOUSE_ASSET_KEY, "/assets/buildings/house-flat.svg");
    this.load.image(VILLAGER_ASSET_KEY, "/assets/units/villager-flat.svg");
    this.load.image(CEREMONIAL_CENTER_TEXTURE_KEYS.mexica, mexicaCeremonialAsset);
    this.load.image(CEREMONIAL_CENTER_TEXTURE_KEYS.tlaxcalteca, tlaxcaltecaCeremonialAsset);
    this.load.image(CEREMONIAL_CENTER_TEXTURE_KEYS.inca, incaCeremonialAsset);
    this.load.image(CEREMONIAL_CENTER_TEXTURE_KEYS.maya, mayaCeremonialAsset);
    preloadVillagerSpriteSheets(this);
    preloadMusicAssets(this);
  }

  create(): void {
    setupHudCamera(this);

    this.cameras.main.setBackgroundColor("#B96542");
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    bootstrapOfflineStartingArea(this);

    createHud(this);

    installDebugApi(this);
    this.syncDomState();
    connectToGameServer(this);

    bindGameplayInput(this);
    setupPointerHover(this);

    startBackgroundMusic(this);
  }

  update(_time: number, delta: number): void {
    panCamera(this, delta);
    updateUnitsModule(this, delta);
    advanceOfflineConstruction(this, delta);
    refreshAllConstructionVisuals(this);
    revealFromLocalPlayerUnits(this);
    redrawExplorationFogIfDirty(this);
    updateBeast(this, delta);
    refreshBackgroundMusicState(this);
  }

  registerResourceNode(
    id: string,
    resource: Resource,
    label: string,
    x: number,
    y: number,
    radius: number,
    text: Phaser.GameObjects.Text,
    visuals: Phaser.GameObjects.GameObject[],
  ): void {
    registerResourceNodeEconomy(this, id, resource, label, x, y, radius, text, visuals);
  }

  pickWorldPointAwayFrom(ox: number, oy: number, minDist: number, margin: number): { x: number; y: number } {
    return randomWorldPointAwayFrom(ox, oy, minDist, margin);
  }

  createUnit(x: number, y: number, data: UnitData): Phaser.GameObjects.Container {
    return createUnitModule(this, x, y, data);
  }

  focusCameraOnWorldPoint(x: number, y: number): void {
    centerCameraOnWorldPoint(this, x, y);
  }

  maybeFocusCameraOnOwnCenter(): void {
    focusOwnOnlineCenterOnce(this);
  }

  adjustCameraZoom(delta: number): void {
    applyCameraZoom(this, delta);
  }

  handleRightClick(x: number, y: number): void {
    handleRightClickModule(this, x, y);
  }

  placeBuilding(x: number, y: number): void {
    construction.placeBuilding(this, x, y);
  }

  startHousePlacement(): void {
    construction.startHousePlacement(this);
  }

  startTelpochcalliPlacement(): void {
    construction.startTelpochcalliPlacement(this);
  }

  trainVillager(): void {
    trainVillagerModule(this);
  }

  trainWarrior(): void {
    trainWarriorModule(this);
  }

  selectUnit(unit: Phaser.GameObjects.Container): void {
    selectUnitModule(this, unit);
  }

  setStatus(message: string): void {
    this.statusText?.setText(message);
    document.body.dataset.status = message;
  }

  formatResources(): string {
    const resourceValues = RESOURCES.map((resource) => `${resource}: ${this.resources[resource]}`).join("   ");
    return `${resourceValues}   poblacion: ${this.population}/${this.populationLimit}   V aldeano   G guerrero`;
  }

  formatCarryCapacities(): string {
    return `capacidad aldeano: ${RESOURCES.map((resource) => `${resource} ${CARRY_CAPACITY[resource]}`).join("   ")}`;
  }

  updateHudResources(): void {
    this.resourceText?.setText(this.formatResources());
    this.syncDomState();
  }

  syncDomState(): void {
    syncSceneStateToDom(this);
  }

  pulseResourceGain(x: number, y: number, message: string): void {
    const text = this.add.text(x, y, message, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      color: "#f5d76e",
      stroke: "#1d281e",
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 28 * WORLD_LINEAR_SCALE,
      alpha: 0,
      duration: 780,
      onComplete: () => text.destroy(),
    });
  }

  clearLocalUnits(): void {
    this.units.forEach((unit) => unit.destroy());
    this.units = [];
    this.selectedUnit = undefined;
    this.selectionRing?.destroy();
    this.selectionRing = undefined;
  }

  findUnitById(id: string): Phaser.GameObjects.Container | undefined {
    return this.units.find((unit) => {
      const unitData = unit.getData("unit") as UnitData | undefined;
      return unitData?.id === id;
    });
  }

  onlineUnitData(unitState: OnlineUnitState, culture: CeremonialCenterCulture = "maya"): UnitData {
    const mine = unitState.ownerId === this.playerId;
    const color = unitState.kind === "aldeano"
      ? mine ? 0xe5c16f : 0x8fd1b5
      : mine ? 0xb84a3b : 0x4b79c4;
    const skin = unitState.kind === "aldeano"
      ? createVillagerSkin(`${unitState.ownerId}:${unitState.id}`, culture)
      : undefined;

    return {
      id: unitState.id,
      kind: unitState.kind,
      label: unitState.kind === "aldeano" ? "Aldeano" : "Guerrero",
      color,
      speed: unitState.speed,
      ownerId: unitState.ownerId,
      skin,
    };
  }

  onlineBuildingData(buildingState: OnlineBuildingState): BuildingData {
    return {
      id: buildingState.id,
      ownerId: buildingState.ownerId,
      kind: buildingState.kind,
      label: buildingState.kind === "casa" ? "Casa" : "Telpochcalli",
      x: buildingState.x,
      y: buildingState.y,
      populationBonus: buildingState.kind === "casa" ? HOUSE_POPULATION_BONUS : 0,
      constructionWorkRemaining: buildingState.constructionWorkRemaining,
    };
  }

  getUnitCargo(unit: Phaser.GameObjects.Container): UnitCargo {
    return getUnitCargoModule(this, unit);
  }

  updateUnitHealthLabel(unit: Phaser.GameObjects.Container): void {
    updateUnitHealthLabelModule(this, unit);
  }

  updateUnitCargoLabel(unit: Phaser.GameObjects.Container): void {
    updateUnitCargoLabelModule(this, unit);
  }

  depleteResourceNode(node: ResourceNode): void {
    depleteResourceNodeEconomy(this, node);
  }
}
