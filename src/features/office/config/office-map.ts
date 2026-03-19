// ── Office Map Configuration — Gather-Style (v2) ─────────────────────────────
// Rich pixel-art office with 3D walls, textured floors, and dense furniture.

export const CANVAS_W = 1400;
export const CANVAS_H = 900;
export const TILE = 24;

// ── Room types ────────────────────────────────────────────────────────────────

export type FloorType = "carpet" | "tile" | "wood" | "stone";

export interface Room {
  id: string;
  label: string;
  x: number; y: number; w: number; h: number;
  floorColor: string;
  floorAccent: string;   // secondary color for floor pattern
  floorType: FloorType;
  wallColor: string;
  wallTop: string;       // lighter top face for 3D
  labelColor: string;
  doors: Door[];
}

export interface Door {
  side: "top" | "bottom" | "left" | "right";
  offset: number;
  width: number;
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

const WALL_H = 10; // visual wall height for 3D effect

export const ROOMS: Room[] = [
  {
    id: "diretoria", label: "Diretoria",
    x: 40, y: 40, w: 300, h: 230,
    floorColor: "#2a2240", floorAccent: "#322850", floorType: "carpet",
    wallColor: "#5c4f8a", wallTop: "#7a6baa",
    labelColor: "#c4b5fd",
    doors: [{ side: "right", offset: 90, width: 50 }, { side: "bottom", offset: 130, width: 50 }],
  },
  {
    id: "sprint-room", label: "Sprint Room",
    x: 380, y: 40, w: 300, h: 230,
    floorColor: "#1e2e20", floorAccent: "#263828", floorType: "carpet",
    wallColor: "#4a7a4f", wallTop: "#6aaa70",
    labelColor: "#86efac",
    doors: [
      { side: "left", offset: 90, width: 50 },
      { side: "right", offset: 90, width: 50 },
      { side: "bottom", offset: 130, width: 50 },
    ],
  },
  {
    id: "war-room", label: "War Room",
    x: 720, y: 40, w: 280, h: 230,
    floorColor: "#2e1e1e", floorAccent: "#3a2626", floorType: "tile",
    wallColor: "#8a4f4f", wallTop: "#aa6b6b",
    labelColor: "#fca5a5",
    doors: [
      { side: "left", offset: 90, width: 50 },
      { side: "bottom", offset: 110, width: 50 },
    ],
  },
  {
    id: "lounge", label: "Lounge",
    x: 1040, y: 40, w: 320, h: 230,
    floorColor: "#2e2a22", floorAccent: "#3a3428", floorType: "wood",
    wallColor: "#7a6a50", wallTop: "#9a8a6a",
    labelColor: "#fde68a",
    doors: [{ side: "bottom", offset: 140, width: 50 }],
  },
  {
    id: "dev-area", label: "Dev Area",
    x: 40, y: 330, w: 420, h: 260,
    floorColor: "#1e2230", floorAccent: "#262c3a", floorType: "carpet",
    wallColor: "#4f5c8a", wallTop: "#6b7aaa",
    labelColor: "#93c5fd",
    doors: [
      { side: "top", offset: 300, width: 50 },
      { side: "right", offset: 110, width: 50 },
    ],
  },
  {
    id: "deploy-room", label: "Deploy / Infra",
    x: 500, y: 330, w: 260, h: 260,
    floorColor: "#2e2818", floorAccent: "#38321e", floorType: "tile",
    wallColor: "#8a7a3a", wallTop: "#aa9a5a",
    labelColor: "#fbbf24",
    doors: [
      { side: "left", offset: 110, width: 50 },
      { side: "top", offset: 90, width: 50 },
      { side: "right", offset: 110, width: 50 },
    ],
  },
  {
    id: "metrics-wall", label: "Metrics",
    x: 800, y: 330, w: 240, h: 260,
    floorColor: "#182828", floorAccent: "#203232", floorType: "tile",
    wallColor: "#3a7a7a", wallTop: "#5a9a9a",
    labelColor: "#67e8f9",
    doors: [
      { side: "left", offset: 110, width: 50 },
      { side: "top", offset: 80, width: 50 },
    ],
  },
  {
    id: "server-room", label: "Servers",
    x: 1080, y: 330, w: 280, h: 260,
    floorColor: "#181820", floorAccent: "#202028", floorType: "stone",
    wallColor: "#3a3a50", wallTop: "#5a5a70",
    labelColor: "#a1a1aa",
    doors: [{ side: "top", offset: 110, width: 50 }],
  },
  {
    id: "command-center", label: "Command Center",
    x: 40, y: 650, w: 1320, h: 210,
    floorColor: "#18182e", floorAccent: "#202038", floorType: "carpet",
    wallColor: "#3a3a7a", wallTop: "#5a5a9a",
    labelColor: "#a5b4fc",
    doors: [
      { side: "top", offset: 180, width: 60 },
      { side: "top", offset: 600, width: 60 },
      { side: "top", offset: 1050, width: 60 },
    ],
  },
];

export { WALL_H };

// ── Furniture ─────────────────────────────────────────────────────────────────

export type FurnitureType =
  | "desk" | "chair" | "monitor" | "whiteboard" | "plant" | "plant-big"
  | "coffee-machine" | "couch" | "tv" | "server-rack" | "bookshelf"
  | "painting" | "rug" | "lamp" | "printer" | "water-cooler"
  | "bean-bag" | "trash-can" | "aquarium" | "coffee-table" | "clock"
  | "filing-cabinet" | "potted-tree";

export interface Furniture {
  type: FurnitureType;
  x: number; y: number; w: number; h: number;
  color?: string;
  variant?: number; // for different looks of same type
}

export const FURNITURE: Furniture[] = [
  // ═══════════════════ Diretoria ═══════════════════════════════════════════════
  // Executive desk (large)
  { type: "desk",    x: 80,  y: 110, w: 80, h: 40 },
  { type: "monitor", x: 95,  y: 105, w: 35, h: 12 },
  { type: "monitor", x: 132, y: 105, w: 20, h: 10, variant: 1 },
  { type: "chair",   x: 105, y: 160, w: 22, h: 22 },
  // Jota's desk
  { type: "desk",    x: 210, y: 110, w: 80, h: 40 },
  { type: "monitor", x: 230, y: 105, w: 35, h: 12 },
  { type: "chair",   x: 240, y: 160, w: 22, h: 22 },
  // Decor
  { type: "bookshelf", x: 48, y: 48, w: 70, h: 20 },
  { type: "painting",  x: 160, y: 48, w: 40, h: 28, variant: 0 },
  { type: "plant-big", x: 295, y: 55, w: 24, h: 30 },
  { type: "rug",       x: 100, y: 190, w: 120, h: 50, color: "#3d2d5e" },
  { type: "lamp",      x: 55,  y: 85,  w: 12, h: 24 },
  { type: "filing-cabinet", x: 280, y: 110, w: 28, h: 35 },
  { type: "clock",     x: 230, y: 48,  w: 16, h: 16 },

  // ═══════════════════ Sprint Room ════════════════════════════════════════════
  { type: "whiteboard", x: 390, y: 48, w: 140, h: 16 },
  { type: "desk",    x: 400, y: 110, w: 70, h: 35 },
  { type: "monitor", x: 415, y: 105, w: 30, h: 10 },
  { type: "chair",   x: 420, y: 155, w: 20, h: 20 },
  { type: "desk",    x: 510, y: 110, w: 70, h: 35 },
  { type: "monitor", x: 525, y: 105, w: 30, h: 10 },
  { type: "chair",   x: 530, y: 155, w: 20, h: 20 },
  { type: "desk",    x: 455, y: 195, w: 70, h: 35 },
  { type: "monitor", x: 470, y: 190, w: 30, h: 10 },
  { type: "chair",   x: 475, y: 180, w: 20, h: 20 },
  { type: "plant",   x: 610, y: 55,  w: 16, h: 18 },
  { type: "plant",   x: 640, y: 215, w: 14, h: 16 },
  { type: "trash-can", x: 393, y: 230, w: 12, h: 14 },
  { type: "printer",   x: 600, y: 100, w: 36, h: 24 },

  // ═══════════════════ War Room ═══════════════════════════════════════════════
  { type: "tv",      x: 760, y: 48, w: 120, h: 14 },
  { type: "tv",      x: 900, y: 48, w: 60,  h: 14, variant: 1 },
  { type: "desk",    x: 740, y: 130, w: 200, h: 45 },
  { type: "chair",   x: 770, y: 185, w: 20, h: 20 },
  { type: "chair",   x: 830, y: 185, w: 20, h: 20 },
  { type: "chair",   x: 890, y: 185, w: 20, h: 20 },
  { type: "monitor", x: 770, y: 125, w: 28, h: 10 },
  { type: "monitor", x: 830, y: 125, w: 28, h: 10, variant: 1 },
  { type: "monitor", x: 890, y: 125, w: 28, h: 10 },
  { type: "water-cooler", x: 960, y: 100, w: 16, h: 28 },
  { type: "trash-can",    x: 960, y: 220, w: 12, h: 14 },
  { type: "clock",   x: 738, y: 80, w: 14, h: 14 },

  // ═══════════════════ Lounge ═════════════════════════════════════════════════
  { type: "couch",       x: 1070, y: 80,  w: 90, h: 38, color: "#6a4a2a" },
  { type: "couch",       x: 1070, y: 175, w: 90, h: 38, color: "#6a4a2a" },
  { type: "coffee-table", x: 1085, y: 128, w: 60, h: 30 },
  { type: "bean-bag",    x: 1190, y: 90,  w: 28, h: 28, color: "#d946ef" },
  { type: "bean-bag",    x: 1230, y: 140, w: 28, h: 28, color: "#3b82f6" },
  { type: "bean-bag",    x: 1190, y: 185, w: 28, h: 28, color: "#ef4444" },
  { type: "potted-tree", x: 1310, y: 55,  w: 30, h: 40 },
  { type: "plant-big",   x: 1050, y: 55,  w: 22, h: 28 },
  { type: "painting",    x: 1280, y: 48,  w: 50, h: 32, variant: 1 },
  { type: "aquarium",    x: 1260, y: 170, w: 60, h: 30 },
  { type: "coffee-machine", x: 1300, y: 100, w: 24, h: 32 },
  { type: "rug",         x: 1080, y: 85,  w: 90, h: 135, color: "#4a3a2a" },
  { type: "lamp",        x: 1170, y: 125, w: 10, h: 20 },

  // ═══════════════════ Dev Area ═══════════════════════════════════════════════
  { type: "desk",    x: 80,  y: 400, w: 75, h: 38 },
  { type: "monitor", x: 95,  y: 395, w: 32, h: 12 },
  { type: "chair",   x: 102, y: 448, w: 22, h: 22 },
  { type: "desk",    x: 200, y: 400, w: 75, h: 38 },
  { type: "monitor", x: 215, y: 395, w: 32, h: 12 },
  { type: "chair",   x: 225, y: 448, w: 22, h: 22 },
  { type: "desk",    x: 320, y: 400, w: 75, h: 38 },
  { type: "monitor", x: 335, y: 395, w: 32, h: 12 },
  { type: "chair",   x: 342, y: 448, w: 22, h: 22 },
  { type: "whiteboard", x: 50, y: 338, w: 120, h: 16 },
  { type: "plant",   x: 415, y: 345, w: 18, h: 20 },
  { type: "plant",   x: 50,  y: 540, w: 16, h: 18 },
  { type: "printer", x: 380, y: 490, w: 36, h: 24 },
  { type: "rug",     x: 100, y: 490, w: 200, h: 60, color: "#1e2a4a" },
  { type: "trash-can", x: 420, y: 540, w: 12, h: 14 },
  { type: "filing-cabinet", x: 50, y: 420, w: 24, h: 35 },
  // Extra desk row
  { type: "desk",    x: 120, y: 510, w: 75, h: 38 },
  { type: "monitor", x: 135, y: 505, w: 32, h: 12 },
  { type: "chair",   x: 145, y: 500, w: 20, h: 20 },
  { type: "desk",    x: 240, y: 510, w: 75, h: 38 },
  { type: "monitor", x: 255, y: 505, w: 32, h: 12 },
  { type: "chair",   x: 265, y: 500, w: 20, h: 20 },

  // ═══════════════════ Deploy Room ════════════════════════════════════════════
  { type: "desk",    x: 530, y: 400, w: 75, h: 38 },
  { type: "monitor", x: 545, y: 395, w: 32, h: 12, variant: 1 },
  { type: "chair",   x: 555, y: 448, w: 22, h: 22 },
  { type: "tv",      x: 530, y: 338, w: 100, h: 14 },
  { type: "server-rack", x: 690, y: 370, w: 32, h: 55 },
  { type: "server-rack", x: 690, y: 440, w: 32, h: 55 },
  { type: "desk",    x: 530, y: 510, w: 75, h: 38 },
  { type: "monitor", x: 545, y: 505, w: 32, h: 12 },
  { type: "chair",   x: 555, y: 500, w: 20, h: 20 },
  { type: "lamp",    x: 640, y: 400, w: 12, h: 22 },
  { type: "trash-can", x: 640, y: 550, w: 12, h: 14 },

  // ═══════════════════ Metrics Wall ═══════════════════════════════════════════
  { type: "tv",      x: 820, y: 338, w: 90, h: 14 },
  { type: "tv",      x: 930, y: 338, w: 60, h: 14, variant: 1 },
  { type: "tv",      x: 820, y: 362, w: 60, h: 14, variant: 2 },
  { type: "desk",    x: 830, y: 440, w: 70, h: 35 },
  { type: "monitor", x: 845, y: 435, w: 28, h: 10 },
  { type: "chair",   x: 855, y: 485, w: 20, h: 20 },
  { type: "desk",    x: 930, y: 440, w: 60, h: 35 },
  { type: "chair",   x: 945, y: 485, w: 20, h: 20 },
  { type: "plant",   x: 990, y: 545, w: 16, h: 18 },
  { type: "plant",   x: 815, y: 545, w: 14, h: 16 },

  // ═══════════════════ Server Room ════════════════════════════════════════════
  { type: "server-rack", x: 1100, y: 365, w: 34, h: 55 },
  { type: "server-rack", x: 1145, y: 365, w: 34, h: 55 },
  { type: "server-rack", x: 1190, y: 365, w: 34, h: 55 },
  { type: "server-rack", x: 1240, y: 365, w: 34, h: 55 },
  { type: "server-rack", x: 1290, y: 365, w: 34, h: 55 },
  { type: "server-rack", x: 1100, y: 460, w: 34, h: 55 },
  { type: "server-rack", x: 1145, y: 460, w: 34, h: 55 },
  { type: "server-rack", x: 1190, y: 460, w: 34, h: 55 },
  { type: "lamp",        x: 1300, y: 470, w: 12, h: 22 },
  { type: "clock",       x: 1090, y: 340, w: 14, h: 14 },

  // ═══════════════════ Command Center ═════════════════════════════════════════
  { type: "tv",    x: 180,  y: 658, w: 140, h: 14 },
  { type: "tv",    x: 560,  y: 658, w: 140, h: 14, variant: 1 },
  { type: "tv",    x: 940,  y: 658, w: 140, h: 14, variant: 2 },
  { type: "desk",  x: 180,  y: 710, w: 110, h: 40 },
  { type: "desk",  x: 560,  y: 710, w: 110, h: 40 },
  { type: "desk",  x: 940,  y: 710, w: 110, h: 40 },
  { type: "monitor", x: 200,  y: 705, w: 30, h: 10 },
  { type: "monitor", x: 245,  y: 705, w: 30, h: 10, variant: 1 },
  { type: "monitor", x: 580,  y: 705, w: 30, h: 10 },
  { type: "monitor", x: 625,  y: 705, w: 30, h: 10, variant: 1 },
  { type: "monitor", x: 960,  y: 705, w: 30, h: 10 },
  { type: "monitor", x: 1005, y: 705, w: 30, h: 10, variant: 1 },
  { type: "chair", x: 220,  y: 760, w: 22, h: 22 },
  { type: "chair", x: 600,  y: 760, w: 22, h: 22 },
  { type: "chair", x: 980,  y: 760, w: 22, h: 22 },
  { type: "rug",   x: 500,  y: 780, w: 300, h: 50, color: "#1e1e40" },
  { type: "plant-big", x: 100,  y: 670, w: 24, h: 30 },
  { type: "plant-big", x: 1280, y: 670, w: 24, h: 30 },
  { type: "water-cooler", x: 1300, y: 730, w: 16, h: 28 },
  { type: "coffee-machine", x: 60, y: 730, w: 24, h: 32 },
];

// ── Hotspots ──────────────────────────────────────────────────────────────────

export interface Hotspot {
  id: string; label: string; roomId: string;
  x: number; y: number; w: number; h: number;
  actionType: "panel" | "navigate"; actionTarget: string; icon: string;
}

export const HOTSPOTS: Hotspot[] = [
  { id: "hs-projects",  label: "Projetos",  roomId: "sprint-room", x: 390, y: 48,  w: 140, h: 16, actionType: "panel", actionTarget: "projects", icon: "📋" },
  { id: "hs-kanban",    label: "Kanban",     roomId: "sprint-room", x: 455, y: 195, w: 70,  h: 35, actionType: "panel", actionTarget: "kanban",   icon: "📌" },
  { id: "hs-incidents", label: "Incidentes", roomId: "war-room",    x: 760, y: 48,  w: 120, h: 14, actionType: "panel", actionTarget: "incidents", icon: "🔥" },
  { id: "hs-crons",     label: "Crons",      roomId: "deploy-room", x: 530, y: 338, w: 100, h: 14, actionType: "panel", actionTarget: "crons",     icon: "⏰" },
  { id: "hs-metrics",   label: "Dashboard",  roomId: "metrics-wall",x: 820, y: 338, w: 90,  h: 14, actionType: "panel", actionTarget: "stats",     icon: "📊" },
  { id: "hs-agents",    label: "Agents",     roomId: "diretoria",   x: 48,  y: 48,  w: 70,  h: 20, actionType: "panel", actionTarget: "agents",    icon: "🤖" },
];

// ── Agents ─────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  id: string; name: string; role: string;
  skinColor: string; shirtColor: string; hairColor: string; pantsColor: string;
  hairStyle: "short" | "medium" | "long" | "curly";
  defaultRoom: string; spawnX: number; spawnY: number;
}

export const AGENTS: AgentConfig[] = [
  {
    id: "joao", name: "João", role: "Operator",
    skinColor: "#f0c8a0", shirtColor: "#3b82f6", hairColor: "#4a3728", pantsColor: "#1e3a5f",
    hairStyle: "short",
    defaultRoom: "diretoria", spawnX: 115, spawnY: 175,
  },
  {
    id: "jota", name: "Jota", role: "Faísca",
    skinColor: "#f0c8a0", shirtColor: "#8b5cf6", hairColor: "#2d1b4e", pantsColor: "#3b2066",
    hairStyle: "medium",
    defaultRoom: "diretoria", spawnX: 250, spawnY: 175,
  },
  {
    id: "caio", name: "Caio", role: "Agent",
    skinColor: "#d4a574", shirtColor: "#10b981", hairColor: "#1a1a1a", pantsColor: "#064e3b",
    hairStyle: "curly",
    defaultRoom: "dev-area", spawnX: 115, spawnY: 465,
  },
  {
    id: "leticia", name: "Letícia", role: "Agent",
    skinColor: "#f0c8a0", shirtColor: "#f59e0b", hairColor: "#8b6914", pantsColor: "#78350f",
    hairStyle: "long",
    defaultRoom: "sprint-room", spawnX: 435, spawnY: 170,
  },
  {
    id: "clara", name: "Clara", role: "Agent",
    skinColor: "#e8b890", shirtColor: "#ec4899", hairColor: "#5c1a3a", pantsColor: "#831843",
    hairStyle: "medium",
    defaultRoom: "dev-area", spawnX: 240, spawnY: 465,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getRoomCenter(roomId: string): { x: number; y: number } | null {
  const room = ROOMS.find((r) => r.id === roomId);
  if (!room) return null;
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 + 20 };
}
