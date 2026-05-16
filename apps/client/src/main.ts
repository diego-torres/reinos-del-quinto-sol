import Phaser from "phaser";
import {
  GAME_TITLE,
  RESOURCES,
  type OnlineBuildingState,
  type OnlineGameState,
  type OnlineUnitState,
  type Resource,
  type ServerMessage,
} from "@reinos/shared";
import {
  createCamazotz,
  drawCeremonialCenter,
  drawHouse,
  drawResourceClusters,
  drawTelpochcalli,
  drawTerrain,
  labelStyle,
} from "./art.js";
import {
  CARRY_CAPACITY,
  CEREMONIAL_CENTER,
  GATHER_AMOUNT,
  GATHER_INTERVAL_MS,
  HOUSE_POPULATION_BONUS,
  HOUSE_WOOD_COST,
  TELPOCHCALLI_COST,
  TRAINING,
  UNIT_STATS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  getBuildingCost,
} from "./rules.js";
import type {
  BuildingData,
  BuildingKind,
  DepositAfter,
  MythicBeast,
  ResourceNode,
  UnitCargo,
  UnitData,
  UnitKind,
  UnitWorkState,
} from "./types.js";
import "./styles.css";

class DemoScene extends Phaser.Scene {
  private selectedUnit?: Phaser.GameObjects.Container;
  private selectionRing?: Phaser.GameObjects.Ellipse;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;
  private statusText?: Phaser.GameObjects.Text;
  private resourceText?: Phaser.GameObjects.Text;
  private carryCapacityText?: Phaser.GameObjects.Text;
  private onlineText?: Phaser.GameObjects.Text;
  private buildMode?: BuildingKind;
  private targetMarkers = new Map<string, Phaser.GameObjects.Arc>();
  private resourceNodes: ResourceNode[] = [];
  private buildings: BuildingData[] = [];
  private units: Phaser.GameObjects.Container[] = [];
  private camazotz?: MythicBeast;
  private nextUnitId = 2;
  private isTrainingVillager = false;
  private isTrainingWarrior = false;
  private socket?: WebSocket;
  private playerId?: string;
  private onlineState?: OnlineGameState;
  private onlineMode = false;
  private initializedOnlineUnits = false;
  private population = 2;
  private populationLimit = 5;
  private resources: Record<Resource, number> = {
    maiz: 200,
    madera: 200,
    piedra: 200,
    obsidiana: 200,
  };

  constructor() {
    super("demo");
  }

  create() {
    this.cameras.main.setBackgroundColor("#B96542");
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    drawTerrain(this);
    drawResourceClusters(this, this.registerResourceNode.bind(this));
    drawCeremonialCenter(this, CEREMONIAL_CENTER.x, CEREMONIAL_CENTER.y);
    this.camazotz = createCamazotz(this, 1010, 780);

    const aldeano = this.createUnit(780, 620, {
      id: "aldeano-1",
      kind: "aldeano",
      label: "Aldeano",
      color: 0xe5c16f,
      speed: 170,
    });

    this.createUnit(880, 690, {
      id: "guerrero-1",
      kind: "guerrero",
      label: "Guerrero",
      color: 0xb84a3b,
      speed: 190,
    });

    this.createHud();
    this.selectUnit(aldeano);
    this.installDebugApi();
    this.syncDomState();
    this.connectToServer();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && this.buildMode) {
        this.placeBuilding(pointer.worldX, pointer.worldY);
        return;
      }

      if (pointer.rightButtonDown()) {
        this.handleRightClick(pointer.worldX, pointer.worldY);
      }
    });

    this.input.mouse?.disableContextMenu();
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard?.on("keydown-H", () => this.startHousePlacement());
    this.input.keyboard?.on("keydown-T", () => this.startTelpochcalliPlacement());
    this.input.keyboard?.on("keydown-V", () => this.trainVillager());
    this.input.keyboard?.on("keydown-G", () => this.trainWarrior());
  }

  update(_time: number, delta: number) {
    this.updateCamera(delta);
    this.updateUnits(delta);
    this.updateBeast(delta);
  }

  private registerResourceNode(
    resource: Resource,
    label: string,
    x: number,
    y: number,
    radius: number,
    text: Phaser.GameObjects.Text,
    visuals: Phaser.GameObjects.GameObject[],
  ) {
    const node: ResourceNode = {
      id: `${resource}-${this.resourceNodes.length + 1}`,
      resource,
      label,
      x,
      y,
      radius,
      amount: 500,
      text,
      visuals,
      depleted: false,
    };

    this.resourceNodes.push(node);
    this.updateResourceNodeLabel(node);
  }

  private createUnit(x: number, y: number, data: UnitData) {
    const unit = this.add.container(x, y);
    unit.setData("unit", data);
    unit.setData("health", UNIT_STATS[data.kind].maxHealth);
    unit.setData("attackElapsed", 0);
    unit.setData("attackTarget", undefined);
    unit.setData("target", undefined);
    unit.setData("gatherTarget", undefined);
    unit.setData("gatherElapsed", 0);
    unit.setData("cargo", { amount: 0 } satisfies UnitCargo);
    unit.setData("workState", "idle" satisfies UnitWorkState);
    unit.setSize(52, 60);
    unit.setInteractive(new Phaser.Geom.Circle(0, 0, 34), Phaser.Geom.Circle.Contains);

    const shadow = this.add.ellipse(0, 28, 48, 18, 0x000000, 0.22);
    const body = this.add.ellipse(0, 4, 34, 44, data.color);
    const head = this.add.circle(0, -24, 13, 0xc98957);
    const accent = data.kind === "guerrero"
      ? this.add.rectangle(20, -2, 7, 56, 0x2b201a).setRotation(-0.45)
      : this.add.rectangle(-20, 2, 8, 42, 0x6b4328).setRotation(0.35);
    const marker = data.kind === "guerrero"
      ? this.add.triangle(0, -44, -12, 10, 0, -12, 12, 10, 0x223d63)
      : this.add.arc(0, -39, 13, 210, 330, false, 0xf0c94a);
    const ownerLabel = data.ownerId && data.ownerId !== this.playerId ? ` ${data.ownerId.replace("player-", "P")}` : "";
    const label = this.add.text(
      0,
      50,
      `${data.label}${ownerLabel} ${UNIT_STATS[data.kind].maxHealth}/${UNIT_STATS[data.kind].maxHealth}`,
      labelStyle(13),
    ).setOrigin(0.5);
    const cargoLabel = this.add.text(0, 68, "", labelStyle(12)).setOrigin(0.5);

    unit.add([shadow, body, head, accent, marker, label, cargoLabel]);
    unit.setData("healthLabel", label);
    unit.setData("cargoLabel", cargoLabel);
    this.updateUnitCargoLabel(unit);

    unit.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.selectUnit(unit);
        pointer.event.stopPropagation();
      }
    });

    this.units.push(unit);
    return unit;
  }

  private selectUnit(unit: Phaser.GameObjects.Container) {
    this.selectedUnit = unit;
    this.selectionRing?.destroy();
    this.selectionRing = this.add.ellipse(unit.x, unit.y + 8, 66, 40);
    this.selectionRing.setStrokeStyle(3, 0xf5d76e, 0.95);
    this.selectionRing.setDepth(5);
    unit.setDepth(10);

    const unitData = unit.getData("unit") as UnitData;
    const hint = unitData.kind === "aldeano"
      ? "Clic derecho en recurso para recolectar. H casa, T telpochcalli."
      : "Clic derecho para mover.";
    this.setStatus(`${unitData.label} seleccionado. ${hint}`);
  }

  private handleRightClick(x: number, y: number) {
    if (!this.selectedUnit) return;

    const unitData = this.selectedUnit.getData("unit") as UnitData;
    const resourceNode = this.findResourceNodeAt(x, y);
    const beast = this.findBeastAt(x, y);

    if (beast) {
      this.sendSelectedUnitToAttack(unitData, beast);
      return;
    }

    if (resourceNode) {
      if (unitData.kind !== "aldeano") {
        this.setStatus(`${unitData.label} no recolecta recursos.`);
        return;
      }

      if (this.onlineMode && this.sendOnlineGatherCommand(unitData, resourceNode)) {
        return;
      }

      this.sendUnitToGather(this.selectedUnit, resourceNode);
      return;
    }

    if (this.isPointInCeremonialCenter(x, y)) {
      if (this.onlineMode && this.sendOnlineDepositCommand(unitData)) {
        return;
      }

      this.sendSelectedUnitToManualDeposit(unitData);
      return;
    }

    if (this.onlineMode && this.sendOnlineMoveCommand(unitData, x, y)) {
      return;
    }

    this.selectedUnit.setData("gatherTarget", undefined);
    this.selectedUnit.setData("gatherElapsed", 0);
    this.selectedUnit.setData("attackTarget", undefined);
    this.selectedUnit.setData("workState", "moving" satisfies UnitWorkState);
    this.moveSelectedUnit(x, y);
  }

  private moveSelectedUnit(x: number, y: number) {
    if (!this.selectedUnit) return;

    const unitData = this.selectedUnit.getData("unit") as UnitData;
    this.selectedUnit.setData("target", new Phaser.Math.Vector2(x, y));
    this.selectedUnit.setData("workState", "moving" satisfies UnitWorkState);
    this.selectedUnit.setData("attackTarget", undefined);
    this.setStatus(`${unitData.label} avanzando a ${Math.round(x)}, ${Math.round(y)}.`);

    this.targetMarkers.get(unitData.id)?.destroy();
    const marker = this.add.circle(x, y, 10, 0xf5d76e, 0.85).setStrokeStyle(2, 0x2b201a);
    this.targetMarkers.set(unitData.id, marker);
    this.tweens.add({
      targets: marker,
      alpha: 0.15,
      scale: 1.8,
      duration: 550,
      yoyo: true,
      repeat: 1,
    });
  }

  private sendUnitToGather(unit: Phaser.GameObjects.Container, resourceNode: ResourceNode) {
    const unitData = unit.getData("unit") as UnitData;
    const approach = this.getGatherApproachPoint(unit, resourceNode);

    unit.setData("gatherTarget", resourceNode);
    unit.setData("gatherElapsed", 0);
    unit.setData("target", approach);
    unit.setData("workState", "moving" satisfies UnitWorkState);
    this.setStatus(`${unitData.label} va hacia ${resourceNode.label.toLowerCase()} para recolectar.`);

    this.targetMarkers.get(unitData.id)?.destroy();
    const marker = this.add.circle(resourceNode.x, resourceNode.y, 12, 0x89d26a, 0.85).setStrokeStyle(2, 0x1d281e);
    this.targetMarkers.set(unitData.id, marker);
    this.tweens.add({
      targets: marker,
      alpha: 0.2,
      scale: 2,
      duration: 650,
      yoyo: true,
      repeat: 1,
    });
  }

  private updateUnits(delta: number) {
    const seconds = delta / 1000;

    this.children.each((child) => {
      if (!(child instanceof Phaser.GameObjects.Container)) return true;

      const unitData = child.getData("unit") as UnitData | undefined;
      const target = child.getData("target") as Phaser.Math.Vector2 | undefined;
      const gatherTarget = child.getData("gatherTarget") as ResourceNode | undefined;
      const workState = child.getData("workState") as UnitWorkState | undefined;
      const attackTarget = child.getData("attackTarget") as MythicBeast | undefined;
      if (!unitData) return true;

      if (attackTarget && !attackTarget.dead) {
        this.updateUnitAttack(child, unitData, attackTarget, delta);
        return true;
      }

      if (!target && gatherTarget) {
        if (workState === "returning") {
          this.updateDeposit(child, unitData, gatherTarget);
        } else {
          this.updateGathering(child, unitData, gatherTarget, delta);
        }
        return true;
      }

      if (!target && workState === "returning") {
        this.updateManualDeposit(child, unitData);
        return true;
      }

      if (!target) return true;

      const distance = Phaser.Math.Distance.Between(child.x, child.y, target.x, target.y);
      if (distance < 4) {
        child.setData("target", undefined);
        this.targetMarkers.get(unitData.id)?.destroy();
        this.targetMarkers.delete(unitData.id);
        if (gatherTarget) {
          const nextState = workState === "returning" ? "returning" : "gathering";
          child.setData("workState", nextState satisfies UnitWorkState);
          this.setStatus(
            nextState === "returning"
              ? `${unitData.label} depositando carga en el centro ceremonial.`
              : `${unitData.label} recolectando ${gatherTarget.label.toLowerCase()}.`,
          );
        } else {
          if (workState === "returning") {
            this.setStatus(`${unitData.label} depositando carga en el centro ceremonial.`);
          } else {
            child.setData("workState", "idle" satisfies UnitWorkState);
          }
        }
        return true;
      }

      const step = Math.min(distance, unitData.speed * seconds);
      const angle = Phaser.Math.Angle.Between(child.x, child.y, target.x, target.y);
      child.x += Math.cos(angle) * step;
      child.y += Math.sin(angle) * step;

      if (child === this.selectedUnit && this.selectionRing) {
        this.selectionRing.setPosition(child.x, child.y + 8);
      }

      return true;
    });
    this.syncDomState();
  }

  private createHud() {
    const panel = this.add.rectangle(18, 18, 780, 152, 0x17261d, 0.86).setOrigin(0);
    panel.setScrollFactor(0);
    panel.setStrokeStyle(2, 0xd7bc73, 0.55);

    this.add.text(36, 30, GAME_TITLE, {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: "#f5e5b0",
    }).setScrollFactor(0);

    this.resourceText = this.add.text(36, 66, this.formatResources(), {
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      color: "#d9e4c5",
    }).setScrollFactor(0);

    this.carryCapacityText = this.add.text(36, 94, this.formatCarryCapacities(), {
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      color: "#c8d6b0",
    }).setScrollFactor(0);

    this.onlineText = this.add.text(520, 30, "online: conectando...", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      color: "#c8d6b0",
    }).setScrollFactor(0);

    this.statusText = this.add.text(36, 122, "Selecciona una unidad.", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      color: "#ffffff",
    }).setScrollFactor(0);
  }

  private setStatus(message: string) {
    this.statusText?.setText(message);
    document.body.dataset.status = message;
  }

  private connectToServer() {
    const socket = new WebSocket("ws://127.0.0.1:8787");
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.onlineText?.setText("online: conectado");
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data as string) as ServerMessage;
      if (message.type === "welcome") {
        this.playerId = message.playerId;
        this.onlineMode = true;
        this.onlineText?.setText(`online: ${this.playerId}`);
        this.applyOnlineState(message.state);
        return;
      }

      if (message.type === "state") {
        this.applyOnlineState(message.state);
      }
    });

    socket.addEventListener("close", () => {
      this.onlineMode = false;
      this.onlineText?.setText("online: desconectado");
    });

    socket.addEventListener("error", () => {
      this.onlineMode = false;
      this.onlineText?.setText("online: servidor no disponible");
    });
  }

  private applyOnlineState(state: OnlineGameState) {
    this.onlineState = state;

    if (!this.initializedOnlineUnits) {
      this.clearLocalUnits();
      this.initializedOnlineUnits = true;
    }

    state.units.forEach((unitState) => {
      let unit = this.findUnitById(unitState.id);
      if (!unit) {
        unit = this.createUnit(unitState.x, unitState.y, this.onlineUnitData(unitState));
      }

      unit.setPosition(unitState.x, unitState.y);
      unit.setData("health", unitState.health);
      unit.setData("target", undefined);
      unit.setData("cargo", unitState.cargo);
      unit.setData("workState", unitState.workState);
      unit.setData("gatherTarget", this.resourceNodes.find((node) => node.id === unitState.gatherTargetId));
      this.updateUnitHealthLabel(unit);
      this.updateUnitCargoLabel(unit);
    });

    const activeIds = new Set(state.units.map((unit) => unit.id));
    this.units
      .filter((unit) => {
        const unitData = unit.getData("unit") as UnitData;
        return unitData.ownerId && !activeIds.has(unitData.id);
      })
      .forEach((unit) => {
        this.units = this.units.filter((candidate) => candidate !== unit);
        unit.destroy();
      });

    if (!this.selectedUnit && this.playerId) {
      const ownUnit = this.units.find((unit) => {
        const unitData = unit.getData("unit") as UnitData;
        return unitData.ownerId === this.playerId;
      });
      if (ownUnit) this.selectUnit(ownUnit);
    }

    if (this.selectedUnit && this.selectionRing) {
      this.selectionRing.setPosition(this.selectedUnit.x, this.selectedUnit.y + 8);
    }

    this.applyOnlineResources(state);
    this.applyOnlineBuildings(state);
    this.onlineText?.setText(`online: ${this.playerId ?? "conectado"} | jugadores ${state.players.length}`);
    this.syncDomState();
  }

  private applyOnlineResources(state: OnlineGameState) {
    const player = state.players.find((candidate) => candidate.id === this.playerId);
    if (player) {
      this.resources = { ...player.resources };
      this.updateHudResources();
    }

    state.resourceNodes.forEach((serverNode) => {
      const node = this.resourceNodes.find((candidate) => candidate.id === serverNode.id);
      if (!node) return;

      node.amount = serverNode.amount;
      if (serverNode.depleted) {
        this.depleteResourceNode(node);
      } else {
        node.depleted = false;
        node.text.setText(`${node.label} (${node.amount})`);
      }
    });
  }

  private applyOnlineBuildings(state: OnlineGameState) {
    state.buildings.forEach((buildingState) => {
      let building = this.buildings.find((candidate) => candidate.id === buildingState.id);
      if (!building) {
        building = this.onlineBuildingData(buildingState);
        building.container = building.kind === "casa"
          ? drawHouse(this, building.x, building.y)
          : drawTelpochcalli(this, building.x, building.y);
        this.buildings.push(building);
      }
    });

    const activeIds = new Set(state.buildings.map((building) => building.id));
    this.buildings
      .filter((building) => building.ownerId && !activeIds.has(building.id))
      .forEach((building) => {
        building.container?.destroy();
        this.buildings = this.buildings.filter((candidate) => candidate !== building);
      });

    this.populationLimit = 5 + this.buildings
      .filter((building) => building.ownerId === this.playerId && building.kind === "casa")
      .reduce((total, building) => total + building.populationBonus, 0);
    this.updateHudResources();
  }

  private clearLocalUnits() {
    this.units.forEach((unit) => unit.destroy());
    this.units = [];
    this.selectedUnit = undefined;
    this.selectionRing?.destroy();
    this.selectionRing = undefined;
  }

  private onlineUnitData(unitState: OnlineUnitState): UnitData {
    const mine = unitState.ownerId === this.playerId;
    const color = unitState.kind === "aldeano"
      ? mine ? 0xe5c16f : 0x8fd1b5
      : mine ? 0xb84a3b : 0x4b79c4;

    return {
      id: unitState.id,
      kind: unitState.kind,
      label: unitState.kind === "aldeano" ? "Aldeano" : "Guerrero",
      color,
      speed: unitState.speed,
      ownerId: unitState.ownerId,
    };
  }

  private onlineBuildingData(buildingState: OnlineBuildingState): BuildingData {
    return {
      id: buildingState.id,
      ownerId: buildingState.ownerId,
      kind: buildingState.kind,
      label: buildingState.kind === "casa" ? "Casa" : "Telpochcalli",
      x: buildingState.x,
      y: buildingState.y,
      populationBonus: buildingState.kind === "casa" ? HOUSE_POPULATION_BONUS : 0,
    };
  }

  private findUnitById(id: string) {
    return this.units.find((unit) => {
      const unitData = unit.getData("unit") as UnitData | undefined;
      return unitData?.id === id;
    });
  }

  private sendOnlineMoveCommand(unitData: UnitData, x: number, y: number) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;

    if (unitData.ownerId !== this.playerId) {
      this.setStatus("Esa unidad pertenece a otro jugador.");
      return true;
    }

    this.socket.send(JSON.stringify({
      type: "move-unit",
      unitId: unitData.id,
      target: { x, y },
    }));
    this.setStatus(`${unitData.label} recibe orden online a ${Math.round(x)}, ${Math.round(y)}.`);
    return true;
  }

  private sendOnlineGatherCommand(unitData: UnitData, resourceNode: ResourceNode) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;

    if (unitData.ownerId !== this.playerId) {
      this.setStatus("Esa unidad pertenece a otro jugador.");
      return true;
    }

    this.socket.send(JSON.stringify({
      type: "gather-resource",
      unitId: unitData.id,
      resourceNodeId: resourceNode.id,
    }));
    this.setStatus(`${unitData.label} recibe orden online de recolectar ${resourceNode.label.toLowerCase()}.`);
    return true;
  }

  private sendOnlineDepositCommand(unitData: UnitData) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;

    if (unitData.ownerId !== this.playerId) {
      this.setStatus("Esa unidad pertenece a otro jugador.");
      return true;
    }

    const cargo = this.getUnitCargo(this.selectedUnit!);
    if (!cargo.resource || cargo.amount <= 0) {
      this.setStatus(`${unitData.label} no trae recursos para depositar.`);
      return true;
    }

    this.socket.send(JSON.stringify({
      type: "deposit-resources",
      unitId: unitData.id,
    }));
    this.setStatus(`${unitData.label} recibe orden online de depositar.`);
    return true;
  }

  private startHousePlacement() {
    if (!this.selectedUnit) return;

    const unitData = this.selectedUnit.getData("unit") as UnitData;
    if (unitData.kind !== "aldeano") {
      this.setStatus("Selecciona un aldeano para construir casas.");
      return;
    }

    if (this.resources.madera < HOUSE_WOOD_COST) {
      this.setStatus(`Madera insuficiente para casa. Necesitas ${HOUSE_WOOD_COST}.`);
      return;
    }

    this.buildMode = "casa";
    this.selectedUnit.setData("gatherTarget", undefined);
    this.selectedUnit.setData("gatherElapsed", 0);
    this.selectedUnit.setData("target", undefined);
    this.selectedUnit.setData("workState", "idle" satisfies UnitWorkState);
    this.setStatus(`Modo construccion: casa cuesta ${HOUSE_WOOD_COST} madera. Clic izquierdo para colocar.`);
  }

  private startTelpochcalliPlacement() {
    if (!this.selectedUnit) return;

    const unitData = this.selectedUnit.getData("unit") as UnitData;
    if (unitData.kind !== "aldeano") {
      this.setStatus("Selecciona un aldeano para construir un telpochcalli.");
      return;
    }

    if (!this.canAfford(TELPOCHCALLI_COST)) {
      this.setStatus(`Recursos insuficientes para telpochcalli. Necesitas ${this.formatCost(TELPOCHCALLI_COST)}.`);
      return;
    }

    this.buildMode = "telpochcalli";
    this.selectedUnit.setData("gatherTarget", undefined);
    this.selectedUnit.setData("gatherElapsed", 0);
    this.selectedUnit.setData("target", undefined);
    this.selectedUnit.setData("workState", "idle" satisfies UnitWorkState);
    this.setStatus(`Modo construccion: telpochcalli cuesta ${this.formatCost(TELPOCHCALLI_COST)}. Clic izquierdo para colocar.`);
  }

  private placeBuilding(x: number, y: number) {
    if (!this.buildMode) return;

    if (!this.selectedUnit) {
      this.cancelBuildMode("Selecciona un aldeano para construir.");
      return;
    }

    const unitData = this.selectedUnit.getData("unit") as UnitData;
    if (unitData.kind !== "aldeano") {
      this.cancelBuildMode("Solo los aldeanos pueden construir casas.");
      return;
    }

    const cost = getBuildingCost(this.buildMode);
    if (!this.canAfford(cost)) {
      this.cancelBuildMode(`Recursos insuficientes. Necesitas ${this.formatCost(cost)}.`);
      return;
    }

    if (!this.canPlaceBuildingAt(x, y, this.buildMode)) {
      this.setStatus("No puedes colocar ese edificio tan cerca de otra estructura o recurso.");
      return;
    }

    if (this.onlineMode && this.sendOnlineBuildCommand(unitData, this.buildMode, x, y)) {
      const label = this.buildMode === "casa" ? "Casa" : "Telpochcalli";
      this.cancelBuildMode(`${label} solicitada al servidor.`);
      return;
    }

    const building: BuildingData = {
      id: `${this.buildMode}-${this.buildings.length + 1}`,
      kind: this.buildMode,
      label: this.buildMode === "casa" ? "Casa" : "Telpochcalli",
      x,
      y,
      populationBonus: this.buildMode === "casa" ? HOUSE_POPULATION_BONUS : 0,
    };

    this.spendResources(cost);
    this.populationLimit += building.populationBonus;
    building.container = building.kind === "casa"
      ? drawHouse(this, x, y)
      : drawTelpochcalli(this, x, y);
    this.buildings.push(building);
    this.updateHudResources();
    const extra = building.kind === "casa"
      ? ` Limite de poblacion: ${this.population}/${this.populationLimit}.`
      : " Presiona G para entrenar guerreros.";
    this.cancelBuildMode(`${building.label} construido.${extra}`);
  }

  private sendOnlineBuildCommand(unitData: UnitData, kind: BuildingKind, x: number, y: number) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;

    if (unitData.ownerId !== this.playerId) {
      this.setStatus("Esa unidad pertenece a otro jugador.");
      return true;
    }

    this.socket.send(JSON.stringify({
      type: "build-structure",
      unitId: unitData.id,
      kind,
      x,
      y,
    }));
    this.setStatus(`${kind === "casa" ? "Casa" : "Telpochcalli"} enviada al servidor.`);
    return true;
  }

  private trainVillager() {
    if (this.isTrainingVillager) {
      this.setStatus("El centro ceremonial ya esta entrenando un aldeano.");
      return;
    }

    if (!this.canTrain("aldeano")) return;

    this.isTrainingVillager = true;
    this.spendResources(TRAINING.aldeano.cost);
    this.population += TRAINING.aldeano.population;
    this.updateHudResources();
    this.setStatus(`Entrenando aldeano (${TRAINING.aldeano.durationMs / 1000}s).`);

    this.time.delayedCall(TRAINING.aldeano.durationMs, () => {
      const spawn = this.getSpawnPointNear(CEREMONIAL_CENTER.x, CEREMONIAL_CENTER.y, 230);
      const unit = this.createUnit(spawn.x, spawn.y, {
        id: `aldeano-${this.nextUnitId++}`,
        kind: "aldeano",
        label: "Aldeano",
        color: 0xe5c16f,
        speed: 170,
      });
      this.isTrainingVillager = false;
      this.selectUnit(unit);
      this.setStatus("Aldeano entrenado en el centro ceremonial.");
      this.updateHudResources();
    });
  }

  private trainWarrior() {
    if (this.isTrainingWarrior) {
      this.setStatus("El telpochcalli ya esta entrenando un guerrero.");
      return;
    }

    const telpochcalli = this.buildings.find((building) => building.kind === "telpochcalli");
    if (!telpochcalli) {
      this.setStatus("Construye un telpochcalli antes de entrenar guerreros.");
      return;
    }

    if (!this.canTrain("guerrero")) return;

    this.isTrainingWarrior = true;
    this.spendResources(TRAINING.guerrero.cost);
    this.population += TRAINING.guerrero.population;
    this.updateHudResources();
    this.setStatus(`Entrenando guerrero (${TRAINING.guerrero.durationMs / 1000}s).`);

    this.time.delayedCall(TRAINING.guerrero.durationMs, () => {
      const spawn = this.getSpawnPointNear(telpochcalli.x, telpochcalli.y, 150);
      const unit = this.createUnit(spawn.x, spawn.y, {
        id: `guerrero-${this.nextUnitId++}`,
        kind: "guerrero",
        label: "Guerrero",
        color: 0xb84a3b,
        speed: 190,
      });
      this.isTrainingWarrior = false;
      this.selectUnit(unit);
      this.setStatus("Guerrero entrenado en el telpochcalli.");
      this.updateHudResources();
    });
  }

  private canTrain(kind: UnitKind) {
    const training = TRAINING[kind];
    if (this.population + training.population > this.populationLimit) {
      this.setStatus(`Limite de poblacion alcanzado: ${this.population}/${this.populationLimit}. Construye casas.`);
      return false;
    }

    if (!this.canAfford(training.cost)) {
      this.setStatus(`Recursos insuficientes para ${training.label.toLowerCase()}. Necesitas ${this.formatCost(training.cost)}.`);
      return false;
    }

    return true;
  }

  private getSpawnPointNear(x: number, y: number, distance: number) {
    const angle = Phaser.Math.DegToRad(35 + this.units.length * 37);
    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(x + Math.cos(angle) * distance, 80, WORLD_WIDTH - 80),
      Phaser.Math.Clamp(y + Math.sin(angle) * distance, 80, WORLD_HEIGHT - 80),
    );
  }

  private sendSelectedUnitToAttack(unitData: UnitData, beast: MythicBeast) {
    if (!this.selectedUnit || beast.dead) return;

    if (unitData.kind !== "guerrero") {
      const warrior = this.units.find((unit) => {
        const candidate = unit.getData("unit") as UnitData | undefined;
        return candidate?.kind === "guerrero";
      });

      if (!warrior) {
        this.setStatus("Necesitas un guerrero para atacar a Camazotz.");
        return;
      }

      this.selectUnit(warrior);
    }

    const attacker = this.selectedUnit;
    attacker.setData("gatherTarget", undefined);
    attacker.setData("gatherElapsed", 0);
    attacker.setData("attackTarget", beast);
    attacker.setData("workState", "moving" satisfies UnitWorkState);
    beast.dormant = false;
    beast.targetUnit = attacker;
    this.updateBeastLabel(beast);
    this.setStatus("Camazotz ha despertado. El guerrero ataca.");
  }

  private updateUnitAttack(unit: Phaser.GameObjects.Container, unitData: UnitData, beast: MythicBeast, delta: number) {
    const stats = UNIT_STATS[unitData.kind];
    const distance = Phaser.Math.Distance.Between(unit.x, unit.y, beast.x, beast.y);

    if (distance > stats.range) {
      unit.setData("target", this.getApproachPoint(unit.x, unit.y, beast.x, beast.y, stats.range - 6));
      this.moveUnitTowardTarget(unit, unitData, delta);
      return;
    }

    unit.setData("target", undefined);
    const elapsed = (unit.getData("attackElapsed") as number) + delta;
    if (elapsed < stats.cooldownMs) {
      unit.setData("attackElapsed", elapsed);
      return;
    }

    beast.health = Math.max(0, beast.health - stats.attack);
    unit.setData("attackElapsed", 0);
    this.pulseResourceGain(beast.x, beast.y - 72, `-${stats.attack}`);
    this.updateBeastLabel(beast);

    if (beast.health <= 0) {
      this.killBeast(beast);
    }
  }

  private updateBeast(delta: number) {
    const beast = this.camazotz;
    if (!beast || beast.dead || beast.dormant) return;

    const target = this.findBeastTarget(beast);
    if (!target) {
      beast.targetUnit = undefined;
      return;
    }

    beast.targetUnit = target;
    const distance = Phaser.Math.Distance.Between(beast.x, beast.y, target.x, target.y);
    if (distance > beast.range) {
      const point = this.getApproachPoint(beast.x, beast.y, target.x, target.y, beast.range - 8);
      const step = Math.min(distance, beast.speed * (delta / 1000));
      const angle = Phaser.Math.Angle.Between(beast.x, beast.y, point.x, point.y);
      beast.x += Math.cos(angle) * step;
      beast.y += Math.sin(angle) * step;
      beast.container.setPosition(beast.x, beast.y);
      return;
    }

    beast.attackElapsed += delta;
    if (beast.attackElapsed < beast.cooldownMs) return;

    beast.attackElapsed = 0;
    this.damageUnit(target, beast.attack);
  }

  private findBeastTarget(beast: MythicBeast) {
    if (beast.targetUnit && this.units.includes(beast.targetUnit)) return beast.targetUnit;

    return this.units.find((unit) => {
      const unitData = unit.getData("unit") as UnitData | undefined;
      if (!unitData || unitData.kind !== "guerrero") return false;
      return Phaser.Math.Distance.Between(unit.x, unit.y, beast.x, beast.y) < 380;
    });
  }

  private damageUnit(unit: Phaser.GameObjects.Container, damage: number) {
    const unitData = unit.getData("unit") as UnitData;
    const health = Math.max(0, (unit.getData("health") as number) - damage);
    unit.setData("health", health);
    this.updateUnitHealthLabel(unit);
    this.pulseResourceGain(unit.x, unit.y - 44, `-${damage}`);

    if (health > 0) return;

    this.killUnit(unit, unitData);
  }

  private killUnit(unit: Phaser.GameObjects.Container, unitData: UnitData) {
    this.units = this.units.filter((candidate) => candidate !== unit);
    this.population = Math.max(0, this.population - TRAINING[unitData.kind].population);
    if (this.selectedUnit === unit) {
      this.selectedUnit = undefined;
      this.selectionRing?.destroy();
      this.selectionRing = undefined;
    }
    unit.destroy();
    this.setStatus(`${unitData.label} ha caido en combate.`);
    this.updateHudResources();
  }

  private killBeast(beast: MythicBeast) {
    beast.dead = true;
    beast.container.destroy();
    this.units.forEach((unit) => {
      if (unit.getData("attackTarget") === beast) {
        unit.setData("attackTarget", undefined);
        unit.setData("workState", "idle" satisfies UnitWorkState);
      }
    });
    RESOURCES.forEach((resource) => {
      this.resources[resource] += beast.reward[resource] ?? 0;
    });
    this.setStatus(`Camazotz fue derrotado. Botin: ${this.formatCost(beast.reward)}.`);
    this.updateHudResources();
  }

  private findBeastAt(x: number, y: number) {
    const beast = this.camazotz;
    if (!beast || beast.dead) return undefined;

    return Phaser.Math.Distance.Between(x, y, beast.x, beast.y) <= 100 ? beast : undefined;
  }

  private getApproachPoint(fromX: number, fromY: number, toX: number, toY: number, range: number) {
    const angle = Phaser.Math.Angle.Between(toX, toY, fromX, fromY);
    return new Phaser.Math.Vector2(
      toX + Math.cos(angle) * range,
      toY + Math.sin(angle) * range,
    );
  }

  private moveUnitTowardTarget(unit: Phaser.GameObjects.Container, unitData: UnitData, delta: number) {
    const target = unit.getData("target") as Phaser.Math.Vector2 | undefined;
    if (!target) return;

    const distance = Phaser.Math.Distance.Between(unit.x, unit.y, target.x, target.y);
    if (distance < 4) {
      unit.setData("target", undefined);
      return;
    }

    const step = Math.min(distance, unitData.speed * (delta / 1000));
    const angle = Phaser.Math.Angle.Between(unit.x, unit.y, target.x, target.y);
    unit.x += Math.cos(angle) * step;
    unit.y += Math.sin(angle) * step;

    if (unit === this.selectedUnit && this.selectionRing) {
      this.selectionRing.setPosition(unit.x, unit.y + 8);
    }
  }

  private updateUnitHealthLabel(unit: Phaser.GameObjects.Container) {
    const unitData = unit.getData("unit") as UnitData;
    const healthLabel = unit.getData("healthLabel") as Phaser.GameObjects.Text | undefined;
    if (!healthLabel) return;

    healthLabel.setText(`${unitData.label} ${unit.getData("health")}/${UNIT_STATS[unitData.kind].maxHealth}`);
  }

  private updateBeastLabel(beast: MythicBeast) {
    const state = beast.dormant ? "dormido" : "despierto";
    beast.healthText.setText(`${beast.name} ${state} ${beast.health}/${beast.maxHealth}`);
  }

  private cancelBuildMode(message: string) {
    this.buildMode = undefined;
    this.setStatus(message);
  }

  private canPlaceBuildingAt(x: number, y: number, kind: BuildingKind) {
    if (x < 80 || y < 80 || x > WORLD_WIDTH - 80 || y > WORLD_HEIGHT - 80) return false;

    const buildingRadius = kind === "casa" ? 112 : 146;
    const nearResource = this.resourceNodes.some((node) => {
      if (node.depleted) return false;
      return Phaser.Math.Distance.Between(x, y, node.x, node.y) < node.radius + (kind === "casa" ? 54 : 82);
    });
    if (nearResource) return false;

    return !this.buildings.some((building) => {
      return Phaser.Math.Distance.Between(x, y, building.x, building.y) < buildingRadius;
    });
  }

  private canAfford(cost: Partial<Record<Resource, number>>) {
    return RESOURCES.every((resource) => this.resources[resource] >= (cost[resource] ?? 0));
  }

  private spendResources(cost: Partial<Record<Resource, number>>) {
    RESOURCES.forEach((resource) => {
      this.resources[resource] -= cost[resource] ?? 0;
    });
  }

  private formatCost(cost: Partial<Record<Resource, number>>) {
    return RESOURCES
      .filter((resource) => (cost[resource] ?? 0) > 0)
      .map((resource) => `${cost[resource]} ${resource}`)
      .join(", ");
  }

  private findResourceNodeAt(x: number, y: number) {
    return this.resourceNodes.find((node) => {
      if (node.depleted || node.amount <= 0) return false;
      const distance = Phaser.Math.Distance.Between(x, y, node.x, node.y);
      return distance <= node.radius;
    });
  }

  private getGatherApproachPoint(unit: Phaser.GameObjects.Container, node: ResourceNode) {
    const angle = Phaser.Math.Angle.Between(node.x, node.y, unit.x, unit.y);
    const distance = node.radius + 26;
    return new Phaser.Math.Vector2(
      node.x + Math.cos(angle) * distance,
      node.y + Math.sin(angle) * distance,
    );
  }

  private updateGathering(
    unit: Phaser.GameObjects.Container,
    unitData: UnitData,
    node: ResourceNode,
    delta: number,
  ) {
    if (node.amount <= 0) {
      unit.setData("gatherTarget", undefined);
      unit.setData("gatherElapsed", 0);
      this.setStatus(`${node.label} agotado. ${unitData.label} espera nuevas ordenes.`);
      return;
    }

    const distance = Phaser.Math.Distance.Between(unit.x, unit.y, node.x, node.y);
    if (distance > node.radius + 42) {
      unit.setData("target", this.getGatherApproachPoint(unit, node));
      unit.setData("workState", "moving" satisfies UnitWorkState);
      return;
    }

    const elapsed = (unit.getData("gatherElapsed") as number) + delta;
    if (elapsed < GATHER_INTERVAL_MS) {
      unit.setData("gatherElapsed", elapsed);
      return;
    }

    const cargo = this.getUnitCargo(unit);
    if (cargo.resource && cargo.resource !== node.resource && cargo.amount > 0) {
      this.sendUnitToDeposit(unit, node);
      return;
    }

    const capacity = CARRY_CAPACITY[node.resource];
    const remainingCapacity = capacity - cargo.amount;
    if (remainingCapacity <= 0) {
      this.sendUnitToDeposit(unit, node);
      return;
    }

    const gathered = Math.min(GATHER_AMOUNT, node.amount, remainingCapacity);
    node.amount -= gathered;
    unit.setData("cargo", {
      resource: node.resource,
      amount: cargo.amount + gathered,
    } satisfies UnitCargo);
    unit.setData("gatherElapsed", 0);
    this.updateUnitCargoLabel(unit);
    this.syncDomState();
    this.updateResourceNodeLabel(node);
    this.pulseResourceGain(unit.x, unit.y - 42, `carga +${gathered} ${node.resource}`);

    const updatedCargo = this.getUnitCargo(unit);
    if (updatedCargo.amount >= capacity || node.amount <= 0) {
      this.sendUnitToDeposit(unit, node);
    }
  }

  private sendUnitToDeposit(unit: Phaser.GameObjects.Container, node: ResourceNode) {
    const unitData = unit.getData("unit") as UnitData;
    unit.setData("gatherTarget", node);
    this.sendUnitToDepositPoint(unit, "resume-gathering");
    this.setStatus(`${unitData.label} vuelve al centro ceremonial para depositar su carga.`);
  }

  private updateDeposit(unit: Phaser.GameObjects.Container, unitData: UnitData, node: ResourceNode) {
    const distance = Phaser.Math.Distance.Between(unit.x, unit.y, CEREMONIAL_CENTER.x, CEREMONIAL_CENTER.y);
    if (distance > CEREMONIAL_CENTER.depositRadius) {
      unit.setData("target", this.getDepositApproachPoint(unit));
      unit.setData("workState", "returning" satisfies UnitWorkState);
      return;
    }

    const cargo = this.getUnitCargo(unit);
    if (!cargo.resource || cargo.amount <= 0) {
      this.finishDepositOrder(unit, node);
      return;
    }

    this.resources[cargo.resource] += cargo.amount;
    this.pulseResourceGain(unit.x, unit.y - 46, `+${cargo.amount} ${cargo.resource}`);
    this.setStatus(`${unitData.label} deposito ${cargo.amount} ${cargo.resource}.`);
    unit.setData("cargo", { amount: 0 } satisfies UnitCargo);
    unit.setData("gatherElapsed", 0);
    this.updateUnitCargoLabel(unit);

    this.finishDepositOrder(unit, node);
    this.updateHudResources();
  }

  private finishDepositOrder(unit: Phaser.GameObjects.Container, node: ResourceNode) {
    const depositAfter = unit.getData("depositAfter") as DepositAfter | undefined;

    if (depositAfter === "resume-gathering" && node.amount > 0) {
      unit.setData("workState", "moving" satisfies UnitWorkState);
      unit.setData("target", this.getGatherApproachPoint(unit, node));
    } else {
      unit.setData("gatherTarget", undefined);
      unit.setData("workState", "idle" satisfies UnitWorkState);
    }

    unit.setData("depositAfter", undefined);
  }

  private getDepositApproachPoint(unit: Phaser.GameObjects.Container) {
    const angle = Phaser.Math.Angle.Between(CEREMONIAL_CENTER.x, CEREMONIAL_CENTER.y, unit.x, unit.y);
    const distance = CEREMONIAL_CENTER.depositRadius - 28;
    return new Phaser.Math.Vector2(
      CEREMONIAL_CENTER.x + Math.cos(angle) * distance,
      CEREMONIAL_CENTER.y + Math.sin(angle) * distance,
    );
  }

  private sendSelectedUnitToManualDeposit(unitData: UnitData) {
    if (!this.selectedUnit) return;

    if (unitData.kind !== "aldeano") {
      this.setStatus(`${unitData.label} no puede depositar recursos.`);
      return;
    }

    const cargo = this.getUnitCargo(this.selectedUnit);
    if (!cargo.resource || cargo.amount <= 0) {
      this.setStatus(`${unitData.label} no trae recursos para depositar.`);
      return;
    }

    this.selectedUnit.setData("gatherTarget", undefined);
    this.sendUnitToDepositPoint(this.selectedUnit, "idle");
    this.setStatus(`${unitData.label} va al centro ceremonial para depositar ${cargo.amount} ${cargo.resource}.`);
  }

  private sendUnitToDepositPoint(unit: Phaser.GameObjects.Container, depositAfter: DepositAfter) {
    unit.setData("target", this.getDepositApproachPoint(unit));
    unit.setData("workState", "returning" satisfies UnitWorkState);
    unit.setData("depositAfter", depositAfter);
    unit.setData("gatherElapsed", 0);
  }

  private updateManualDeposit(unit: Phaser.GameObjects.Container, unitData: UnitData) {
    const distance = Phaser.Math.Distance.Between(unit.x, unit.y, CEREMONIAL_CENTER.x, CEREMONIAL_CENTER.y);
    if (distance > CEREMONIAL_CENTER.depositRadius) {
      unit.setData("target", this.getDepositApproachPoint(unit));
      unit.setData("workState", "returning" satisfies UnitWorkState);
      return;
    }

    const cargo = this.getUnitCargo(unit);
    if (!cargo.resource || cargo.amount <= 0) {
      unit.setData("workState", "idle" satisfies UnitWorkState);
      unit.setData("depositAfter", undefined);
      this.setStatus(`${unitData.label} no trae recursos para depositar.`);
      return;
    }

    this.resources[cargo.resource] += cargo.amount;
    this.pulseResourceGain(unit.x, unit.y - 46, `+${cargo.amount} ${cargo.resource}`);
    this.setStatus(`${unitData.label} deposito ${cargo.amount} ${cargo.resource}.`);
    unit.setData("cargo", { amount: 0 } satisfies UnitCargo);
    unit.setData("workState", "idle" satisfies UnitWorkState);
    unit.setData("depositAfter", undefined);
    this.updateUnitCargoLabel(unit);
    this.updateHudResources();
  }

  private isPointInCeremonialCenter(x: number, y: number) {
    return Phaser.Math.Distance.Between(x, y, CEREMONIAL_CENTER.x, CEREMONIAL_CENTER.y) <= CEREMONIAL_CENTER.depositRadius;
  }

  private getUnitCargo(unit: Phaser.GameObjects.Container): UnitCargo {
    return unit.getData("cargo") as UnitCargo;
  }

  private updateUnitCargoLabel(unit: Phaser.GameObjects.Container) {
    const cargoLabel = unit.getData("cargoLabel") as Phaser.GameObjects.Text | undefined;
    const cargo = this.getUnitCargo(unit);
    if (!cargoLabel) return;

    if (!cargo.resource || cargo.amount <= 0) {
      cargoLabel.setText("");
      return;
    }

    cargoLabel.setText(`${cargo.resource} ${cargo.amount}/${CARRY_CAPACITY[cargo.resource]}`);
  }

  private updateHudResources() {
    this.resourceText?.setText(this.formatResources());
    this.syncDomState();
  }

  private formatResources() {
    const resourceValues = RESOURCES.map((resource) => `${resource}: ${this.resources[resource]}`).join("   ");
    return `${resourceValues}   poblacion: ${this.population}/${this.populationLimit}   V aldeano   G guerrero`;
  }

  private formatCarryCapacities() {
    return `capacidad aldeano: ${RESOURCES.map((resource) => `${resource} ${CARRY_CAPACITY[resource]}`).join("   ")}`;
  }

  private updateResourceNodeLabel(node: ResourceNode) {
    if (node.amount <= 0) {
      this.depleteResourceNode(node);
      return;
    }

    node.text.setText(`${node.label} (${node.amount})`);
    this.syncDomState();
  }

  private depleteResourceNode(node: ResourceNode) {
    if (node.depleted) return;

    node.depleted = true;
    node.amount = 0;
    node.visuals.forEach((visual) => visual.destroy());
    this.setStatus(`${node.label} agotado.`);
    this.syncDomState();
  }

  private syncDomState() {
    document.body.dataset.resources = JSON.stringify(this.resources);
    document.body.dataset.resourceNodes = JSON.stringify(this.resourceNodes.map((node) => ({
      id: node.id,
      resource: node.resource,
      amount: node.amount,
      depleted: node.depleted,
    })));
    document.body.dataset.population = JSON.stringify({
      current: this.population,
      limit: this.populationLimit,
    });
    document.body.dataset.buildings = JSON.stringify(this.getDebugBuildings());
    document.body.dataset.carryCapacity = JSON.stringify(CARRY_CAPACITY);
    document.body.dataset.units = JSON.stringify(this.getDebugUnits());
    document.body.dataset.training = JSON.stringify({
      villager: this.isTrainingVillager,
      warrior: this.isTrainingWarrior,
    });
    document.body.dataset.beast = JSON.stringify(this.camazotz
      ? {
          id: this.camazotz.id,
          name: this.camazotz.name,
          health: this.camazotz.health,
          maxHealth: this.camazotz.maxHealth,
          dormant: this.camazotz.dormant,
          dead: this.camazotz.dead,
          reward: this.camazotz.reward,
        }
      : undefined);
  }

  private pulseResourceGain(x: number, y: number, message: string) {
    const text = this.add.text(x, y, message, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      color: "#f5d76e",
      stroke: "#1d281e",
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 28,
      alpha: 0,
      duration: 780,
      onComplete: () => text.destroy(),
    });
  }

  private installDebugApi() {
    const debugApi = {
      getResources: () => ({ ...this.resources }),
      getResourceNodes: () => this.resourceNodes.map((node) => ({
        id: node.id,
        resource: node.resource,
        label: node.label,
        amount: node.amount,
        depleted: node.depleted,
        x: node.x,
        y: node.y,
      })),
      getSelectedUnit: () => {
        const unitData = this.selectedUnit?.getData("unit") as UnitData | undefined;
        return unitData?.id;
      },
      getCarryCapacity: () => ({ ...CARRY_CAPACITY }),
      getUnits: () => this.getDebugUnits(),
      getBeast: () => this.camazotz ? {
        id: this.camazotz.id,
        name: this.camazotz.name,
        health: this.camazotz.health,
        dormant: this.camazotz.dormant,
        dead: this.camazotz.dead,
      } : undefined,
      trainVillager: () => {
        this.trainVillager();
        return {
          resources: { ...this.resources },
          population: {
            current: this.population,
            limit: this.populationLimit,
          },
          training: {
            villager: this.isTrainingVillager,
            warrior: this.isTrainingWarrior,
          },
        };
      },
      trainWarrior: () => {
        this.trainWarrior();
        return {
          resources: { ...this.resources },
          population: {
            current: this.population,
            limit: this.populationLimit,
          },
          training: {
            villager: this.isTrainingVillager,
            warrior: this.isTrainingWarrior,
          },
        };
      },
      gatherFirst: (resource: Resource) => {
        const node = this.resourceNodes.find((candidate) => candidate.resource === resource);
        if (!this.selectedUnit || !node) return false;

        const unitData = this.selectedUnit.getData("unit") as UnitData;
        if (unitData.kind !== "aldeano") return false;

        this.sendUnitToGather(this.selectedUnit, node);
        return true;
      },
      buildHouseAt: (x: number, y: number) => {
        this.startHousePlacement();
        this.placeBuilding(x, y);
        return {
          resources: { ...this.resources },
          population: {
            current: this.population,
            limit: this.populationLimit,
          },
          buildings: this.getDebugBuildings(),
        };
      },
      exhaustFirst: (resource: Resource) => {
        const node = this.resourceNodes.find((candidate) => candidate.resource === resource && !candidate.depleted);
        if (!node) return false;

        node.amount = 0;
        this.updateResourceNodeLabel(node);
        return true;
      },
    };

    (globalThis as typeof globalThis & { __RQSDebug?: typeof debugApi }).__RQSDebug = debugApi;
    (window as typeof window & { __RQSDebug?: typeof debugApi }).__RQSDebug = debugApi;
  }

  private getDebugUnits() {
    const units: Array<{
      id: string;
      kind: UnitKind;
      x: number;
      y: number;
      cargo: UnitCargo;
      workState: UnitWorkState;
    }> = [];

    this.children.each((child) => {
      if (!(child instanceof Phaser.GameObjects.Container)) return true;

      const unitData = child.getData("unit") as UnitData | undefined;
      if (!unitData) return true;

      units.push({
        id: unitData.id,
        kind: unitData.kind,
        x: Math.round(child.x),
        y: Math.round(child.y),
        cargo: this.getUnitCargo(child),
        workState: child.getData("workState") as UnitWorkState,
      });
      return true;
    });

    return units;
  }

  private getDebugBuildings() {
    return this.buildings.map((building) => ({
      id: building.id,
      kind: building.kind,
      ownerId: building.ownerId,
      x: Math.round(building.x),
      y: Math.round(building.y),
      populationBonus: building.populationBonus,
    }));
  }

  private updateCamera(delta: number) {
    const camera = this.cameras.main;
    const speed = 520 * (delta / 1000);
    const left = this.cursors?.left?.isDown || this.wasd?.A?.isDown;
    const right = this.cursors?.right?.isDown || this.wasd?.D?.isDown;
    const up = this.cursors?.up?.isDown || this.wasd?.W?.isDown;
    const down = this.cursors?.down?.isDown || this.wasd?.S?.isDown;

    if (left) camera.scrollX -= speed;
    if (right) camera.scrollX += speed;
    if (up) camera.scrollY -= speed;
    if (down) camera.scrollY += speed;
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#B96542",
  scene: DemoScene,
  physics: {
    default: "arcade",
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
