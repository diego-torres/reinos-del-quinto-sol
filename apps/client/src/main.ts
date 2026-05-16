import Phaser from "phaser";
import { GAME_TITLE, RESOURCES, type Resource } from "@reinos/shared";
import "./styles.css";

type UnitKind = "aldeano" | "guerrero";

type UnitData = {
  id: string;
  kind: UnitKind;
  label: string;
  color: number;
  speed: number;
};

type UnitStats = {
  maxHealth: number;
  attack: number;
  range: number;
  cooldownMs: number;
};

type ResourceNode = {
  id: string;
  resource: Resource;
  label: string;
  x: number;
  y: number;
  radius: number;
  amount: number;
  text: Phaser.GameObjects.Text;
  visuals: Phaser.GameObjects.GameObject[];
  depleted: boolean;
};

type UnitCargo = {
  resource?: Resource;
  amount: number;
};

type UnitWorkState = "idle" | "moving" | "gathering" | "returning";

type BuildingKind = "casa" | "telpochcalli";

type DepositAfter = "idle" | "resume-gathering";

type BuildingData = {
  id: string;
  kind: BuildingKind;
  label: string;
  x: number;
  y: number;
  populationBonus: number;
};

type TrainingDefinition = {
  label: string;
  cost: Partial<Record<Resource, number>>;
  population: number;
  durationMs: number;
};

type MythicBeast = {
  id: string;
  name: string;
  x: number;
  y: number;
  container: Phaser.GameObjects.Container;
  health: number;
  maxHealth: number;
  attack: number;
  range: number;
  speed: number;
  cooldownMs: number;
  attackElapsed: number;
  dormant: boolean;
  dead: boolean;
  targetUnit?: Phaser.GameObjects.Container;
  reward: Partial<Record<Resource, number>>;
  healthText: Phaser.GameObjects.Text;
};

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1600;
const TILE_SIZE = 96;
const GATHER_INTERVAL_MS = 1000;
const GATHER_AMOUNT = 10;
const CEREMONIAL_CENTER = {
  x: 520,
  y: 470,
  depositRadius: 180,
};
const CARRY_CAPACITY: Record<Resource, number> = {
  maiz: 30,
  madera: 25,
  piedra: 20,
  obsidiana: 15,
};
const HOUSE_WOOD_COST = 50;
const HOUSE_POPULATION_BONUS = 5;
const TELPOCHCALLI_COST: Partial<Record<Resource, number>> = {
  madera: 120,
  piedra: 40,
};
const UNIT_STATS: Record<UnitKind, UnitStats> = {
  aldeano: {
    maxHealth: 55,
    attack: 2,
    range: 34,
    cooldownMs: 1200,
  },
  guerrero: {
    maxHealth: 95,
    attack: 14,
    range: 58,
    cooldownMs: 850,
  },
};
const TRAINING: Record<UnitKind, TrainingDefinition> = {
  aldeano: {
    label: "Aldeano",
    cost: { maiz: 50 },
    population: 1,
    durationMs: 1400,
  },
  guerrero: {
    label: "Guerrero",
    cost: { maiz: 60, obsidiana: 20 },
    population: 1,
    durationMs: 1700,
  },
};

class DemoScene extends Phaser.Scene {
  private selectedUnit?: Phaser.GameObjects.Container;
  private selectionRing?: Phaser.GameObjects.Ellipse;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;
  private statusText?: Phaser.GameObjects.Text;
  private resourceText?: Phaser.GameObjects.Text;
  private carryCapacityText?: Phaser.GameObjects.Text;
  private buildMode?: BuildingKind;
  private targetMarkers = new Map<string, Phaser.GameObjects.Arc>();
  private resourceNodes: ResourceNode[] = [];
  private buildings: BuildingData[] = [];
  private units: Phaser.GameObjects.Container[] = [];
  private camazotz?: MythicBeast;
  private nextUnitId = 2;
  private isTrainingVillager = false;
  private isTrainingWarrior = false;
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
    this.cameras.main.setBackgroundColor("#254b33");
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.drawTerrain();
    this.drawResourceClusters();
    this.drawCeremonialCenter(CEREMONIAL_CENTER.x, CEREMONIAL_CENTER.y);
    this.camazotz = this.createCamazotz(1010, 780);

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

  private drawTerrain() {
    const graphics = this.add.graphics();

    for (let y = 0; y < WORLD_HEIGHT; y += TILE_SIZE) {
      for (let x = 0; x < WORLD_WIDTH; x += TILE_SIZE) {
        const shade = (x / TILE_SIZE + y / TILE_SIZE) % 2 === 0 ? 0x32613e : 0x2d5939;
        graphics.fillStyle(shade, 1);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }

    graphics.lineStyle(1, 0x446f4a, 0.28);
    for (let x = 0; x <= WORLD_WIDTH; x += TILE_SIZE) {
      graphics.lineBetween(x, 0, x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += TILE_SIZE) {
      graphics.lineBetween(0, y, WORLD_WIDTH, y);
    }

    const river = this.add.graphics();
    river.lineStyle(72, 0x317d89, 0.9);
    river.beginPath();
    river.moveTo(0, 1060);
    river.lineTo(360, 990);
    river.lineTo(730, 1070);
    river.lineTo(1160, 970);
    river.lineTo(1640, 1030);
    river.lineTo(2400, 880);
    river.strokePath();

    river.lineStyle(16, 0x8fc7b7, 0.35);
    river.strokePath();
  }

  private drawResourceClusters() {
    this.drawMaizeField(620, 520);
    this.drawMaizeField(280, 780);
    this.drawMaizeField(1080, 560);
    this.drawForest(1360, 350);
    this.drawForest(1760, 740);
    this.drawStoneOutcrop(690, 1030);
    this.drawStoneOutcrop(1650, 1120);
    this.drawObsidianDeposit(1120, 1120);
    this.drawObsidianDeposit(2050, 430);
  }

  private drawMaizeField(x: number, y: number) {
    const group = this.add.container(x, y);
    for (let i = 0; i < 18; i++) {
      const px = (i % 6) * 24;
      const py = Math.floor(i / 6) * 30;
      const stalk = this.add.rectangle(px, py, 5, 34, 0x73a942);
      const cob = this.add.ellipse(px + 5, py - 4, 11, 22, 0xf0c94a);
      group.add([stalk, cob]);
    }
    const label = this.add.text(x - 8, y + 92, "Maizal", labelStyle()).setOrigin(0.5);
    this.registerResourceNode("maiz", "Maizal", x + 56, y + 34, 94, label, [group, label]);
  }

  private drawForest(x: number, y: number) {
    const group = this.add.container(x, y);
    for (let i = 0; i < 12; i++) {
      const px = (i % 4) * 44;
      const py = Math.floor(i / 4) * 44;
      group.add(this.add.rectangle(px, py + 22, 12, 42, 0x6b4328));
      group.add(this.add.triangle(px, py, -25, 30, 0, -28, 25, 30, 0x1c6b3f));
      group.add(this.add.triangle(px, py - 18, -21, 22, 0, -30, 21, 22, 0x23824a));
    }
    const label = this.add.text(x + 62, y + 142, "Bosque", labelStyle()).setOrigin(0.5);
    this.registerResourceNode("madera", "Bosque", x + 66, y + 52, 118, label, [group, label]);
  }

  private drawStoneOutcrop(x: number, y: number) {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xb7b59e, 1);
    graphics.fillCircle(x, y, 38);
    graphics.fillStyle(0x8d8b78, 1);
    graphics.fillCircle(x + 34, y + 22, 30);
    graphics.fillStyle(0xd5d1b8, 1);
    graphics.fillCircle(x - 26, y + 28, 24);
    const label = this.add.text(x + 10, y + 70, "Piedra", labelStyle()).setOrigin(0.5);
    this.registerResourceNode("piedra", "Piedra", x + 8, y + 8, 74, label, [graphics, label]);
  }

  private drawObsidianDeposit(x: number, y: number) {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x17141d, 1);
    graphics.fillTriangle(x, y - 52, x - 38, y + 42, x + 38, y + 42);
    graphics.fillStyle(0x372f4d, 1);
    graphics.fillTriangle(x + 18, y - 28, x - 8, y + 42, x + 44, y + 42);
    graphics.lineStyle(3, 0x81d8d0, 0.45);
    graphics.lineBetween(x, y - 42, x - 10, y + 34);
    const label = this.add.text(x + 4, y + 72, "Obsidiana", labelStyle()).setOrigin(0.5);
    this.registerResourceNode("obsidiana", "Obsidiana", x + 5, y + 2, 72, label, [graphics, label]);
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

  private drawCeremonialCenter(x: number, y: number) {
    const base = this.add.container(x, y);
    base.add(this.add.rectangle(0, 88, 260, 84, 0xb9a66f).setStrokeStyle(4, 0x735f38));
    base.add(this.add.rectangle(0, 35, 210, 74, 0xc8b77a).setStrokeStyle(4, 0x735f38));
    base.add(this.add.rectangle(0, -12, 152, 58, 0xd5c585).setStrokeStyle(4, 0x735f38));
    base.add(this.add.rectangle(0, -52, 76, 38, 0x7d3f2b).setStrokeStyle(4, 0x4d2c21));
    base.add(this.add.rectangle(0, 58, 42, 142, 0x8e7445, 0.45));
    base.add(this.add.text(0, 158, "Centro ceremonial", labelStyle(15)).setOrigin(0.5));
  }

  private drawHouse(x: number, y: number) {
    const house = this.add.container(x, y);
    house.setDepth(2);
    house.add(this.add.ellipse(0, 38, 92, 24, 0x000000, 0.18));
    house.add(this.add.rectangle(0, 22, 86, 52, 0xb98a58).setStrokeStyle(4, 0x5a3a24));
    house.add(this.add.triangle(0, -26, -52, 20, 0, -60, 52, 20, 0x7d3f2b).setStrokeStyle(4, 0x4d2c21));
    house.add(this.add.rectangle(0, 36, 24, 28, 0x3c281d).setStrokeStyle(2, 0x20140f));
    house.add(this.add.rectangle(-24, 18, 16, 14, 0xf0c94a, 0.45).setStrokeStyle(2, 0x5a3a24));
    house.add(this.add.text(0, 82, "Casa", labelStyle(13)).setOrigin(0.5));
  }

  private drawTelpochcalli(x: number, y: number) {
    const building = this.add.container(x, y);
    building.setDepth(2);
    building.add(this.add.ellipse(0, 54, 144, 28, 0x000000, 0.18));
    building.add(this.add.rectangle(0, 28, 126, 72, 0x9b6b42).setStrokeStyle(4, 0x4d2c21));
    building.add(this.add.rectangle(0, -20, 148, 36, 0x7d3f2b).setStrokeStyle(4, 0x351d17));
    building.add(this.add.triangle(-46, -44, -20, -16, -46, -76, -72, -16, 0xd7bc73).setStrokeStyle(3, 0x4d2c21));
    building.add(this.add.triangle(46, -44, 72, -16, 46, -76, 20, -16, 0xd7bc73).setStrokeStyle(3, 0x4d2c21));
    building.add(this.add.rectangle(0, 38, 34, 48, 0x271913).setStrokeStyle(2, 0x120b08));
    building.add(this.add.rectangle(-36, 26, 18, 18, 0x223d63, 0.75).setStrokeStyle(2, 0x111c2d));
    building.add(this.add.rectangle(36, 26, 18, 18, 0x223d63, 0.75).setStrokeStyle(2, 0x111c2d));
    building.add(this.add.text(0, 104, "Telpochcalli", labelStyle(13)).setOrigin(0.5));
  }

  private createCamazotz(x: number, y: number): MythicBeast {
    const container = this.add.container(x, y);
    container.setDepth(3);

    container.add(this.add.ellipse(0, 48, 150, 26, 0x000000, 0.25));
    container.add(this.add.triangle(-44, -4, -138, 34, -26, 22, -66, -72, 0x211827).setStrokeStyle(3, 0x5c2745));
    container.add(this.add.triangle(44, -4, 138, 34, 26, 22, 66, -72, 0x211827).setStrokeStyle(3, 0x5c2745));
    container.add(this.add.ellipse(0, 8, 70, 86, 0x37213a).setStrokeStyle(4, 0x130d19));
    container.add(this.add.circle(-18, -20, 8, 0xf5d76e));
    container.add(this.add.circle(18, -20, 8, 0xf5d76e));
    container.add(this.add.triangle(0, -2, -8, 14, 0, 30, 8, 14, 0xe8e0c8));
    container.add(this.add.triangle(-20, -52, -8, -28, -30, -28, -26, -76, 0x2b1d33));
    container.add(this.add.triangle(20, -52, 8, -28, 30, -28, 26, -76, 0x2b1d33));

    const healthText = this.add.text(0, 92, "Camazotz dormido 90/90", labelStyle(13)).setOrigin(0.5);
    container.add(healthText);

    return {
      id: "camazotz-1",
      name: "Camazotz",
      x,
      y,
      container,
      health: 90,
      maxHealth: 90,
      attack: 10,
      range: 66,
      speed: 115,
      cooldownMs: 1100,
      attackElapsed: 0,
      dormant: true,
      dead: false,
      reward: {
        maiz: 100,
        piedra: 80,
        obsidiana: 50,
      },
      healthText,
    };
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
    const label = this.add.text(0, 50, `${data.label} ${UNIT_STATS[data.kind].maxHealth}/${UNIT_STATS[data.kind].maxHealth}`, labelStyle(13)).setOrigin(0.5);
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

      this.sendUnitToGather(this.selectedUnit, resourceNode);
      return;
    }

    if (this.isPointInCeremonialCenter(x, y)) {
      this.sendSelectedUnitToManualDeposit(unitData);
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

    const cost = this.getBuildingCost(this.buildMode);
    if (!this.canAfford(cost)) {
      this.cancelBuildMode(`Recursos insuficientes. Necesitas ${this.formatCost(cost)}.`);
      return;
    }

    if (!this.canPlaceBuildingAt(x, y, this.buildMode)) {
      this.setStatus("No puedes colocar ese edificio tan cerca de otra estructura o recurso.");
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
    this.buildings.push(building);
    if (building.kind === "casa") {
      this.drawHouse(x, y);
    } else {
      this.drawTelpochcalli(x, y);
    }
    this.updateHudResources();
    const extra = building.kind === "casa"
      ? ` Limite de poblacion: ${this.population}/${this.populationLimit}.`
      : " Presiona G para entrenar guerreros.";
    this.cancelBuildMode(`${building.label} construido.${extra}`);
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

  private getBuildingCost(kind: BuildingKind): Partial<Record<Resource, number>> {
    if (kind === "casa") return { madera: HOUSE_WOOD_COST };
    return TELPOCHCALLI_COST;
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
    document.body.dataset.buildings = JSON.stringify(this.buildings);
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
          buildings: [...this.buildings],
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
  backgroundColor: "#254b33",
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

function labelStyle(fontSize = 14): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: "system-ui, sans-serif",
    fontSize: `${fontSize}px`,
    color: "#fff4cf",
    stroke: "#1d281e",
    strokeThickness: 4,
  };
}
