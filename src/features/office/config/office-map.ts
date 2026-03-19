// ── Office Map — Real Company Departments ─────────────────────────────────────
// 6 rooms representing actual departments. Agents sit where they work.

export const CANVAS_W = 1400;
export const CANVAS_H = 900;
export const TILE = 24;

// ── Types ─────────────────────────────────────────────────────────────────────

export type FloorType = "carpet" | "tile" | "wood" | "stone";

export interface Room {
  id: string;
  label: string;
  x: number; y: number; w: number; h: number;
  floorColor: string;
  floorAccent: string;
  floorType: FloorType;
  wallColor: string;
  wallTop: string;
  labelColor: string;
  doors: Door[];
}

export interface Door {
  side: "top" | "bottom" | "left" | "right";
  offset: number;
  width: number;
}

const WALL_H = 10;
export { WALL_H };

// ── 6 Department Rooms ────────────────────────────────────────────────────────
//
// Layout (1400 x 900):
//
//  ┌──────────────┬──────────────┬────────────────────┐
//  │  Recepção    │  Diretoria   │  Sala de Reunião   │  Row 1: y=40..310
//  │  (300x270)   │  (340x270)   │  (400x270)         │
//  └──────────────┴──────────────┴────────────────────┘
//        corridor strip y=310..360
//  ┌────────────────────┬──────────────┬──────────────┐
//  │  Desenvolvimento   │  Operações   │    Copa      │  Row 2: y=360..620
//  │  (500x260)         │  (340x260)   │  (260x260)   │
//  └────────────────────┴──────────────┴──────────────┘

export const ROOMS: Room[] = [
  // ── Row 1 ───────────────────────────────────────────────────────────────────
  {
    id: "recepcao", label: "Recepção",
    x: 40, y: 40, w: 340, h: 270,
    floorColor: "#2a2520", floorAccent: "#342e28", floorType: "wood",
    wallColor: "#6a5a4a", wallTop: "#8a7a6a",
    labelColor: "#fde68a",
    doors: [
      { side: "right", offset: 110, width: 55 },
      { side: "bottom", offset: 150, width: 55 },
    ],
  },
  {
    id: "diretoria", label: "Diretoria",
    x: 420, y: 40, w: 380, h: 270,
    floorColor: "#2a2240", floorAccent: "#322850", floorType: "carpet",
    wallColor: "#5c4f8a", wallTop: "#7a6baa",
    labelColor: "#c4b5fd",
    doors: [
      { side: "left", offset: 110, width: 55 },
      { side: "right", offset: 110, width: 55 },
      { side: "bottom", offset: 170, width: 55 },
    ],
  },
  {
    id: "sala-reuniao", label: "Sala de Reunião",
    x: 840, y: 40, w: 520, h: 270,
    floorColor: "#1e2230", floorAccent: "#262c3a", floorType: "carpet",
    wallColor: "#4a5a7a", wallTop: "#6a7a9a",
    labelColor: "#93c5fd",
    doors: [
      { side: "left", offset: 110, width: 55 },
      { side: "bottom", offset: 230, width: 55 },
    ],
  },

  // ── Row 2 ───────────────────────────────────────────────────────────────────
  {
    id: "desenvolvimento", label: "Desenvolvimento",
    x: 40, y: 360, w: 540, h: 260,
    floorColor: "#1e2e20", floorAccent: "#263828", floorType: "carpet",
    wallColor: "#4a7a4f", wallTop: "#6aaa70",
    labelColor: "#86efac",
    doors: [
      { side: "top", offset: 250, width: 55 },
      { side: "right", offset: 110, width: 55 },
    ],
  },
  {
    id: "operacoes", label: "Operações",
    x: 620, y: 360, w: 380, h: 260,
    floorColor: "#2e2818", floorAccent: "#38321e", floorType: "tile",
    wallColor: "#8a7a3a", wallTop: "#aa9a5a",
    labelColor: "#fbbf24",
    doors: [
      { side: "left", offset: 110, width: 55 },
      { side: "top", offset: 160, width: 55 },
      { side: "right", offset: 110, width: 55 },
    ],
  },
  {
    id: "copa", label: "Copa",
    x: 1040, y: 360, w: 320, h: 260,
    floorColor: "#2e2a22", floorAccent: "#3a3428", floorType: "wood",
    wallColor: "#7a6a50", wallTop: "#9a8a6a",
    labelColor: "#fde68a",
    doors: [
      { side: "left", offset: 110, width: 55 },
      { side: "top", offset: 130, width: 55 },
    ],
  },

  // ── Row 3 — Leisure areas ─────────────────────────────────────────────────
  {
    id: "salao-jogos", label: "Salão de Jogos",
    x: 40, y: 660, w: 500, h: 200,
    floorColor: "#1a1a2e", floorAccent: "#22224a", floorType: "carpet",
    wallColor: "#4a3a6a", wallTop: "#6a5a8a",
    labelColor: "#c084fc",
    doors: [
      { side: "top", offset: 220, width: 55 },
      { side: "right", offset: 80, width: 55 },
    ],
  },
  {
    id: "jardim", label: "Jardim",
    x: 580, y: 660, w: 780, h: 200,
    floorColor: "#1a2e1a", floorAccent: "#223a20", floorType: "stone",
    wallColor: "#3a5a3a", wallTop: "#5a7a5a",
    labelColor: "#86efac",
    doors: [
      { side: "left", offset: 80, width: 55 },
      { side: "top", offset: 200, width: 55 },
      { side: "top", offset: 500, width: 55 },
    ],
  },
];

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
  variant?: number;
}

export const FURNITURE: Furniture[] = [
  // ═══════════════════ Recepção (40,40 → 380,310) ═════════════════════════════
  { type: "couch",       x: 80,  y: 100, w: 100, h: 40, color: "#5a4a3a" },
  { type: "couch",       x: 80,  y: 200, w: 100, h: 40, color: "#5a4a3a" },
  { type: "coffee-table", x: 100, y: 152, w: 60,  h: 30 },
  { type: "plant-big",   x: 55,  y: 60,  w: 24, h: 30 },
  { type: "potted-tree", x: 330, y: 60,  w: 30, h: 40 },
  { type: "water-cooler", x: 330, y: 140, w: 16, h: 28 },
  { type: "painting",    x: 200, y: 58,  w: 60, h: 32, variant: 1 },
  { type: "rug",         x: 70,  y: 95,  w: 140, h: 155, color: "#3a2a1a" },
  { type: "lamp",        x: 195, y: 130, w: 12, h: 22 },
  { type: "desk",        x: 250, y: 180, w: 80,  h: 40 },
  { type: "monitor",     x: 270, y: 175, w: 30,  h: 10 },
  { type: "chair",       x: 278, y: 230, w: 22,  h: 22 },

  // ═══════════════════ Diretoria (420,40 → 800,310) ═══════════════════════════
  // João's desk — dual monitor setup
  { type: "desk",        x: 460, y: 120, w: 90,  h: 42 },
  { type: "monitor",     x: 475, y: 115, w: 35,  h: 12 },
  { type: "monitor",     x: 515, y: 116, w: 22,  h: 10, variant: 1 },
  { type: "chair",       x: 495, y: 175, w: 24,  h: 24 },
  // Jota's desk — dual monitor setup
  { type: "desk",        x: 630, y: 120, w: 90,  h: 42 },
  { type: "monitor",     x: 645, y: 115, w: 35,  h: 12 },
  { type: "monitor",     x: 685, y: 116, w: 22,  h: 10, variant: 2 },
  { type: "chair",       x: 665, y: 175, w: 24,  h: 24 },
  { type: "bookshelf",   x: 430, y: 58,  w: 80,  h: 20 },
  { type: "painting",    x: 600, y: 58,  w: 50,  h: 30, variant: 0 },
  { type: "plant-big",   x: 760, y: 65,  w: 24,  h: 30 },
  { type: "filing-cabinet", x: 760, y: 130, w: 28, h: 38 },
  { type: "printer",     x: 760, y: 180, w: 30,  h: 20 },
  { type: "rug",         x: 470, y: 200, w: 180, h: 70, color: "#3d2d5e" },
  { type: "lamp",        x: 435, y: 95,  w: 12,  h: 22 },
  { type: "clock",       x: 680, y: 58,  w: 16,  h: 16 },

  // ═══════════════════ Sala de Reunião (840,40 → 1360,310) ════════════════════
  // Large central meeting table
  { type: "desk",        x: 950, y: 130, w: 250, h: 80 },
  { type: "chair",       x: 980, y: 115, w: 20,  h: 20 },
  { type: "chair",       x: 1040, y: 115, w: 20, h: 20 },
  { type: "chair",       x: 1100, y: 115, w: 20, h: 20 },
  { type: "chair",       x: 1160, y: 115, w: 20, h: 20 },
  { type: "chair",       x: 980,  y: 220, w: 20, h: 20 },
  { type: "chair",       x: 1040, y: 220, w: 20, h: 20 },
  { type: "chair",       x: 1100, y: 220, w: 20, h: 20 },
  { type: "chair",       x: 1160, y: 220, w: 20, h: 20 },
  { type: "tv",          x: 960,  y: 58,  w: 180, h: 16 },
  { type: "whiteboard",  x: 1200, y: 58,  w: 120, h: 16 },
  { type: "plant",       x: 860,  y: 65,  w: 18,  h: 20 },
  { type: "plant",       x: 1320, y: 65,  w: 18,  h: 20 },
  { type: "water-cooler", x: 1320, y: 250, w: 16, h: 28 },
  { type: "trash-can",   x: 860,  y: 270, w: 14,  h: 16 },

  // ═══════════════════ Desenvolvimento (40,360 → 580,620) ═════════════════════
  // Row 1 — dual monitor workstations (Caio, Clara, + 2 empty)
  { type: "desk",    x: 70,  y: 420, w: 75, h: 38 },
  { type: "monitor", x: 80,  y: 415, w: 28, h: 12 },
  { type: "monitor", x: 112, y: 416, w: 20, h: 10, variant: 1 },
  { type: "chair",   x: 95,  y: 468, w: 22, h: 22 },
  { type: "desk",    x: 190, y: 420, w: 75, h: 38 },
  { type: "monitor", x: 200, y: 415, w: 28, h: 12 },
  { type: "monitor", x: 232, y: 416, w: 20, h: 10, variant: 2 },
  { type: "chair",   x: 218, y: 468, w: 22, h: 22 },
  { type: "desk",    x: 310, y: 420, w: 75, h: 38 },
  { type: "monitor", x: 320, y: 415, w: 28, h: 12 },
  { type: "monitor", x: 352, y: 416, w: 20, h: 10, variant: 1 },
  { type: "chair",   x: 338, y: 468, w: 22, h: 22 },
  { type: "desk",    x: 430, y: 420, w: 75, h: 38 },
  { type: "monitor", x: 440, y: 415, w: 28, h: 12 },
  { type: "monitor", x: 472, y: 416, w: 20, h: 10, variant: 2 },
  { type: "chair",   x: 458, y: 468, w: 22, h: 22 },
  // Row 2 — single monitor + laptop setups
  { type: "desk",    x: 120, y: 530, w: 75, h: 38 },
  { type: "monitor", x: 135, y: 525, w: 28, h: 12 },
  { type: "chair",   x: 145, y: 520, w: 20, h: 20 },
  { type: "desk",    x: 250, y: 530, w: 75, h: 38 },
  { type: "monitor", x: 265, y: 525, w: 28, h: 12 },
  { type: "chair",   x: 278, y: 520, w: 20, h: 20 },
  { type: "desk",    x: 380, y: 530, w: 75, h: 38 },
  { type: "monitor", x: 395, y: 525, w: 28, h: 12 },
  { type: "monitor", x: 427, y: 526, w: 18, h: 10, variant: 1 },
  { type: "chair",   x: 408, y: 520, w: 20, h: 20 },
  // Decor
  { type: "whiteboard", x: 55,  y: 378, w: 140, h: 16 },
  { type: "printer",    x: 500, y: 530, w: 36, h: 24 },
  { type: "plant",      x: 530, y: 375, w: 18, h: 20 },
  { type: "plant",      x: 55,  y: 580, w: 16, h: 18 },
  { type: "trash-can",  x: 540, y: 580, w: 14, h: 16 },

  // ═══════════════════ Operações (620,360 → 1000,620) ═════════════════════════
  // Wall monitors (dashboards)
  { type: "tv",          x: 650, y: 378, w: 120, h: 14 },
  { type: "tv",          x: 800, y: 378, w: 80,  h: 14, variant: 1 },
  // Letícia's desk — triple monitor NOC setup
  { type: "desk",        x: 650, y: 440, w: 80,  h: 38 },
  { type: "monitor",     x: 658, y: 435, w: 28,  h: 12 },
  { type: "monitor",     x: 690, y: 436, w: 22,  h: 10, variant: 1 },
  { type: "chair",       x: 680, y: 490, w: 22,  h: 22 },
  // Desk 2 — dual monitor
  { type: "desk",        x: 780, y: 440, w: 80,  h: 38 },
  { type: "monitor",     x: 790, y: 435, w: 28,  h: 12, variant: 1 },
  { type: "monitor",     x: 822, y: 436, w: 22,  h: 10, variant: 2 },
  { type: "chair",       x: 810, y: 490, w: 22,  h: 22 },
  // Server racks
  { type: "server-rack", x: 920, y: 400, w: 34,  h: 55 },
  { type: "server-rack", x: 920, y: 470, w: 34,  h: 55 },
  { type: "server-rack", x: 960, y: 400, w: 34,  h: 55 },
  // Desk 3 — monitoring station
  { type: "desk",        x: 650, y: 550, w: 80,  h: 38 },
  { type: "monitor",     x: 660, y: 545, w: 28,  h: 12 },
  { type: "monitor",     x: 692, y: 546, w: 22,  h: 10, variant: 2 },
  { type: "chair",       x: 680, y: 540, w: 20,  h: 20 },
  { type: "lamp",        x: 880, y: 420, w: 12,  h: 22 },
  { type: "clock",       x: 640, y: 380, w: 14,  h: 14 },
  { type: "printer",     x: 880, y: 540, w: 32,  h: 22 },
  { type: "trash-can",   x: 960, y: 570, w: 14,  h: 16 },

  // ═══════════════════ Copa (1040,360 → 1360,620) ═════════════════════════════
  { type: "rug",           x: 1070, y: 400, w: 120, h: 150, color: "#4a3a2a" },
  { type: "couch",         x: 1070, y: 410, w: 100, h: 38, color: "#6a4a2a" },
  { type: "couch",         x: 1070, y: 510, w: 100, h: 38, color: "#6a4a2a" },
  { type: "coffee-table",  x: 1085, y: 460, w: 70,  h: 30 },
  { type: "plant-big",     x: 1210, y: 405, w: 28,  h: 34 },
  { type: "bookshelf",     x: 1245, y: 440, w: 50,  h: 60 },
  { type: "chair",         x: 1215, y: 520, w: 20,  h: 22 },
  { type: "coffee-machine", x: 1310, y: 390, w: 26, h: 34 },
  { type: "aquarium",      x: 1280, y: 530, w: 60,  h: 32 },
  { type: "potted-tree",   x: 1050, y: 375, w: 28,  h: 38 },
  { type: "plant",         x: 1320, y: 580, w: 18,  h: 20 },
  { type: "lamp",          x: 1190, y: 460, w: 12,  h: 22 },
  { type: "painting",      x: 1200, y: 378, w: 50,  h: 30, variant: 1 },

  // ═══════════════════ Salão de Jogos (40,660 → 540,860) ════════════════════
  { type: "rug",           x: 70,  y: 700, w: 200, h: 130, color: "#2a1a4a" },
  { type: "couch",         x: 80,  y: 710, w: 100, h: 38, color: "#6a3a8a" },
  { type: "couch",         x: 80,  y: 790, w: 100, h: 38, color: "#6a3a8a" },
  { type: "coffee-table",  x: 95,  y: 760, w: 70,  h: 24 },
  { type: "tv",            x: 60,  y: 678, w: 160, h: 14, variant: 2 },
  { type: "bookshelf",     x: 300, y: 678, w: 60,  h: 50 },
  { type: "desk",          x: 380, y: 700, w: 80,  h: 38 },
  { type: "monitor",       x: 398, y: 695, w: 32,  h: 12 },
  { type: "chair",         x: 408, y: 748, w: 22,  h: 22 },
  { type: "plant-big",     x: 490, y: 680, w: 26,  h: 34 },
  { type: "lamp",          x: 195, y: 760, w: 12,  h: 22 },
  { type: "water-cooler",  x: 490, y: 820, w: 16,  h: 28 },
  { type: "trash-can",     x: 50,  y: 840, w: 14,  h: 16 },

  // ═══════════════════ Jardim (580,660 → 1360,860) ══════════════════════════
  { type: "potted-tree",   x: 610, y: 690, w: 34,  h: 44 },
  { type: "potted-tree",   x: 730, y: 680, w: 30,  h: 40 },
  { type: "potted-tree",   x: 1000, y: 685, w: 32, h: 42 },
  { type: "potted-tree",   x: 1280, y: 690, w: 34, h: 44 },
  { type: "plant-big",     x: 660, y: 820, w: 26,  h: 34 },
  { type: "plant-big",     x: 900, y: 830, w: 28,  h: 34 },
  { type: "plant-big",     x: 1180, y: 820, w: 26, h: 34 },
  { type: "plant",         x: 820, y: 700, w: 18,  h: 20 },
  { type: "plant",         x: 1100, y: 710, w: 18, h: 20 },
  { type: "couch",         x: 780, y: 750, w: 100, h: 38, color: "#4a6a3a" },
  { type: "couch",         x: 1050, y: 750, w: 100, h: 38, color: "#4a6a3a" },
  { type: "coffee-table",  x: 820, y: 800, w: 60,  h: 24 },
  { type: "coffee-table",  x: 1090, y: 800, w: 60, h: 24 },
  { type: "lamp",          x: 750, y: 770, w: 12,  h: 22 },
  { type: "lamp",          x: 1200, y: 770, w: 12, h: 22 },
  { type: "aquarium",      x: 1260, y: 750, w: 60, h: 32 },
];

// ── Hotspots ──────────────────────────────────────────────────────────────────

export interface Hotspot {
  id: string; label: string; roomId: string;
  x: number; y: number; w: number; h: number;
  actionType: "panel" | "navigate"; actionTarget: string; icon: string;
}

export const HOTSPOTS: Hotspot[] = [
  { id: "hs-meeting-tv",    label: "Iniciar Reunião", roomId: "sala-reuniao", x: 960,  y: 58, w: 180, h: 16, actionType: "panel", actionTarget: "meeting", icon: "🎯" },
  { id: "hs-meeting-board", label: "Quadro",          roomId: "sala-reuniao", x: 1200, y: 58, w: 120, h: 16, actionType: "panel", actionTarget: "projects", icon: "📋" },
  { id: "hs-ops-monitors",  label: "Monitores",       roomId: "operacoes",    x: 650,  y: 378, w: 120, h: 14, actionType: "panel", actionTarget: "stats",    icon: "📊" },
  { id: "hs-dev-board",     label: "Board",           roomId: "desenvolvimento", x: 55, y: 378, w: 140, h: 16, actionType: "panel", actionTarget: "kanban",  icon: "📌" },
];

// ── Agents ─────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  id: string; name: string; role: string;
  department: string;
  skinColor: string; shirtColor: string; hairColor: string; pantsColor: string;
  hairStyle: "short" | "medium" | "long" | "curly";
  defaultRoom: string; spawnX: number; spawnY: number;
}

// spawnX/spawnY = position of their chair/desk (where they sit when working)
export const AGENTS: AgentConfig[] = [
  {
    id: "joao", name: "João", role: "CEO / Operador",
    department: "diretoria",
    skinColor: "#f0c8a0", shirtColor: "#3b82f6", hairColor: "#4a3728", pantsColor: "#1e3a5f",
    hairStyle: "short",
    defaultRoom: "diretoria", spawnX: 505, spawnY: 180,  // chair at desk 1
  },
  {
    id: "jota", name: "Jota", role: "CTO / Líder",
    department: "diretoria",
    skinColor: "#f0c8a0", shirtColor: "#8b5cf6", hairColor: "#2d1b4e", pantsColor: "#3b2066",
    hairStyle: "medium",
    defaultRoom: "diretoria", spawnX: 675, spawnY: 180,  // chair at desk 2
  },
  {
    id: "caio", name: "Caio", role: "Desenvolvedor",
    department: "desenvolvimento",
    skinColor: "#d4a574", shirtColor: "#10b981", hairColor: "#1a1a1a", pantsColor: "#064e3b",
    hairStyle: "curly",
    defaultRoom: "desenvolvimento", spawnX: 106, spawnY: 472, // chair at desk row1-col1
  },
  {
    id: "leticia", name: "Letícia", role: "Operações / Infra",
    department: "operacoes",
    skinColor: "#f0c8a0", shirtColor: "#f59e0b", hairColor: "#8b6914", pantsColor: "#78350f",
    hairStyle: "long",
    defaultRoom: "operacoes", spawnX: 691, spawnY: 495,  // chair at ops desk 1
  },
  {
    id: "clara", name: "Clara", role: "Desenvolvedora",
    department: "desenvolvimento",
    skinColor: "#e8b890", shirtColor: "#ec4899", hairColor: "#5c1a3a", pantsColor: "#831843",
    hairStyle: "medium",
    defaultRoom: "desenvolvimento", spawnX: 229, spawnY: 472, // chair at desk row1-col2
  },
];

// ── Idle spots (where agents hang out when not working) ──────────────────────

export const IDLE_ROOMS = ["copa", "recepcao", "salao-jogos", "jardim"] as const;

export const IDLE_SPOTS: Record<string, Array<{ x: number; y: number }>> = {
  copa: [
    { x: 1100, y: 440 },  // near couch
    { x: 1100, y: 530 },  // near other couch
    { x: 1150, y: 480 },  // near coffee table
    { x: 1320, y: 420 },  // near coffee machine
  ],
  recepcao: [
    { x: 160, y: 200 },   // near plant
    { x: 200, y: 260 },   // center area
    { x: 130, y: 140 },   // by the bookshelf
  ],
  "salao-jogos": [
    { x: 120, y: 740 },   // couch area
    { x: 120, y: 810 },   // other couch
    { x: 200, y: 770 },   // coffee table
    { x: 420, y: 750 },   // arcade desk
    { x: 350, y: 730 },   // bookshelf area
  ],
  jardim: [
    { x: 830, y: 780 },   // bench 1
    { x: 1100, y: 780 },  // bench 2
    { x: 700, y: 750 },   // near tree
    { x: 960, y: 760 },   // center path
    { x: 1220, y: 770 },  // near aquarium
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getRoomCenter(roomId: string): { x: number; y: number } | null {
  const room = ROOMS.find((r) => r.id === roomId);
  if (!room) return null;
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 + 20 };
}

export function getIdleSpot(roomId: string, agentIndex: number): { x: number; y: number } | null {
  const spots = IDLE_SPOTS[roomId];
  if (!spots || spots.length === 0) return getRoomCenter(roomId);
  return spots[agentIndex % spots.length];
}
