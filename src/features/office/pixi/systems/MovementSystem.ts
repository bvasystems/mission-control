// ── Movement System — Updates all agent positions ────────────────────────────

import type { AgentLayer } from "../layers/AgentLayer";

export class MovementSystem {
  private agentLayer: AgentLayer;

  constructor(agentLayer: AgentLayer) {
    this.agentLayer = agentLayer;
  }

  update(dt: number) {
    for (const [, agent] of this.agentLayer.agents) {
      agent.update(dt);
    }
  }
}
