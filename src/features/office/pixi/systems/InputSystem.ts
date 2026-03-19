// ── Input System — Keyboard (WASD) + "E" interaction ─────────────────────────

import type { AgentLayer } from "../layers/AgentLayer";

export class InputSystem {
  private keys = new Set<string>();
  private onInteract: (id: string) => void;
  private agentLayer: AgentLayer;
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;

  constructor(agentLayer: AgentLayer, onInteract: (id: string) => void) {
    this.agentLayer = agentLayer;
    this.onInteract = onInteract;

    this.onKeyDownBound = this.onKeyDown.bind(this);
    this.onKeyUpBound = this.onKeyUp.bind(this);

    window.addEventListener("keydown", this.onKeyDownBound);
    window.addEventListener("keyup", this.onKeyUpBound);
  }

  private isTyping(): boolean {
    const tag = document.activeElement?.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" ||
      document.activeElement?.getAttribute("contenteditable") === "true";
  }

  private onKeyDown(e: KeyboardEvent) {
    if (this.isTyping()) return;
    const key = e.key.toLowerCase();

    if (key === "e") {
      e.preventDefault();
      // Find nearby agent or hotspot via proximity system
      // The OfficeApp handles this through the callback
      const joao = this.agentLayer.agents.get("joao");
      if (!joao) return;

      // Check nearby agents
      for (const [id, agent] of this.agentLayer.agents) {
        if (id === "joao") continue;
        const dx = joao.container.x - agent.container.x;
        const dy = joao.container.y - agent.container.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 60) {
          this.onInteract(id);
          return;
        }
      }
      return;
    }

    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      e.preventDefault();
      this.keys.add(key);
      this.updateVelocity();
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.key.toLowerCase());
    this.updateVelocity();
  }

  private updateVelocity() {
    const joao = this.agentLayer.agents.get("joao");
    if (!joao) return;

    let vx = 0, vy = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) vy -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) vy += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) vx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) vx += 1;

    if (vx !== 0 && vy !== 0) {
      const l = Math.SQRT2;
      vx /= l;
      vy /= l;
    }

    joao.setVelocity(vx, vy);
  }

  destroy() {
    window.removeEventListener("keydown", this.onKeyDownBound);
    window.removeEventListener("keyup", this.onKeyUpBound);
  }
}
