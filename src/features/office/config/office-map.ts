// ── Office Map Configuration ──────────────────────────────────────────────────
// Defines rooms, hotspots, and agent positions for the 2D virtual office.
// All coordinates are in a 1200×800 virtual canvas space.

export interface Room {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;       // fill color
  borderColor: string; // stroke
  icon: string;        // emoji
}

export interface Hotspot {
  id: string;
  label: string;
  roomId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  actionType: "panel" | "navigate";
  actionTarget: string; // panel id or route
  icon: string;
}

export interface AgentPosition {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  color: string;
}

// ── Virtual canvas dimensions ─────────────────────────────────────────────────
export const CANVAS_W = 1200;
export const CANVAS_H = 800;

// ── Room definitions ──────────────────────────────────────────────────────────
export const ROOMS: Room[] = [
  {
    id: "lobby",
    label: "Lobby",
    x: 40, y: 40, w: 320, h: 200,
    color: "rgba(59,130,246,0.06)",
    borderColor: "rgba(59,130,246,0.25)",
    icon: "🏢",
  },
  {
    id: "sprint-room",
    label: "Sprint Room",
    x: 400, y: 40, w: 360, h: 200,
    color: "rgba(16,185,129,0.06)",
    borderColor: "rgba(16,185,129,0.25)",
    icon: "🏃",
  },
  {
    id: "war-room",
    label: "War Room",
    x: 800, y: 40, w: 360, h: 200,
    color: "rgba(239,68,68,0.06)",
    borderColor: "rgba(239,68,68,0.25)",
    icon: "🚨",
  },
  {
    id: "dev-area",
    label: "Dev Area",
    x: 40, y: 300, w: 540, h: 280,
    color: "rgba(168,85,247,0.06)",
    borderColor: "rgba(168,85,247,0.25)",
    icon: "💻",
  },
  {
    id: "deploy-room",
    label: "Deploy / Infra",
    x: 620, y: 300, w: 260, h: 280,
    color: "rgba(245,158,11,0.06)",
    borderColor: "rgba(245,158,11,0.25)",
    icon: "🚀",
  },
  {
    id: "metrics-wall",
    label: "Metrics Wall",
    x: 920, y: 300, w: 240, h: 280,
    color: "rgba(6,182,212,0.06)",
    borderColor: "rgba(6,182,212,0.25)",
    icon: "📊",
  },
  {
    id: "command-center",
    label: "Command Center",
    x: 40, y: 640, w: 1120, h: 120,
    color: "rgba(99,102,241,0.04)",
    borderColor: "rgba(99,102,241,0.2)",
    icon: "👑",
  },
];

// ── Hotspot definitions ───────────────────────────────────────────────────────
export const HOTSPOTS: Hotspot[] = [
  {
    id: "hs-projects",
    label: "Projetos",
    roomId: "sprint-room",
    x: 420, y: 60, w: 150, h: 50,
    actionType: "panel",
    actionTarget: "projects",
    icon: "📋",
  },
  {
    id: "hs-kanban",
    label: "Kanban Board",
    roomId: "sprint-room",
    x: 590, y: 60, w: 150, h: 50,
    actionType: "panel",
    actionTarget: "kanban",
    icon: "📌",
  },
  {
    id: "hs-incidents",
    label: "Incidentes",
    roomId: "war-room",
    x: 820, y: 60, w: 150, h: 50,
    actionType: "panel",
    actionTarget: "incidents",
    icon: "🔥",
  },
  {
    id: "hs-crons",
    label: "Cron Jobs",
    roomId: "deploy-room",
    x: 640, y: 320, w: 130, h: 50,
    actionType: "panel",
    actionTarget: "crons",
    icon: "⏰",
  },
  {
    id: "hs-deploy",
    label: "Deploys",
    roomId: "deploy-room",
    x: 640, y: 390, w: 130, h: 50,
    actionType: "panel",
    actionTarget: "deploys",
    icon: "🚀",
  },
  {
    id: "hs-metrics",
    label: "Dashboard",
    roomId: "metrics-wall",
    x: 940, y: 320, w: 130, h: 50,
    actionType: "panel",
    actionTarget: "stats",
    icon: "📊",
  },
  {
    id: "hs-agents",
    label: "Agents",
    roomId: "lobby",
    x: 60, y: 60, w: 130, h: 50,
    actionType: "panel",
    actionTarget: "agents",
    icon: "🤖",
  },
];

// ── Agent positions on the map ────────────────────────────────────────────────
export const AGENT_POSITIONS: AgentPosition[] = [
  { id: "joao",    name: "João",    role: "Operator",  x: 200, y: 170, color: "#3b82f6" },
  { id: "jota",    name: "Jota",    role: "Main Agent", x: 120, y: 420, color: "#8b5cf6" },
  { id: "caio",    name: "Caio",    role: "Agent",     x: 280, y: 420, color: "#10b981" },
  { id: "leticia", name: "Letícia", role: "Agent",     x: 440, y: 420, color: "#f59e0b" },
  { id: "clara",   name: "Clara",   role: "Agent",     x: 200, y: 500, color: "#ec4899" },
];
