// ── 2D Canvas Rendering Engine for the Virtual Office ─────────────────────────
// Pure functions that draw on a CanvasRenderingContext2D.
// No React dependency — called from the OfficeCanvas component's render loop.

import {
  ROOMS,
  HOTSPOTS,
  AGENT_POSITIONS,
  CANVAS_W,
  CANVAS_H,
  type Room,
  type Hotspot,
  type AgentPosition,
} from "../config/office-map";

export interface AgentStatus {
  id: string;
  status: "active" | "idle" | "degraded" | "down";
  messages_24h: number;
  errors_24h: number;
}

export interface RenderState {
  hoveredEntity: string | null;
  hoveredHotspot: string | null;
  agentStatuses: Map<string, AgentStatus>;
  time: number; // performance.now for animations
}

// ── Status → Color mapping ────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  idle: "#6b7280",
  degraded: "#f59e0b",
  down: "#ef4444",
};

const STATUS_GLOW: Record<string, string> = {
  active: "rgba(34,197,94,0.4)",
  idle: "rgba(107,114,128,0.2)",
  degraded: "rgba(245,158,11,0.4)",
  down: "rgba(239,68,68,0.5)",
};

// ── Helper: rounded rect ──────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
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

// ── Draw background grid ──────────────────────────────────────────────────────
function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  const step = 40;
  for (let x = 0; x <= CANVAS_W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_H);
    ctx.stroke();
  }
  for (let y = 0; y <= CANVAS_H; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
    ctx.stroke();
  }
}

// ── Draw rooms ────────────────────────────────────────────────────────────────
function drawRoom(ctx: CanvasRenderingContext2D, room: Room) {
  // Fill
  roundRect(ctx, room.x, room.y, room.w, room.h, 12);
  ctx.fillStyle = room.color;
  ctx.fill();

  // Border
  ctx.strokeStyle = room.borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Label
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "bold 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`${room.icon} ${room.label}`, room.x + 14, room.y + 24);
}

// ── Draw hotspots ─────────────────────────────────────────────────────────────
function drawHotspot(
  ctx: CanvasRenderingContext2D,
  hs: Hotspot,
  isHovered: boolean
) {
  const alpha = isHovered ? 0.2 : 0.08;
  const borderAlpha = isHovered ? 0.6 : 0.2;

  roundRect(ctx, hs.x, hs.y, hs.w, hs.h, 8);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${borderAlpha})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Icon + label
  ctx.fillStyle = isHovered
    ? "rgba(255,255,255,0.9)"
    : "rgba(255,255,255,0.5)";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${hs.icon} ${hs.label}`, hs.x + hs.w / 2, hs.y + hs.h / 2 + 4);

  // Cursor hint on hover
  if (isHovered) {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "9px Inter, system-ui, sans-serif";
    ctx.fillText("clique para abrir", hs.x + hs.w / 2, hs.y + hs.h - 4);
  }
}

// ── Draw agent avatar ─────────────────────────────────────────────────────────
function drawAgent(
  ctx: CanvasRenderingContext2D,
  agent: AgentPosition,
  state: RenderState
) {
  const isHovered = state.hoveredEntity === agent.id;
  const statusData = state.agentStatuses.get(agent.name.toLowerCase());
  const status = statusData?.status ?? "idle";
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
  const glowColor = STATUS_GLOW[status] ?? STATUS_GLOW.idle;

  const radius = isHovered ? 24 : 20;
  const x = agent.x;
  const y = agent.y;

  // Pulse animation for active agents
  if (status === "active" || status === "degraded") {
    const pulse = Math.sin(state.time / 600) * 0.3 + 0.5;
    ctx.beginPath();
    ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = glowColor.replace(/[\d.]+\)$/, `${pulse * 0.3})`);
    ctx.fill();
  }

  // Outer glow
  ctx.beginPath();
  ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
  ctx.fillStyle = glowColor;
  ctx.fill();

  // Main circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = agent.color;
  ctx.fill();

  // Inner gradient
  const grad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, radius);
  grad.addColorStop(0, "rgba(255,255,255,0.2)");
  grad.addColorStop(1, "rgba(0,0,0,0.1)");
  ctx.fillStyle = grad;
  ctx.fill();

  // Border
  ctx.strokeStyle = isHovered
    ? "rgba(255,255,255,0.8)"
    : "rgba(255,255,255,0.15)";
  ctx.lineWidth = isHovered ? 2 : 1;
  ctx.stroke();

  // Initials
  const initials = agent.name.charAt(0).toUpperCase();
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${isHovered ? 14 : 12}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials, x, y);

  // Name label below
  ctx.fillStyle = isHovered
    ? "rgba(255,255,255,0.95)"
    : "rgba(255,255,255,0.6)";
  ctx.font = `${isHovered ? "bold " : ""}11px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(agent.name, x, y + radius + 16);

  // Role below name
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.fillText(agent.role, x, y + radius + 28);

  // Status dot
  ctx.beginPath();
  ctx.arc(x + radius - 2, y - radius + 2, 5, 0, Math.PI * 2);
  ctx.fillStyle = statusColor;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ── Draw floor connectors (decorative lines between rooms) ────────────────────
function drawConnectors(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);

  // Lobby → Sprint Room
  ctx.beginPath();
  ctx.moveTo(360, 140);
  ctx.lineTo(400, 140);
  ctx.stroke();

  // Sprint Room → War Room
  ctx.beginPath();
  ctx.moveTo(760, 140);
  ctx.lineTo(800, 140);
  ctx.stroke();

  // Lobby → Dev Area
  ctx.beginPath();
  ctx.moveTo(200, 240);
  ctx.lineTo(200, 300);
  ctx.stroke();

  // Dev Area → Deploy Room
  ctx.beginPath();
  ctx.moveTo(580, 440);
  ctx.lineTo(620, 440);
  ctx.stroke();

  // Deploy → Metrics
  ctx.beginPath();
  ctx.moveTo(880, 440);
  ctx.lineTo(920, 440);
  ctx.stroke();

  ctx.setLineDash([]);
}

// ── Main render function ──────────────────────────────────────────────────────
export function renderOffice(
  ctx: CanvasRenderingContext2D,
  state: RenderState
) {
  // Clear
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Background
  ctx.fillStyle = "#09090b"; // zinc-950
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Grid
  drawGrid(ctx);

  // Connectors
  drawConnectors(ctx);

  // Rooms
  for (const room of ROOMS) {
    drawRoom(ctx, room);
  }

  // Hotspots
  for (const hs of HOTSPOTS) {
    drawHotspot(ctx, hs, state.hoveredHotspot === hs.id);
  }

  // Agents
  for (const agent of AGENT_POSITIONS) {
    drawAgent(ctx, agent, state);
  }
}

// ── Hit testing ───────────────────────────────────────────────────────────────

export function hitTestAgent(
  mx: number, my: number
): AgentPosition | null {
  for (const agent of AGENT_POSITIONS) {
    const dx = mx - agent.x;
    const dy = my - agent.y;
    if (dx * dx + dy * dy <= 28 * 28) return agent;
  }
  return null;
}

export function hitTestHotspot(
  mx: number, my: number
): Hotspot | null {
  for (const hs of HOTSPOTS) {
    if (mx >= hs.x && mx <= hs.x + hs.w && my >= hs.y && my <= hs.y + hs.h) {
      return hs;
    }
  }
  return null;
}

export { ROOMS, HOTSPOTS, AGENT_POSITIONS, CANVAS_W, CANVAS_H };
