// ── Character Spritesheet Parser ─────────────────────────────────────────────
// Loads character PNGs from pixel-agents and extracts individual frames.
// Each PNG is 112x96: 7 frames (16px wide) × 3 directions (32px tall).
// Directions: row 0=down, row 1=up, row 2=right. Left = mirrored right.
// Frames per row: walk(0-3), type(4-5), read(6).

const FRAME_W = 16;
const FRAME_H = 32;
const FRAMES_PER_ROW = 7;
const DIRECTIONS = ["down", "up", "right"] as const;

export type CharDirection = "down" | "up" | "left" | "right";
export type CharAction = "walk" | "type" | "read" | "idle";

export interface CharFrames {
  walk: Record<CharDirection, HTMLCanvasElement[]>;   // 4 frames
  type: Record<CharDirection, HTMLCanvasElement[]>;   // 2 frames
  read: Record<CharDirection, HTMLCanvasElement[]>;   // 1 frame
}

// Cache of loaded character sprites
const charCache = new Map<number, CharFrames>();
const loadingPromises = new Map<number, Promise<CharFrames | null>>();

function extractFrame(img: HTMLImageElement, fx: number, fy: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, fx, fy, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
  return canvas;
}

function mirrorFrame(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(FRAME_W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

async function loadCharSpritesheet(palette: number): Promise<CharFrames | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const frames: CharFrames = {
        walk: { down: [], up: [], left: [], right: [] },
        type: { down: [], up: [], left: [], right: [] },
        read: { down: [], up: [], left: [], right: [] },
      };

      for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
        const dir = DIRECTIONS[dirIdx];
        const rowY = dirIdx * FRAME_H;
        const allFrames: HTMLCanvasElement[] = [];

        for (let f = 0; f < FRAMES_PER_ROW; f++) {
          allFrames.push(extractFrame(img, f * FRAME_W, rowY));
        }

        // Walk: frames 0-3
        const walkFrames = allFrames.slice(0, 4);
        // Type: frames 4-5
        const typeFrames = allFrames.slice(4, 6);
        // Read: frame 6
        const readFrames = [allFrames[6]];

        if (dir === "right") {
          frames.walk.right = walkFrames;
          frames.type.right = typeFrames;
          frames.read.right = readFrames;
          // Left = mirrored right
          frames.walk.left = walkFrames.map(mirrorFrame);
          frames.type.left = typeFrames.map(mirrorFrame);
          frames.read.left = readFrames.map(mirrorFrame);
        } else {
          frames.walk[dir] = walkFrames;
          frames.type[dir] = typeFrames;
          frames.read[dir] = readFrames;
        }
      }

      charCache.set(palette, frames);
      resolve(frames);
    };
    img.onerror = () => resolve(null);
    img.src = `/assets/office/characters/char_${palette}.png`;
  });
}

export async function getCharFrames(palette: number): Promise<CharFrames | null> {
  if (charCache.has(palette)) return charCache.get(palette)!;

  // Avoid duplicate loads
  if (loadingPromises.has(palette)) return loadingPromises.get(palette)!;

  const promise = loadCharSpritesheet(palette);
  loadingPromises.set(palette, promise);
  return promise;
}

// Pre-load all palettes
export function preloadAllCharacters(): void {
  for (let i = 0; i < 6; i++) {
    getCharFrames(i);
  }
}

// Get the current frame for a character based on state
export function getCharacterFrame(
  frames: CharFrames,
  action: CharAction,
  direction: CharDirection,
  walkCycle: number,
  time: number
): HTMLCanvasElement | null {
  if (action === "walk") {
    const walkFrames = frames.walk[direction];
    if (!walkFrames?.length) return null;
    const idx = Math.floor(walkCycle) % walkFrames.length;
    return walkFrames[idx];
  }

  if (action === "type") {
    const typeFrames = frames.type[direction];
    if (!typeFrames?.length) return null;
    const idx = Math.floor(time / 300) % typeFrames.length;
    return typeFrames[idx];
  }

  if (action === "read") {
    const readFrames = frames.read[direction];
    if (!readFrames?.length) return null;
    return readFrames[0];
  }

  // Idle: use first walk frame (standing still)
  const idleFrames = frames.walk[direction];
  if (!idleFrames?.length) return null;
  return idleFrames[0];
}

export const CHAR_FRAME_W = FRAME_W;
export const CHAR_FRAME_H = FRAME_H;
