// ── 2D Canvas Rendering Engine — Gather-Style Virtual Office ──────────────────
// Draws pixel-art characters, furniture, rooms with walls/doors, and movement.

import {
  ROOMS, HOTSPOTS, FURNITURE, AGENTS, CANVAS_W, CANVAS_H, TILE,
  type Room, type Hotspot, type Furniture, type AgentConfig,
} from "../config/office-map";

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
  direction: Direction;
  walking: boolean;
  walkCycle: number; // 0-3 frame counter
  idleBob: number;
}

export interface RenderState {
  hoveredEntity: string | null;
  hoveredHotspot: string | null;
  selectedEntity: string | null;
  agentStatuses: Map<string, AgentStatus>;
  agentDispatches: Map<string, AgentDispatchIndicator>;
  agentAnims: Map<string, AgentAnimState>;
  time: number;
  lastTime: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WALK_SPEED = 90;         // px per second
const WALK_FRAME_RATE = 6;     // frames per second for walk cycle
const CHAR_W = 18;             // character body width
const CHAR_H = 22;             // character body height (without head)
const HEAD_R = 9;              // head radius
const WALL_THICKNESS = 4;

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e", idle: "#6b7280", degraded: "#f59e0b", down: "#ef4444",
};

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

// ── Floor tiles ───────────────────────────────────────────────────────────────

function drawFloor(ctx: CanvasRenderingContext2D) {
  // Dark base
  ctx.fillStyle = "#0c0c14";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Subtle checkerboard outside rooms (corridor)
  for (let x = 0; x < CANVAS_W; x += TILE) {
    for (let y = 0; y < CANVAS_H; y += TILE) {
      const checker = ((x / TILE) + (y / TILE)) % 2 === 0;
      ctx.fillStyle = checker ? "rgba(255,255,255,0.012)" : "rgba(0,0,0,0)";
      ctx.fillRect(x, y, TILE, TILE);
    }
  }
}

// ── Room floor + walls ────────────────────────────────────────────────────────

function drawRoom(ctx: CanvasRenderingContext2D, room: Room) {
  const { x, y, w, h } = room;

  // Floor fill with subtle tile pattern
  ctx.fillStyle = room.floorColor;
  ctx.fillRect(x, y, w, h);

  // Floor tile lines
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 0.5;
  for (let tx = x; tx < x + w; tx += TILE) {
    ctx.beginPath(); ctx.moveTo(tx, y); ctx.lineTo(tx, y + h); ctx.stroke();
  }
  for (let ty = y; ty < y + h; ty += TILE) {
    ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x + w, ty); ctx.stroke();
  }

  // Walls with doors
  ctx.fillStyle = room.wallColor;

  // Each side: draw wall segments with gaps for doors
  const sides: Array<{ side: "top" | "bottom" | "left" | "right" }> = [
    { side: "top" }, { side: "bottom" }, { side: "left" }, { side: "right" },
  ];

  for (const { side } of sides) {
    const doors = room.doors.filter((d) => d.side === side);
    const segments: Array<[number, number]> = [];

    if (side === "top" || side === "bottom") {
      let start = 0;
      for (const door of doors.sort((a, b) => a.offset - b.offset)) {
        if (door.offset > start) segments.push([start, door.offset]);
        start = door.offset + door.width;
      }
      if (start < w) segments.push([start, w]);

      const wy = side === "top" ? y : y + h - WALL_THICKNESS;
      for (const [s, e] of segments) {
        ctx.fillRect(x + s, wy, e - s, WALL_THICKNESS);
      }
      // Door indicators
      for (const door of doors) {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(x + door.offset, wy, door.width, WALL_THICKNESS);
        ctx.fillStyle = room.wallColor;
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
        ctx.fillRect(wx, y + s, WALL_THICKNESS, e - s);
      }
      for (const door of doors) {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(wx, y + door.offset, WALL_THICKNESS, door.width);
        ctx.fillStyle = room.wallColor;
      }
    }
  }

  // Room label
  ctx.fillStyle = room.labelColor;
  ctx.font = "bold 10px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(room.label.toUpperCase(), x + 10, y + 8);
}

// ── Furniture drawing ─────────────────────────────────────────────────────────

function drawFurniture(ctx: CanvasRenderingContext2D, f: Furniture) {
  switch (f.type) {
    case "desk": {
      // Desktop surface
      roundRect(ctx, f.x, f.y, f.w, f.h, 3);
      ctx.fillStyle = "#2a2520";
      ctx.fill();
      ctx.strokeStyle = "#3d3530";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Surface shine
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(f.x + 4, f.y + 3, f.w - 8, f.h / 2 - 2);
      break;
    }
    case "chair": {
      // Seat
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2, f.y + f.h / 2, f.w / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#333340";
      ctx.fill();
      ctx.strokeStyle = "#44445a";
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case "monitor": {
      // Screen
      roundRect(ctx, f.x, f.y, f.w, f.h, 1);
      ctx.fillStyle = "#1a3a5c";
      ctx.fill();
      ctx.strokeStyle = "#2a2a30";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Screen glow
      ctx.fillStyle = "rgba(59,130,246,0.15)";
      ctx.fillRect(f.x + 2, f.y + 1, f.w - 4, f.h - 2);
      break;
    }
    case "whiteboard": {
      roundRect(ctx, f.x, f.y, f.w, f.h, 2);
      ctx.fillStyle = "#e8e8e0";
      ctx.fill();
      ctx.strokeStyle = "#888880";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Some "writing" lines
      ctx.strokeStyle = "rgba(59,130,246,0.3)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(f.x + 6, f.y + 3 + i * 3);
        ctx.lineTo(f.x + f.w * (0.4 + Math.random() * 0.4), f.y + 3 + i * 3);
        ctx.stroke();
      }
      break;
    }
    case "plant": {
      // Pot
      roundRect(ctx, f.x + 2, f.y + f.h * 0.6, f.w - 4, f.h * 0.4, 2);
      ctx.fillStyle = "#8B4513";
      ctx.fill();
      // Leaves
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2, f.y + f.h * 0.4, f.w * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "#228B22";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2 - 3, f.y + f.h * 0.3, f.w * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "#2d9e2d";
      ctx.fill();
      break;
    }
    case "coffee": {
      roundRect(ctx, f.x, f.y, f.w, f.h, 4);
      ctx.fillStyle = "#3a2a1a";
      ctx.fill();
      ctx.strokeStyle = "#4a3a2a";
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case "couch": {
      roundRect(ctx, f.x, f.y, f.w, f.h, 6);
      ctx.fillStyle = f.color ?? "#3b3b5c";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Cushion line
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.moveTo(f.x + f.w * 0.33, f.y + 4);
      ctx.lineTo(f.x + f.w * 0.33, f.y + f.h - 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(f.x + f.w * 0.66, f.y + 4);
      ctx.lineTo(f.x + f.w * 0.66, f.y + f.h - 4);
      ctx.stroke();
      break;
    }
    case "tv": {
      roundRect(ctx, f.x, f.y, f.w, f.h, 2);
      ctx.fillStyle = "#111118";
      ctx.fill();
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Screen content
      const grad = ctx.createLinearGradient(f.x, f.y, f.x + f.w, f.y + f.h);
      grad.addColorStop(0, "rgba(59,130,246,0.12)");
      grad.addColorStop(0.5, "rgba(16,185,129,0.08)");
      grad.addColorStop(1, "rgba(99,102,241,0.12)");
      ctx.fillStyle = grad;
      ctx.fillRect(f.x + 1, f.y + 1, f.w - 2, f.h - 2);
      break;
    }
    case "server-rack": {
      roundRect(ctx, f.x, f.y, f.w, f.h, 2);
      ctx.fillStyle = "#1a1a22";
      ctx.fill();
      ctx.strokeStyle = "#333340";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Blinking lights
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(f.x + 8, f.y + 10 + i * 10, 2, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? "#22c55e" : "#3b82f6";
        ctx.fill();
      }
      break;
    }
    case "bookshelf": {
      roundRect(ctx, f.x, f.y, f.w, f.h, 2);
      ctx.fillStyle = "#3a2a1a";
      ctx.fill();
      // Books
      const colors = ["#c53030", "#2b6cb0", "#38a169", "#d69e2e", "#805ad5"];
      const bookW = 6;
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(f.x + 4 + i * (bookW + 2), f.y + 2, bookW, f.h - 4);
      }
      break;
    }
  }
}

// ── Hotspot overlay ───────────────────────────────────────────────────────────

function drawHotspot(ctx: CanvasRenderingContext2D, hs: Hotspot, isHovered: boolean) {
  if (!isHovered) return; // Only show on hover — hotspots are furniture-based

  // Highlight glow
  ctx.save();
  ctx.shadowColor = "rgba(99,102,241,0.6)";
  ctx.shadowBlur = 12;
  roundRect(ctx, hs.x - 4, hs.y - 4, hs.w + 8, hs.h + 8, 6);
  ctx.strokeStyle = "rgba(99,102,241,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Label tooltip above
  const label = `${hs.icon} ${hs.label}`;
  ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
  const tw = ctx.measureText(label).width + 14;
  const tx = hs.x + hs.w / 2 - tw / 2;
  const ty = hs.y - 24;

  roundRect(ctx, tx, ty, tw, 18, 4);
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fill();
  ctx.strokeStyle = "rgba(99,102,241,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#e0e0ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, hs.x + hs.w / 2, ty + 9);
}

// ── Character (bonequinho) drawing ────────────────────────────────────────────

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

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale, scale);

  // ── Ground shadow ───────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.ellipse(0, CHAR_H / 2 + 4, 12, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();

  // ── Legs/feet ───────────────────────────────────────────────────────────────
  const legSpread = anim.walking ? Math.sin(anim.walkCycle * Math.PI / 2) * 4 : 0;

  // Left leg
  roundRect(ctx, -5 - (dir === "left" ? 1 : 0), CHAR_H / 2 - 8 + legSpread, 5, 10, 2);
  ctx.fillStyle = agent.pantsColor;
  ctx.fill();

  // Right leg
  roundRect(ctx, 1 + (dir === "right" ? 1 : 0), CHAR_H / 2 - 8 - legSpread, 5, 10, 2);
  ctx.fillStyle = agent.pantsColor;
  ctx.fill();

  // Shoes
  roundRect(ctx, -6, CHAR_H / 2 + legSpread, 6, 4, 1);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();
  roundRect(ctx, 1, CHAR_H / 2 - legSpread, 6, 4, 1);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();

  // ── Body (shirt) ────────────────────────────────────────────────────────────
  roundRect(ctx, -CHAR_W / 2, -CHAR_H / 2, CHAR_W, CHAR_H - 6, 4);
  ctx.fillStyle = agent.shirtColor;
  ctx.fill();

  // Body shading
  const bodyGrad = ctx.createLinearGradient(-CHAR_W / 2, -CHAR_H / 2, CHAR_W / 2, CHAR_H / 2);
  bodyGrad.addColorStop(0, "rgba(255,255,255,0.1)");
  bodyGrad.addColorStop(1, "rgba(0,0,0,0.15)");
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // ── Arms ────────────────────────────────────────────────────────────────────
  const armSwing = anim.walking ? Math.sin(anim.walkCycle * Math.PI / 2) * 3 : 0;

  // Left arm
  roundRect(ctx, -CHAR_W / 2 - 4, -CHAR_H / 2 + 4 + armSwing, 4, 12, 2);
  ctx.fillStyle = agent.shirtColor;
  ctx.fill();
  // Hand
  ctx.beginPath();
  ctx.arc(-CHAR_W / 2 - 2, -CHAR_H / 2 + 16 + armSwing, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = agent.skinColor;
  ctx.fill();

  // Right arm
  roundRect(ctx, CHAR_W / 2, -CHAR_H / 2 + 4 - armSwing, 4, 12, 2);
  ctx.fillStyle = agent.shirtColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(CHAR_W / 2 + 2, -CHAR_H / 2 + 16 - armSwing, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = agent.skinColor;
  ctx.fill();

  // ── Head ────────────────────────────────────────────────────────────────────
  const headY = -CHAR_H / 2 - HEAD_R + 2;

  // Neck
  ctx.fillStyle = agent.skinColor;
  ctx.fillRect(-3, -CHAR_H / 2 - 2, 6, 4);

  // Head circle
  ctx.beginPath();
  ctx.arc(0, headY, HEAD_R, 0, Math.PI * 2);
  ctx.fillStyle = agent.skinColor;
  ctx.fill();

  // Head shine
  ctx.beginPath();
  ctx.arc(-2, headY - 3, HEAD_R * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();

  // ── Hair ────────────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(0, headY, HEAD_R + 0.5, Math.PI * 1.1, Math.PI * 1.9);
  ctx.lineTo(HEAD_R * 0.8, headY - HEAD_R * 0.5);
  ctx.fillStyle = agent.hairColor;
  ctx.fill();

  // Hair top
  ctx.beginPath();
  ctx.ellipse(0, headY - HEAD_R + 1, HEAD_R - 1, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = agent.hairColor;
  ctx.fill();

  // ── Face ────────────────────────────────────────────────────────────────────
  if (dir === "down" || dir === "left" || dir === "right") {
    const faceOffX = dir === "left" ? -2 : dir === "right" ? 2 : 0;

    // Eyes
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(-3 + faceOffX, headY, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3 + faceOffX, headY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye whites (tiny)
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-3 + faceOffX + 0.5, headY - 0.5, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3 + faceOffX + 0.5, headY - 0.5, 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (smile when selected/hovered)
    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(faceOffX, headY + 3, 2.5, 0, Math.PI);
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  // ── Selection indicator ─────────────────────────────────────────────────────
  if (isSelected) {
    const selPulse = Math.sin(state.time / 500) * 0.15 + 0.85;
    ctx.beginPath();
    ctx.ellipse(0, CHAR_H / 2 + 4, 18, 7, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(99,102,241,${selPulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Hover highlight ─────────────────────────────────────────────────────────
  if (isHovered && !isSelected) {
    ctx.beginPath();
    ctx.ellipse(0, CHAR_H / 2 + 4, 16, 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();

  // ── Name tag (not scaled) ───────────────────────────────────────────────────
  const tagY = y + bob - CHAR_H / 2 - HEAD_R * 2 - 10;
  const nameStr = agent.name;
  ctx.font = `${isSelected ? "bold " : ""}9px 'Inter', system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Tag background
  const nameW = ctx.measureText(nameStr).width + 10;
  roundRect(ctx, x - nameW / 2, tagY - 7, nameW, 14, 3);
  ctx.fillStyle = isSelected
    ? "rgba(99,102,241,0.9)"
    : isHovered
      ? "rgba(0,0,0,0.85)"
      : "rgba(0,0,0,0.6)";
  ctx.fill();

  if (isSelected || isHovered) {
    ctx.strokeStyle = isSelected ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = "#fff";
  ctx.fillText(nameStr, x, tagY);

  // ── Role tag (below name, only on hover/select) ─────────────────────────────
  if (isHovered || isSelected) {
    ctx.font = "8px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(agent.role, x, tagY + 14);
  }

  // ── Status dot ──────────────────────────────────────────────────────────────
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
  ctx.beginPath();
  ctx.arc(x + 10, y + bob - CHAR_H / 2 - HEAD_R * 2 - 2, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = statusColor;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Active pulse ring
  if (status === "active") {
    const pulse = Math.sin(state.time / 500) * 0.4 + 0.6;
    ctx.beginPath();
    ctx.arc(x + 10, y + bob - CHAR_H / 2 - HEAD_R * 2 - 2, 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(34,197,94,${pulse * 0.5})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── Dispatch badge (command pending) ────────────────────────────────────────
  if (dispatchData?.hasActive) {
    const bx = x - 10;
    const by = y + bob - CHAR_H / 2 - HEAD_R * 2 - 2;
    const dp = Math.sin(state.time / 350) * 0.3 + 0.7;

    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(99,102,241,${dp})`;
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", bx, by);
  }
}

// ── Movement system ───────────────────────────────────────────────────────────

export function updateAgentMovement(state: RenderState, deltaMs: number) {
  const deltaSec = deltaMs / 1000;

  for (const agent of AGENTS) {
    let anim = state.agentAnims.get(agent.id);
    if (!anim) {
      // Initialize
      anim = {
        x: agent.spawnX,
        y: agent.spawnY,
        targetX: agent.spawnX,
        targetY: agent.spawnY,
        direction: "down",
        walking: false,
        walkCycle: 0,
        idleBob: Math.random() * Math.PI * 2,
      };
      state.agentAnims.set(agent.id, anim);
    }

    const dx = anim.targetX - anim.x;
    const dy = anim.targetY - anim.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      // Move toward target
      anim.walking = true;
      const step = Math.min(WALK_SPEED * deltaSec, dist);
      anim.x += (dx / dist) * step;
      anim.y += (dy / dist) * step;

      // Update direction
      if (Math.abs(dx) > Math.abs(dy)) {
        anim.direction = dx > 0 ? "right" : "left";
      } else {
        anim.direction = dy > 0 ? "down" : "up";
      }

      // Walk cycle
      anim.walkCycle += WALK_FRAME_RATE * deltaSec;
      if (anim.walkCycle >= 4) anim.walkCycle -= 4;
    } else {
      anim.walking = false;
      anim.x = anim.targetX;
      anim.y = anim.targetY;
    }
  }
}

export function setAgentTarget(state: RenderState, agentId: string, tx: number, ty: number) {
  const anim = state.agentAnims.get(agentId);
  if (anim) {
    anim.targetX = tx;
    anim.targetY = ty;
  }
}

// ── Corridor areas (for ambient detail) ───────────────────────────────────────

function drawCorridorDetails(ctx: CanvasRenderingContext2D) {
  // Subtle direction arrows on corridor floor
  ctx.fillStyle = "rgba(255,255,255,0.02)";

  // Horizontal corridor between room rows
  for (let x = 60; x < CANVAS_W - 60; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 270);
    ctx.lineTo(x + 10, 275);
    ctx.lineTo(x, 280);
    ctx.fill();
  }
}

// ── Main render function ──────────────────────────────────────────────────────

export function renderOffice(ctx: CanvasRenderingContext2D, state: RenderState) {
  // Delta time for movement
  const delta = state.lastTime > 0 ? state.time - state.lastTime : 16;
  state.lastTime = state.time;

  // Update movement
  updateAgentMovement(state, delta);

  // Clear
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Floor
  drawFloor(ctx);

  // Corridors
  drawCorridorDetails(ctx);

  // Rooms
  for (const room of ROOMS) {
    drawRoom(ctx, room);
  }

  // Furniture
  for (const f of FURNITURE) {
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
}

// ── Hit testing ───────────────────────────────────────────────────────────────

export function hitTestAgent(mx: number, my: number, state: RenderState): AgentConfig | null {
  for (const agent of AGENTS) {
    const anim = state.agentAnims.get(agent.id);
    if (!anim) continue;
    const dx = mx - anim.x;
    const dy = my - anim.y;
    // Hit area is roughly the character body
    if (Math.abs(dx) < 16 && dy > -HEAD_R * 2 - CHAR_H / 2 && dy < CHAR_H / 2 + 6) {
      return agent;
    }
  }
  return null;
}

export function hitTestHotspot(mx: number, my: number): Hotspot | null {
  for (const hs of HOTSPOTS) {
    // Expand hit area slightly for better UX
    const pad = 6;
    if (mx >= hs.x - pad && mx <= hs.x + hs.w + pad &&
        my >= hs.y - pad && my <= hs.y + hs.h + pad) {
      return hs;
    }
  }
  return null;
}

export { ROOMS, HOTSPOTS, AGENTS, CANVAS_W, CANVAS_H };
