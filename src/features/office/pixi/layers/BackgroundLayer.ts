// ── Background Layer — Rooms, floors, walls ──────────────────────────────────

import { Container, Graphics, Sprite, Texture, Assets } from "pixi.js";
import { ROOMS, type Room } from "../../config/office-map";
import { CANVAS_W, CANVAS_H } from "../constants";

export class BackgroundLayer {
  container = new Container();
  onRoomClick: ((roomId: string) => void) | null = null;

  async init() {
    // Outdoor grass background
    const grass = new Graphics();
    grass.rect(0, 0, CANVAS_W, CANVAS_H);
    grass.fill(0x1a3a1a);
    // Grass texture dots
    for (let i = 0; i < 400; i++) {
      const gx = Math.random() * CANVAS_W;
      const gy = Math.random() * CANVAS_H;
      grass.circle(gx, gy, 1 + Math.random());
      grass.fill({ color: 0x2a4a2a, alpha: 0.3 + Math.random() * 0.3 });
    }
    this.container.addChild(grass);

    // Corridor between rows
    const corridors = new Graphics();
    // Row 1-2 corridor
    corridors.rect(30, 305, CANVAS_W - 60, 60);
    corridors.fill(0x1a1714);
    // Row 2-3 corridor
    corridors.rect(30, 615, CANVAS_W - 60, 50);
    corridors.fill(0x1a1714);
    this.container.addChild(corridors);

    // Rooms
    for (const room of ROOMS) {
      const roomContainer = this.createRoom(room);
      this.container.addChild(roomContainer);
    }

    // Cache as texture since background is static
    this.container.cacheAsTexture(true);
  }

  private createRoom(room: Room): Container {
    const c = new Container();

    // Floor
    const floor = new Graphics();
    floor.rect(room.x, room.y, room.w, room.h);
    floor.fill(this.hexColor(room.floorColor));
    c.addChild(floor);

    // Floor texture pattern
    const pattern = new Graphics();
    if (room.floorType === "wood") {
      for (let fy = room.y; fy < room.y + room.h; fy += 6) {
        pattern.rect(room.x, fy, room.w, 0.5);
        pattern.fill({ color: 0xffffff, alpha: 0.04 });
      }
    } else if (room.floorType === "tile") {
      const ts = 12;
      for (let r = 0; r < Math.ceil(room.h / ts); r++) {
        for (let col = 0; col < Math.ceil(room.w / ts); col++) {
          if ((r + col) % 2 === 0) {
            pattern.rect(room.x + col * ts, room.y + r * ts, ts, ts);
            pattern.fill({ color: this.hexColor(room.floorAccent), alpha: 0.3 });
          }
        }
      }
    } else if (room.floorType === "carpet") {
      for (let i = room.y; i < room.y + room.h; i += 8) {
        pattern.moveTo(room.x, i);
        pattern.lineTo(room.x + room.w, i + 8);
        pattern.stroke({ color: 0xffffff, width: 0.3, alpha: 0.05 });
      }
    } else if (room.floorType === "stone") {
      for (let r = 0; r < Math.ceil(room.h / 14); r++) {
        for (let col = 0; col < Math.ceil(room.w / 20); col++) {
          const sx = room.x + col * 20 + (r % 2 === 0 ? 0 : 10);
          const sy = room.y + r * 14;
          pattern.rect(sx, sy, 18, 12);
          pattern.stroke({ color: 0x000000, width: 0.5, alpha: 0.15 });
        }
      }
    }
    c.addChild(pattern);

    // Ambient lighting (radial gradient effect)
    const ambient = new Graphics();
    const cx = room.x + room.w / 2;
    const cy = room.y + room.h / 2;
    // Center glow
    ambient.circle(cx, cy, Math.max(room.w, room.h) * 0.35);
    ambient.fill({ color: 0xffffff, alpha: 0.025 });
    // Edge darkening
    ambient.rect(room.x, room.y, room.w, room.h);
    ambient.fill({ color: 0x000000, alpha: 0.04 });
    c.addChild(ambient);

    // Walls
    const walls = new Graphics();
    const wallH = 10;
    const wallT = 4;
    const wallColor = this.hexColor(room.wallColor);
    const wallTop = this.hexColor(room.wallTop);

    // Top wall
    this.drawWall(walls, room, "top", wallColor, wallTop, wallH, wallT);
    // Bottom wall
    this.drawWall(walls, room, "bottom", wallColor, wallTop, wallH, wallT);
    // Left wall
    this.drawWall(walls, room, "left", wallColor, wallTop, wallH, wallT);
    // Right wall
    this.drawWall(walls, room, "right", wallColor, wallTop, wallH, wallT);
    c.addChild(walls);

    // Interactive area for clicks
    const hitArea = new Graphics();
    hitArea.rect(room.x, room.y, room.w, room.h);
    hitArea.fill({ color: 0xffffff, alpha: 0.001 });
    hitArea.eventMode = "static";
    hitArea.cursor = "pointer";
    hitArea.on("pointerdown", () => {
      this.onRoomClick?.(room.id);
    });
    c.addChild(hitArea);

    return c;
  }

  private drawWall(g: Graphics, room: Room, side: "top" | "bottom" | "left" | "right", wallColor: number, wallTop: number, wallH: number, wallT: number) {
    const doors = room.doors.filter((d) => d.side === side);
    const segments: Array<[number, number]> = [];
    const dim = (side === "top" || side === "bottom") ? room.w : room.h;

    let start = 0;
    for (const door of doors.sort((a, b) => a.offset - b.offset)) {
      if (door.offset > start) segments.push([start, door.offset]);
      start = door.offset + door.width;
    }
    if (start < dim) segments.push([start, dim]);

    for (const [s, e] of segments) {
      if (side === "top") {
        g.rect(room.x + s, room.y - wallH, e - s, wallT + wallH);
        g.fill(wallColor);
        g.rect(room.x + s, room.y - wallH, e - s, wallH);
        g.fill(wallTop);
      } else if (side === "bottom") {
        g.rect(room.x + s, room.y + room.h, e - s, wallT);
        g.fill(wallColor);
      } else if (side === "left") {
        g.rect(room.x - wallH, room.y + s, wallT + wallH, e - s);
        g.fill(wallColor);
        g.rect(room.x - wallH, room.y + s, wallH, e - s);
        g.fill(wallTop);
      } else {
        g.rect(room.x + room.w, room.y + s, wallT, e - s);
        g.fill(wallColor);
      }
    }
  }

  private hexColor(cssHex: string): number {
    return parseInt(cssHex.replace("#", ""), 16);
  }
}
