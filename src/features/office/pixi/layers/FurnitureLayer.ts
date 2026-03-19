// ── Furniture Layer — Sprite-based furniture rendering ────────────────────────

import { Container, Graphics, Assets, Sprite, Texture } from "pixi.js";
import { FURNITURE, type Furniture } from "../../config/office-map";

// Map our furniture types to pixel-agents asset folders
const SPRITE_MAP: Record<string, string> = {
  desk: "DESK", chair: "CUSHIONED_CHAIR", monitor: "PC",
  couch: "SOFA", bookshelf: "BOOKSHELF", plant: "PLANT",
  "plant-big": "LARGE_PLANT", "potted-tree": "LARGE_PLANT",
  "coffee-table": "COFFEE_TABLE", "coffee-machine": "COFFEE",
  "water-cooler": "COFFEE", whiteboard: "WHITEBOARD",
  "trash-can": "BIN", "filing-cabinet": "DOUBLE_BOOKSHELF",
  lamp: "PLANT_2", printer: "PC", clock: "CLOCK",
  painting: "SMALL_PAINTING", rug: "", tv: "", aquarium: "",
  "server-rack": "DOUBLE_BOOKSHELF",
};

export class FurnitureLayer {
  container = new Container();
  private spriteTextures = new Map<string, Texture>();

  async init() {
    // Pre-load available furniture sprites
    const loaded = new Set<string>();
    for (const [, assetFolder] of Object.entries(SPRITE_MAP)) {
      if (!assetFolder || loaded.has(assetFolder)) continue;
      loaded.add(assetFolder);
      try {
        const tex = await Assets.load(`/assets/office/furniture/${assetFolder}/${assetFolder}_FRONT.png`);
        this.spriteTextures.set(assetFolder, tex);
      } catch {
        // Try without _FRONT suffix
        try {
          const tex = await Assets.load(`/assets/office/furniture/${assetFolder}/${assetFolder}.png`);
          this.spriteTextures.set(assetFolder, tex);
        } catch {
          // No sprite available, will use fallback graphics
        }
      }
    }

    // Sort furniture by Y for proper layering
    const sorted = [...FURNITURE].sort((a, b) => (a.y + a.h) - (b.y + b.h));

    for (const f of sorted) {
      const obj = this.createFurniture(f);
      if (obj) this.container.addChild(obj);
    }

    // Cache since furniture is static
    this.container.cacheAsTexture(true);
  }

  private createFurniture(f: Furniture): Container | null {
    const assetFolder = SPRITE_MAP[f.type];

    // Try sprite first
    if (assetFolder && this.spriteTextures.has(assetFolder)) {
      const tex = this.spriteTextures.get(assetFolder)!;
      const sprite = new Sprite(tex);
      sprite.x = f.x;
      sprite.y = f.y;
      sprite.width = f.w;
      sprite.height = f.h;
      return sprite as unknown as Container;
    }

    // Fallback: programmatic Graphics for types without sprites
    return this.drawFallback(f);
  }

  private drawFallback(f: Furniture): Container {
    const g = new Graphics();

    switch (f.type) {
      case "desk":
        g.roundRect(f.x, f.y, f.w, f.h, 3);
        g.fill(0x3a3025);
        g.roundRect(f.x, f.y, f.w, 4, 3);
        g.fill(0x4a4035);
        break;

      case "monitor": {
        const renderH = Math.max(f.h, 18);
        const renderY = f.y - (renderH - f.h);
        // Screen
        g.roundRect(f.x - 1, renderY - 1, f.w + 2, renderH + 1, 3);
        g.fill(0x0a0a14);
        // Screen content
        const colors = [0x3b82f6, 0xa855f7, 0x22c55e];
        const variant = f.variant ?? 0;
        g.roundRect(f.x + 2, renderY + 2, f.w - 4, renderH - 5, 1);
        g.fill({ color: colors[variant % 3], alpha: 0.4 });
        // Stand
        g.rect(f.x + f.w / 2 - 1, renderY + renderH, 3, 4);
        g.fill(0x222230);
        // LED
        g.circle(f.x + f.w / 2, renderY + renderH - 2, 1.2);
        g.fill(0x22c55e);
        break;
      }

      case "couch":
        g.roundRect(f.x, f.y, f.w, f.h, 5);
        g.fill(this.colorOrDefault(f.color, 0x5a4a3a));
        g.roundRect(f.x + 2, f.y + 2, f.w - 4, f.h - 4, 4);
        g.fill({ color: 0xffffff, alpha: 0.05 });
        break;

      case "rug":
        g.roundRect(f.x, f.y, f.w, f.h, 6);
        g.fill({ color: this.colorOrDefault(f.color, 0x3a2a1a), alpha: 0.5 });
        break;

      case "tv":
        g.roundRect(f.x, f.y, f.w, f.h, 2);
        g.fill(0x0a0a14);
        g.roundRect(f.x + 2, f.y + 1, f.w - 4, f.h - 2, 1);
        g.fill({ color: 0x3b82f6, alpha: 0.3 });
        break;

      case "server-rack":
        g.roundRect(f.x, f.y, f.w, f.h, 2);
        g.fill(0x222228);
        // LEDs
        for (let i = 0; i < 4; i++) {
          const colors = [0x22c55e, 0x3b82f6, 0xf59e0b, 0x22c55e];
          g.circle(f.x + 8 + i * 6, f.y + f.h / 2, 2);
          g.fill(colors[i]);
        }
        break;

      case "aquarium":
        g.roundRect(f.x, f.y, f.w, f.h, 3);
        g.fill({ color: 0x3b82f6, alpha: 0.25 });
        g.roundRect(f.x, f.y, f.w, f.h, 3);
        g.stroke({ color: 0x6b7280, width: 1.5 });
        break;

      case "chair":
        g.circle(f.x + f.w / 2, f.y + f.h / 2, f.w / 2.5);
        g.fill(0x444450);
        break;

      default:
        // Generic box
        g.roundRect(f.x, f.y, f.w, f.h, 2);
        g.fill(this.colorOrDefault(f.color, 0x3a3a3a));
        break;
    }

    return g as unknown as Container;
  }

  private colorOrDefault(color: string | undefined, def: number): number {
    if (!color) return def;
    return parseInt(color.replace("#", ""), 16);
  }
}
