import Phaser from "phaser";
import { GAME_TITLE, RESOURCES } from "@reinos/shared";
import "./styles.css";

type UnitKind = "aldeano" | "guerrero";

type UnitData = {
  id: string;
  kind: UnitKind;
  label: string;
  color: number;
  speed: number;
};

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1600;
const TILE_SIZE = 96;

class DemoScene extends Phaser.Scene {
  private selectedUnit?: Phaser.GameObjects.Container;
  private selectionRing?: Phaser.GameObjects.Ellipse;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;
  private statusText?: Phaser.GameObjects.Text;
  private targetMarkers = new Map<string, Phaser.GameObjects.Arc>();

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

    this.selectUnit(aldeano);
    this.createHud();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.moveSelectedUnit(pointer.worldX, pointer.worldY);
      }
    });

    this.input.mouse?.disableContextMenu();
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
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
    this.add.text(x - 8, y + 92, "Maizal", labelStyle()).setOrigin(0.5);
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
    this.add.text(x + 62, y + 142, "Bosque", labelStyle()).setOrigin(0.5);
  }

  private drawStoneOutcrop(x: number, y: number) {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xb7b59e, 1);
    graphics.fillCircle(x, y, 38);
    graphics.fillStyle(0x8d8b78, 1);
    graphics.fillCircle(x + 34, y + 22, 30);
    graphics.fillStyle(0xd5d1b8, 1);
    graphics.fillCircle(x - 26, y + 28, 24);
    this.add.text(x + 10, y + 70, "Piedra", labelStyle()).setOrigin(0.5);
  }

  private drawObsidianDeposit(x: number, y: number) {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x17141d, 1);
    graphics.fillTriangle(x, y - 52, x - 38, y + 42, x + 38, y + 42);
    graphics.fillStyle(0x372f4d, 1);
    graphics.fillTriangle(x + 18, y - 28, x - 8, y + 42, x + 44, y + 42);
    graphics.lineStyle(3, 0x81d8d0, 0.45);
    graphics.lineBetween(x, y - 42, x - 10, y + 34);
    this.add.text(x + 4, y + 72, "Obsidiana", labelStyle()).setOrigin(0.5);
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

  private createUnit(x: number, y: number, data: UnitData) {
    const unit = this.add.container(x, y);
    unit.setData("unit", data);
    unit.setData("target", undefined);
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
    this.setStatus(`${unitData.label} seleccionado. Clic derecho para mover.`);
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

  private updateUnits(delta: number) {
    const seconds = delta / 1000;

    this.children.each((child) => {
      if (!(child instanceof Phaser.GameObjects.Container)) return true;

      const unitData = child.getData("unit") as UnitData | undefined;
      const target = child.getData("target") as Phaser.Math.Vector2 | undefined;
      if (!unitData || !target) return true;

      const distance = Phaser.Math.Distance.Between(child.x, child.y, target.x, target.y);
      if (distance < 4) {
        child.setData("target", undefined);
        this.targetMarkers.get(unitData.id)?.destroy();
        this.targetMarkers.delete(unitData.id);
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
    const panel = this.add.rectangle(18, 18, 420, 122, 0x17261d, 0.86).setOrigin(0);
    panel.setScrollFactor(0);
    panel.setStrokeStyle(2, 0xd7bc73, 0.55);

    this.add.text(36, 30, GAME_TITLE, {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: "#f5e5b0",
    }).setScrollFactor(0);

    this.add.text(36, 66, RESOURCES.map((resource) => `${resource}: 200`).join("   "), {
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
