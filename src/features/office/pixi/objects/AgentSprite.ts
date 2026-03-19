// ── Agent Sprite — Character with body parts, animations, nametag ────────────

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { AgentConfig } from "../../config/office-map";
import type { AgentActivity } from "../../types";
import { CHAR_SCALE, STATUS_COLORS, WALK_SPEED, WALK_FRAME_RATE } from "../constants";

const HEAD_R = 10;
const CHAR_W = 20;
const CHAR_H = 24;

// Character sprite sheet indices: each char PNG is a spritesheet with walk frames
const CHAR_PALETTES: Record<string, number> = {
  joao: 0, jota: 1, caio: 2, leticia: 3, clara: 4,
};

export class AgentSprite {
  container = new Container();
  config: AgentConfig;
  targetX: number;
  targetY: number;
  walking = false;
  direction: "down" | "up" | "left" | "right" = "down";

  private body: Graphics;
  private nameTag: Container;
  private statusDot: Graphics;
  private activityBubble: Container;
  private proximityRing: Graphics;
  private pressELabel: Container;
  private walkCycle = 0;
  private status = "idle";
  private activity: AgentActivity | null = null;
  private velX = 0;
  private velY = 0;
  isPlayerControlled: boolean;

  constructor(cfg: AgentConfig) {
    this.config = cfg;
    this.targetX = cfg.spawnX;
    this.targetY = cfg.spawnY;
    this.isPlayerControlled = cfg.id === "joao";

    this.container.x = cfg.spawnX;
    this.container.y = cfg.spawnY;

    // Body (programmatic fallback)
    this.body = new Graphics();
    this.drawBody();
    this.container.addChild(this.body);

    // Try to load character sprite
    this.loadCharSprite(cfg.id);

    // Name tag (below character)
    this.nameTag = this.createNameTag(cfg.name);
    this.container.addChild(this.nameTag);

    // Status dot
    this.statusDot = new Graphics();
    this.statusDot.circle(0, 0, 4);
    this.statusDot.fill(STATUS_COLORS.idle);
    this.statusDot.x = 18;
    this.statusDot.y = CHAR_H / 2 + 18;
    this.container.addChild(this.statusDot);

    // Activity bubble (hidden by default)
    this.activityBubble = new Container();
    this.activityBubble.visible = false;
    this.container.addChild(this.activityBubble);

    // Proximity ring (hidden by default)
    this.proximityRing = new Graphics();
    this.proximityRing.visible = false;
    this.container.addChild(this.proximityRing);

    // Press E label (hidden by default)
    this.pressELabel = this.createPressELabel();
    this.pressELabel.visible = false;
    this.container.addChild(this.pressELabel);

    // Z-index based on Y position
    this.container.zIndex = cfg.spawnY;
  }

  private async loadCharSprite(_agentId: string) {
    // Character PNGs are full spritesheets (all frames in one image).
    // TODO: parse spritesheet into individual frames for AnimatedSprite.
    // For now, use the programmatic body which works correctly.
  }

  private drawBody() {
    const g = this.body;
    g.clear();
    const color = parseInt(this.config.shirtColor.replace("#", ""), 16);
    const skin = parseInt(this.config.skinColor.replace("#", ""), 16);
    const hair = parseInt(this.config.hairColor.replace("#", ""), 16);

    // Shadow
    g.ellipse(0, CHAR_H / 2 + 4, 14, 5);
    g.fill({ color: 0x000000, alpha: 0.3 });

    // Body
    g.roundRect(-CHAR_W / 2, -CHAR_H / 2, CHAR_W, CHAR_H, 4);
    g.fill(color);

    // Head ring (for contrast)
    const headY = -CHAR_H / 2 - HEAD_R + 2;
    g.circle(0, headY, HEAD_R + 2);
    g.fill({ color: color, alpha: 0.6 });

    // Head
    g.circle(0, headY, HEAD_R);
    g.fill(skin);

    // Hair
    g.circle(0, headY - 4, HEAD_R * 0.8);
    g.fill(hair);

    // Eyes
    g.circle(-3, headY, 1.5);
    g.fill(0xffffff);
    g.circle(3, headY, 1.5);
    g.fill(0xffffff);
    g.circle(-3, headY, 0.8);
    g.fill(0x1a1a1a);
    g.circle(3, headY, 0.8);
    g.fill(0x1a1a1a);
  }

  private createNameTag(name: string): Container {
    const c = new Container();
    const style = new TextStyle({
      fontSize: 10, fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: "bold", fill: 0xffffff,
    });
    const text = new Text({ text: name, style });
    text.anchor.set(0.5);

    const bg = new Graphics();
    const pad = 8;
    bg.roundRect(-text.width / 2 - pad, -8, text.width + pad * 2, 16, 5);
    bg.fill({ color: 0x000000, alpha: 0.6 });

    c.addChild(bg);
    c.addChild(text);
    c.y = CHAR_H / 2 + 16;
    return c;
  }

  private createPressELabel(): Container {
    const c = new Container();
    const style = new TextStyle({
      fontSize: 9, fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: "bold", fill: 0xffffff,
    });
    const text = new Text({ text: "PRESS E", style });
    text.anchor.set(0.5);

    const bg = new Graphics();
    bg.roundRect(-28, -9, 56, 18, 4);
    bg.fill({ color: 0x6366f1, alpha: 0.9 });

    c.addChild(bg);
    c.addChild(text);
    c.y = -CHAR_H / 2 - HEAD_R * 2 - 14;
    return c;
  }

  setStatus(status: string) {
    this.status = status;
    this.statusDot.clear();
    this.statusDot.circle(0, 0, 4);
    this.statusDot.fill(STATUS_COLORS[status] ?? STATUS_COLORS.idle);
  }

  setActivity(activity: AgentActivity) {
    this.activity = activity;
    this.updateActivityBubble();
  }

  private updateActivityBubble() {
    this.activityBubble.removeChildren();
    if (!this.activity || this.activity.state === "idle") {
      this.activityBubble.visible = false;
      return;
    }

    this.activityBubble.visible = true;
    const STYLES: Record<string, { color: number; icon: string }> = {
      thinking: { color: 0xa855f7, icon: "🧠" },
      coding: { color: 0x3b82f6, icon: "💻" },
      reading: { color: 0x10b981, icon: "📖" },
      talking: { color: 0xf59e0b, icon: "🗣️" },
      waiting: { color: 0x6b7280, icon: "☕" },
      done: { color: 0x22c55e, icon: "✅" },
    };
    const s = STYLES[this.activity.state] ?? STYLES.thinking;

    const bg = new Graphics();
    const label = this.activity.label || s.icon;
    const w = Math.max(30, label.length * 6 + 16);
    bg.roundRect(-w / 2, -10, w, 20, 7);
    bg.fill(s.color);

    const text = new Text({
      text: `${s.icon} ${this.activity.label}`,
      style: new TextStyle({ fontSize: 9, fontFamily: "Inter, sans-serif", fill: 0xffffff }),
    });
    text.anchor.set(0.5);

    this.activityBubble.addChild(bg);
    this.activityBubble.addChild(text);
    this.activityBubble.x = 20;
    this.activityBubble.y = -CHAR_H / 2 - HEAD_R * 2 - 20;
  }

  showProximity(show: boolean) {
    this.proximityRing.visible = show;
    this.pressELabel.visible = show;
    if (show) {
      this.proximityRing.clear();
      this.proximityRing.ellipse(0, CHAR_H / 2 + 4, 24, 10);
      this.proximityRing.stroke({ color: 0x6366f1, width: 2, alpha: 0.6 });
    }
  }

  setVelocity(vx: number, vy: number) {
    this.velX = vx;
    this.velY = vy;
  }

  update(dt: number) {
    const deltaSec = dt / 1000;

    if (this.isPlayerControlled) {
      // Player movement
      const isMoving = this.velX !== 0 || this.velY !== 0;
      if (isMoving) {
        const speed = WALK_SPEED * 1.2;
        this.container.x += this.velX * speed * deltaSec;
        this.container.y += this.velY * speed * deltaSec;

        // Clamp
        this.container.x = Math.max(20, Math.min(1380, this.container.x));
        this.container.y = Math.max(20, Math.min(880, this.container.y));

        this.walking = true;
        if (Math.abs(this.velX) > Math.abs(this.velY)) {
          this.direction = this.velX > 0 ? "right" : "left";
        } else {
          this.direction = this.velY > 0 ? "down" : "up";
        }
      } else {
        this.walking = false;
      }
    } else {
      // AI movement toward target
      const dx = this.targetX - this.container.x;
      const dy = this.targetY - this.container.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 2) {
        this.walking = true;
        const step = Math.min(WALK_SPEED * deltaSec, dist);
        this.container.x += (dx / dist) * step;
        this.container.y += (dy / dist) * step;

        if (Math.abs(dx) > Math.abs(dy)) {
          this.direction = dx > 0 ? "right" : "left";
        } else {
          this.direction = dy > 0 ? "down" : "up";
        }
      } else {
        this.walking = false;
        this.container.x = this.targetX;
        this.container.y = this.targetY;
      }
    }

    // Walk animation
    if (this.walking) {
      this.walkCycle += WALK_FRAME_RATE * deltaSec;
      if (this.walkCycle >= 4) this.walkCycle -= 4;
    }

    // Idle bob
    if (!this.walking) {
      const bob = Math.sin(Date.now() / 800 + this.config.spawnX) * 1.2;
      this.body.y = bob;
    } else {
      this.body.y = 0;
    }

    // Z-sort
    this.container.zIndex = this.container.y;
  }
}
