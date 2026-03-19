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

// ── Agent room assignment based on status ─────────────────────────────────────
// Maps agent status/activity to a target room
function getTargetRoom(agentId: string, status: string, hasDispatch: boolean): string | null {
  // If the agent has an active dispatch, move them to command-center
  if (hasDispatch) return "command-center";

  // Status-based room assignments
  if (status === "down") return "server-room";

  // Otherwise stay in default room
  return null;
}

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

  // Update agent statuses and trigger room changes
  useEffect(() => {
    if (!agents) return;
    const map = new Map<string, AgentStatus>();
    for (const a of agents) {
      map.set(a.name.toLowerCase(), {
        id: a.id,
        status: a.status,
        messages_24h: a.messages_24h,
        errors_24h: a.errors_24h,
      });
    }
    stateRef.current.agentStatuses = map;

    // Update agent room targets based on status
    for (const agentCfg of AGENTS) {
      const statusData = map.get(agentCfg.name.toLowerCase());
      const dispatchData = stateRef.current.agentDispatches.get(agentCfg.name.toLowerCase());
      const targetRoom = getTargetRoom(
        agentCfg.id,
        statusData?.status ?? "idle",
        dispatchData?.hasActive ?? false
      );

      if (targetRoom) {
        const center = getRoomCenter(targetRoom);
        if (center) {
          // Add some random offset so agents don't stack
          const offsetX = (Math.random() - 0.5) * 60;
          const offsetY = (Math.random() - 0.5) * 40;
          setAgentTarget(stateRef.current, agentCfg.id, center.x + offsetX, center.y + offsetY);
        }
      } else {
        // Return to default position
        setAgentTarget(stateRef.current, agentCfg.id, agentCfg.spawnX, agentCfg.spawnY);
      }
    }
  }, [agents]);

  // Sync selected agent
  useEffect(() => {
    stateRef.current.selectedEntity = selectedAgentId;
  }, [selectedAgentId]);

  // Build dispatch indicators
  useEffect(() => {
    const map = new Map<string, AgentDispatchIndicator>();
    if (dispatches) {
      for (const d of dispatches) {
        const key = d.target_agent.toLowerCase();
        const existing = map.get(key);
        const isActive = d.status === "queued" || d.status === "sent";
        if (!existing) {
          map.set(key, { hasActive: isActive, lastStatus: d.status });
        } else if (isActive) {
          existing.hasActive = true;
        }
      }
    }
    stateRef.current.agentDispatches = map;

    // Move agents with active dispatches
    for (const agentCfg of AGENTS) {
      const dispatchData = map.get(agentCfg.name.toLowerCase());
      if (dispatchData?.hasActive) {
        const center = getRoomCenter("command-center");
        if (center) {
          const offsetX = (Math.random() - 0.5) * 80;
          setAgentTarget(stateRef.current, agentCfg.id, center.x + offsetX, center.y);
        }
      }
    }
  }, [dispatches]);

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
