// ── Agent Layer — Character rendering and management ─────────────────────────

import { Container } from "pixi.js";
import type { AgentConfig } from "../../config/office-map";
import type { AgentActivity } from "../../types";
import { AgentSprite } from "../objects/AgentSprite";

export class AgentLayer {
  container = new Container();
  agents = new Map<string, AgentSprite>();
  onAgentClick: ((id: string) => void) | null = null;

  init(agentConfigs: AgentConfig[]) {
    this.container.sortableChildren = true;

    for (const cfg of agentConfigs) {
      const agent = new AgentSprite(cfg);
      agent.container.eventMode = "static";
      agent.container.cursor = "pointer";
      agent.container.on("pointerdown", () => {
        this.onAgentClick?.(cfg.id);
      });
      this.agents.set(cfg.id, agent);
      this.container.addChild(agent.container);
    }
  }

  syncStatuses(statuses: Map<string, { status: string; messages_24h: number; errors_24h: number }>) {
    for (const [id, data] of statuses) {
      const agent = this.findByName(id);
      if (agent) agent.setStatus(data.status);
    }
  }

  syncActivities(activities: Map<string, AgentActivity>) {
    for (const [id, activity] of activities) {
      const agent = this.agents.get(id);
      if (agent) agent.setActivity(activity);
    }
  }

  syncTargets(targets: Map<string, { x: number; y: number }>) {
    for (const [id, target] of targets) {
      const agent = this.agents.get(id);
      if (agent) {
        agent.targetX = target.x;
        agent.targetY = target.y;
      }
    }
  }

  private findByName(name: string): AgentSprite | undefined {
    for (const [, agent] of this.agents) {
      if (agent.config.name.toLowerCase() === name) return agent;
    }
    return undefined;
  }
}
