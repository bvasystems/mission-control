// ── UI Layer — Room labels, alerts, minimap ──────────────────────────────────

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { ROOMS, AGENTS, HOTSPOTS } from "../../config/office-map";
import { CANVAS_W, CANVAS_H, AGENT_COLORS } from "../constants";
import type { AgentLayer } from "./AgentLayer";

const ROOM_ICONS: Record<string, string> = {
  recepcao: "🏢", diretoria: "👔", "sala-reuniao": "🎯",
  desenvolvimento: "💻", operacoes: "📊", copa: "☕",
  "salao-jogos": "🎮", jardim: "🌿",
};

export class UILayer {
  container = new Container();
  private alertOverlays = new Map<string, Graphics>();
  private alertBadges = new Map<string, Container>();
  private minimapContainer!: Container;

  init() {
    // Room labels
    for (const room of ROOMS) {
      const label = this.createRoomLabel(room.id, room.label, room.x, room.y, room.w, room.labelColor);
      this.container.addChild(label);
    }

    // Alert overlay placeholders
    for (const room of ROOMS) {
      const overlay = new Graphics();
      overlay.visible = false;
      this.alertOverlays.set(room.id, overlay);
      this.container.addChild(overlay);

      const badge = new Container();
      badge.visible = false;
      this.alertBadges.set(room.id, badge);
      this.container.addChild(badge);
    }

    // Minimap
    this.minimapContainer = this.createMinimap();
    this.container.addChild(this.minimapContainer);
  }

  update(time: number, nearbyAgent: string | null, nearbyHotspot: string | null, agentLayer: AgentLayer) {
    // Update minimap agent positions
    this.updateMinimap(agentLayer);

    // Pulse alerts
    for (const [roomId, overlay] of this.alertOverlays) {
      if (overlay.visible) {
        const pulse = Math.sin(time / 400) * 0.15 + 0.15;
        overlay.alpha = pulse;
      }
    }
  }

  syncAlerts(alerts: Map<string, string>) {
    // Reset all
    for (const [, overlay] of this.alertOverlays) overlay.visible = false;
    for (const [, badge] of this.alertBadges) badge.visible = false;

    for (const [key, value] of alerts) {
      if (key.endsWith(":count")) continue;
      const room = ROOMS.find((r) => r.id === key);
      if (!room) continue;

      const overlay = this.alertOverlays.get(key);
      if (overlay) {
        overlay.clear();
        overlay.rect(room.x, room.y, room.w, room.h);
        overlay.fill({ color: value === "critical" ? 0xef4444 : 0xf59e0b, alpha: 0.2 });
        overlay.visible = true;
      }

      const count = alerts.get(`${key}:count`) ?? "";
      const badge = this.alertBadges.get(key);
      if (badge) {
        badge.removeChildren();
        const text = value === "critical"
          ? `${count ? count + " " : ""}INCIDENTE${count && Number(count) > 1 ? "S" : ""}`
          : "ALERTA";
        const style = new TextStyle({ fontSize: 8, fontFamily: "Inter, sans-serif", fontWeight: "bold", fill: 0xffffff });
        const t = new Text({ text, style });
        t.anchor.set(0.5);

        const bg = new Graphics();
        const w = t.width + 12;
        bg.roundRect(-w / 2, -8, w, 16, 4);
        bg.fill(value === "critical" ? 0xef4444 : 0xf59e0b);

        badge.addChild(bg);
        badge.addChild(t);
        badge.x = room.x + room.w - w / 2 - 8;
        badge.y = room.y + 14;
        badge.visible = true;
      }
    }
  }

  private createRoomLabel(id: string, label: string, rx: number, ry: number, rw: number, colorHex: string): Container {
    const c = new Container();
    const icon = ROOM_ICONS[id] ?? "";
    const fullText = icon ? `${icon}  ${label.toUpperCase()}` : label.toUpperCase();

    const style = new TextStyle({
      fontSize: 11, fontFamily: "Inter, system-ui, sans-serif",
      fontWeight: "bold", fill: parseInt(colorHex.replace("#", ""), 16),
    });
    const text = new Text({ text: fullText, style });
    text.anchor.set(0.5);

    const bg = new Graphics();
    const w = text.width + 20;
    const h = 22;
    bg.roundRect(-w / 2, -h / 2, w, h, 6);
    bg.fill({ color: 0x000000, alpha: 0.8 });
    bg.roundRect(-w / 2, -h / 2, w, h, 6);
    bg.stroke({ color: 0x666666, width: 0.5, alpha: 0.3 });

    c.addChild(bg);
    c.addChild(text);
    c.x = rx + rw / 2;
    c.y = ry > 50 ? ry - 18 : ry + 14;
    return c;
  }

  private createMinimap(): Container {
    const c = new Container();
    const scale = 0.1;
    const mmW = CANVAS_W * scale;
    const mmH = CANVAS_H * scale;

    c.x = CANVAS_W - mmW - 12;
    c.y = CANVAS_H - mmH - 12;

    // Background
    const bg = new Graphics();
    bg.roundRect(-2, -2, mmW + 4, mmH + 4, 4);
    bg.fill({ color: 0x000000, alpha: 0.7 });
    bg.stroke({ color: 0xffffff, width: 0.5, alpha: 0.1 });
    c.addChild(bg);

    // Rooms
    const rooms = new Graphics();
    for (const room of ROOMS) {
      rooms.rect(room.x * scale, room.y * scale, room.w * scale, room.h * scale);
      rooms.fill({ color: 0xffffff, alpha: 0.08 });
      rooms.rect(room.x * scale, room.y * scale, room.w * scale, room.h * scale);
      rooms.stroke({ color: 0xffffff, width: 0.5, alpha: 0.15 });
    }
    c.addChild(rooms);

    return c;
  }

  private updateMinimap(agentLayer: AgentLayer) {
    const scale = 0.1;
    // Remove old dots (children after bg + rooms = index 2+)
    while (this.minimapContainer.children.length > 2) {
      this.minimapContainer.removeChildAt(2);
    }

    for (const [id, agent] of agentLayer.agents) {
      const dot = new Graphics();
      const r = id === "joao" ? 3 : 2;
      dot.circle(0, 0, r);
      dot.fill(AGENT_COLORS[id] ?? 0x6b7280);
      if (id === "joao") {
        dot.circle(0, 0, r);
        dot.stroke({ color: 0xffffff, width: 0.8 });
      }
      dot.x = agent.container.x * scale;
      dot.y = agent.container.y * scale;
      this.minimapContainer.addChild(dot);
    }
  }
}
