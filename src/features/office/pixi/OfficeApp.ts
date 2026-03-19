// ── PixiJS Office Application ─────────────────────────────────────────────────
// Manages the Pixi Application lifecycle, layers, and game loop.

import { Application, Container } from "pixi.js";
import { CANVAS_W, CANVAS_H } from "./constants";
import { BackgroundLayer } from "./layers/BackgroundLayer";
import { FurnitureLayer } from "./layers/FurnitureLayer";
import { AgentLayer } from "./layers/AgentLayer";
import { UILayer } from "./layers/UILayer";
import { InputSystem } from "./systems/InputSystem";
import { MovementSystem } from "./systems/MovementSystem";
import { ProximitySystem } from "./systems/ProximitySystem";
import type { AgentConfig } from "../config/office-map";
import { AGENTS } from "../config/office-map";
import type { AgentActivity } from "../types";

export interface OfficeCallbacks {
  onSelectAgent: (id: string) => void;
  onOpenPanel: (panel: string) => void;
}

export interface SyncData {
  agentStatuses: Map<string, { status: string; messages_24h: number; errors_24h: number }>;
  agentActivities: Map<string, AgentActivity>;
  agentTargets: Map<string, { x: number; y: number }>;
  alertRooms: Map<string, string>;
  meetingAgents: string[];
}

export class OfficeApp {
  app!: Application;
  private backgroundLayer!: BackgroundLayer;
  private furnitureLayer!: FurnitureLayer;
  agentLayer!: AgentLayer;
  private uiLayer!: UILayer;
  private inputSystem!: InputSystem;
  private movementSystem!: MovementSystem;
  private proximitySystem!: ProximitySystem;
  private callbacks: OfficeCallbacks | null = null;

  async init(container: HTMLDivElement, callbacks: OfficeCallbacks) {
    this.callbacks = callbacks;

    this.app = new Application();
    await this.app.init({
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: 0x0a0a0a,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      resizeTo: container,
    });

    container.appendChild(this.app.canvas as HTMLCanvasElement);

    // Create layer containers in z-order
    const stage = this.app.stage;

    this.backgroundLayer = new BackgroundLayer();
    stage.addChild(this.backgroundLayer.container);

    this.furnitureLayer = new FurnitureLayer();
    stage.addChild(this.furnitureLayer.container);

    this.agentLayer = new AgentLayer();
    stage.addChild(this.agentLayer.container);

    this.uiLayer = new UILayer();
    stage.addChild(this.uiLayer.container);

    // Initialize layers
    await this.backgroundLayer.init();
    await this.furnitureLayer.init();
    this.agentLayer.init(AGENTS);
    this.uiLayer.init();

    // Systems
    this.movementSystem = new MovementSystem(this.agentLayer);
    this.proximitySystem = new ProximitySystem(this.agentLayer);
    this.inputSystem = new InputSystem(this.agentLayer, (id) => {
      if (this.callbacks) {
        if (id.startsWith("hs:")) {
          this.callbacks.onOpenPanel(id.slice(3));
        } else {
          this.callbacks.onSelectAgent(id);
        }
      }
    });

    // Mouse interaction on agents
    this.agentLayer.onAgentClick = (id: string) => {
      this.callbacks?.onSelectAgent(id);
    };

    // Mouse on rooms/hotspots
    this.backgroundLayer.onRoomClick = (roomId: string) => {
      const panelMap: Record<string, string> = {
        "recepcao": "agents", "diretoria": "agents",
        "desenvolvimento": "kanban", "operacoes": "stats",
        "sala-reuniao": "meeting", "copa": "stats",
        "salao-jogos": "stats", "jardim": "stats",
      };
      const panel = panelMap[roomId];
      if (panel) this.callbacks?.onOpenPanel(panel);
    };

    // Game loop
    this.app.ticker.add((ticker) => {
      const dt = ticker.deltaMS;
      this.movementSystem.update(dt);
      this.proximitySystem.update();
      this.uiLayer.update(this.app.ticker.lastTime, this.proximitySystem.nearbyAgent, this.proximitySystem.nearbyHotspot, this.agentLayer);
    });
  }

  syncData(data: SyncData) {
    this.agentLayer.syncStatuses(data.agentStatuses);
    this.agentLayer.syncActivities(data.agentActivities);
    this.agentLayer.syncTargets(data.agentTargets);
    this.uiLayer.syncAlerts(data.alertRooms);
  }

  destroy() {
    this.inputSystem?.destroy();
    this.app?.destroy(true, { children: true });
  }
}
