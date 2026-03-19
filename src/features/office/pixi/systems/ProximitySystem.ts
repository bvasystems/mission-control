// ── Proximity System — Detects João near agents/hotspots ─────────────────────

import { PROXIMITY_RANGE } from "../constants";
import { HOTSPOTS } from "../../config/office-map";
import type { AgentLayer } from "../layers/AgentLayer";

export class ProximitySystem {
  private agentLayer: AgentLayer;
  nearbyAgent: string | null = null;
  nearbyHotspot: string | null = null;

  constructor(agentLayer: AgentLayer) {
    this.agentLayer = agentLayer;
  }

  update() {
    const joao = this.agentLayer.agents.get("joao");
    if (!joao) return;

    const jx = joao.container.x;
    const jy = joao.container.y;

    // Find nearest agent
    let minDist = PROXIMITY_RANGE;
    let nearest: string | null = null;

    for (const [id, agent] of this.agentLayer.agents) {
      if (id === "joao") continue;
      const dx = jx - agent.container.x;
      const dy = jy - agent.container.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = id;
      }
    }

    // Update proximity indicators
    if (nearest !== this.nearbyAgent) {
      // Hide old
      if (this.nearbyAgent) {
        const old = this.agentLayer.agents.get(this.nearbyAgent);
        old?.showProximity(false);
      }
      // Show new
      if (nearest) {
        const agent = this.agentLayer.agents.get(nearest);
        agent?.showProximity(true);
      }
      this.nearbyAgent = nearest;
    }

    // Check hotspots
    this.nearbyHotspot = null;
    for (const hs of HOTSPOTS) {
      const hx = hs.x + hs.w / 2;
      const hy = hs.y + hs.h / 2;
      const dx = jx - hx;
      const dy = jy - hy;
      if (Math.sqrt(dx * dx + dy * dy) < PROXIMITY_RANGE) {
        this.nearbyHotspot = hs.id;
        break;
      }
    }
  }
}
