"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  renderOffice,
  hitTestAgent,
  hitTestHotspot,
  setAgentTarget,
  CANVAS_W,
  CANVAS_H,
  AGENTS,
  type RenderState,
  type AgentStatus,
  type AgentDispatchIndicator,
} from "../engine/OfficeRenderer";
import { getRoomCenter } from "../config/office-map";
import { useOfficeStore, type PanelType } from "../store";
import { useAgents } from "../hooks/useOfficeData";
import { useAllDispatches } from "../hooks/useDispatch";

export function OfficeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const stateRef = useRef<RenderState>({
    hoveredEntity: null,
    hoveredHotspot: null,
    selectedEntity: null,
    agentStatuses: new Map(),
    agentDispatches: new Map(),
    agentAnims: new Map(),
    time: 0,
    lastTime: 0,
  });

  const { data: agents } = useAgents();
  const { data: dispatches } = useAllDispatches();
  const { openPanel, selectAgent, setHoveredEntity } = useOfficeStore();
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);

  // Sync selected agent
  useEffect(() => {
    stateRef.current.selectedEntity = selectedAgentId;
  }, [selectedAgentId]);

  // ── Combined effect: sync statuses + dispatches + movement ──────────────────
  // Runs whenever agents data OR dispatches data changes
  useEffect(() => {
    const state = stateRef.current;

    // 1. Update agent statuses
    const statusMap = new Map<string, AgentStatus>();
    if (agents) {
      for (const a of agents) {
        statusMap.set(a.name.toLowerCase(), {
          id: a.id,
          status: a.status,
          messages_24h: a.messages_24h,
          errors_24h: a.errors_24h,
        });
      }
    }
    state.agentStatuses = statusMap;

    // 2. Build dispatch indicators
    const dispatchMap = new Map<string, AgentDispatchIndicator>();
    if (dispatches) {
      for (const d of dispatches) {
        const key = d.target_agent.toLowerCase();
        const existing = dispatchMap.get(key);
        const isActive = d.status === "queued" || d.status === "sent" || d.status === "acknowledged";
        if (!existing) {
          dispatchMap.set(key, { hasActive: isActive, lastStatus: d.status });
        } else if (isActive) {
          existing.hasActive = true;
        }
      }
    }
    state.agentDispatches = dispatchMap;

    // 3. Move agents based on combined state
    for (const agentCfg of AGENTS) {
      const nameKey = agentCfg.name.toLowerCase();
      const statusData = statusMap.get(nameKey);
      const dispatchData = dispatchMap.get(nameKey);
      const status = statusData?.status ?? "idle";
      const hasActiveDispatch = dispatchData?.hasActive ?? false;

      let targetRoom: string | null = null;

      if (hasActiveDispatch) {
        targetRoom = "command-center";
      } else if (status === "down") {
        targetRoom = "server-room";
      }

      if (targetRoom) {
        const center = getRoomCenter(targetRoom);
        if (center) {
          // Deterministic offset based on agent id to avoid random jitter
          const hash = agentCfg.id.charCodeAt(0) + agentCfg.id.charCodeAt(agentCfg.id.length - 1);
          const offsetX = ((hash % 7) - 3) * 25;
          const offsetY = ((hash % 5) - 2) * 15;
          setAgentTarget(state, agentCfg.id, center.x + offsetX, center.y + offsetY);
        }
      } else {
        // Return to default spawn
        setAgentTarget(state, agentCfg.id, agentCfg.spawnX, agentCfg.spawnY);
      }
    }
  }, [agents, dispatches]);

  // ── Convert screen coords to canvas coords ─────────────────────────────────
  const toCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  // ── Mouse move handler ──────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = toCanvasCoords(e.clientX, e.clientY);
      const canvas = canvasRef.current;

      const agent = hitTestAgent(x, y, stateRef.current);
      const hotspot = hitTestHotspot(x, y);

      stateRef.current.hoveredEntity = agent?.id ?? null;
      stateRef.current.hoveredHotspot = hotspot?.id ?? null;
      setHoveredEntity(agent?.id ?? null);

      if (canvas) {
        canvas.style.cursor = agent || hotspot ? "pointer" : "default";
      }
    },
    [toCanvasCoords, setHoveredEntity]
  );

  // ── Click handler ───────────────────────────────────────────────────────────
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = toCanvasCoords(e.clientX, e.clientY);

      const agent = hitTestAgent(x, y, stateRef.current);
      if (agent) {
        selectAgent(agent.id);
        return;
      }

      const hotspot = hitTestHotspot(x, y);
      if (hotspot) {
        openPanel(hotspot.actionTarget as PanelType);
        return;
      }
    },
    [toCanvasCoords, selectAgent, openPanel]
  );

  // ── Render loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function frame(time: number) {
      stateRef.current.time = time;
      renderOffice(ctx!, stateRef.current);
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Resize handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      const aspect = CANVAS_W / CANVAS_H;
      let w = width;
      let h = width / aspect;
      if (h > height) {
        h = height;
        w = height * aspect;
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden p-2">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={() => {
          stateRef.current.hoveredEntity = null;
          stateRef.current.hoveredHotspot = null;
          setHoveredEntity(null);
          if (canvasRef.current) canvasRef.current.style.cursor = "default";
        }}
        className="rounded-xl border border-white/[0.06] shadow-2xl"
      />
    </div>
  );
}
