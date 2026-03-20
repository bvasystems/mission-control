// ── Furniture Sprite Loader ──────────────────────────────────────────────────
// Maps our furniture types to pixel-agents PNG assets and handles loading/caching.
// Sprites are drawn at the furniture's x,y position, scaled to fit w,h.

export interface FurnitureSpriteInfo {
  file: string;            // path to PNG
  nativeW: number;         // original sprite width in pixels
  nativeH: number;         // original sprite height in pixels
}

// Map our furniture type → sprite info
const SPRITE_MAP: Record<string, FurnitureSpriteInfo> = {
  desk:             { file: "/assets/office/furniture/DESK/DESK_FRONT.png", nativeW: 48, nativeH: 32 },
  chair:            { file: "/assets/office/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png", nativeW: 16, nativeH: 16 },
  monitor:          { file: "/assets/office/furniture/PC/PC_FRONT_ON_1.png", nativeW: 16, nativeH: 32 },
  couch:            { file: "/assets/office/furniture/SOFA/SOFA_FRONT.png", nativeW: 32, nativeH: 16 },
  bookshelf:        { file: "/assets/office/furniture/BOOKSHELF/BOOKSHELF.png", nativeW: 32, nativeH: 16 },
  "coffee-table":   { file: "/assets/office/furniture/COFFEE_TABLE/COFFEE_TABLE.png", nativeW: 32, nativeH: 32 },
  "coffee-machine": { file: "/assets/office/furniture/COFFEE/COFFEE.png", nativeW: 16, nativeH: 16 },
  whiteboard:       { file: "/assets/office/furniture/WHITEBOARD/WHITEBOARD.png", nativeW: 32, nativeH: 32 },
  "trash-can":      { file: "/assets/office/furniture/BIN/BIN.png", nativeW: 16, nativeH: 16 },
  plant:            { file: "/assets/office/furniture/PLANT/PLANT.png", nativeW: 16, nativeH: 32 },
  "plant-big":      { file: "/assets/office/furniture/LARGE_PLANT/LARGE_PLANT.png", nativeW: 32, nativeH: 48 },
  "potted-tree":    { file: "/assets/office/furniture/LARGE_PLANT/LARGE_PLANT.png", nativeW: 32, nativeH: 48 },
  "water-cooler":   { file: "/assets/office/furniture/COFFEE/COFFEE.png", nativeW: 16, nativeH: 16 },
  painting:         { file: "/assets/office/furniture/SMALL_PAINTING/SMALL_PAINTING.png", nativeW: 16, nativeH: 32 },
  "filing-cabinet":  { file: "/assets/office/furniture/DOUBLE_BOOKSHELF/DOUBLE_BOOKSHELF.png", nativeW: 32, nativeH: 32 },
  "server-rack":    { file: "/assets/office/furniture/DOUBLE_BOOKSHELF/DOUBLE_BOOKSHELF.png", nativeW: 32, nativeH: 32 },
  printer:          { file: "/assets/office/furniture/PC/PC_SIDE.png", nativeW: 16, nativeH: 32 },
  clock:            { file: "/assets/office/furniture/CLOCK/CLOCK.png", nativeW: 16, nativeH: 32 },
  lamp:             { file: "/assets/office/furniture/PLANT_2/PLANT_2.png", nativeW: 16, nativeH: 32 },
};

// Image cache
const imageCache = new Map<string, HTMLImageElement>();
const loadingSet = new Set<string>();
let allLoaded = false;

export function getSpriteInfo(type: string): FurnitureSpriteInfo | null {
  return SPRITE_MAP[type] ?? null;
}

export function getSpriteImage(type: string): HTMLImageElement | null {
  const info = SPRITE_MAP[type];
  if (!info) return null;
  return imageCache.get(info.file) ?? null;
}

export function areFurnitureSpritesLoaded(): boolean {
  return allLoaded;
}

export function preloadFurnitureSprites(): void {
  if (allLoaded || loadingSet.size > 0) return;

  const uniqueFiles = new Set(Object.values(SPRITE_MAP).map((s) => s.file));
  let loaded = 0;
  const total = uniqueFiles.size;

  for (const file of uniqueFiles) {
    if (imageCache.has(file)) {
      loaded++;
      continue;
    }
    loadingSet.add(file);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(file, img);
      loadingSet.delete(file);
      loaded++;
      if (loaded >= total) allLoaded = true;
    };
    img.onerror = () => {
      loadingSet.delete(file);
      loaded++;
      if (loaded >= total) allLoaded = true;
    };
    img.src = file;
  }
}

// Types that should NOT use sprites (rendered programmatically better)
export const NO_SPRITE_TYPES = new Set(["rug", "tv", "aquarium"]);
