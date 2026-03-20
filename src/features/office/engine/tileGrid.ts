// ── Tile Grid System ─────────────────────────────────────────────────────────
// Converts pixel-coordinate rooms/furniture into a 16px tile grid for
// pathfinding and collision. Compatible with BFS pathfinding.

import { ROOMS, FURNITURE, CANVAS_W, CANVAS_H, type Room, type Furniture } from "../config/office-map";

export const TILE_SIZE = 16;
export const GRID_COLS = Math.ceil(CANVAS_W / TILE_SIZE);  // 88
export const GRID_ROWS = Math.ceil(CANVAS_H / TILE_SIZE);  // 57

// Tile types
export const enum TileType {
  VOID = 0,    // Outside — not walkable
  FLOOR = 1,   // Room floor — walkable
  WALL = 2,    // Wall — not walkable
  DOOR = 3,    // Door threshold — walkable
  CORRIDOR = 4, // Between rooms — walkable
  BLOCKED = 5, // Furniture — not walkable
}

// The grid: [row][col]
let grid: TileType[][] | null = null;
let blockedTiles: Set<string> | null = null;

// ── Build the grid from room/furniture definitions ───────────────────────────

function buildGrid(): TileType[][] {
  const g: TileType[][] = Array.from({ length: GRID_ROWS }, () =>
    new Array(GRID_COLS).fill(TileType.VOID)
  );

  // 1. Mark room interiors as FLOOR
  for (const room of ROOMS) {
    const c1 = Math.floor(room.x / TILE_SIZE);
    const r1 = Math.floor(room.y / TILE_SIZE);
    const c2 = Math.ceil((room.x + room.w) / TILE_SIZE);
    const r2 = Math.ceil((room.y + room.h) / TILE_SIZE);

    for (let r = r1; r < r2 && r < GRID_ROWS; r++) {
      for (let c = c1; c < c2 && c < GRID_COLS; c++) {
        g[r][c] = TileType.FLOOR;
      }
    }

    // Mark walls (1 tile thick around room edges)
    // Top wall
    for (let c = c1; c < c2 && c < GRID_COLS; c++) {
      if (r1 > 0) g[r1][c] = TileType.WALL;
    }
    // Bottom wall
    for (let c = c1; c < c2 && c < GRID_COLS; c++) {
      if (r2 - 1 < GRID_ROWS) g[r2 - 1][c] = TileType.WALL;
    }
    // Left wall
    for (let r = r1; r < r2 && r < GRID_ROWS; r++) {
      if (c1 >= 0) g[r][c1] = TileType.WALL;
    }
    // Right wall
    for (let r = r1; r < r2 && r < GRID_ROWS; r++) {
      if (c2 - 1 < GRID_COLS) g[r][c2 - 1] = TileType.WALL;
    }

    // Re-mark interior (walls were 1 tile in, override with floor)
    for (let r = r1 + 1; r < r2 - 1 && r < GRID_ROWS; r++) {
      for (let c = c1 + 1; c < c2 - 1 && c < GRID_COLS; c++) {
        g[r][c] = TileType.FLOOR;
      }
    }

    // 2. Mark doors as DOOR (walkable through walls)
    for (const door of room.doors) {
      const doorTiles = getDoorTiles(room, door.side, door.offset, door.width);
      for (const { col, row } of doorTiles) {
        if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
          g[row][col] = TileType.DOOR;
        }
      }
    }
  }

  // 3. Mark corridors between rooms
  // Horizontal corridor row 1↔2 (y ~305-365)
  markCorridor(g, 30, 305, CANVAS_W - 60, 60);
  // Horizontal corridor row 2↔3 (y ~615-665)
  markCorridor(g, 30, 615, CANVAS_W - 60, 50);

  return g;
}

function getDoorTiles(
  room: Room,
  side: "top" | "bottom" | "left" | "right",
  offset: number,
  width: number
): Array<{ col: number; row: number }> {
  const tiles: Array<{ col: number; row: number }> = [];
  const doorPad = 2; // Extra tiles around door for smooth transit

  if (side === "top") {
    const startCol = Math.floor((room.x + offset) / TILE_SIZE);
    const endCol = Math.ceil((room.x + offset + width) / TILE_SIZE);
    const wallRow = Math.floor(room.y / TILE_SIZE);
    for (let c = startCol; c < endCol; c++) {
      for (let r = wallRow - doorPad; r <= wallRow + doorPad; r++) {
        tiles.push({ col: c, row: r });
      }
    }
  } else if (side === "bottom") {
    const startCol = Math.floor((room.x + offset) / TILE_SIZE);
    const endCol = Math.ceil((room.x + offset + width) / TILE_SIZE);
    const wallRow = Math.ceil((room.y + room.h) / TILE_SIZE) - 1;
    for (let c = startCol; c < endCol; c++) {
      for (let r = wallRow - doorPad; r <= wallRow + doorPad; r++) {
        tiles.push({ col: c, row: r });
      }
    }
  } else if (side === "left") {
    const startRow = Math.floor((room.y + offset) / TILE_SIZE);
    const endRow = Math.ceil((room.y + offset + width) / TILE_SIZE);
    const wallCol = Math.floor(room.x / TILE_SIZE);
    for (let r = startRow; r < endRow; r++) {
      for (let c = wallCol - doorPad; c <= wallCol + doorPad; c++) {
        tiles.push({ col: c, row: r });
      }
    }
  } else {
    const startRow = Math.floor((room.y + offset) / TILE_SIZE);
    const endRow = Math.ceil((room.y + offset + width) / TILE_SIZE);
    const wallCol = Math.ceil((room.x + room.w) / TILE_SIZE) - 1;
    for (let r = startRow; r < endRow; r++) {
      for (let c = wallCol - doorPad; c <= wallCol + doorPad; c++) {
        tiles.push({ col: c, row: r });
      }
    }
  }

  return tiles;
}

function markCorridor(g: TileType[][], px: number, py: number, pw: number, ph: number) {
  const c1 = Math.floor(px / TILE_SIZE);
  const r1 = Math.floor(py / TILE_SIZE);
  const c2 = Math.ceil((px + pw) / TILE_SIZE);
  const r2 = Math.ceil((py + ph) / TILE_SIZE);
  for (let r = r1; r < r2 && r < GRID_ROWS; r++) {
    for (let c = c1; c < c2 && c < GRID_COLS; c++) {
      if (g[r][c] === TileType.VOID) {
        g[r][c] = TileType.CORRIDOR;
      }
    }
  }
}

// ── Build blocked tiles from furniture ───────────────────────────────────────

function buildBlockedTiles(): Set<string> {
  const blocked = new Set<string>();
  // Furniture types that don't block movement
  const passthrough = new Set(["rug", "lamp", "painting", "clock"]);

  for (const f of FURNITURE) {
    if (passthrough.has(f.type)) continue;

    const c1 = Math.floor(f.x / TILE_SIZE);
    const r1 = Math.floor(f.y / TILE_SIZE);
    const c2 = Math.ceil((f.x + f.w) / TILE_SIZE);
    const r2 = Math.ceil((f.y + f.h) / TILE_SIZE);

    for (let r = r1; r < r2; r++) {
      for (let c = c1; c < c2; c++) {
        blocked.add(`${c},${r}`);
      }
    }
  }

  return blocked;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getGrid(): TileType[][] {
  if (!grid) grid = buildGrid();
  return grid;
}

export function getBlockedTiles(): Set<string> {
  if (!blockedTiles) blockedTiles = buildBlockedTiles();
  return blockedTiles;
}

export function isTileWalkable(col: number, row: number): boolean {
  const g = getGrid();
  const bt = getBlockedTiles();
  if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return false;
  const t = g[row][col];
  if (t === TileType.VOID || t === TileType.WALL) return false;
  if (bt.has(`${col},${row}`)) return false;
  return true;
}

// Pixel to tile conversion
export function pixelToTile(px: number, py: number): { col: number; row: number } {
  return {
    col: Math.floor(px / TILE_SIZE),
    row: Math.floor(py / TILE_SIZE),
  };
}

export function tileToPixel(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

// Check walkability from pixel coordinates
export function isPixelWalkable(px: number, py: number): boolean {
  const { col, row } = pixelToTile(px, py);
  return isTileWalkable(col, row);
}

// ── BFS Pathfinding ──────────────────────────────────────────────────────────
// Returns path as array of tile positions (excluding start, including end).
// Returns pixel coordinates for each step.

export function findPath(
  startX: number, startY: number,
  endX: number, endY: number
): Array<{ x: number; y: number }> {
  const start = pixelToTile(startX, startY);
  const end = pixelToTile(endX, endY);

  if (start.col === end.col && start.row === end.row) return [];

  const g = getGrid();
  const bt = getBlockedTiles();

  // End must be walkable
  if (!isTileWalkable(end.col, end.row)) {
    // Try adjacent tiles
    const dirs = [
      { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
      { dc: -1, dr: 0 }, { dc: 1, dr: 0 },
    ];
    let found = false;
    for (const d of dirs) {
      if (isTileWalkable(end.col + d.dc, end.row + d.dr)) {
        end.col += d.dc;
        end.row += d.dr;
        found = true;
        break;
      }
    }
    if (!found) return [];
  }

  const key = (c: number, r: number) => `${c},${r}`;
  const startKey = key(start.col, start.row);
  const endKey = key(end.col, end.row);

  const visited = new Set<string>();
  visited.add(startKey);

  const parent = new Map<string, string>();
  const queue: Array<{ col: number; row: number }> = [start];

  const dirs = [
    { dc: 0, dr: -1 },
    { dc: 0, dr: 1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currKey = key(curr.col, curr.row);

    if (currKey === endKey) {
      // Reconstruct path as pixel coordinates
      const path: Array<{ x: number; y: number }> = [];
      let k = endKey;
      while (k !== startKey) {
        const [c, r] = k.split(",").map(Number);
        path.unshift(tileToPixel(c, r));
        k = parent.get(k)!;
      }
      return path;
    }

    for (const d of dirs) {
      const nc = curr.col + d.dc;
      const nr = curr.row + d.dr;
      const nk = key(nc, nr);

      if (visited.has(nk)) continue;
      if (!isTileWalkable(nc, nr)) continue;

      visited.add(nk);
      parent.set(nk, currKey);
      queue.push({ col: nc, row: nr });
    }
  }

  // No path found — return direct line as fallback
  return [{ x: endX, y: endY }];
}
