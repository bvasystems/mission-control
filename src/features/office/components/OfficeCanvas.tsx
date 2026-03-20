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
import { getRoomCenter, getIdleSpot, HOTSPOTS } from "../config/office-map";
import { useOfficeStore, type PanelType } from "../store";
import { useAgents, useIncidents, useTasks } from "../hooks/useOfficeData";
import { useAllDispatches } from "../hooks/useDispatch";
import { determineRoom } from "../engine/roomAssignment";
import type { AgentActivity } from "../types";

// ── Room → Panel mapping ──────────────────────────────────────────────────────
const ROOM_PANEL_MAP: Record<string, PanelType> = {
  "recepcao": "agents",
  "diretoria": "agents",
  "desenvolvimento": "kanban",
  "operacoes": "stats",
  "sala-reuniao": "meeting",
  "copa": "stats",
};

// ── Simple activity from status/dispatch ──────────────────────────────────────
function simpleActivity(
  status: string,
  hasDispatch: boolean,
  hasTask: boolean
): AgentActivity {
  const now = Date.now();
  if (hasDispatch) return { state: "thinking", label: "Processando...", since: now };
  if (status === "degraded") return { state: "waiting", label: "Degradado", since: now };
  if (status === "down") return { state: "waiting", label: "Offline", since: now };
  if (hasTask) return { state: "coding", label: "Em tarefa", since: now };
  // No tasks/dispatch → agent is on break (will be in copa/recepcao)
  return { state: "idle", label: "", since: now };
}

export function OfficeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const seenResponsesRef = useRef<Set<string>>(new Set());
  const lastNearbyRef = useRef<string | null>(null);
  const stateRef = useRef<RenderState>({
    hoveredEntity: null,
    hoveredHotspot: null,
    hoveredRoom: null,
    selectedEntity: null,
    nearbyAgent: null,
    nearbyHotspot: null,
    agentStatuses: new Map(),
    agentDispatches: new Map(),
    agentAnims: new Map(),
    agentActivities: new Map(),
    agentFlash: new Map(),
    alertRooms: new Map(),
    particles: [],
    cameraX: 0,
    cameraY: 0,
    time: 0,
    lastTime: 0,
  });

  const { data: agents } = useAgents();
  const { data: dispatches } = useAllDispatches();
  const { data: incidents } = useIncidents();
  const { data: tasks } = useTasks();
  const { openPanel, closePanel, selectAgent, setHoveredEntity } = useOfficeStore();
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);
  const meetingAgents = useOfficeStore((s) => s.meetingAgents);

  useEffect(() => { stateRef.current.selectedEntity = selectedAgentId; }, [selectedAgentId]);

  // ── Combined data sync + movement ──────────────────────────────────────────
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

    // 2b. Detect new responses → trigger flash on agent
    if (dispatches) {
      for (const d of dispatches) {
        if (d.status === "done" && d.response && !seenResponsesRef.current.has(d.id)) {
          seenResponsesRef.current.add(d.id);
          // Flash the agent for 3 seconds
          const agentId = AGENTS.find((a) => a.name.toLowerCase() === d.target_agent.toLowerCase())?.id;
          if (agentId) {
            state.agentFlash.set(agentId, performance.now() + 3000);
          }
        }
      }
      // Keep seen set from growing indefinitely
      if (seenResponsesRef.current.size > 200) {
        const arr = [...seenResponsesRef.current];
        seenResponsesRef.current = new Set(arr.slice(-100));
      }
    }

    // 3. Incident alerts
    const alertMap = new Map<string, string>();
    const openIncidents = incidents?.filter((i) => i.status !== "closed") ?? [];
    if (openIncidents.some((i) => i.severity === "critical")) {
      alertMap.set("sala-reuniao", "critical");
      alertMap.set("sala-reuniao:count", String(openIncidents.length));
    } else if (openIncidents.some((i) => i.severity === "high")) {
      alertMap.set("sala-reuniao", "warning");
      alertMap.set("sala-reuniao:count", String(openIncidents.length));
    }
    state.alertRooms = alertMap;

    // 4. Activity + Room assignment per agent
    const activityMap = new Map<string, AgentActivity>();
    // Seats at meeting table chairs — top row (y=105) and bottom row (y=245)
    const meetingSeats = [
      { x: 990, y: 105 }, { x: 1050, y: 105 }, { x: 1110, y: 105 }, { x: 1170, y: 105 },
      { x: 990, y: 245 }, { x: 1050, y: 245 }, { x: 1110, y: 245 }, { x: 1170, y: 245 },
    ];
    let seatCounter = 0;

    for (const agentCfg of AGENTS) {
      const isJoao = agentCfg.id === "joao";
      const isInMeeting = meetingAgents.includes(agentCfg.id);

      // João is player-controlled EXCEPT when called to meeting
      if (isJoao && !isInMeeting) continue;

      const nameKey = agentCfg.name.toLowerCase();
      const statusData = statusMap.get(nameKey);
      const dispatchData = dispatchMap.get(nameKey);
      // Only in_progress and review tasks keep agent at desk
      // backlog and todo don't count as "actively working"
      const agentTasks = tasks?.filter(
        (t) => (t.owner?.toLowerCase() === nameKey || t.assigned_to?.toLowerCase() === nameKey) &&
               (t.column === "in_progress" || t.column === "review")
      ) ?? [];

      // Simple activity
      activityMap.set(agentCfg.id, simpleActivity(
        statusData?.status ?? "idle",
        dispatchData?.hasActive ?? false,
        agentTasks.length > 0,
      ));

      // Room assignment — only meeting or department
      const targetRoom = determineRoom(agentCfg, {
        status: statusData?.status ?? "idle",
        isInMeeting: meetingAgents.includes(agentCfg.id),
        hasActiveTasks: agentTasks.length > 0,
        hasActiveDispatch: dispatchData?.hasActive ?? false,
      });

      if (targetRoom === agentCfg.defaultRoom) {
        // Stay at their desk
        setAgentTarget(state, agentCfg.id, agentCfg.spawnX, agentCfg.spawnY);
      } else if (targetRoom === "sala-reuniao") {
        const seat = meetingSeats[seatCounter % meetingSeats.length];
        seatCounter++;
        setAgentTarget(state, agentCfg.id, seat.x, seat.y);
        // Disable player control for João during meeting
        if (isJoao) {
          const joaoAnim = state.agentAnims.get("joao");
          if (joaoAnim) { joaoAnim.isPlayerControlled = false; joaoAnim.velX = 0; joaoAnim.velY = 0; }
        }
      } else {
        // Other rooms (copa, recepcao) → specific idle spots
        const agentIdx = AGENTS.indexOf(agentCfg);
        const spot = getIdleSpot(targetRoom, agentIdx);
        if (spot) {
          setAgentTarget(state, agentCfg.id, spot.x, spot.y);
        }
      }
    }

    // Restore João's player control when not in meeting
    if (!meetingAgents.includes("joao")) {
      const joaoAnim = state.agentAnims.get("joao");
      if (joaoAnim && !joaoAnim.isPlayerControlled) {
        joaoAnim.isPlayerControlled = true;
      }
    }

    state.agentActivities = activityMap;
  }, [agents, dispatches, incidents, tasks, meetingAgents]);

  // ── Keyboard input ──────────────────────────────────────────────────────────
  useEffect(() => {
    const isTyping = () => {
      const tag = document.activeElement?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.getAttribute("contenteditable") === "true";
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping()) return;
      const key = e.key.toLowerCase();

      // "E" key — interact with nearby agent or hotspot
      if (key === "e") {
        e.preventDefault();
        const s = stateRef.current;
        if (s.nearbyAgent) {
          selectAgent(s.nearbyAgent);
          return;
        }
        if (s.nearbyHotspot) {
          const hs = HOTSPOTS.find((h) => h.id === s.nearbyHotspot);
          if (hs) openPanel(hs.actionTarget as PanelType);
          return;
        }
      }

      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        e.preventDefault();
        keysRef.current.add(key);
        updateVelocity();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
      updateVelocity();
    };
    function updateVelocity() {
      const keys = keysRef.current;
      const joao = stateRef.current.agentAnims.get("joao");
      if (!joao) return;
      let vx = 0, vy = 0;
      if (keys.has("w") || keys.has("arrowup")) vy -= 1;
      if (keys.has("s") || keys.has("arrowdown")) vy += 1;
      if (keys.has("a") || keys.has("arrowleft")) vx -= 1;
      if (keys.has("d") || keys.has("arrowright")) vx += 1;
      if (vx !== 0 && vy !== 0) { const l = Math.SQRT2; vx /= l; vy /= l; }
      joao.velX = vx;
      joao.velY = vy;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, []);

  // ── Coord conversion ───────────────────────────────────────────────────────
  const toCanvas = useCallback((cx: number, cy: number) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: (cx - r.left) * (CANVAS_W / r.width), y: (cy - r.top) * (CANVAS_H / r.height) };
  }, []);

  // ── Mouse ───────────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toCanvas(e.clientX, e.clientY);
    const s = stateRef.current;
    const agent = hitTestAgent(x, y, s);
    const hotspot = hitTestHotspot(x, y, s);
    const room = !agent && !hotspot ? hitTestRoom(x, y, s) : null;
    s.hoveredEntity = agent?.id ?? null;
    s.hoveredHotspot = hotspot?.id ?? null;
    s.hoveredRoom = room?.id ?? null;
    setHoveredEntity(agent?.id ?? null);
    if (canvasRef.current) canvasRef.current.style.cursor = agent || hotspot || room ? "pointer" : "default";
  }, [toCanvas, setHoveredEntity]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toCanvas(e.clientX, e.clientY);
    const s = stateRef.current;
    const agent = hitTestAgent(x, y, s);
    if (agent) { selectAgent(agent.id); return; }
    const hotspot = hitTestHotspot(x, y, s);
    if (hotspot) { openPanel(hotspot.actionTarget as PanelType); return; }
    const room = hitTestRoom(x, y, s);
    if (room) { const panel = ROOM_PANEL_MAP[room.id]; if (panel) openPanel(panel); }
  }, [toCanvas, selectAgent, openPanel]);

  // ── Render loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    function frame(time: number) {
      stateRef.current.time = time;
      renderOffice(ctx!, stateRef.current);

      // ── Proximity auto-chat: open when near, close when away ──
      const nearby = stateRef.current.nearbyAgent;
      if (nearby && nearby !== lastNearbyRef.current) {
        lastNearbyRef.current = nearby;
        selectAgent(nearby);
      } else if (!nearby && lastNearbyRef.current) {
        lastNearbyRef.current = null;
        closePanel();
      }

      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const obs = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      const a = CANVAS_W / CANVAS_H;
      let w = width, h = width / a;
      if (h > height) { h = height; w = height * a; }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden p-2">
      <canvas
        ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
        onMouseMove={handleMouseMove} onClick={handleClick}
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
