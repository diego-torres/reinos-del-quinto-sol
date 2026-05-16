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

type ResourceNode = {
  id: string;
  resource: Resource;
  label: string;
  x: number;
  y: number;
  radius: number;
  amount: number;
  text: Phaser.GameObjects.Text;
};

type BuildingKind = "casa";

type BuildingData = {
  id: string;
  kind: BuildingKind;
  label: string;
  x: number;
  y: number;
  populationBonus: number;
};

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1600;
const TILE_SIZE = 96;
const GATHER_INTERVAL_MS = 1000;
const GATHER_AMOUNT = 10;
const HOUSE_WOOD_COST = 50;
const HOUSE_POPULATION_BONUS = 5;

class DemoScene extends Phaser.Scene {
  private selectedUnit?: Phaser.GameObjects.Container;
  private selectionRing?: Phaser.GameObjects.Ellipse;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;
  private statusText?: Phaser.GameObjects.Text;
  private resourceText?: Phaser.GameObjects.Text;
  private buildMode?: BuildingKind;
  private targetMarkers = new Map<string, Phaser.GameObjects.Arc>();
  private resourceNodes: ResourceNode[] = [];
  private buildings: BuildingData[] = [];
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
    this.drawCeremonialCenter(520, 470);

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
  }

  update(_time: number, delta: number) {
    this.updateCamera(delta);
    this.updateUnits(delta);
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
    this.registerResourceNode("maiz", "Maizal", x + 56, y + 34, 94, label);
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
    this.registerResourceNode("madera", "Bosque", x + 66, y + 52, 118, label);
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
    this.registerResourceNode("piedra", "Piedra", x + 8, y + 8, 74, label);
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
    this.registerResourceNode("obsidiana", "Obsidiana", x + 5, y + 2, 72, label);
  }

  private registerResourceNode(
    resource: Resource,
    label: string,
    x: number,
    y: number,
    radius: number,
    text: Phaser.GameObjects.Text,
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

  private createUnit(x: number, y: number, data: UnitData) {
    const unit = this.add.container(x, y);
    unit.setData("unit", data);
    unit.setData("target", undefined);
    unit.setData("gatherTarget", undefined);
    unit.setData("gatherElapsed", 0);
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
    const label = this.add.text(0, 50, data.label, labelStyle(13)).setOrigin(0.5);

    unit.add([shadow, body, head, accent, marker, label]);

    unit.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.selectUnit(unit);
        pointer.event.stopPropagation();
      }
    });

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
      ? "Clic derecho en recurso para recolectar. H para construir casa."
      : "Clic derecho para mover.";
    this.setStatus(`${unitData.label} seleccionado. ${hint}`);
  }

  private handleRightClick(x: number, y: number) {
    if (!this.selectedUnit) return;

    const unitData = this.selectedUnit.getData("unit") as UnitData;
    const resourceNode = this.findResourceNodeAt(x, y);

    if (resourceNode) {
      if (unitData.kind !== "aldeano") {
        this.setStatus(`${unitData.label} no recolecta recursos.`);
        return;
      }

      this.sendUnitToGather(this.selectedUnit, resourceNode);
      return;
    }

    this.selectedUnit.setData("gatherTarget", undefined);
    this.selectedUnit.setData("gatherElapsed", 0);
    this.moveSelectedUnit(x, y);
  }

  private moveSelectedUnit(x: number, y: number) {
    if (!this.selectedUnit) return;

    const unitData = this.selectedUnit.getData("unit") as UnitData;
    this.selectedUnit.setData("target", new Phaser.Math.Vector2(x, y));
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
      if (!unitData) return true;

      if (!target && gatherTarget) {
        this.updateGathering(child, unitData, gatherTarget, delta);
        return true;
      }

      if (!target) return true;

      const distance = Phaser.Math.Distance.Between(child.x, child.y, target.x, target.y);
      if (distance < 4) {
        child.setData("target", undefined);
        this.targetMarkers.get(unitData.id)?.destroy();
        this.targetMarkers.delete(unitData.id);
        if (gatherTarget) {
          this.setStatus(`${unitData.label} recolectando ${gatherTarget.label.toLowerCase()}.`);
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
  }

  private createHud() {
    const panel = this.add.rectangle(18, 18, 780, 122, 0x17261d, 0.86).setOrigin(0);
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

    this.statusText = this.add.text(36, 96, "Selecciona una unidad.", {
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
    this.setStatus(`Modo construccion: casa cuesta ${HOUSE_WOOD_COST} madera. Clic izquierdo para colocar.`);
  }

  private placeBuilding(x: number, y: number) {
    if (this.buildMode !== "casa") return;

    if (!this.selectedUnit) {
      this.cancelBuildMode("Selecciona un aldeano para construir.");
      return;
    }

    const unitData = this.selectedUnit.getData("unit") as UnitData;
    if (unitData.kind !== "aldeano") {
      this.cancelBuildMode("Solo los aldeanos pueden construir casas.");
      return;
    }

    if (this.resources.madera < HOUSE_WOOD_COST) {
      this.cancelBuildMode(`Madera insuficiente para casa. Necesitas ${HOUSE_WOOD_COST}.`);
      return;
    }

    if (!this.canPlaceHouseAt(x, y)) {
      this.setStatus("No puedes colocar la casa tan cerca de otra estructura o recurso.");
      return;
    }

    const building: BuildingData = {
      id: `casa-${this.buildings.length + 1}`,
      kind: "casa",
      label: "Casa",
      x,
      y,
      populationBonus: HOUSE_POPULATION_BONUS,
    };

    this.resources.madera -= HOUSE_WOOD_COST;
    this.populationLimit += HOUSE_POPULATION_BONUS;
    this.buildings.push(building);
    this.drawHouse(x, y);
    this.updateHudResources();
    this.cancelBuildMode(`Casa construida. Limite de poblacion: ${this.population}/${this.populationLimit}.`);
  }

  private cancelBuildMode(message: string) {
    this.buildMode = undefined;
    this.setStatus(message);
  }

  private canPlaceHouseAt(x: number, y: number) {
    if (x < 80 || y < 80 || x > WORLD_WIDTH - 80 || y > WORLD_HEIGHT - 80) return false;

    const nearResource = this.resourceNodes.some((node) => {
      return Phaser.Math.Distance.Between(x, y, node.x, node.y) < node.radius + 54;
    });
    if (nearResource) return false;

    return !this.buildings.some((building) => {
      return Phaser.Math.Distance.Between(x, y, building.x, building.y) < 112;
    });
  }

  private findResourceNodeAt(x: number, y: number) {
    return this.resourceNodes.find((node) => {
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
      return;
    }

    const elapsed = (unit.getData("gatherElapsed") as number) + delta;
    if (elapsed < GATHER_INTERVAL_MS) {
      unit.setData("gatherElapsed", elapsed);
      return;
    }

    const gathered = Math.min(GATHER_AMOUNT, node.amount);
    node.amount -= gathered;
    this.resources[node.resource] += gathered;
    unit.setData("gatherElapsed", 0);
    this.updateHudResources();
    this.updateResourceNodeLabel(node);
    this.pulseResourceGain(unit.x, unit.y - 42, `+${gathered} ${node.resource}`);
  }

  private updateHudResources() {
    this.resourceText?.setText(this.formatResources());
    this.syncDomState();
  }

  private formatResources() {
    const resourceValues = RESOURCES.map((resource) => `${resource}: ${this.resources[resource]}`).join("   ");
    return `${resourceValues}   poblacion: ${this.population}/${this.populationLimit}`;
  }

  private updateResourceNodeLabel(node: ResourceNode) {
    node.text.setText(`${node.label} (${node.amount})`);
    this.syncDomState();
  }

  private syncDomState() {
    document.body.dataset.resources = JSON.stringify(this.resources);
    document.body.dataset.resourceNodes = JSON.stringify(this.resourceNodes.map((node) => ({
      id: node.id,
      resource: node.resource,
      amount: node.amount,
    })));
    document.body.dataset.population = JSON.stringify({
      current: this.population,
      limit: this.populationLimit,
    });
    document.body.dataset.buildings = JSON.stringify(this.buildings);
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
        x: node.x,
        y: node.y,
      })),
      getSelectedUnit: () => {
        const unitData = this.selectedUnit?.getData("unit") as UnitData | undefined;
        return unitData?.id;
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
    };

    (globalThis as typeof globalThis & { __RQSDebug?: typeof debugApi }).__RQSDebug = debugApi;
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
