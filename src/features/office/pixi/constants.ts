// ── Pixi Office Constants ────────────────────────────────────────────────────

export const TILE = 16;                  // Base tile size in pixels
export const CANVAS_W = 1400;
export const CANVAS_H = 900;
export const WALK_SPEED = 90;            // px per second
export const WALK_FRAME_RATE = 8;        // animation fps
export const PROXIMITY_RANGE = 60;       // px to trigger "Press E"
export const CHAR_SCALE = 2;             // character sprite scale

export const STATUS_COLORS: Record<string, number> = {
  active: 0x22c55e,
  idle: 0x6b7280,
  degraded: 0xf59e0b,
  down: 0xef4444,
};

export const AGENT_COLORS: Record<string, number> = {
  "joao": 0x3b82f6,
  "jota": 0x8b5cf6,
  "caio": 0x10b981,
  "leticia": 0xf59e0b,
  "clara": 0xec4899,
};
