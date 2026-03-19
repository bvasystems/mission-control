// ── Office Map Configuration — Gather-Style ──────────────────────────────────
// Defines the 2D office floor plan: rooms, walls, doors, furniture, agent spawn points.
// All coordinates are in a 1200×800 virtual canvas space.

export const CANVAS_W = 1200;
export const CANVAS_H = 800;
export const TILE = 32; // tile size for floor pattern

// ── Room definitions ──────────────────────────────────────────────────────────

export interface Room {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floorColor: string;
  wallColor: string;
  labelColor: string;
  doors: Door[];    // gaps in the walls
}

export interface Door {
  side: "top" | "bottom" | "left" | "right";
  offset: number;   // offset from room edge start
  width: number;     // door width
}

export const ROOMS: Room[] = [
  {
    id: "diretoria",
    label: "Diretoria",
    x: 30, y: 30, w: 270, h: 220,
    floorColor: "#1a1a2e",
    wallColor: "#3b3b5c",
    labelColor: "rgba(147,130,255,0.7)",
    doors: [{ side: "right", offset: 80, width: 50 }],
  },
  {
    id: "sprint-room",
    label: "Sprint Room",
    x: 330, y: 30, w: 270, h: 220,
    floorColor: "#1a2e1a",
    wallColor: "#3b5c3b",
    labelColor: "rgba(74,222,128,0.7)",
    doors: [
      { side: "left", offset: 80, width: 50 },
      { side: "right", offset: 80, width: 50 },
      { side: "bottom", offset: 110, width: 50 },
    ],
  },
  {
    id: "war-room",
    label: "War Room",
    x: 630, y: 30, w: 250, h: 220,
    floorColor: "#2e1a1a",
    wallColor: "#5c3b3b",
    labelColor: "rgba(248,113,113,0.7)",
    doors: [
      { side: "left", offset: 80, width: 50 },
      { side: "bottom", offset: 100, width: 50 },
    ],
  },
  {
    id: "lounge",
    label: "Lounge",
    x: 910, y: 30, w: 260, h: 220,
    floorColor: "#1e1e2e",
    wallColor: "#4a4a6a",
    labelColor: "rgba(196,181,253,0.7)",
    doors: [{ side: "bottom", offset: 100, width: 50 }],
  },
  {
    id: "dev-area",
    label: "Dev Area",
    x: 30, y: 310, w: 380, h: 250,
    floorColor: "#1a1e2e",
    wallColor: "#3b4a6a",
    labelColor: "rgba(129,140,248,0.7)",
    doors: [
      { side: "top", offset: 270, width: 50 },
      { side: "right", offset: 100, width: 50 },
    ],
  },
  {
    id: "deploy-room",
    label: "Deploy / Infra",
    x: 440, y: 310, w: 240, h: 250,
    floorColor: "#2e2a1a",
    wallColor: "#5c5330",
    labelColor: "rgba(251,191,36,0.7)",
    doors: [
      { side: "left", offset: 100, width: 50 },
      { side: "top", offset: 80, width: 50 },
      { side: "right", offset: 100, width: 50 },
    ],
  },
  {
    id: "metrics-wall",
    label: "Metrics",
    x: 710, y: 310, w: 220, h: 250,
    floorColor: "#1a2e2e",
    wallColor: "#305c5c",
    labelColor: "rgba(34,211,238,0.7)",
    doors: [
      { side: "left", offset: 100, width: 50 },
      { side: "top", offset: 70, width: 50 },
    ],
  },
  {
    id: "server-room",
    label: "Servers",
    x: 960, y: 310, w: 210, h: 250,
    floorColor: "#1a1a1e",
    wallColor: "#3b3b44",
    labelColor: "rgba(161,161,170,0.7)",
    doors: [{ side: "top", offset: 80, width: 50 }],
  },
  {
    id: "command-center",
    label: "Command Center",
    x: 30, y: 620, w: 1140, h: 150,
    floorColor: "#16162a",
    wallColor: "#2e2e5c",
    labelColor: "rgba(99,102,241,0.6)",
    doors: [
      { side: "top", offset: 150, width: 60 },
      { side: "top", offset: 550, width: 60 },
      { side: "top", offset: 900, width: 60 },
    ],
  },
];

// ── Furniture definitions ─────────────────────────────────────────────────────

export type FurnitureType =
  | "desk" | "chair" | "monitor" | "whiteboard" | "plant"
  | "coffee" | "couch" | "tv" | "server-rack" | "bookshelf";

export interface Furniture {
  type: FurnitureType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number; // degrees
  color?: string;
}

export const FURNITURE: Furniture[] = [
  // ── Diretoria ───────────────────────────────────────────────────────────────
  { type: "desk",      x: 80,  y: 100, w: 70, h: 35 },
  { type: "monitor",   x: 95,  y: 95,  w: 30, h: 8 },
  { type: "chair",     x: 100, y: 145, w: 20, h: 20 },
  { type: "desk",      x: 180, y: 100, w: 70, h: 35 },
  { type: "monitor",   x: 195, y: 95,  w: 30, h: 8 },
  { type: "chair",     x: 200, y: 145, w: 20, h: 20 },
  { type: "bookshelf", x: 40,  y: 40,  w: 60, h: 16 },
  { type: "plant",     x: 260, y: 45,  w: 16, h: 16 },

  // ── Sprint Room ─────────────────────────────────────────────────────────────
  { type: "whiteboard", x: 340, y: 38, w: 120, h: 12 },
  { type: "desk",       x: 370, y: 100, w: 60, h: 30 },
  { type: "chair",      x: 385, y: 140, w: 18, h: 18 },
  { type: "desk",       x: 470, y: 100, w: 60, h: 30 },
  { type: "chair",      x: 485, y: 140, w: 18, h: 18 },
  { type: "desk",       x: 420, y: 180, w: 60, h: 30 },
  { type: "chair",      x: 435, y: 170, w: 18, h: 18 },
  { type: "plant",      x: 565, y: 45,  w: 16, h: 16 },

  // ── War Room ────────────────────────────────────────────────────────────────
  { type: "tv",    x: 700, y: 38, w: 100, h: 10 },
  { type: "desk",  x: 680, y: 120, w: 160, h: 40 },
  { type: "chair", x: 710, y: 170, w: 18, h: 18 },
  { type: "chair", x: 760, y: 170, w: 18, h: 18 },
  { type: "chair", x: 810, y: 170, w: 18, h: 18 },

  // ── Lounge ──────────────────────────────────────────────────────────────────
  { type: "couch",  x: 940, y: 80,  w: 80, h: 35, color: "#4a3b6a" },
  { type: "couch",  x: 940, y: 150, w: 80, h: 35, color: "#4a3b6a" },
  { type: "coffee", x: 960, y: 124, w: 40, h: 20 },
  { type: "plant",  x: 1130, y: 45, w: 20, h: 20 },
  { type: "plant",  x: 920, y: 45,  w: 16, h: 16 },

  // ── Dev Area ────────────────────────────────────────────────────────────────
  { type: "desk",    x: 80,  y: 380, w: 70, h: 35 },
  { type: "monitor", x: 95,  y: 375, w: 30, h: 8 },
  { type: "chair",   x: 100, y: 425, w: 20, h: 20 },
  { type: "desk",    x: 200, y: 380, w: 70, h: 35 },
  { type: "monitor", x: 215, y: 375, w: 30, h: 8 },
  { type: "chair",   x: 220, y: 425, w: 20, h: 20 },
  { type: "desk",    x: 310, y: 380, w: 70, h: 35 },
  { type: "monitor", x: 325, y: 375, w: 30, h: 8 },
  { type: "chair",   x: 330, y: 425, w: 20, h: 20 },
  { type: "whiteboard", x: 40, y: 318, w: 100, h: 12 },
  { type: "plant",   x: 375, y: 325, w: 16, h: 16 },

  // ── Deploy Room ─────────────────────────────────────────────────────────────
  { type: "desk",    x: 480, y: 380, w: 70, h: 35 },
  { type: "monitor", x: 495, y: 375, w: 30, h: 8 },
  { type: "chair",   x: 500, y: 425, w: 20, h: 20 },
  { type: "tv",      x: 480, y: 318, w: 80, h: 10 },
  { type: "server-rack", x: 620, y: 340, w: 30, h: 50 },

  // ── Metrics Wall ────────────────────────────────────────────────────────────
  { type: "tv",    x: 740, y: 318, w: 80, h: 10 },
  { type: "tv",    x: 840, y: 318, w: 60, h: 10 },
  { type: "desk",  x: 750, y: 420, w: 60, h: 30 },
  { type: "chair", x: 765, y: 460, w: 18, h: 18 },
  { type: "plant", x: 900, y: 520, w: 16, h: 16 },

  // ── Server Room ─────────────────────────────────────────────────────────────
  { type: "server-rack", x: 980,  y: 340, w: 30, h: 50 },
  { type: "server-rack", x: 1020, y: 340, w: 30, h: 50 },
  { type: "server-rack", x: 1060, y: 340, w: 30, h: 50 },
  { type: "server-rack", x: 1100, y: 340, w: 30, h: 50 },
  { type: "server-rack", x: 980,  y: 440, w: 30, h: 50 },
  { type: "server-rack", x: 1020, y: 440, w: 30, h: 50 },

  // ── Command Center ──────────────────────────────────────────────────────────
  { type: "tv",    x: 200,  y: 628, w: 120, h: 10 },
  { type: "tv",    x: 550,  y: 628, w: 120, h: 10 },
  { type: "tv",    x: 900,  y: 628, w: 120, h: 10 },
  { type: "desk",  x: 200,  y: 680, w: 100, h: 35 },
  { type: "desk",  x: 550,  y: 680, w: 100, h: 35 },
  { type: "desk",  x: 900,  y: 680, w: 100, h: 35 },
  { type: "chair", x: 240,  y: 725, w: 18, h: 18 },
  { type: "chair", x: 590,  y: 725, w: 18, h: 18 },
  { type: "chair", x: 940,  y: 725, w: 18, h: 18 },
];

// ── Hotspot definitions ───────────────────────────────────────────────────────

export interface Hotspot {
  id: string;
  label: string;
  roomId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  actionType: "panel" | "navigate";
  actionTarget: string;
  icon: string;
}

export const HOTSPOTS: Hotspot[] = [
  { id: "hs-projects",  label: "Projetos",   roomId: "sprint-room", x: 340, y: 38,  w: 120, h: 12, actionType: "panel", actionTarget: "projects", icon: "📋" },
  { id: "hs-kanban",    label: "Kanban",      roomId: "sprint-room", x: 420, y: 180, w: 60,  h: 30, actionType: "panel", actionTarget: "kanban",   icon: "📌" },
  { id: "hs-incidents", label: "Incidentes",  roomId: "war-room",    x: 700, y: 38,  w: 100, h: 10, actionType: "panel", actionTarget: "incidents", icon: "🔥" },
  { id: "hs-crons",     label: "Crons",       roomId: "deploy-room", x: 480, y: 318, w: 80,  h: 10, actionType: "panel", actionTarget: "crons",     icon: "⏰" },
  { id: "hs-metrics",   label: "Dashboard",   roomId: "metrics-wall",x: 740, y: 318, w: 80,  h: 10, actionType: "panel", actionTarget: "stats",     icon: "📊" },
  { id: "hs-agents",    label: "Agents",      roomId: "diretoria",   x: 40,  y: 40,  w: 60,  h: 16, actionType: "panel", actionTarget: "agents",    icon: "🤖" },
];

// ── Agent definitions ─────────────────────────────────────────────────────────

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  skinColor: string;    // skin tone
  shirtColor: string;   // body/shirt color
  hairColor: string;    // hair color
  pantsColor: string;   // legs/pants color
  defaultRoom: string;  // room they spawn in
  spawnX: number;       // spawn position within the room
  spawnY: number;
}

export const AGENTS: AgentConfig[] = [
  {
    id: "joao", name: "João", role: "Operator",
    skinColor: "#f0c8a0", shirtColor: "#3b82f6", hairColor: "#4a3728", pantsColor: "#1e3a5f",
    defaultRoom: "diretoria", spawnX: 110, spawnY: 160,
  },
  {
    id: "jota", name: "Jota", role: "Faísca",
    skinColor: "#f0c8a0", shirtColor: "#8b5cf6", hairColor: "#2d1b4e", pantsColor: "#3b2066",
    defaultRoom: "diretoria", spawnX: 210, spawnY: 160,
  },
  {
    id: "caio", name: "Caio", role: "Agent",
    skinColor: "#d4a574", shirtColor: "#10b981", hairColor: "#1a1a1a", pantsColor: "#064e3b",
    defaultRoom: "dev-area", spawnX: 110, spawnY: 440,
  },
  {
    id: "leticia", name: "Letícia", role: "Agent",
    skinColor: "#f0c8a0", shirtColor: "#f59e0b", hairColor: "#8b6914", pantsColor: "#78350f",
    defaultRoom: "sprint-room", spawnX: 395, spawnY: 155,
  },
  {
    id: "clara", name: "Clara", role: "Agent",
    skinColor: "#e8b890", shirtColor: "#ec4899", hairColor: "#5c1a3a", pantsColor: "#831843",
    defaultRoom: "dev-area", spawnX: 230, spawnY: 440,
  },
];

// ── Room center points (for pathfinding targets) ──────────────────────────────

export function getRoomCenter(roomId: string): { x: number; y: number } | null {
  const room = ROOMS.find((r) => r.id === roomId);
  if (!room) return null;
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 + 20 };
}
