// ── 2D Canvas Rendering Engine — Gather-Style Virtual Office (v2) ─────────────
// Rich pixel-art characters, detailed furniture, 3D walls, textured floors,
// outdoor environment, and smooth movement system.

import {
  ROOMS, HOTSPOTS, FURNITURE, AGENTS, CANVAS_W, CANVAS_H, TILE, WALL_H,
  type Room, type Hotspot, type Furniture, type AgentConfig, type FloorType,
} from "../config/office-map";
import type { AgentActivity } from "../types";
import {
  type CharFrames, type CharAction,
  getCharFrames, getCharacterFrame, preloadAllCharacters,
  CHAR_FRAME_W, CHAR_FRAME_H,
} from "./characterSprites";
import { findPath, isPixelWalkable } from "./tileGrid";
import { getSpriteImage, getSpriteInfo, preloadFurnitureSprites, NO_SPRITE_TYPES } from "./furnitureSprites";

// Pre-load furniture sprites
if (typeof window !== "undefined") {
  preloadFurnitureSprites();
}

// ── Character sprite cache (per agent) ───────────────────────────────────────
const agentSpriteFrames = new Map<string, CharFrames>();
const AGENT_PALETTES: Record<string, number> = {
  joao: 0, jota: 1, caio: 2, leticia: 3, clara: 4,
};

// Pre-load character sprites on module load
if (typeof window !== "undefined") {
  preloadAllCharacters();
  // Cache per agent
  for (const [agentId, palette] of Object.entries(AGENT_PALETTES)) {
    getCharFrames(palette).then((frames) => {
      if (frames) agentSpriteFrames.set(agentId, frames);
    });
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentStatus {
  id: string;
  status: "active" | "idle" | "degraded" | "down";
  messages_24h: number;
  errors_24h: number;
}

export interface AgentDispatchIndicator {
  hasActive: boolean;
  lastStatus: string | null;
}

export type Direction = "down" | "up" | "left" | "right";

export interface AgentAnimState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  path: Array<{ x: number; y: number }>;  // BFS path waypoints
  pathIndex: number;                        // current waypoint index
  direction: Direction;
  walking: boolean;
  walkCycle: number; // 0-3 frame counter
  idleBob: number;
  isPlayerControlled?: boolean;
  velX?: number;
  velY?: number;
  // Transition effects
  spawnTimer: number;       // countdown from 1 → 0 (fade in on first appear)
  teleportTimer: number;    // countdown from 1 → 0 (glow when changing rooms)
  lastRoom: string;         // track room changes for teleport effect
}

export interface RenderState {
  hoveredEntity: string | null;
  hoveredHotspot: string | null;
  hoveredRoom: string | null;
  selectedEntity: string | null;
  nearbyAgent: string | null;        // Agent within proximity of João
  nearbyHotspot: string | null;      // Hotspot within proximity of João
  agentStatuses: Map<string, AgentStatus>;
  agentDispatches: Map<string, AgentDispatchIndicator>;
  agentAnims: Map<string, AgentAnimState>;
  agentActivities: Map<string, AgentActivity>;
  agentFlash: Map<string, number>;   // agentId → flash end timestamp
  agentUnread: Map<string, string>;  // agentId → preview text (persists until viewed)
  alertRooms: Map<string, string>;
  particles: Particle[];
  cameraX: number;
  cameraY: number;
  time: number;
  lastTime: number;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string;
  type: "steam" | "leaf" | "sparkle";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WALK_SPEED = 90;         // px per second
const WALK_FRAME_RATE = 6;     // frames per second for walk cycle
const CHAR_W = 20;             // character body width (slightly larger)
const CHAR_H = 24;             // character body height (without head)
const HEAD_R = 10;             // head radius
const WALL_THICKNESS = 4;

const PROXIMITY_RANGE = 60;        // px — distance to trigger interaction
const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e", idle: "#6b7280", degraded: "#f59e0b", down: "#ef4444",
};

// ── Activity accessories (drawn on character based on state) ─────────────────
const ACTIVITY_ACCESSORIES: Record<string, { emoji: string; offsetX: number; offsetY: number }> = {
  coding:   { emoji: "💻", offsetX: 16, offsetY: -2 },
  thinking: { emoji: "🧠", offsetX: -16, offsetY: -18 },
  reading:  { emoji: "📖", offsetX: 16, offsetY: -2 },
  talking:  { emoji: "🗣️", offsetX: -16, offsetY: -18 },
  waiting:  { emoji: "☕", offsetX: 16, offsetY: 0 },
  done:     { emoji: "✅", offsetX: -16, offsetY: -18 },
};

// ── Deterministic pseudo-random from seed ─────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ── Helper: rounded rect ──────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Outdoor border (grass + trees) ────────────────────────────────────────────

function drawOutdoorBorder(ctx: CanvasRenderingContext2D) {
  // Dark green grass background
  ctx.fillStyle = "#1a3a1a";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Grass texture dots
  for (let i = 0; i < 600; i++) {
    const gx = seededRandom(i * 3 + 1) * CANVAS_W;
    const gy = seededRandom(i * 3 + 2) * CANVAS_H;
    const brightness = seededRandom(i * 3 + 3);
    ctx.fillStyle = brightness > 0.5
      ? "rgba(40,90,40,0.4)"
      : "rgba(30,70,30,0.3)";
    ctx.fillRect(gx, gy, 2, 2);
  }

  // Simple trees around the border
  const treePositions = [
    { x: 8, y: 20 }, { x: 28, y: 10 },
    { x: CANVAS_W - 30, y: 15 }, { x: CANVAS_W - 12, y: 25 },
    { x: 15, y: CANVAS_H - 20 }, { x: CANVAS_W - 20, y: CANVAS_H - 15 },
    { x: 200, y: 8 }, { x: 500, y: 12 }, { x: 800, y: 8 },
    { x: 1100, y: 10 }, { x: 1350, y: 18 },
    { x: 5, y: 300 }, { x: 5, y: 500 }, { x: 5, y: 700 },
    { x: CANVAS_W - 8, y: 350 }, { x: CANVAS_W - 10, y: 550 },
    { x: 300, y: CANVAS_H - 8 }, { x: 700, y: CANVAS_H - 10 },
    { x: 1000, y: CANVAS_H - 8 }, { x: 1300, y: CANVAS_H - 12 },
  ];

  for (const tp of treePositions) {
    // Trunk
    ctx.fillStyle = "#4a3520";
    ctx.fillRect(tp.x - 2, tp.y, 4, 10);
    // Canopy
    ctx.beginPath();
    ctx.arc(tp.x, tp.y - 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#2a6a2a";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tp.x - 3, tp.y - 5, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#348a34";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tp.x + 3, tp.y - 4, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#2d7a2d";
    ctx.fill();
  }
}

// ── Corridor floor ────────────────────────────────────────────────────────────

function drawCorridorFloor(ctx: CanvasRenderingContext2D) {
  // Determine the bounding box of all rooms to figure out the "building" area
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
  for (const room of ROOMS) {
    minX = Math.min(minX, room.x);
    minY = Math.min(minY, room.y);
    maxX = Math.max(maxX, room.x + room.w);
    maxY = Math.max(maxY, room.y + room.h);
  }

  // Building interior floor (corridor)
  const pad = 0;
  const bx = minX - pad;
  const by = minY - pad;
  const bw = maxX - minX + pad * 2;
  const bh = maxY - minY + pad * 2;

  ctx.fillStyle = "#1a1714";
  ctx.fillRect(bx, by, bw, bh);

  // Subtle tile pattern on corridor
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 0.5;
  for (let tx = bx; tx < bx + bw; tx += TILE) {
    ctx.beginPath(); ctx.moveTo(tx, by); ctx.lineTo(tx, by + bh); ctx.stroke();
  }
  for (let ty = by; ty < by + bh; ty += TILE) {
    ctx.beginPath(); ctx.moveTo(bx, ty); ctx.lineTo(bx + bw, ty); ctx.stroke();
  }

  // Warm accent lines at tile intersections
  for (let tx = bx; tx < bx + bw; tx += TILE) {
    for (let ty = by; ty < by + bh; ty += TILE) {
      ctx.fillStyle = "rgba(180,140,90,0.015)";
      ctx.fillRect(tx, ty, 1, 1);
    }
  }
}

// ── Floor texture functions ───────────────────────────────────────────────────

function drawFloorTexture(ctx: CanvasRenderingContext2D, room: Room) {
  const { x, y, w, h, floorType, floorColor, floorAccent } = room;

  // Base floor
  ctx.fillStyle = floorColor;
  ctx.fillRect(x, y, w, h);

  switch (floorType) {
    case "carpet": {
      // Subtle diagonal crosshatch
      ctx.strokeStyle = floorAccent;
      ctx.lineWidth = 0.4;
      ctx.globalAlpha = 0.3;
      for (let d = -h; d < w; d += 8) {
        ctx.beginPath();
        ctx.moveTo(x + d, y);
        ctx.lineTo(x + d + h, y + h);
        ctx.stroke();
      }
      for (let d = -h; d < w; d += 8) {
        ctx.beginPath();
        ctx.moveTo(x + d + h, y);
        ctx.lineTo(x + d, y + h);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "tile": {
      // Small checkerboard
      const tileSize = TILE / 2;
      for (let tx = 0; tx < w; tx += tileSize) {
        for (let ty = 0; ty < h; ty += tileSize) {
          const checker = (Math.floor(tx / tileSize) + Math.floor(ty / tileSize)) % 2 === 0;
          if (checker) {
            ctx.fillStyle = floorAccent;
            ctx.globalAlpha = 0.3;
            ctx.fillRect(x + tx, y + ty, tileSize, tileSize);
            ctx.globalAlpha = 1;
          }
        }
      }
      // Grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 0.3;
      for (let tx = 0; tx <= w; tx += tileSize) {
        ctx.beginPath(); ctx.moveTo(x + tx, y); ctx.lineTo(x + tx, y + h); ctx.stroke();
      }
      for (let ty = 0; ty <= h; ty += tileSize) {
        ctx.beginPath(); ctx.moveTo(x, y + ty); ctx.lineTo(x + w, y + ty); ctx.stroke();
      }
      break;
    }
    case "wood": {
      // Horizontal wood plank lines
      ctx.strokeStyle = floorAccent;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.35;
      for (let ty = 0; ty < h; ty += 6) {
        ctx.beginPath();
        ctx.moveTo(x, y + ty);
        ctx.lineTo(x + w, y + ty);
        ctx.stroke();
      }
      // Plank variation
      for (let ty = 0; ty < h; ty += 6) {
        const offset = seededRandom(ty * 7 + x) * w;
        ctx.strokeStyle = "rgba(255,255,255,0.03)";
        ctx.beginPath();
        ctx.moveTo(x + offset, y + ty);
        ctx.lineTo(x + offset, y + ty + 6);
        ctx.stroke();
        ctx.strokeStyle = floorAccent;
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "stone": {
      // Irregular stone pattern
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 0.6;
      for (let row = 0; row < h; row += 14) {
        const stagger = (Math.floor(row / 14) % 2) * 10;
        for (let col = 0; col < w; col += 20) {
          const sx = x + col + stagger;
          const sy = y + row;
          const sw = 18;
          const sh = 12;
          if (sx + sw > x + w || sy + sh > y + h) continue;
          roundRect(ctx, sx, sy, sw, sh, 1);
          ctx.stroke();
          // Slight color variation
          ctx.fillStyle = seededRandom(row * 31 + col * 17) > 0.5
            ? "rgba(255,255,255,0.015)"
            : "rgba(0,0,0,0.02)";
          ctx.fill();
        }
      }
      break;
    }
  }
}

// ── Room floor + 3D walls ─────────────────────────────────────────────────────

function drawRoom(ctx: CanvasRenderingContext2D, room: Room) {
  const { x, y, w, h } = room;

  // Textured floor
  drawFloorTexture(ctx, room);

  // ── 3D Walls with top face ────────────────────────────────────────────────

  const sides: Array<"top" | "bottom" | "left" | "right"> = ["top", "bottom", "left", "right"];

  for (const side of sides) {
    const doors = room.doors.filter((d) => d.side === side);
    const segments: Array<[number, number]> = [];

    if (side === "top" || side === "bottom") {
      let start = 0;
      for (const door of doors.sort((a, b) => a.offset - b.offset)) {
        if (door.offset > start) segments.push([start, door.offset]);
        start = door.offset + door.width;
      }
      if (start < w) segments.push([start, w]);

      const wy = side === "top" ? y - WALL_H : y + h - WALL_THICKNESS;

      for (const [s, e] of segments) {
        // Wall front face
        ctx.fillStyle = room.wallColor;
        ctx.fillRect(x + s, wy + (side === "top" ? WALL_H : 0), e - s, WALL_THICKNESS);

        // Wall top face (3D depth illusion)
        if (side === "top") {
          ctx.fillStyle = room.wallTop;
          ctx.fillRect(x + s, wy, e - s, WALL_H);
          // Gradient on 3D face
          const topGrad = ctx.createLinearGradient(0, wy, 0, wy + WALL_H);
          topGrad.addColorStop(0, "rgba(255,255,255,0.12)");
          topGrad.addColorStop(1, "rgba(0,0,0,0.05)");
          ctx.fillStyle = topGrad;
          ctx.fillRect(x + s, wy, e - s, WALL_H);
        } else {
          // Bottom wall: top face visible above the wall line
          ctx.fillStyle = room.wallTop;
          ctx.fillRect(x + s, wy - WALL_H, e - s, WALL_H);
          const topGrad = ctx.createLinearGradient(0, wy - WALL_H, 0, wy);
          topGrad.addColorStop(0, "rgba(255,255,255,0.1)");
          topGrad.addColorStop(1, "rgba(0,0,0,0.05)");
          ctx.fillStyle = topGrad;
          ctx.fillRect(x + s, wy - WALL_H, e - s, WALL_H);
        }
      }

      // Door indicators — subtle floor pattern through doorway
      for (const door of doors) {
        const dwy = side === "top" ? y : y + h - WALL_THICKNESS;
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(x + door.offset, dwy - (side === "top" ? WALL_H : 0),
          door.width, WALL_THICKNESS + WALL_H);
        // Door threshold
        ctx.fillStyle = "rgba(180,140,80,0.08)";
        ctx.fillRect(x + door.offset + 2, dwy, door.width - 4, WALL_THICKNESS);
      }
    } else {
      let start = 0;
      for (const door of doors.sort((a, b) => a.offset - b.offset)) {
        if (door.offset > start) segments.push([start, door.offset]);
        start = door.offset + door.width;
      }
      if (start < h) segments.push([start, h]);

      const wx = side === "left" ? x : x + w - WALL_THICKNESS;

      for (const [s, e] of segments) {
        // Wall front face
        ctx.fillStyle = room.wallColor;
        ctx.fillRect(wx, y + s, WALL_THICKNESS, e - s);

        // Wall top face (horizontal strip on top for depth)
        ctx.fillStyle = room.wallTop;
        if (side === "left") {
          ctx.fillRect(wx - WALL_H, y + s, WALL_H, e - s);
          const sideGrad = ctx.createLinearGradient(wx - WALL_H, 0, wx, 0);
          sideGrad.addColorStop(0, "rgba(255,255,255,0.08)");
          sideGrad.addColorStop(1, "rgba(0,0,0,0.05)");
          ctx.fillStyle = sideGrad;
          ctx.fillRect(wx - WALL_H, y + s, WALL_H, e - s);
        } else {
          ctx.fillRect(wx + WALL_THICKNESS, y + s, WALL_H, e - s);
          const sideGrad = ctx.createLinearGradient(wx + WALL_THICKNESS, 0, wx + WALL_THICKNESS + WALL_H, 0);
          sideGrad.addColorStop(0, "rgba(0,0,0,0.05)");
          sideGrad.addColorStop(1, "rgba(255,255,255,0.08)");
          ctx.fillStyle = sideGrad;
          ctx.fillRect(wx + WALL_THICKNESS, y + s, WALL_H, e - s);
        }
      }

      // Door indicators
      for (const door of doors) {
        const dwx = side === "left" ? x : x + w - WALL_THICKNESS;
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(dwx - (side === "left" ? WALL_H : 0), y + door.offset,
          WALL_THICKNESS + WALL_H, door.width);
        ctx.fillStyle = "rgba(180,140,80,0.08)";
        ctx.fillRect(dwx, y + door.offset + 2, WALL_THICKNESS, door.width - 4);
      }
    }
  }

  // ── Wall corner accents ──────────────────────────────────────────────────
  ctx.fillStyle = room.wallColor;
  // Small squares at corners to clean up joins
  ctx.fillRect(x - WALL_H, y - WALL_H, WALL_H + WALL_THICKNESS, WALL_H + WALL_THICKNESS);
  ctx.fillRect(x + w - WALL_THICKNESS, y - WALL_H, WALL_H + WALL_THICKNESS, WALL_H + WALL_THICKNESS);
  ctx.fillRect(x - WALL_H, y + h - WALL_THICKNESS, WALL_H + WALL_THICKNESS, WALL_H + WALL_THICKNESS);
  ctx.fillRect(x + w - WALL_THICKNESS, y + h - WALL_THICKNESS, WALL_H + WALL_THICKNESS, WALL_H + WALL_THICKNESS);

  // Room label is drawn later as overlay (see drawRoomLabels)
}

// ── Furniture drawing ─────────────────────────────────────────────────────────

function drawFurniture(ctx: CanvasRenderingContext2D, f: Furniture) {
  // Furniture sprites disabled — programmatic rendering looks better at
  // current scale. Sprites will be used when full tile-based layout is ready.
  switch (f.type) {
    case "desk": {
      // Wood surface with slight 3D
      const deskTop = 2;
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(f.x + 2, f.y + 2, f.w, f.h);
      // Main surface
      roundRect(ctx, f.x, f.y + deskTop, f.w, f.h - deskTop, 3);
      ctx.fillStyle = "#3a3025";
      ctx.fill();
      // Top edge highlight
      roundRect(ctx, f.x, f.y, f.w, deskTop + 2, 3);
      ctx.fillStyle = "#4a4035";
      ctx.fill();
      // Surface shine
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(f.x + 4, f.y + 3, f.w - 8, f.h / 2 - 2);
      // Edge line
      ctx.strokeStyle = "#2a2018";
      ctx.lineWidth = 0.5;
      roundRect(ctx, f.x, f.y, f.w, f.h, 3);
      ctx.stroke();
      // Wood grain lines
      ctx.strokeStyle = "rgba(255,255,255,0.025)";
      ctx.lineWidth = 0.3;
      for (let gy = f.y + 4; gy < f.y + f.h - 2; gy += 3) {
        ctx.beginPath();
        ctx.moveTo(f.x + 2, gy);
        ctx.lineTo(f.x + f.w - 2, gy);
        ctx.stroke();
      }
      break;
    }
    case "chair": {
      const cx = f.x + f.w / 2;
      const cy = f.y + f.h / 2;
      const r = f.w / 2;
      // Wheels (5 small circles)
      ctx.fillStyle = "#222228";
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * (r + 2), cy + Math.sin(angle) * (r + 2), 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Wheel arms
      ctx.strokeStyle = "#333340";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * (r + 2), cy + Math.sin(angle) * (r + 2));
        ctx.stroke();
      }
      // Seat
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#333340";
      ctx.fill();
      // Seat highlight
      ctx.beginPath();
      ctx.arc(cx - 1, cy - 1, r * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      // Backrest (top-down view - arc at top)
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.4, r * 0.8, Math.PI * 1.2, Math.PI * 1.8);
      ctx.strokeStyle = "#44445a";
      ctx.lineWidth = 3;
      ctx.stroke();
      // Seat edge
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "#44445a";
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case "monitor": {
      const variant = f.variant ?? 0;
      // Make monitors visually taller — render at 1.6x height for visibility
      const renderH = Math.max(f.h, 18);
      const renderY = f.y - (renderH - f.h);

      // Screen glow (subtle backlight)
      const glowColors = [
        "rgba(59,130,246,0.15)",
        "rgba(168,85,247,0.15)",
        "rgba(16,185,129,0.15)",
      ];
      ctx.save();
      ctx.shadowColor = glowColors[variant % glowColors.length];
      ctx.shadowBlur = 8;

      // Stand base
      ctx.fillStyle = "#222230";
      const baseW = Math.max(f.w * 0.4, 10);
      roundRect(ctx, f.x + f.w / 2 - baseW / 2, renderY + renderH, baseW, 3, 1);
      ctx.fill();
      // Stand neck
      ctx.fillRect(f.x + f.w / 2 - 1.5, renderY + renderH - 2, 3, 5);

      // Screen bezel (darker, thicker frame)
      roundRect(ctx, f.x - 1, renderY - 1, f.w + 2, renderH + 1, 3);
      ctx.fillStyle = "#0a0a14";
      ctx.fill();
      ctx.restore();

      // Screen content (brighter, more visible)
      const screenPad = 2;
      const screenColors = [
        ["rgba(59,130,246,0.55)", "rgba(16,185,129,0.35)"],
        ["rgba(168,85,247,0.55)", "rgba(236,72,153,0.35)"],
        ["rgba(34,197,94,0.50)",  "rgba(59,130,246,0.35)"],
      ];
      const [c1, c2] = screenColors[variant % screenColors.length];
      const grad = ctx.createLinearGradient(f.x, renderY, f.x + f.w, renderY + renderH);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      roundRect(ctx, f.x + screenPad, renderY + screenPad, f.w - screenPad * 2, renderH - screenPad * 2 - 1, 1);
      ctx.fillStyle = grad;
      ctx.fill();

      // Screen content lines (brighter fake text/code)
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      const lineCount = Math.floor((renderH - 8) / 3);
      for (let i = 0; i < lineCount; i++) {
        const lineW = (f.w - 10) * (0.3 + seededRandom(f.x + i * 7) * 0.6);
        ctx.fillRect(f.x + 5, renderY + 4 + i * 3, lineW, 1.2);
      }

      // Bezel border
      roundRect(ctx, f.x - 1, renderY - 1, f.w + 2, renderH + 1, 3);
      ctx.strokeStyle = "#333344";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Power LED
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2, renderY + renderH - 2, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = "#22c55e";
      ctx.fill();
      break;
    }
    case "whiteboard": {
      // Frame
      roundRect(ctx, f.x - 2, f.y - 2, f.w + 4, f.h + 4, 2);
      ctx.fillStyle = "#888880";
      ctx.fill();
      // Surface
      roundRect(ctx, f.x, f.y, f.w, f.h, 1);
      ctx.fillStyle = "#ececda";
      ctx.fill();
      // Surface shine
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(f.x + 2, f.y + 1, f.w * 0.6, f.h * 0.4);
      // Writing lines (colored markers)
      const markerColors = ["rgba(59,130,246,0.5)", "rgba(239,68,68,0.4)", "rgba(34,197,94,0.4)", "rgba(168,85,247,0.4)"];
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = markerColors[i];
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        const startX = f.x + 6 + seededRandom(f.x + i * 3) * 10;
        const lineLen = f.w * (0.3 + seededRandom(f.y + i * 5) * 0.5);
        ctx.moveTo(startX, f.y + 2 + i * 3);
        ctx.lineTo(startX + lineLen, f.y + 2 + i * 3);
        ctx.stroke();
      }
      // Marker tray at bottom
      ctx.fillStyle = "#777770";
      ctx.fillRect(f.x + f.w * 0.3, f.y + f.h + 1, f.w * 0.4, 2);
      // Markers on tray
      const trayColors = ["#e53e3e", "#3182ce", "#38a169"];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = trayColors[i];
        ctx.fillRect(f.x + f.w * 0.35 + i * 8, f.y + f.h + 1, 5, 2);
      }
      break;
    }
    case "plant": {
      // Pot
      ctx.fillStyle = "#8B4513";
      roundRect(ctx, f.x + 2, f.y + f.h * 0.55, f.w - 4, f.h * 0.45, 2);
      ctx.fill();
      // Pot rim
      ctx.fillStyle = "#a0522d";
      ctx.fillRect(f.x + 1, f.y + f.h * 0.53, f.w - 2, 3);
      // Soil
      ctx.beginPath();
      ctx.ellipse(f.x + f.w / 2, f.y + f.h * 0.58, f.w / 2 - 3, 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#3a2a1a";
      ctx.fill();
      // Main leaf cluster
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2, f.y + f.h * 0.35, f.w * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = "#228B22";
      ctx.fill();
      // Accent leaves
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2 - 3, f.y + f.h * 0.25, f.w * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "#2eaa2e";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2 + 2, f.y + f.h * 0.3, f.w * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = "#1d8a1d";
      ctx.fill();
      // Highlight
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2 - 2, f.y + f.h * 0.28, f.w * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fill();
      break;
    }
    case "plant-big": {
      // Large pot
      ctx.fillStyle = "#7a3a10";
      roundRect(ctx, f.x + 1, f.y + f.h * 0.5, f.w - 2, f.h * 0.5, 3);
      ctx.fill();
      // Pot rim
      ctx.fillStyle = "#8a4a20";
      ctx.fillRect(f.x, f.y + f.h * 0.48, f.w, 4);
      // Soil
      ctx.beginPath();
      ctx.ellipse(f.x + f.w / 2, f.y + f.h * 0.54, f.w / 2 - 2, 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#3a2a1a";
      ctx.fill();
      // Multiple leaf clusters
      const leaves = [
        { dx: 0, dy: -0.1, r: 0.5 },
        { dx: -0.2, dy: -0.2, r: 0.35 },
        { dx: 0.2, dy: -0.15, r: 0.38 },
        { dx: -0.1, dy: -0.3, r: 0.3 },
        { dx: 0.1, dy: -0.35, r: 0.28 },
        { dx: 0, dy: -0.4, r: 0.25 },
      ];
      const greens = ["#1a7a1a", "#228B22", "#2eaa2e", "#1d8a1d", "#34b534", "#268a26"];
      for (let i = 0; i < leaves.length; i++) {
        const l = leaves[i];
        ctx.beginPath();
        ctx.arc(f.x + f.w / 2 + l.dx * f.w, f.y + f.h * (0.5 + l.dy), f.w * l.r, 0, Math.PI * 2);
        ctx.fillStyle = greens[i % greens.length];
        ctx.fill();
      }
      // Highlight
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2 - 3, f.y + f.h * 0.2, f.w * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fill();
      break;
    }
    case "coffee-machine": {
      // Body
      roundRect(ctx, f.x, f.y, f.w, f.h, 3);
      ctx.fillStyle = "#2a2a2a";
      ctx.fill();
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // Top hopper
      roundRect(ctx, f.x + 3, f.y + 2, f.w - 6, f.h * 0.25, 2);
      ctx.fillStyle = "#3a3a3a";
      ctx.fill();
      // Display screen
      roundRect(ctx, f.x + 4, f.y + f.h * 0.3, f.w - 8, f.h * 0.15, 1);
      ctx.fillStyle = "#1a4a2a";
      ctx.fill();
      // Buttons
      ctx.fillStyle = "#666";
      ctx.beginPath();
      ctx.arc(f.x + f.w * 0.3, f.y + f.h * 0.55, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(f.x + f.w * 0.6, f.y + f.h * 0.55, 2, 0, Math.PI * 2);
      ctx.fill();
      // Drip area
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(f.x + 4, f.y + f.h * 0.65, f.w - 8, f.h * 0.25);
      // Cup
      roundRect(ctx, f.x + f.w / 2 - 4, f.y + f.h * 0.7, 8, 7, 1);
      ctx.fillStyle = "#e8e8e8";
      ctx.fill();
      // Coffee inside cup
      ctx.fillStyle = "#4a2a0a";
      ctx.fillRect(f.x + f.w / 2 - 3, f.y + f.h * 0.72, 6, 3);
      break;
    }
    case "couch": {
      const couchColor = f.color ?? "#3b3b5c";
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      roundRect(ctx, f.x + 2, f.y + 2, f.w, f.h, 6);
      ctx.fill();
      // Base
      roundRect(ctx, f.x, f.y, f.w, f.h, 6);
      ctx.fillStyle = couchColor;
      ctx.fill();
      // Armrests
      const armW = f.w * 0.1;
      roundRect(ctx, f.x, f.y, armW, f.h, 4);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fill();
      roundRect(ctx, f.x + f.w - armW, f.y, armW, f.h, 4);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fill();
      // Cushion dividers
      const cushions = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 0.8;
      for (let i = 1; i < cushions; i++) {
        const cx = f.x + armW + (f.w - armW * 2) * (i / cushions);
        ctx.beginPath();
        ctx.moveTo(cx, f.y + 3);
        ctx.lineTo(cx, f.y + f.h - 3);
        ctx.stroke();
      }
      // Cushion highlights
      for (let i = 0; i < cushions; i++) {
        const cx = f.x + armW + (f.w - armW * 2) * (i / cushions) + 3;
        const cw = (f.w - armW * 2) / cushions - 6;
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        roundRect(ctx, cx, f.y + 4, cw, f.h * 0.4, 3);
        ctx.fill();
      }
      // Outline
      roundRect(ctx, f.x, f.y, f.w, f.h, 6);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case "tv": {
      const variant = f.variant ?? 0;
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(f.x + 1, f.y + 1, f.w, f.h);
      // Thin bezel
      roundRect(ctx, f.x, f.y, f.w, f.h, 2);
      ctx.fillStyle = "#0a0a12";
      ctx.fill();
      // Screen with gradient content
      const screenX = f.x + 1;
      const screenY = f.y + 1;
      const screenW = f.w - 2;
      const screenH = f.h - 2;
      const gradSets = [
        ["rgba(59,130,246,0.18)", "rgba(16,185,129,0.12)", "rgba(99,102,241,0.15)"],
        ["rgba(236,72,153,0.15)", "rgba(168,85,247,0.12)", "rgba(59,130,246,0.1)"],
        ["rgba(245,158,11,0.15)", "rgba(239,68,68,0.1)", "rgba(34,197,94,0.12)"],
      ];
      const gset = gradSets[variant % gradSets.length];
      const grad = ctx.createLinearGradient(screenX, screenY, screenX + screenW, screenY + screenH);
      grad.addColorStop(0, gset[0]);
      grad.addColorStop(0.5, gset[1]);
      grad.addColorStop(1, gset[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(screenX, screenY, screenW, screenH);
      // Scanlines effect
      ctx.fillStyle = "rgba(0,0,0,0.04)";
      for (let sy = screenY; sy < screenY + screenH; sy += 2) {
        ctx.fillRect(screenX, sy, screenW, 1);
      }
      // Screen glow
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fillRect(screenX, screenY, screenW, screenH / 2);
      // Bezel stroke
      roundRect(ctx, f.x, f.y, f.w, f.h, 2);
      ctx.strokeStyle = "#222230";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      break;
    }
    case "server-rack": {
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      roundRect(ctx, f.x + 1, f.y + 1, f.w, f.h, 2);
      ctx.fill();
      // Main body
      roundRect(ctx, f.x, f.y, f.w, f.h, 2);
      ctx.fillStyle = "#16161e";
      ctx.fill();
      ctx.strokeStyle = "#2a2a38";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Front panel sections
      const sections = Math.floor(f.h / 12);
      for (let i = 0; i < sections; i++) {
        const sy = f.y + 4 + i * 12;
        // Section divider
        ctx.fillStyle = "#1e1e28";
        ctx.fillRect(f.x + 3, sy, f.w - 6, 10);
        ctx.strokeStyle = "#2a2a38";
        ctx.lineWidth = 0.3;
        ctx.strokeRect(f.x + 3, sy, f.w - 6, 10);
        // LED indicators (blinking effect via seed)
        const ledColors = ["#22c55e", "#3b82f6", "#22c55e", "#f59e0b"];
        for (let j = 0; j < 3; j++) {
          const ledOn = seededRandom(f.x * 7 + f.y * 13 + i * 3 + j) > 0.3;
          ctx.beginPath();
          ctx.arc(f.x + 8 + j * 5, sy + 5, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = ledOn ? ledColors[(i + j) % ledColors.length] : "#333";
          ctx.fill();
        }
        // Vent lines on right side
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 0.3;
        for (let v = 0; v < 4; v++) {
          ctx.beginPath();
          ctx.moveTo(f.x + f.w - 10 + v * 2, sy + 2);
          ctx.lineTo(f.x + f.w - 10 + v * 2, sy + 8);
          ctx.stroke();
        }
      }
      break;
    }
    case "bookshelf": {
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      roundRect(ctx, f.x + 1, f.y + 1, f.w, f.h, 2);
      ctx.fill();
      // Shelf body
      roundRect(ctx, f.x, f.y, f.w, f.h, 2);
      ctx.fillStyle = "#3a2a1a";
      ctx.fill();
      ctx.strokeStyle = "#2a1a0a";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // Shelf dividers
      const shelfRows = Math.max(1, Math.floor(f.h / 10));
      for (let r = 1; r < shelfRows; r++) {
        const sy = f.y + (f.h / shelfRows) * r;
        ctx.fillStyle = "#4a3a2a";
        ctx.fillRect(f.x + 1, sy - 1, f.w - 2, 2);
      }
      // Books
      const bookColors = ["#c53030", "#2b6cb0", "#38a169", "#d69e2e", "#805ad5", "#e53e3e", "#2d9e5c", "#b7791f", "#667eea"];
      const bookW = Math.min(5, (f.w - 6) / 8);
      for (let r = 0; r < shelfRows; r++) {
        const rowY = f.y + (f.h / shelfRows) * r + 2;
        const rowH = f.h / shelfRows - 4;
        let bx = f.x + 3;
        const maxBx = f.x + f.w - 3;
        let bi = 0;
        while (bx + bookW < maxBx) {
          const bw = bookW + seededRandom(f.x + r * 11 + bi * 7) * 2;
          ctx.fillStyle = bookColors[(r * 5 + bi) % bookColors.length];
          ctx.fillRect(bx, rowY, bw, rowH);
          // Book spine highlight
          ctx.fillStyle = "rgba(255,255,255,0.1)";
          ctx.fillRect(bx, rowY, 0.8, rowH);
          bx += bw + 1;
          bi++;
        }
      }
      break;
    }
    case "painting": {
      const variant = f.variant ?? 0;
      // Frame
      roundRect(ctx, f.x - 3, f.y - 3, f.w + 6, f.h + 6, 2);
      ctx.fillStyle = "#5a4530";
      ctx.fill();
      // Inner frame
      roundRect(ctx, f.x - 1, f.y - 1, f.w + 2, f.h + 2, 1);
      ctx.fillStyle = "#6a5540";
      ctx.fill();
      // Canvas
      ctx.fillStyle = "#f0e8d8";
      ctx.fillRect(f.x, f.y, f.w, f.h);
      // Abstract art based on variant
      if (variant === 0) {
        // Geometric abstract
        ctx.fillStyle = "rgba(59,130,246,0.4)";
        ctx.fillRect(f.x + 4, f.y + 4, f.w * 0.4, f.h * 0.5);
        ctx.fillStyle = "rgba(239,68,68,0.35)";
        ctx.beginPath();
        ctx.arc(f.x + f.w * 0.65, f.y + f.h * 0.4, f.w * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(34,197,94,0.3)";
        ctx.fillRect(f.x + f.w * 0.3, f.y + f.h * 0.55, f.w * 0.5, f.h * 0.35);
      } else {
        // Landscape abstract
        ctx.fillStyle = "rgba(135,206,235,0.4)";
        ctx.fillRect(f.x, f.y, f.w, f.h * 0.5);
        ctx.fillStyle = "rgba(34,139,34,0.35)";
        ctx.fillRect(f.x, f.y + f.h * 0.45, f.w, f.h * 0.3);
        ctx.fillStyle = "rgba(210,180,140,0.3)";
        ctx.fillRect(f.x, f.y + f.h * 0.7, f.w, f.h * 0.3);
        // Sun
        ctx.beginPath();
        ctx.arc(f.x + f.w * 0.8, f.y + f.h * 0.2, 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,200,50,0.5)";
        ctx.fill();
      }
      // Frame highlight
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 0.5;
      roundRect(ctx, f.x - 3, f.y - 3, f.w + 6, f.h + 6, 2);
      ctx.stroke();
      break;
    }
    case "rug": {
      const rugColor = f.color ?? "#3a2a4a";
      // Main rug body
      roundRect(ctx, f.x, f.y, f.w, f.h, 4);
      ctx.fillStyle = rugColor;
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
      // Border pattern
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      roundRect(ctx, f.x + 4, f.y + 4, f.w - 8, f.h - 8, 3);
      ctx.stroke();
      // Inner pattern (diamond shapes)
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 0.5;
      const centerX = f.x + f.w / 2;
      const centerY = f.y + f.h / 2;
      for (let s = 1; s <= 3; s++) {
        const dw = s * (f.w * 0.12);
        const dh = s * (f.h * 0.15);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - dh);
        ctx.lineTo(centerX + dw, centerY);
        ctx.lineTo(centerX, centerY + dh);
        ctx.lineTo(centerX - dw, centerY);
        ctx.closePath();
        ctx.stroke();
      }
      // Fringe edges (top and bottom)
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 0.4;
      for (let fx = f.x + 2; fx < f.x + f.w - 2; fx += 3) {
        // Top fringe
        ctx.beginPath();
        ctx.moveTo(fx, f.y);
        ctx.lineTo(fx, f.y - 3);
        ctx.stroke();
        // Bottom fringe
        ctx.beginPath();
        ctx.moveTo(fx, f.y + f.h);
        ctx.lineTo(fx, f.y + f.h + 3);
        ctx.stroke();
      }
      break;
    }
    case "lamp": {
      // Glow (drawn first, behind)
      const glowGrad = ctx.createRadialGradient(
        f.x + f.w / 2, f.y + f.h * 0.3, 0,
        f.x + f.w / 2, f.y + f.h * 0.3, f.w * 1.5
      );
      glowGrad.addColorStop(0, "rgba(255,220,130,0.08)");
      glowGrad.addColorStop(1, "rgba(255,220,130,0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(f.x - f.w, f.y - f.h * 0.3, f.w * 3, f.h * 1.5);
      // Base
      ctx.fillStyle = "#555";
      roundRect(ctx, f.x + f.w / 2 - 4, f.y + f.h - 4, 8, 4, 1);
      ctx.fill();
      // Stem
      ctx.fillStyle = "#888";
      ctx.fillRect(f.x + f.w / 2 - 1, f.y + f.h * 0.35, 2, f.h * 0.65);
      // Shade
      ctx.beginPath();
      ctx.moveTo(f.x, f.y + f.h * 0.4);
      ctx.lineTo(f.x + f.w, f.y + f.h * 0.4);
      ctx.lineTo(f.x + f.w * 0.75, f.y);
      ctx.lineTo(f.x + f.w * 0.25, f.y);
      ctx.closePath();
      ctx.fillStyle = "#c8a860";
      ctx.fill();
      // Shade highlight
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.moveTo(f.x + f.w * 0.3, f.y + f.h * 0.38);
      ctx.lineTo(f.x + f.w * 0.6, f.y + f.h * 0.38);
      ctx.lineTo(f.x + f.w * 0.55, f.y + 3);
      ctx.lineTo(f.x + f.w * 0.35, f.y + 3);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "printer": {
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      roundRect(ctx, f.x + 1, f.y + 1, f.w, f.h, 3);
      ctx.fill();
      // Main body
      roundRect(ctx, f.x, f.y, f.w, f.h, 3);
      ctx.fillStyle = "#d0d0d0";
      ctx.fill();
      ctx.strokeStyle = "#aaa";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      // Top panel (darker)
      roundRect(ctx, f.x + 2, f.y + 2, f.w - 4, f.h * 0.3, 2);
      ctx.fillStyle = "#bbb";
      ctx.fill();
      // Paper input slot (back)
      ctx.fillStyle = "#fff";
      ctx.fillRect(f.x + f.w * 0.2, f.y + 1, f.w * 0.6, 3);
      // Paper output tray (front)
      ctx.fillStyle = "#e8e8e8";
      ctx.fillRect(f.x + f.w * 0.15, f.y + f.h - 4, f.w * 0.7, 4);
      // Paper sticking out
      ctx.fillStyle = "#fff";
      ctx.fillRect(f.x + f.w * 0.25, f.y + f.h - 2, f.w * 0.5, 3);
      // Status LED
      ctx.beginPath();
      ctx.arc(f.x + f.w - 6, f.y + f.h * 0.5, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "#22c55e";
      ctx.fill();
      // Control panel
      ctx.fillStyle = "#333";
      roundRect(ctx, f.x + 4, f.y + f.h * 0.4, f.w * 0.4, f.h * 0.25, 1);
      ctx.fill();
      break;
    }
    case "water-cooler": {
      // Water bottle on top
      ctx.fillStyle = "rgba(100,180,255,0.3)";
      roundRect(ctx, f.x + f.w * 0.2, f.y, f.w * 0.6, f.h * 0.4, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(150,200,255,0.3)";
      ctx.lineWidth = 0.5;
      roundRect(ctx, f.x + f.w * 0.2, f.y, f.w * 0.6, f.h * 0.4, 3);
      ctx.stroke();
      // Bottle neck
      ctx.fillStyle = "rgba(100,180,255,0.25)";
      ctx.fillRect(f.x + f.w * 0.35, f.y + f.h * 0.35, f.w * 0.3, f.h * 0.1);
      // Body
      roundRect(ctx, f.x + f.w * 0.1, f.y + f.h * 0.4, f.w * 0.8, f.h * 0.55, 3);
      ctx.fillStyle = "#e0e0e0";
      ctx.fill();
      ctx.strokeStyle = "#ccc";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      // Tap area
      ctx.fillStyle = "#888";
      ctx.fillRect(f.x + f.w * 0.6, f.y + f.h * 0.5, f.w * 0.15, f.h * 0.15);
      // Blue tap
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.arc(f.x + f.w * 0.65, f.y + f.h * 0.55, 2, 0, Math.PI * 2);
      ctx.fill();
      // Red tap
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(f.x + f.w * 0.65, f.y + f.h * 0.62, 2, 0, Math.PI * 2);
      ctx.fill();
      // Base
      ctx.fillStyle = "#ccc";
      ctx.fillRect(f.x + f.w * 0.05, f.y + f.h * 0.9, f.w * 0.9, f.h * 0.1);
      break;
    }
    case "bean-bag": {
      const bbColor = f.color ?? "#6366f1";
      // Shadow
      ctx.beginPath();
      ctx.ellipse(f.x + f.w / 2 + 1, f.y + f.h / 2 + 2, f.w / 2, f.h / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fill();
      // Main squishy shape (slightly asymmetric)
      ctx.beginPath();
      ctx.ellipse(f.x + f.w / 2, f.y + f.h / 2, f.w / 2, f.h / 2 - 1, 0, 0, Math.PI * 2);
      ctx.fillStyle = bbColor;
      ctx.fill();
      // Wrinkle lines
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2, f.y + f.h / 2, f.w * 0.3, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      // Highlight
      ctx.beginPath();
      ctx.ellipse(f.x + f.w * 0.4, f.y + f.h * 0.35, f.w * 0.2, f.h * 0.15, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fill();
      break;
    }
    case "trash-can": {
      // Shadow
      ctx.beginPath();
      ctx.ellipse(f.x + f.w / 2 + 1, f.y + f.h + 1, f.w / 2, 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fill();
      // Body (tapered cylinder - top view shows as slightly tapered rect)
      ctx.fillStyle = "#555";
      ctx.beginPath();
      ctx.moveTo(f.x + 1, f.y + 3);
      ctx.lineTo(f.x + f.w - 1, f.y + 3);
      ctx.lineTo(f.x + f.w - 2, f.y + f.h);
      ctx.lineTo(f.x + 2, f.y + f.h);
      ctx.closePath();
      ctx.fill();
      // Rim
      ctx.beginPath();
      ctx.ellipse(f.x + f.w / 2, f.y + 3, f.w / 2, 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#666";
      ctx.fill();
      ctx.strokeStyle = "#777";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      // Vertical ridges
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 0.4;
      for (let rx = f.x + 3; rx < f.x + f.w - 2; rx += 3) {
        ctx.beginPath();
        ctx.moveTo(rx, f.y + 5);
        ctx.lineTo(rx, f.y + f.h - 1);
        ctx.stroke();
      }
      break;
    }
    case "aquarium": {
      // Glass body
      roundRect(ctx, f.x, f.y, f.w, f.h, 3);
      ctx.fillStyle = "rgba(30,100,180,0.3)";
      ctx.fill();
      ctx.strokeStyle = "rgba(150,200,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Water
      ctx.fillStyle = "rgba(40,130,220,0.15)";
      ctx.fillRect(f.x + 2, f.y + 3, f.w - 4, f.h - 5);
      // Sand bottom
      ctx.fillStyle = "rgba(210,180,120,0.25)";
      ctx.fillRect(f.x + 2, f.y + f.h - 5, f.w - 4, 3);
      // Small plants
      ctx.fillStyle = "rgba(34,180,34,0.4)";
      ctx.fillRect(f.x + 6, f.y + f.h - 10, 2, 7);
      ctx.fillRect(f.x + 10, f.y + f.h - 12, 2, 9);
      ctx.fillRect(f.x + f.w - 10, f.y + f.h - 9, 2, 6);
      // Fish shapes (tiny triangles)
      const fishColors = ["rgba(255,100,50,0.5)", "rgba(255,200,50,0.4)", "rgba(100,200,255,0.5)"];
      for (let fi = 0; fi < 3; fi++) {
        const fx = f.x + 8 + seededRandom(f.x + fi * 13) * (f.w - 16);
        const fy = f.y + 6 + seededRandom(f.y + fi * 17) * (f.h - 16);
        ctx.fillStyle = fishColors[fi % fishColors.length];
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + 4, fy + 1.5);
        ctx.lineTo(fx, fy + 3);
        ctx.closePath();
        ctx.fill();
        // Tail
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx - 2, fy - 1);
        ctx.lineTo(fx - 2, fy + 4);
        ctx.lineTo(fx, fy + 3);
        ctx.closePath();
        ctx.fill();
      }
      // Water surface highlight
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(f.x + 3, f.y + 3, f.w - 6, 2);
      // Light reflection on glass
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(f.x + 1, f.y + 2, 2, f.h - 4);
      break;
    }
    case "coffee-table": {
      // Shadow
      ctx.beginPath();
      ctx.ellipse(f.x + f.w / 2 + 1, f.y + f.h / 2 + 2, f.w / 2 + 1, f.h / 2 + 1, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fill();
      // Table top (oval/rounded)
      roundRect(ctx, f.x, f.y, f.w, f.h, f.h / 2);
      ctx.fillStyle = "#4a3a28";
      ctx.fill();
      // Surface highlight
      roundRect(ctx, f.x + 3, f.y + 2, f.w - 6, f.h / 2, (f.h - 4) / 2);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      // Edge
      roundRect(ctx, f.x, f.y, f.w, f.h, f.h / 2);
      ctx.strokeStyle = "#3a2a18";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      break;
    }
    case "clock": {
      const cx = f.x + f.w / 2;
      const cy = f.y + f.h / 2;
      const cr = Math.min(f.w, f.h) / 2;
      // Face
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fillStyle = "#e8e8e0";
      ctx.fill();
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Hour markers
      ctx.fillStyle = "#333";
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * (cr - 2), cy + Math.sin(angle) * (cr - 2), 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // Hour hand
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(-Math.PI * 0.3) * (cr * 0.5), cy + Math.sin(-Math.PI * 0.3) * (cr * 0.5));
      ctx.stroke();
      // Minute hand
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(Math.PI * 0.2) * (cr * 0.7), cy + Math.sin(Math.PI * 0.2) * (cr * 0.7));
      ctx.stroke();
      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 1, 0, Math.PI * 2);
      ctx.fillStyle = "#333";
      ctx.fill();
      break;
    }
    case "filing-cabinet": {
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      roundRect(ctx, f.x + 1, f.y + 1, f.w, f.h, 2);
      ctx.fill();
      // Body
      roundRect(ctx, f.x, f.y, f.w, f.h, 2);
      ctx.fillStyle = "#555560";
      ctx.fill();
      ctx.strokeStyle = "#444450";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // Drawers
      const drawers = Math.max(2, Math.floor(f.h / 12));
      const drawerH = (f.h - 4) / drawers;
      for (let d = 0; d < drawers; d++) {
        const dy = f.y + 2 + d * drawerH;
        // Drawer face
        ctx.fillStyle = "#606068";
        ctx.fillRect(f.x + 2, dy, f.w - 4, drawerH - 2);
        // Drawer line
        ctx.strokeStyle = "#4a4a52";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(f.x + 2, dy, f.w - 4, drawerH - 2);
        // Handle
        ctx.fillStyle = "#888";
        ctx.fillRect(f.x + f.w / 2 - 3, dy + drawerH / 2 - 1, 6, 2);
      }
      break;
    }
    case "potted-tree": {
      // Large pot
      ctx.fillStyle = "#6a3010";
      roundRect(ctx, f.x + 2, f.y + f.h * 0.6, f.w - 4, f.h * 0.4, 4);
      ctx.fill();
      // Pot rim
      ctx.fillStyle = "#7a4020";
      ctx.fillRect(f.x, f.y + f.h * 0.58, f.w, 4);
      // Soil
      ctx.beginPath();
      ctx.ellipse(f.x + f.w / 2, f.y + f.h * 0.64, f.w / 2 - 3, 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#3a2a1a";
      ctx.fill();
      // Trunk
      ctx.fillStyle = "#5a3a1a";
      ctx.fillRect(f.x + f.w / 2 - 3, f.y + f.h * 0.25, 6, f.h * 0.4);
      // Trunk texture
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 0.5;
      for (let ty = f.y + f.h * 0.28; ty < f.y + f.h * 0.62; ty += 4) {
        ctx.beginPath();
        ctx.moveTo(f.x + f.w / 2 - 3, ty);
        ctx.lineTo(f.x + f.w / 2 + 3, ty);
        ctx.stroke();
      }
      // Canopy (multiple overlapping circles)
      const canopyClusters = [
        { dx: 0, dy: 0, r: 0.4 },
        { dx: -0.25, dy: 0.05, r: 0.3 },
        { dx: 0.25, dy: 0.05, r: 0.3 },
        { dx: -0.1, dy: -0.15, r: 0.28 },
        { dx: 0.15, dy: -0.12, r: 0.25 },
        { dx: 0, dy: -0.2, r: 0.2 },
      ];
      const treeGreens = ["#1a6a1a", "#228a22", "#2aa52a", "#1d7a1d", "#34a534", "#268a26"];
      for (let i = 0; i < canopyClusters.length; i++) {
        const c = canopyClusters[i];
        ctx.beginPath();
        ctx.arc(f.x + f.w / 2 + c.dx * f.w, f.y + f.h * 0.22 + c.dy * f.h, f.w * c.r, 0, Math.PI * 2);
        ctx.fillStyle = treeGreens[i];
        ctx.fill();
      }
      // Highlight
      ctx.beginPath();
      ctx.arc(f.x + f.w * 0.4, f.y + f.h * 0.12, f.w * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fill();
      break;
    }
    default: {
      // Fallback: simple colored rect for unknown furniture types
      roundRect(ctx, f.x, f.y, f.w, f.h, 2);
      ctx.fillStyle = f.color ?? "#444";
      ctx.fill();
      break;
    }
  }
}

// ── Hotspot overlay ───────────────────────────────────────────────────────────

function drawHotspot(ctx: CanvasRenderingContext2D, hs: Hotspot, isHovered: boolean) {
  if (!isHovered) return; // Only show on hover

  // Glow effect
  ctx.save();
  ctx.shadowColor = "rgba(99,102,241,0.7)";
  ctx.shadowBlur = 16;
  roundRect(ctx, hs.x - 4, hs.y - 4, hs.w + 8, hs.h + 8, 6);
  ctx.strokeStyle = "rgba(99,102,241,0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Inner glow fill
  roundRect(ctx, hs.x - 2, hs.y - 2, hs.w + 4, hs.h + 4, 4);
  ctx.fillStyle = "rgba(99,102,241,0.08)";
  ctx.fill();

  // Label tooltip above
  const label = `${hs.icon} ${hs.label}`;
  ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
  const tw = ctx.measureText(label).width + 18;
  const tx = hs.x + hs.w / 2 - tw / 2;
  const ty = hs.y - 28;

  // Tooltip shadow
  roundRect(ctx, tx + 1, ty + 1, tw, 20, 5);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();

  // Tooltip body
  roundRect(ctx, tx, ty, tw, 20, 5);
  ctx.fillStyle = "rgba(15,15,30,0.92)";
  ctx.fill();
  ctx.strokeStyle = "rgba(99,102,241,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tooltip arrow
  ctx.beginPath();
  ctx.moveTo(hs.x + hs.w / 2 - 5, ty + 20);
  ctx.lineTo(hs.x + hs.w / 2, ty + 25);
  ctx.lineTo(hs.x + hs.w / 2 + 5, ty + 20);
  ctx.fillStyle = "rgba(15,15,30,0.92)";
  ctx.fill();

  ctx.fillStyle = "#e0e0ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, hs.x + hs.w / 2, ty + 10);
}

// ── Character (bonequinho) drawing ────────────────────────────────────────────

function drawHair(
  ctx: CanvasRenderingContext2D,
  agent: AgentConfig,
  headY: number,
  dir: Direction,
) {
  const style = agent.hairStyle ?? "short";

  ctx.fillStyle = agent.hairColor;

  switch (style) {
    case "short": {
      // Top cap
      ctx.beginPath();
      ctx.ellipse(0, headY - HEAD_R + 2, HEAD_R - 0.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Side hair (thin)
      ctx.beginPath();
      ctx.arc(0, headY, HEAD_R + 0.5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.lineTo(HEAD_R * 0.7, headY - HEAD_R * 0.4);
      ctx.fill();
      break;
    }
    case "medium": {
      // Fuller top
      ctx.beginPath();
      ctx.ellipse(0, headY - HEAD_R + 2, HEAD_R + 1, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Side coverage
      ctx.beginPath();
      ctx.arc(0, headY, HEAD_R + 1.5, Math.PI * 1.0, Math.PI * 2.0);
      ctx.fill();
      // Slight fringe
      if (dir === "down" || dir === "left") {
        ctx.fillRect(-HEAD_R, headY - HEAD_R + 1, HEAD_R * 0.6, 5);
      }
      break;
    }
    case "long": {
      // Full top
      ctx.beginPath();
      ctx.ellipse(0, headY - HEAD_R + 2, HEAD_R + 1, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Side coverage going down past head
      ctx.beginPath();
      ctx.arc(0, headY, HEAD_R + 1.5, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();
      // Long strands going down on sides
      roundRect(ctx, -HEAD_R - 2, headY - 2, 4, HEAD_R + 8, 1);
      ctx.fill();
      roundRect(ctx, HEAD_R - 2, headY - 2, 4, HEAD_R + 8, 1);
      ctx.fill();
      // Back hair
      if (dir === "up") {
        roundRect(ctx, -HEAD_R + 1, headY + 2, HEAD_R * 2 - 2, 10, 2);
        ctx.fill();
      }
      break;
    }
    case "curly": {
      // Bigger, rounder hair with multiple bumps
      const bumps = 8;
      for (let i = 0; i < bumps; i++) {
        const angle = (Math.PI * 2 * i) / bumps;
        const bx = Math.cos(angle) * (HEAD_R + 2);
        const by = Math.sin(angle) * (HEAD_R + 2) + headY - 2;
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Central mass
      ctx.beginPath();
      ctx.arc(0, headY - 2, HEAD_R + 1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  agent: AgentConfig,
  anim: AgentAnimState,
  state: RenderState
) {
  const isHovered = state.hoveredEntity === agent.id;
  const isSelected = state.selectedEntity === agent.id;
  const statusData = state.agentStatuses.get(agent.name.toLowerCase());
  const dispatchData = state.agentDispatches.get(agent.name.toLowerCase());
  const status = statusData?.status ?? "idle";

  const x = anim.x;
  const y = anim.y;
  const bob = anim.walking ? 0 : Math.sin(state.time / 800 + x) * 1.2;
  const dir = anim.direction;

  // Scale up slightly on hover/select
  const scale = isSelected ? 1.15 : isHovered ? 1.08 : 1;

  // ── Spawn fade-in effect ──────────────────────────────────────────────────
  const spawnAlpha = anim.spawnTimer > 0 ? (1 - anim.spawnTimer) : 1;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale, scale);

  // Apply spawn fade
  if (spawnAlpha < 1) {
    ctx.globalAlpha = spawnAlpha;
    // Spawn glow ring
    const spawnGlow = anim.spawnTimer * 0.8;
    const spawnRadius = 20 + anim.spawnTimer * 30;
    ctx.beginPath();
    ctx.arc(0, 0, spawnRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(99,102,241,${spawnGlow * 0.3})`;
    ctx.fill();
  }

  // ── Teleport glow effect (when changing rooms) ────────────────────────────
  if (anim.teleportTimer > 0) {
    const tGlow = anim.teleportTimer;
    const tRadius = 15 + tGlow * 20;
    ctx.beginPath();
    ctx.arc(0, 0, tRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(168,85,247,${tGlow * 0.25})`;
    ctx.fill();
    // Sparkle particles around character
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + state.time / 200;
      const pr = tRadius * (0.6 + tGlow * 0.4);
      const px = Math.cos(angle) * pr;
      const py = Math.sin(angle) * pr;
      ctx.beginPath();
      ctx.arc(px, py, 2 * tGlow, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(196,181,253,${tGlow * 0.6})`;
      ctx.fill();
    }
  }

  // ── Try sprite-based rendering first ────────────────────────────────────────
  const spriteFrames = agentSpriteFrames.get(agent.id);
  if (spriteFrames) {
    // Determine action from activity
    const activity = state.agentActivities.get(agent.id);
    const actState = activity?.state ?? "idle";
    let action: CharAction = "idle";
    if (anim.walking) action = "walk";
    else if (actState === "coding") action = "type";
    else if (actState === "reading") action = "read";
    else if (actState === "thinking") action = "type";

    const frame = getCharacterFrame(spriteFrames, action, dir, anim.walkCycle, state.time);
    if (frame) {
      // Ground shadow
      ctx.beginPath();
      ctx.ellipse(0, CHAR_H / 2 + 4, 14, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fill();

      // Draw sprite centered, scaled up 2x for visibility
      const drawScale = 2;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        frame,
        -CHAR_FRAME_W * drawScale / 2,
        -CHAR_FRAME_H * drawScale / 2 + 4,
        CHAR_FRAME_W * drawScale,
        CHAR_FRAME_H * drawScale
      );
      ctx.imageSmoothingEnabled = true;

      // Selection indicator
      if (isSelected) {
        const selPulse = Math.sin(state.time / 500) * 0.15 + 0.85;
        ctx.beginPath();
        ctx.ellipse(0, CHAR_H / 2 + 4, 20, 8, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(99,102,241,${selPulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (isHovered && !isSelected) {
        ctx.beginPath();
        ctx.ellipse(0, CHAR_H / 2 + 4, 18, 7, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();

      // Skip to nametag (same code path as programmatic)
      // Jump past the programmatic body by going to nametag section
      drawCharacterOverlays(ctx, agent, anim, state, x, y, bob, dir, status, isHovered, isSelected);
      return;
    }
  }

  // ── Fallback: Programmatic body (when sprites not loaded) ──────────────────

  // ── Ground shadow ───────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.ellipse(0, CHAR_H / 2 + 4, 14, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();

  // ── Legs/feet ───────────────────────────────────────────────────────────────
  const legSpread = anim.walking ? Math.sin(anim.walkCycle * Math.PI / 2) * 4 : 0;

  // Left leg
  roundRect(ctx, -6 - (dir === "left" ? 1 : 0), CHAR_H / 2 - 9 + legSpread, 6, 11, 2);
  ctx.fillStyle = agent.pantsColor;
  ctx.fill();

  // Right leg
  roundRect(ctx, 1 + (dir === "right" ? 1 : 0), CHAR_H / 2 - 9 - legSpread, 6, 11, 2);
  ctx.fillStyle = agent.pantsColor;
  ctx.fill();

  // Shoes
  roundRect(ctx, -7, CHAR_H / 2 + legSpread, 7, 5, 1.5);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();
  // Shoe sole highlight
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(-6, CHAR_H / 2 + legSpread + 3, 5, 1);

  roundRect(ctx, 1, CHAR_H / 2 - legSpread, 7, 5, 1.5);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(2, CHAR_H / 2 - legSpread + 3, 5, 1);

  // ── Body (shirt) ──────────────────────────────────────────────────────────
  roundRect(ctx, -CHAR_W / 2, -CHAR_H / 2, CHAR_W, CHAR_H - 6, 4);
  ctx.fillStyle = agent.shirtColor;
  ctx.fill();

  // Body shading
  const bodyGrad = ctx.createLinearGradient(-CHAR_W / 2, -CHAR_H / 2, CHAR_W / 2, CHAR_H / 2);
  bodyGrad.addColorStop(0, "rgba(255,255,255,0.12)");
  bodyGrad.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Collar detail
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-4, -CHAR_H / 2 + 2);
  ctx.lineTo(0, -CHAR_H / 2 + 5);
  ctx.lineTo(4, -CHAR_H / 2 + 2);
  ctx.stroke();

  // ── Arms ──────────────────────────────────────────────────────────────────
  const armSwing = anim.walking ? Math.sin(anim.walkCycle * Math.PI / 2) * 3 : 0;

  // Left arm
  roundRect(ctx, -CHAR_W / 2 - 5, -CHAR_H / 2 + 3 + armSwing, 5, 14, 2);
  ctx.fillStyle = agent.shirtColor;
  ctx.fill();
  // Arm shading
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fill();
  // Hand
  ctx.beginPath();
  ctx.arc(-CHAR_W / 2 - 2.5, -CHAR_H / 2 + 17 + armSwing, 3, 0, Math.PI * 2);
  ctx.fillStyle = agent.skinColor;
  ctx.fill();

  // Right arm
  roundRect(ctx, CHAR_W / 2, -CHAR_H / 2 + 3 - armSwing, 5, 14, 2);
  ctx.fillStyle = agent.shirtColor;
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(CHAR_W / 2 + 2.5, -CHAR_H / 2 + 17 - armSwing, 3, 0, Math.PI * 2);
  ctx.fillStyle = agent.skinColor;
  ctx.fill();

  // ── Head ──────────────────────────────────────────────────────────────────
  const headY = -CHAR_H / 2 - HEAD_R + 2;

  // Neck
  ctx.fillStyle = agent.skinColor;
  ctx.fillRect(-3, -CHAR_H / 2 - 3, 6, 5);

  // Head outline ring (contraste — cor do agente)
  ctx.beginPath();
  ctx.arc(0, headY, HEAD_R + 2, 0, Math.PI * 2);
  ctx.fillStyle = isHovered || isSelected ? agent.shirtColor : "rgba(0,0,0,0.4)";
  ctx.fill();
  if (isHovered) {
    ctx.strokeStyle = agent.shirtColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Head circle
  ctx.beginPath();
  ctx.arc(0, headY, HEAD_R, 0, Math.PI * 2);
  ctx.fillStyle = agent.skinColor;
  ctx.fill();

  // Head shine
  ctx.beginPath();
  ctx.arc(-2, headY - 3, HEAD_R * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();

  // ── Hair (with style) ────────────────────────────────────────────────────
  drawHair(ctx, agent, headY, dir);

  // ── Face ──────────────────────────────────────────────────────────────────
  if (dir === "down" || dir === "left" || dir === "right") {
    const faceOffX = dir === "left" ? -2.5 : dir === "right" ? 2.5 : 0;

    // Eye whites
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-3.5 + faceOffX, headY - 0.5, 2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(3.5 + faceOffX, headY - 0.5, 2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(-3.5 + faceOffX + 0.3, headY - 0.3, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.5 + faceOffX + 0.3, headY - 0.3, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Eye glints
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-3.5 + faceOffX - 0.3, headY - 1, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.5 + faceOffX - 0.3, headY - 1, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrows
    ctx.strokeStyle = agent.hairColor;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-5 + faceOffX, headY - 3);
    ctx.lineTo(-2 + faceOffX, headY - 3.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2 + faceOffX, headY - 3.5);
    ctx.lineTo(5 + faceOffX, headY - 3);
    ctx.stroke();

    // Mouth
    if (isSelected || isHovered) {
      // Smile
      ctx.beginPath();
      ctx.arc(faceOffX, headY + 3.5, 2.5, 0.1, Math.PI - 0.1);
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    } else {
      // Neutral
      ctx.beginPath();
      ctx.moveTo(faceOffX - 2, headY + 3.5);
      ctx.lineTo(faceOffX + 2, headY + 3.5);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Cheek blush (subtle)
    ctx.beginPath();
    ctx.arc(-5 + faceOffX, headY + 1.5, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,150,150,0.08)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5 + faceOffX, headY + 1.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Selection indicator ─────────────────────────────────────────────────────
  if (isSelected) {
    const selPulse = Math.sin(state.time / 500) * 0.15 + 0.85;
    ctx.beginPath();
    ctx.ellipse(0, CHAR_H / 2 + 4, 20, 8, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(99,102,241,${selPulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Hover highlight ─────────────────────────────────────────────────────────
  if (isHovered && !isSelected) {
    ctx.beginPath();
    ctx.ellipse(0, CHAR_H / 2 + 4, 18, 7, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ── Response flash (agent just responded) ───────────────────────────────────
  const flashEnd = state.agentFlash?.get(agent.id);
  const isFlashing = flashEnd && state.time < flashEnd;
  if (isFlashing) {
    const flashProgress = (flashEnd - state.time) / 3000;
    const pulse = Math.sin(state.time / 150) * 0.5 + 0.5;
    // Glow ring
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 26, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(34,197,94,${pulse * flashProgress * 0.8})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // ── Response preview bubble (shows message text) ──────────────────────────
  const unreadText = state.agentUnread?.get(agent.id);
  if (unreadText) {
    const bubbleX = 0;
    const bubbleY = -CHAR_H / 2 - HEAD_R * 2 - 28;
    const floatY = Math.sin(state.time / 600) * 2;

    // Truncate preview
    ctx.font = "8px 'Inter', system-ui, sans-serif";
    let preview = unreadText;
    if (preview.length > 40) preview = preview.slice(0, 37) + "...";
    const textW = ctx.measureText(preview).width;
    const bw = Math.min(Math.max(textW + 16, 50), 140);
    const bh = 22;

    // Bubble background
    ctx.save();
    ctx.shadowColor = "rgba(34,197,94,0.3)";
    ctx.shadowBlur = 8;
    roundRect(ctx, bubbleX - bw / 2, bubbleY + floatY - bh / 2, bw, bh, 6);
    ctx.fillStyle = "rgba(34,197,94,0.9)";
    ctx.fill();
    ctx.restore();

    // Bubble tail
    ctx.beginPath();
    ctx.moveTo(bubbleX - 4, bubbleY + floatY + bh / 2 - 2);
    ctx.lineTo(bubbleX, bubbleY + floatY + bh / 2 + 5);
    ctx.lineTo(bubbleX + 4, bubbleY + floatY + bh / 2 - 2);
    ctx.fillStyle = "rgba(34,197,94,0.9)";
    ctx.fill();

    // Text
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(preview, bubbleX, bubbleY + floatY);
  }

  ctx.globalAlpha = 1;
  ctx.restore();

  // ── Unread badge (persistent dot near nametag — visible from far) ─────────
  if (unreadText && !isFlashing) {
    const badgePulse = Math.sin(state.time / 800) * 0.3 + 0.7;
    ctx.beginPath();
    ctx.arc(x + 20, y + bob - CHAR_H / 2 - HEAD_R, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(34,197,94,${badgePulse})`;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Number "!" inside
    ctx.font = "bold 7px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText("!", x + 20, y + bob - CHAR_H / 2 - HEAD_R);
  }

  // ── Name tag (ALWAYS visible, below character) ──────────────────────────────
  const tagY = y + bob + CHAR_H / 2 + 14;
  const nameStr = agent.name;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Name
  ctx.font = `bold 9px 'Inter', system-ui, sans-serif`;
  const nameW = ctx.measureText(nameStr).width + 14;
  const tagH = isHovered || isSelected ? 26 : 16;
  roundRect(ctx, x - nameW / 2, tagY - 8, nameW, tagH, 5);
  ctx.fillStyle = isSelected
    ? "rgba(99,102,241,0.9)"
    : isHovered
      ? "rgba(0,0,0,0.88)"
      : "rgba(0,0,0,0.55)";
  ctx.fill();

  if (isSelected || isHovered) {
    ctx.strokeStyle = isSelected ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = "#fff";
  ctx.fillText(nameStr, x, tagY);

  // Role (always visible below name on hover/select)
  if (isHovered || isSelected) {
    ctx.font = "7px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(agent.role, x, tagY + 11);
  }

  // ── Status dot (next to nametag) ────────────────────────────────────────────
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
  const dotX = x + ctx.measureText(nameStr).width / 2 + 11;
  const dotY = tagY;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = statusColor;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Active pulse ring
  if (status === "active") {
    const pulse = Math.sin(state.time / 500) * 0.4 + 0.6;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(34,197,94,${pulse * 0.5})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── Activity speech bubble ───────────────────────────────────────────────────
  const activity = state.agentActivities.get(agent.id);
  const activityState = activity?.state ?? "idle";

  if (activityState !== "idle") {
    const bubbleX = x + 18;
    const bubbleY = y + bob - CHAR_H / 2 - HEAD_R * 2 - 22;
    const floatY = Math.sin(state.time / 500) * 1.5;
    const label = activity?.label ?? "";

    // Bubble config by state
    const BUBBLE_STYLES: Record<string, { bg: string; glow: string; icon: string }> = {
      thinking:  { bg: "rgba(168,85,247,0.9)",  glow: "rgba(168,85,247,0.4)", icon: "💭" },
      coding:    { bg: "rgba(59,130,246,0.9)",   glow: "rgba(59,130,246,0.4)", icon: "⌨️" },
      reading:   { bg: "rgba(16,185,129,0.9)",   glow: "rgba(16,185,129,0.4)", icon: "📖" },
      talking:   { bg: "rgba(245,158,11,0.9)",   glow: "rgba(245,158,11,0.4)", icon: "💬" },
      waiting:   { bg: "rgba(107,114,128,0.9)",  glow: "rgba(107,114,128,0.3)", icon: "⏳" },
      done:      { bg: "rgba(34,197,94,0.9)",    glow: "rgba(34,197,94,0.4)",  icon: "✓" },
    };
    const style = BUBBLE_STYLES[activityState] ?? BUBBLE_STYLES.thinking;

    // Measure label to size bubble
    ctx.font = "9px 'Inter', system-ui, sans-serif";
    const labelW = label ? ctx.measureText(label).width : 0;
    const bubbleW = Math.max(24, labelW + 22);
    const bubbleH = label ? 20 : 16;

    ctx.save();
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = 10;

    // Bubble body
    roundRect(ctx, bubbleX - bubbleW / 2, bubbleY + floatY - bubbleH / 2, bubbleW, bubbleH, 7);
    ctx.fillStyle = style.bg;
    ctx.fill();
    ctx.restore();

    // Bubble tail
    ctx.beginPath();
    ctx.moveTo(bubbleX - 5, bubbleY + floatY + bubbleH / 2 - 2);
    ctx.lineTo(bubbleX - 10, bubbleY + floatY + bubbleH / 2 + 5);
    ctx.lineTo(bubbleX - 1, bubbleY + floatY + bubbleH / 2 - 2);
    ctx.fillStyle = style.bg;
    ctx.fill();

    // Icon + label
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (label) {
      ctx.font = "9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(`${style.icon} ${label}`, bubbleX, bubbleY + floatY);
    } else {
      // Icon only with animation
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#fff";
      if (activityState === "thinking" || activityState === "waiting") {
        const dotPhase = Math.floor(state.time / 400) % 4;
        const dots = dotPhase === 3 ? style.icon : ".".repeat(dotPhase + 1);
        ctx.fillText(dots, bubbleX, bubbleY + floatY);
      } else if (activityState === "done") {
        ctx.fillText("✓", bubbleX, bubbleY + floatY);
      } else {
        ctx.fillText(style.icon, bubbleX, bubbleY + floatY);
      }
    }

    // Activity ring on ground
    const ringAlpha = Math.sin(state.time / 350) * 0.25 + 0.4;
    ctx.beginPath();
    ctx.ellipse(x, y + bob + CHAR_H / 2 + 4, 20, 8, 0, 0, Math.PI * 2);
    ctx.strokeStyle = style.bg.replace(/[\d.]+\)$/, `${ringAlpha})`);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ── Accessory icon (contextual item based on activity) ─────────────────────
  if (activityState !== "idle" && !anim.walking) {
    const acc = ACTIVITY_ACCESSORIES[activityState];
    if (acc) {
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const accFloat = Math.sin(state.time / 1200 + x * 0.1) * 1;
      ctx.fillText(acc.emoji, x + acc.offsetX, y + bob + acc.offsetY + accFloat);
    }
  }

  // ── Idle micro-animation (look around) ─────────────────────────────────────
  if (activityState === "idle" && !anim.walking && !isHovered && !isSelected) {
    // Subtle eye movement cycle — eyes shift direction every ~3s
    const lookPhase = Math.floor((state.time + x * 100) / 3000) % 4;
    if (lookPhase === 1 || lookPhase === 3) {
      // Small "looking" indicator — slightly shift pupils (already drawn, this is visual only via head tilt)
      // We add a subtle body sway for idle animation
      // (The bob already handles vertical, this is just a note that the character feels alive)
    }
  }

  // ── Proximity indicator (when João is near this agent) ─────────────────────
  if (state.nearbyAgent === agent.id && agent.id !== "joao") {
    const pulseAlpha = Math.sin(state.time / 400) * 0.2 + 0.5;
    ctx.beginPath();
    ctx.ellipse(x, y + bob + CHAR_H / 2 + 4, 24, 10, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(99,102,241,${pulseAlpha})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // "Press E" tooltip
    ctx.font = "bold 8px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tipY = y + bob - CHAR_H / 2 - HEAD_R * 2 - 8;
    const tipW = 52;
    roundRect(ctx, x - tipW / 2, tipY - 8, tipW, 16, 4);
    ctx.fillStyle = "rgba(99,102,241,0.85)";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText("PRESS E", x, tipY);
  }
}

// ── Character Overlays (shared between sprite and programmatic paths) ────────

function drawCharacterOverlays(
  ctx: CanvasRenderingContext2D,
  agent: AgentConfig,
  anim: AgentAnimState,
  state: RenderState,
  x: number, y: number, bob: number,
  dir: string, status: string,
  isHovered: boolean, isSelected: boolean
) {
  // Name tag
  const tagY = y + bob + CHAR_H / 2 + 14;
  const nameStr = agent.name;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 9px 'Inter', system-ui, sans-serif";
  const nameW = ctx.measureText(nameStr).width + 14;
  const tagH = isHovered || isSelected ? 26 : 16;
  roundRect(ctx, x - nameW / 2, tagY - 8, nameW, tagH, 5);
  ctx.fillStyle = isSelected
    ? "rgba(99,102,241,0.9)"
    : isHovered ? "rgba(0,0,0,0.88)" : "rgba(0,0,0,0.55)";
  ctx.fill();
  if (isSelected || isHovered) {
    ctx.strokeStyle = isSelected ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = "#fff";
  ctx.fillText(nameStr, x, tagY);
  if (isHovered || isSelected) {
    ctx.font = "7px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(agent.role, x, tagY + 11);
  }

  // Status dot
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
  const dotX = x + ctx.measureText(nameStr).width / 2 + 11;
  const dotY = tagY;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = statusColor;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  if (status === "active") {
    const pulse = Math.sin(state.time / 500) * 0.4 + 0.6;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(34,197,94,${pulse * 0.5})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── Response flash ─────────────────────────────────────────────────────────
  const flashEnd = state.agentFlash?.get(agent.id);
  const isFlashing = flashEnd && state.time < flashEnd;
  if (isFlashing) {
    const flashProgress = (flashEnd - state.time) / 5000;
    const pulse = Math.sin(state.time / 150) * 0.5 + 0.5;
    ctx.beginPath();
    ctx.arc(x, y + bob, 26, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(34,197,94,${pulse * flashProgress * 0.8})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // ── Unread response bubble ────────────────────────────────────────────────
  const unreadText = state.agentUnread?.get(agent.id);
  if (unreadText) {
    const bubbleX = x;
    const bubbleY = y + bob - CHAR_H / 2 - HEAD_R * 2 - 28;
    const floatY = Math.sin(state.time / 600) * 2;

    ctx.font = "8px 'Inter', system-ui, sans-serif";
    let preview = unreadText;
    if (preview.length > 40) preview = preview.slice(0, 37) + "...";
    const textW = ctx.measureText(preview).width;
    const bw = Math.min(Math.max(textW + 16, 50), 140);
    const bh = 22;

    ctx.save();
    ctx.shadowColor = "rgba(34,197,94,0.3)";
    ctx.shadowBlur = 8;
    roundRect(ctx, bubbleX - bw / 2, bubbleY + floatY - bh / 2, bw, bh, 6);
    ctx.fillStyle = "rgba(34,197,94,0.9)";
    ctx.fill();
    ctx.restore();

    // Tail
    ctx.beginPath();
    ctx.moveTo(bubbleX - 4, bubbleY + floatY + bh / 2 - 2);
    ctx.lineTo(bubbleX, bubbleY + floatY + bh / 2 + 5);
    ctx.lineTo(bubbleX + 4, bubbleY + floatY + bh / 2 - 2);
    ctx.fillStyle = "rgba(34,197,94,0.9)";
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(preview, bubbleX, bubbleY + floatY);
  }

  // ── Unread badge (persistent "!" dot) ─────────────────────────────────────
  if (unreadText && !isFlashing) {
    const badgePulse = Math.sin(state.time / 800) * 0.3 + 0.7;
    ctx.beginPath();
    ctx.arc(x + 20, y + bob - CHAR_H / 2 - HEAD_R, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(34,197,94,${badgePulse})`;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = "bold 7px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText("!", x + 20, y + bob - CHAR_H / 2 - HEAD_R);
  }

  // ── Proximity "PRESS E" ───────────────────────────────────────────────────
  if (state.nearbyAgent === agent.id && agent.id !== "joao") {
    const pulseAlpha = Math.sin(state.time / 400) * 0.2 + 0.5;
    ctx.beginPath();
    ctx.ellipse(x, y + bob + CHAR_H / 2 + 4, 24, 10, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(99,102,241,${pulseAlpha})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "bold 8px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tipY = y + bob - CHAR_H / 2 - HEAD_R * 2 - 8;
    const tipW = 52;
    roundRect(ctx, x - tipW / 2, tipY - 8, tipW, 16, 4);
    ctx.fillStyle = "rgba(99,102,241,0.85)";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText("PRESS E", x, tipY);
  }
}

// ── Movement system ───────────────────────────────────────────────────────────

// ── Walkable area check (rooms + door corridors only) ────────────────────────
function isWalkable(x: number, y: number): boolean {
  const PAD = 6;

  // Inside any room is walkable
  for (const room of ROOMS) {
    if (x >= room.x + PAD && x <= room.x + room.w - PAD &&
        y >= room.y + PAD && y <= room.y + room.h - PAD) {
      return true;
    }
  }

  // Corridor zones — only the actual corridors between rooms, not everywhere
  // Horizontal corridor between row 1 and row 2 (y ~310-360)
  if (x >= 30 && x <= CANVAS_W - 30 && y >= 300 && y <= 370) {
    return true;
  }
  // Horizontal corridor between row 2 and row 3 (y ~620-660)
  if (x >= 30 && x <= CANVAS_W - 30 && y >= 610 && y <= 670) {
    return true;
  }
  // Vertical corridor left side (x ~30-40)
  if (x >= 20 && x <= 50 && y >= 30 && y <= CANVAS_H - 20) {
    return true;
  }
  // Vertical corridor right side (x ~1360-1400)
  if (x >= CANVAS_W - 50 && x <= CANVAS_W - 20 && y >= 30 && y <= CANVAS_H - 20) {
    return true;
  }

  // Door threshold zones — allow walking through door openings in walls
  for (const room of ROOMS) {
    for (const door of room.doors) {
      let dx1: number, dy1: number, dx2: number, dy2: number;
      const DOOR_PAD = 20; // extra space around door for smooth transit

      if (door.side === "top") {
        dx1 = room.x + door.offset - 5;
        dx2 = room.x + door.offset + door.width + 5;
        dy1 = room.y - DOOR_PAD;
        dy2 = room.y + DOOR_PAD;
      } else if (door.side === "bottom") {
        dx1 = room.x + door.offset - 5;
        dx2 = room.x + door.offset + door.width + 5;
        dy1 = room.y + room.h - DOOR_PAD;
        dy2 = room.y + room.h + DOOR_PAD;
      } else if (door.side === "left") {
        dx1 = room.x - DOOR_PAD;
        dx2 = room.x + DOOR_PAD;
        dy1 = room.y + door.offset - 5;
        dy2 = room.y + door.offset + door.width + 5;
      } else {
        dx1 = room.x + room.w - DOOR_PAD;
        dx2 = room.x + room.w + DOOR_PAD;
        dy1 = room.y + door.offset - 5;
        dy2 = room.y + door.offset + door.width + 5;
      }

      if (x >= dx1 && x <= dx2 && y >= dy1 && y <= dy2) {
        return true;
      }
    }
  }

  return false;
}

export function updateAgentMovement(state: RenderState, deltaMs: number) {
  const deltaSec = deltaMs / 1000;

  for (const agent of AGENTS) {
    let anim = state.agentAnims.get(agent.id);
    if (!anim) {
      anim = {
        x: agent.spawnX,
        y: agent.spawnY,
        targetX: agent.spawnX,
        targetY: agent.spawnY,
        path: [],
        pathIndex: 0,
        direction: "down",
        walking: false,
        walkCycle: 0,
        idleBob: Math.random() * Math.PI * 2,
        isPlayerControlled: agent.id === "joao",
        velX: 0,
        velY: 0,
        spawnTimer: 1.0,      // start with spawn animation
        teleportTimer: 0,
        lastRoom: agent.defaultRoom,
      };
      state.agentAnims.set(agent.id, anim);
    }

    // Update transition timers
    if (anim.spawnTimer > 0) anim.spawnTimer = Math.max(0, anim.spawnTimer - deltaSec * 2);
    if (anim.teleportTimer > 0) anim.teleportTimer = Math.max(0, anim.teleportTimer - deltaSec * 2.5);

    // Player-controlled agent (João)
    if (anim.isPlayerControlled) {
      const vx = anim.velX ?? 0;
      const vy = anim.velY ?? 0;
      const isMoving = vx !== 0 || vy !== 0;

      if (isMoving) {
        const speed = WALK_SPEED * 1.2; // Player moves slightly faster
        const newX = anim.x + vx * speed * deltaSec;
        const newY = anim.y + vy * speed * deltaSec;

        // Tile-based collision check (walls + furniture via tile grid)
        if (isPixelWalkable(newX, newY)) {
          anim.x = Math.max(20, Math.min(CANVAS_W - 20, newX));
          anim.y = Math.max(20, Math.min(CANVAS_H - 20, newY));
        } else {
          // Try sliding along walls/furniture
          if (isPixelWalkable(newX, anim.y)) {
            anim.x = Math.max(20, Math.min(CANVAS_W - 20, newX));
          } else if (isPixelWalkable(anim.x, newY)) {
            anim.y = Math.max(20, Math.min(CANVAS_H - 20, newY));
          }
        }

        // Direction
        if (Math.abs(vx) > Math.abs(vy)) {
          anim.direction = vx > 0 ? "right" : "left";
        } else {
          anim.direction = vy > 0 ? "down" : "up";
        }

        anim.walking = true;
        anim.walkCycle += WALK_FRAME_RATE * deltaSec;
        if (anim.walkCycle >= 4) anim.walkCycle -= 4;
      } else {
        anim.walking = false;
      }

      // Keep target synced to current position
      anim.targetX = anim.x;
      anim.targetY = anim.y;

      // Camera fixa — escritório cabe na viewport, não precisa de follow
      state.cameraX = 0;
      state.cameraY = 0;

      continue;
    }

    // AI-controlled agents — follow BFS path through doors
    if (anim.path.length > 0 && anim.pathIndex < anim.path.length) {
      // Move toward current waypoint
      const waypoint = anim.path[anim.pathIndex];
      const dx = waypoint.x - anim.x;
      const dy = waypoint.y - anim.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 2) {
        anim.walking = true;
        const step = Math.min(WALK_SPEED * deltaSec, dist);
        anim.x += (dx / dist) * step;
        anim.y += (dy / dist) * step;

        if (Math.abs(dx) > Math.abs(dy)) {
          anim.direction = dx > 0 ? "right" : "left";
        } else {
          anim.direction = dy > 0 ? "down" : "up";
        }

        anim.walkCycle += WALK_FRAME_RATE * deltaSec;
        if (anim.walkCycle >= 4) anim.walkCycle -= 4;
      } else {
        // Reached waypoint — advance to next
        anim.pathIndex++;
        if (anim.pathIndex >= anim.path.length) {
          // Path complete
          anim.walking = false;
          anim.x = anim.targetX;
          anim.y = anim.targetY;
          anim.path = [];
          anim.pathIndex = 0;
        }
      }
    } else {
      // No path or path complete — direct move fallback
      const dx = anim.targetX - anim.x;
      const dy = anim.targetY - anim.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 2) {
        anim.walking = true;
        const step = Math.min(WALK_SPEED * deltaSec, dist);
        anim.x += (dx / dist) * step;
        anim.y += (dy / dist) * step;

        if (Math.abs(dx) > Math.abs(dy)) {
          anim.direction = dx > 0 ? "right" : "left";
        } else {
          anim.direction = dy > 0 ? "down" : "up";
        }

        anim.walkCycle += WALK_FRAME_RATE * deltaSec;
        if (anim.walkCycle >= 4) anim.walkCycle -= 4;
      } else {
        anim.walking = false;
        anim.x = anim.targetX;
        anim.y = anim.targetY;
      }
    }
  }
}

export function setAgentTarget(state: RenderState, agentId: string, tx: number, ty: number, roomId?: string) {
  const anim = state.agentAnims.get(agentId);
  if (anim) {
    // Only recalculate path if target actually changed
    if (Math.abs(anim.targetX - tx) > 2 || Math.abs(anim.targetY - ty) > 2) {
      anim.targetX = tx;
      anim.targetY = ty;

      // Detect room change → trigger teleport effect
      if (roomId && roomId !== anim.lastRoom) {
        anim.teleportTimer = 1.0;
        anim.lastRoom = roomId;
      }

      // Calculate BFS path for AI agents (not player-controlled)
      if (!anim.isPlayerControlled) {
        anim.path = findPath(anim.x, anim.y, tx, ty);
        anim.pathIndex = 0;
      }
    }
  }
}

// ── Main render function ──────────────────────────────────────────────────────

export function renderOffice(ctx: CanvasRenderingContext2D, state: RenderState) {
  // Delta time for movement
  const delta = state.lastTime > 0 ? state.time - state.lastTime : 16;
  state.lastTime = state.time;

  // Update movement
  updateAgentMovement(state, delta);

  // ── Proximity detection (João near agents/hotspots) ──────────────────────
  const joaoAnim = state.agentAnims.get("joao");
  state.nearbyAgent = null;
  state.nearbyHotspot = null;
  if (joaoAnim) {
    let minDist = PROXIMITY_RANGE;
    for (const agent of AGENTS) {
      if (agent.id === "joao") continue;
      const anim = state.agentAnims.get(agent.id);
      if (!anim) continue;
      const dx = joaoAnim.x - anim.x;
      const dy = joaoAnim.y - anim.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        state.nearbyAgent = agent.id;
      }
    }
    for (const hs of HOTSPOTS) {
      const hsCx = hs.x + hs.w / 2;
      const hsCy = hs.y + hs.h / 2;
      const dx = joaoAnim.x - hsCx;
      const dy = joaoAnim.y - hsCy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < PROXIMITY_RANGE) {
        state.nearbyHotspot = hs.id;
        break;
      }
    }
  }

  // ── Particle system update ───────────────────────────────────────────────
  if (!state.particles) state.particles = [];
  updateParticles(state, delta);

  // Clear
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Apply camera transform (subtle edge panning)
  ctx.save();
  ctx.translate(-state.cameraX, -state.cameraY);

  // Outdoor border (grass + trees)
  drawOutdoorBorder(ctx);

  // Corridor floor (between rooms)
  drawCorridorFloor(ctx);

  // Rooms (floor + 3D walls + lighting + alerts)
  for (const room of ROOMS) {
    drawRoom(ctx, room);

    // ── Room ambient lighting (radial gradient — brighter center, darker edges) ──
    const rlx = room.x + room.w / 2;
    const rly = room.y + room.h / 2;
    const rlr = Math.max(room.w, room.h) * 0.7;
    const ambientGrad = ctx.createRadialGradient(rlx, rly, 0, rlx, rly, rlr);
    ambientGrad.addColorStop(0, "rgba(255,255,255,0.03)");
    ambientGrad.addColorStop(0.6, "rgba(0,0,0,0)");
    ambientGrad.addColorStop(1, "rgba(0,0,0,0.08)");
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(room.x, room.y, room.w, room.h);

    // Room hover highlight
    if (state.hoveredRoom === room.id) {
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(room.x, room.y, room.w, room.h);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.strokeRect(room.x, room.y, room.w, room.h);
    }

    // Alert overlay (war room with incidents, etc.)
    const alert = state.alertRooms.get(room.id);
    if (alert) {
      const pulse = Math.sin(state.time / 400) * 0.15 + 0.15;
      const color = alert === "critical" ? `rgba(239,68,68,${pulse})` : `rgba(245,158,11,${pulse})`;
      ctx.fillStyle = color;
      ctx.fillRect(room.x, room.y, room.w, room.h);

      // Alert border
      const borderPulse = Math.sin(state.time / 300) * 0.3 + 0.5;
      ctx.strokeStyle = alert === "critical"
        ? `rgba(239,68,68,${borderPulse})`
        : `rgba(245,158,11,${borderPulse})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(room.x + 1, room.y + 1, room.w - 2, room.h - 2);

      // Alert badge with incident count
      const alertCount = state.alertRooms.get(room.id + ":count") ?? "";
      const badgeText = alert === "critical"
        ? `${alertCount ? alertCount + " " : ""}INCIDENTE${alertCount && Number(alertCount) > 1 ? "S" : ""}`
        : "ALERTA";
      ctx.font = "bold 8px 'Inter', system-ui, sans-serif";
      const tw = ctx.measureText(badgeText).width + 12;
      const bx = room.x + room.w - tw - 6;
      const by = room.y + 6;
      roundRect(ctx, bx, by, tw, 16, 4);
      ctx.fillStyle = alert === "critical" ? "rgba(239,68,68,0.9)" : "rgba(245,158,11,0.9)";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText, bx + tw / 2, by + 8);
    }
  }

  // Furniture (sorted by Y for layering)
  // Surface items (monitors, printers) get z-boost so they render ON TOP of desks
  const SURFACE_TYPES = new Set(["monitor", "printer"]);
  const sortedFurniture = [...FURNITURE].sort((a, b) => {
    const zA = SURFACE_TYPES.has(a.type) ? (a.y + a.h + 50) : (a.y + a.h);
    const zB = SURFACE_TYPES.has(b.type) ? (b.y + b.h + 50) : (b.y + b.h);
    return zA - zB;
  });
  for (const f of sortedFurniture) {
    drawFurniture(ctx, f);
  }

  // Hotspots (only hovered ones show)
  for (const hs of HOTSPOTS) {
    drawHotspot(ctx, hs, state.hoveredHotspot === hs.id);
  }

  // Characters — sort by Y for proper overlap
  const sortedAgents = [...AGENTS].sort((a, b) => {
    const animA = state.agentAnims.get(a.id);
    const animB = state.agentAnims.get(b.id);
    return (animA?.y ?? a.spawnY) - (animB?.y ?? b.spawnY);
  });

  for (const agent of sortedAgents) {
    const anim = state.agentAnims.get(agent.id);
    if (anim) {
      drawCharacter(ctx, agent, anim, state);
    }
  }

  // ── Room labels (drawn LAST as overlay, above everything) ────────────────
  const ROOM_ICONS: Record<string, string> = {
    "recepcao": "🏢", "diretoria": "👔", "sala-reuniao": "🎯",
    "desenvolvimento": "💻", "operacoes": "📊", "copa": "☕",
    "salao-jogos": "🎮", "jardim": "🌿",
  };

  for (const room of ROOMS) {
    const icon = ROOM_ICONS[room.id] ?? "";
    const labelText = room.label.toUpperCase();
    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    const textW = ctx.measureText(labelText).width;
    const fullText = icon ? `${icon}  ${labelText}` : labelText;
    const labelW = textW + (icon ? 28 : 16);
    const labelH = 22;
    const lx = room.x + room.w / 2 - labelW / 2;
    const ly = room.y > 50
      ? room.y - WALL_H - labelH - 4
      : room.y + 8;

    // Background pill
    roundRect(ctx, lx, ly, labelW, labelH, 6);
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fill();
    ctx.strokeStyle = room.wallTop;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Text with icon
    ctx.fillStyle = room.labelColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fullText, room.x + room.w / 2, ly + labelH / 2);
  }

  // ── "Press E" on nearby hotspots ────────────────────────────────────────
  if (state.nearbyHotspot) {
    const hs = HOTSPOTS.find((h) => h.id === state.nearbyHotspot);
    if (hs) {
      const hx = hs.x + hs.w / 2;
      const hy = hs.y - 10;
      const pulseA = Math.sin(state.time / 400) * 0.2 + 0.7;
      ctx.font = "bold 8px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = `E  ${hs.label}`;
      const lw = ctx.measureText(label).width + 14;
      roundRect(ctx, hx - lw / 2, hy - 9, lw, 18, 5);
      ctx.fillStyle = `rgba(99,102,241,${pulseA})`;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, hx, hy);
    }
  }

  // ── Render particles ──────────────────────────────────────────────────────
  for (const p of state.particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha * 0.6;
    if (p.type === "steam") {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    } else if (p.type === "leaf") {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size * 1.5, p.size);
    } else if (p.type === "sparkle") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Restore camera transform
  ctx.restore();

  // ── Mini-map (drawn outside camera transform, fixed position) ─────────────
  drawMiniMap(ctx, state);
}

// ── Particle system ──────────────────────────────────────────────────────────

function updateParticles(state: RenderState, delta: number) {
  const dt = delta / 1000;

  // Spawn new particles
  // Steam from coffee machines (~1040+310 area = copa coffee machine at x:1310,y:390)
  if (Math.random() < 0.03) {
    state.particles.push({
      x: 1323 + Math.random() * 6, y: 390,
      vx: (Math.random() - 0.5) * 4, vy: -8 - Math.random() * 6,
      life: 2, maxLife: 2, size: 2 + Math.random() * 2,
      color: "rgba(200,200,200,0.5)", type: "steam",
    });
  }

  // Leaves in jardim (580-1360, 660-860) — more frequent
  if (Math.random() < 0.04) {
    const leafColors = [
      "rgba(74,222,128,0.6)",   // bright green
      "rgba(134,239,172,0.5)",  // light green
      "rgba(22,163,74,0.5)",    // dark green
      "rgba(250,204,21,0.4)",   // yellow (autumn)
    ];
    state.particles.push({
      x: 600 + Math.random() * 720, y: 660 + Math.random() * 30,
      vx: 2 + Math.random() * 6, vy: 5 + Math.random() * 8,
      life: 5, maxLife: 5, size: 2 + Math.random() * 2.5,
      color: leafColors[Math.floor(Math.random() * leafColors.length)],
      type: "leaf",
    });
  }

  // Sparkles on pond/aquarium in jardim
  if (Math.random() < 0.03) {
    state.particles.push({
      x: 925 + Math.random() * 70, y: 770 + Math.random() * 30,
      vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2,
      life: 2, maxLife: 2, size: 1.5 + Math.random(),
      color: "rgba(147,197,253,0.7)",
      type: "sparkle",
    });
  }

  // Sparkles on monitors (random desk area)
  if (Math.random() < 0.01) {
    const desks = [
      { x: 490, y: 115 }, { x: 660, y: 115 }, // diretoria
      { x: 95, y: 415 }, { x: 215, y: 415 },   // dev
      { x: 670, y: 435 },                        // ops
    ];
    const desk = desks[Math.floor(Math.random() * desks.length)];
    state.particles.push({
      x: desk.x + Math.random() * 30, y: desk.y + Math.random() * 8,
      vx: 0, vy: -2,
      life: 1.5, maxLife: 1.5, size: 1.5,
      color: "rgba(147,197,253,0.7)", type: "sparkle",
    });
  }

  // Update existing
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }

  // Cap max particles
  if (state.particles.length > 60) {
    state.particles.splice(0, state.particles.length - 60);
  }
}

// ── Mini-map ─────────────────────────────────────────────────────────────────

function drawMiniMap(ctx: CanvasRenderingContext2D, state: RenderState) {
  const scale = 0.1;
  const mmW = CANVAS_W * scale;
  const mmH = CANVAS_H * scale;
  const mmX = CANVAS_W - mmW - 12;
  const mmY = CANVAS_H - mmH - 12;

  // Background
  roundRect(ctx, mmX - 2, mmY - 2, mmW + 4, mmH + 4, 4);
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Rooms
  for (const room of ROOMS) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(mmX + room.x * scale, mmY + room.y * scale, room.w * scale, room.h * scale);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(mmX + room.x * scale, mmY + room.y * scale, room.w * scale, room.h * scale);
  }

  // Agents as colored dots
  for (const agent of AGENTS) {
    const anim = state.agentAnims.get(agent.id);
    if (!anim) continue;
    const ax = mmX + anim.x * scale;
    const ay = mmY + anim.y * scale;
    ctx.beginPath();
    ctx.arc(ax, ay, agent.id === "joao" ? 3 : 2, 0, Math.PI * 2);
    ctx.fillStyle = agent.shirtColor;
    ctx.fill();
    // João has a white ring
    if (agent.id === "joao") {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
}

// ── Furniture collision check (for pathfinding) ──────────────────────────────

function collidesWithFurniture(x: number, y: number, excludeTypes: string[] = ["rug", "lamp"]): boolean {
  for (const f of FURNITURE) {
    if (excludeTypes.includes(f.type)) continue;
    // Shrink hitbox slightly for better feel
    const pad = 4;
    if (x >= f.x + pad && x <= f.x + f.w - pad &&
        y >= f.y + pad && y <= f.y + f.h - pad) {
      return true;
    }
  }
  return false;
}

// ── Hit testing ───────────────────────────────────────────────────────────────

export function hitTestAgent(mx: number, my: number, state: RenderState): AgentConfig | null {
  // Account for camera offset
  const wmx = mx + state.cameraX;
  const wmy = my + state.cameraY;
  for (const agent of AGENTS) {
    const anim = state.agentAnims.get(agent.id);
    if (!anim) continue;
    const dx = wmx - anim.x;
    const dy = wmy - anim.y;
    // Hit area is roughly the character body
    if (Math.abs(dx) < 18 && dy > -HEAD_R * 2 - CHAR_H / 2 && dy < CHAR_H / 2 + 6) {
      return agent;
    }
  }
  return null;
}

export function hitTestHotspot(mx: number, my: number, state?: RenderState): Hotspot | null {
  const wmx = mx + (state?.cameraX ?? 0);
  const wmy = my + (state?.cameraY ?? 0);
  for (const hs of HOTSPOTS) {
    const pad = 6;
    if (wmx >= hs.x - pad && wmx <= hs.x + hs.w + pad &&
        wmy >= hs.y - pad && wmy <= hs.y + hs.h + pad) {
      return hs;
    }
  }
  return null;
}

export function hitTestRoom(mx: number, my: number, state?: RenderState): Room | null {
  const wmx = mx + (state?.cameraX ?? 0);
  const wmy = my + (state?.cameraY ?? 0);
  for (const room of ROOMS) {
    if (wmx >= room.x && wmx <= room.x + room.w &&
        wmy >= room.y && wmy <= room.y + room.h) {
      return room;
    }
  }
  return null;
}

export { ROOMS, HOTSPOTS, AGENTS, CANVAS_W, CANVAS_H };
