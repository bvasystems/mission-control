"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  renderOffice,
  hitTestAgent,
  hitTestHotspot,
  CANVAS_W,
  CANVAS_H,
  type RenderState,
  type AgentStatus,
} from "../engine/OfficeRenderer";
import { useOfficeStore, type PanelType } from "../store";
import { useAgents } from "../hooks/useOfficeData";

export function OfficeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const stateRef = useRef<RenderState>({
    hoveredEntity: null,
    hoveredHotspot: null,
    agentStatuses: new Map(),
    time: 0,
  });

  const { data: agents } = useAgents();
  const { openPanel, selectAgent, setHoveredEntity } = useOfficeStore();

  // Update agent statuses when data changes
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
  }, [agents]);

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

      const agent = hitTestAgent(x, y);
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

      // Check agent first
      const agent = hitTestAgent(x, y);
      if (agent) {
        selectAgent(agent.id);
        return;
      }

      // Check hotspot
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

  // ── Resize handler: maintain aspect ratio ───────────────────────────────────
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
    <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden p-4">
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
