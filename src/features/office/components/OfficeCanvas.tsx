"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  renderOffice,
  hitTestAgent,
  hitTestHotspot,
  hitTestRoom,
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
import { useAgents, useIncidents, useTasks } from "../hooks/useOfficeData";
import { useAllDispatches } from "../hooks/useDispatch";
import { computeActivity } from "../engine/activityEngine";
import { determineRoom } from "../engine/roomAssignment";

// ── Room → Panel mapping ──────────────────────────────────────────────────────
const ROOM_PANEL_MAP: Record<string, PanelType> = {
  "diretoria": "agents",
  "sprint-room": "projects",
  "war-room": "incidents",
  "dev-area": "kanban",
  "deploy-room": "crons",
  "metrics-wall": "stats",
  "server-room": "agents",
  "lounge": "stats",
  "command-center": "agents",
};

export function OfficeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const stateRef = useRef<RenderState>({
    hoveredEntity: null,
    hoveredHotspot: null,
    hoveredRoom: null,
    selectedEntity: null,
    agentStatuses: new Map(),
    agentDispatches: new Map(),
    agentAnims: new Map(),
    agentActivities: new Map(),
    alertRooms: new Map(),
    cameraX: 0,
    cameraY: 0,
    time: 0,
    lastTime: 0,
  });

  const { data: agents } = useAgents();
  const { data: dispatches } = useAllDispatches();
  const { data: incidents } = useIncidents();
  const { data: tasks } = useTasks();
  const { openPanel, selectAgent, setHoveredEntity } = useOfficeStore();
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);

  // Sync selected agent
  useEffect(() => {
    stateRef.current.selectedEntity = selectedAgentId;
  }, [selectedAgentId]);

  // ── Combined effect: statuses + dispatches + tasks + incidents → movement ──
  useEffect(() => {
    const state = stateRef.current;

    // 1. Agent statuses
    const statusMap = new Map<string, AgentStatus>();
    if (agents) {
      for (const a of agents) {
        statusMap.set(a.name.toLowerCase(), {
          id: a.id, status: a.status,
          messages_24h: a.messages_24h, errors_24h: a.errors_24h,
        });
      }
    }
    state.agentStatuses = statusMap;

    // 2. Dispatch indicators
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

    // 3. Incident alerts on rooms
    const alertMap = new Map<string, "warning" | "critical">();
    const openIncidents = incidents?.filter((i) => i.status !== "closed") ?? [];
    if (openIncidents.length > 0) {
      const hasCritical = openIncidents.some((i) => i.severity === "critical");
      const hasHigh = openIncidents.some((i) => i.severity === "high");
      if (hasCritical) {
        alertMap.set("war-room", "critical");
      } else if (hasHigh) {
        alertMap.set("war-room", "warning");
      }
    }
    state.alertRooms = alertMap;

    // 4. Compute activity state per agent
    const activityMap = new Map<string, ReturnType<typeof computeActivity>>();
    for (const agentCfg of AGENTS) {
      const nameKey = agentCfg.name.toLowerCase();
      const statusData = statusMap.get(nameKey);
      const agentDispatches = dispatches?.filter(
        (d) => d.target_agent === nameKey || d.issued_by === nameKey
      ) ?? [];
      const agentTasks = tasks?.filter(
        (t) => (t.owner?.toLowerCase() === nameKey || t.assigned_to?.toLowerCase() === nameKey) &&
               t.column !== "done"
      ) ?? [];

      const activity = computeActivity({
        agentName: nameKey,
        agentStatus: statusData?.status ?? "idle",
        dispatches: agentDispatches,
        tasks: agentTasks,
      });
      activityMap.set(agentCfg.id, activity);
    }
    state.agentActivities = activityMap;

    // 5. Room assignment per agent (skip João — player controlled)
    for (const agentCfg of AGENTS) {
      if (agentCfg.id === "joao") continue; // Player-controlled
      const nameKey = agentCfg.name.toLowerCase();
      const statusData = statusMap.get(nameKey);
      const dispatchData = dispatchMap.get(nameKey);

      // Find tasks for this agent
      const agentTasks = tasks?.filter(
        (t) => (t.owner?.toLowerCase() === nameKey || t.assigned_to?.toLowerCase() === nameKey) &&
               t.column !== "done"
      ) ?? [];

      // Check if agent is incident owner
      const ownedIncident = openIncidents.find(
        (i) => i.owner?.toLowerCase() === nameKey || i.source?.toLowerCase() === nameKey
      );

      const targetRoom = determineRoom(agentCfg, {
        status: statusData?.status ?? "idle",
        hasActiveDispatch: dispatchData?.hasActive ?? false,
        activeTasks: agentTasks.map((t) => ({
          column: t.column, type: t.type, priority: t.priority,
        })),
        isIncidentOwner: !!ownedIncident,
        incidentSeverity: ownedIncident?.severity ?? null,
      });

      const center = getRoomCenter(targetRoom);
      if (center) {
        const hash = agentCfg.id.charCodeAt(0) + agentCfg.id.charCodeAt(agentCfg.id.length - 1);
        const offsetX = ((hash % 7) - 3) * 25;
        const offsetY = ((hash % 5) - 2) * 15;
        setAgentTarget(state, agentCfg.id, center.x + offsetX, center.y + offsetY);
      }
    }
  }, [agents, dispatches, incidents, tasks]);

  // ── Convert screen coords to canvas coords ─────────────────────────────────
  const toCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (CANVAS_W / rect.width),
      y: (clientY - rect.top) * (CANVAS_H / rect.height),
    };
  }, []);

  // ── Keyboard input (WASD / Arrow keys) ───────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        e.preventDefault();
        keysRef.current.add(key);
        updateJoaoVelocity();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
      updateJoaoVelocity();
    };

    function updateJoaoVelocity() {
      const keys = keysRef.current;
      const joao = stateRef.current.agentAnims.get("joao");
      if (!joao) return;

      let vx = 0, vy = 0;
      if (keys.has("w") || keys.has("arrowup")) vy -= 1;
      if (keys.has("s") || keys.has("arrowdown")) vy += 1;
      if (keys.has("a") || keys.has("arrowleft")) vx -= 1;
      if (keys.has("d") || keys.has("arrowright")) vx += 1;

      // Normalize diagonal
      if (vx !== 0 && vy !== 0) {
        const len = Math.sqrt(vx * vx + vy * vy);
        vx /= len;
        vy /= len;
      }

      joao.velX = vx;
      joao.velY = vy;
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ── Mouse move ──────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = toCanvasCoords(e.clientX, e.clientY);
      const canvas = canvasRef.current;

      const agent = hitTestAgent(x, y, stateRef.current);
      const hotspot = hitTestHotspot(x, y, stateRef.current);
      const room = !agent && !hotspot ? hitTestRoom(x, y, stateRef.current) : null;

      stateRef.current.hoveredEntity = agent?.id ?? null;
      stateRef.current.hoveredHotspot = hotspot?.id ?? null;
      stateRef.current.hoveredRoom = room?.id ?? null;
      setHoveredEntity(agent?.id ?? null);

      if (canvas) {
        canvas.style.cursor = agent || hotspot || room ? "pointer" : "default";
      }
    },
    [toCanvasCoords, setHoveredEntity]
  );

  // ── Click handler (agent > hotspot > room) ─────────────────────────────────
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = toCanvasCoords(e.clientX, e.clientY);

      const agent = hitTestAgent(x, y, stateRef.current);
      if (agent) { selectAgent(agent.id); return; }

      const hotspot = hitTestHotspot(x, y, stateRef.current);
      if (hotspot) { openPanel(hotspot.actionTarget as PanelType); return; }

      // Room click — open contextual panel
      const room = hitTestRoom(x, y, stateRef.current);
      if (room) {
        const panel = ROOM_PANEL_MAP[room.id];
        if (panel) openPanel(panel);
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
      if (h > height) { h = height; w = height * aspect; }
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
          stateRef.current.hoveredRoom = null;
          setHoveredEntity(null);
          if (canvasRef.current) canvasRef.current.style.cursor = "default";
        }}
        className="rounded-xl border border-white/[0.06] shadow-2xl"
      />
    </div>
  );
}
