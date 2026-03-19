"use client";

import { useRef, useEffect } from "react";
import { useOfficeStore, type PanelType } from "../store";
import { useAgents, useIncidents, useTasks } from "../hooks/useOfficeData";
import { useAllDispatches } from "../hooks/useDispatch";
import { AGENTS, getIdleSpot } from "../config/office-map";
import { determineRoom } from "../engine/roomAssignment";
import type { AgentActivity } from "../types";
import type { OfficeApp, SyncData } from "../pixi/OfficeApp";

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
  return { state: "idle", label: "", since: now };
}

export function OfficeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<OfficeApp | null>(null);

  const { data: agents } = useAgents();
  const { data: dispatches } = useAllDispatches();
  const { data: incidents } = useIncidents();
  const { data: tasks } = useTasks();
  const { openPanel, selectAgent } = useOfficeStore();
  const meetingAgents = useOfficeStore((s) => s.meetingAgents);

  // ── Init Pixi app (dynamic import for SSR safety) ────────────────────────
  useEffect(() => {
    let app: OfficeApp | null = null;
    let destroyed = false;

    (async () => {
      if (!containerRef.current || destroyed) return;

      const { OfficeApp: AppClass } = await import("../pixi/OfficeApp");
      if (destroyed) return;

      app = new AppClass();
      await app.init(containerRef.current, {
        onSelectAgent: (id: string) => selectAgent(id),
        onOpenPanel: (panel: string) => openPanel(panel as PanelType),
      });

      if (destroyed) {
        app.destroy();
        return;
      }

      appRef.current = app;
    })();

    return () => {
      destroyed = true;
      app?.destroy();
      appRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync data from SWR → Pixi ────────────────────────────────────────────
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;

    // Build status map
    const statusMap = new Map<string, { status: string; messages_24h: number; errors_24h: number }>();
    for (const a of agents ?? []) {
      statusMap.set(a.name.toLowerCase(), {
        status: a.status,
        messages_24h: a.messages_24h,
        errors_24h: a.errors_24h,
      });
    }

    // Build dispatch map
    const dispatchMap = new Map<string, boolean>();
    for (const d of dispatches ?? []) {
      if (d.status === "queued" || d.status === "sent") {
        dispatchMap.set(d.target_agent, true);
      }
    }

    // Build activities and targets
    const activities = new Map<string, AgentActivity>();
    const targets = new Map<string, { x: number; y: number }>();

    const meetingSeats = [
      { x: 990, y: 105 }, { x: 1050, y: 105 }, { x: 1110, y: 105 }, { x: 1170, y: 105 },
      { x: 990, y: 245 }, { x: 1050, y: 245 }, { x: 1110, y: 245 }, { x: 1170, y: 245 },
    ];
    let seatCounter = 0;

    for (const agentCfg of AGENTS) {
      if (agentCfg.id === "joao" && !meetingAgents.includes("joao")) continue;

      const nameKey = agentCfg.name.toLowerCase();
      const statusData = statusMap.get(nameKey);
      const hasActiveDispatch = dispatchMap.get(nameKey) ?? false;
      const agentTasks = tasks?.filter(
        (t) => (t.owner?.toLowerCase() === nameKey || t.assigned_to?.toLowerCase() === nameKey) &&
               t.column !== "done"
      ) ?? [];

      activities.set(agentCfg.id, simpleActivity(
        statusData?.status ?? "idle",
        hasActiveDispatch,
        agentTasks.length > 0,
      ));

      const targetRoom = determineRoom(agentCfg, {
        status: (statusData?.status ?? "idle") as "active" | "idle" | "degraded" | "down",
        isInMeeting: meetingAgents.includes(agentCfg.id),
        hasActiveTasks: agentTasks.length > 0,
        hasActiveDispatch,
      });

      if (targetRoom === agentCfg.defaultRoom) {
        targets.set(agentCfg.id, { x: agentCfg.spawnX, y: agentCfg.spawnY });
      } else if (targetRoom === "sala-reuniao") {
        const seat = meetingSeats[seatCounter % meetingSeats.length];
        seatCounter++;
        targets.set(agentCfg.id, seat);
      } else {
        const agentIdx = AGENTS.indexOf(agentCfg);
        const spot = getIdleSpot(targetRoom, agentIdx);
        if (spot) targets.set(agentCfg.id, spot);
      }
    }

    // Alert rooms
    const alertMap = new Map<string, string>();
    const openIncidents = incidents?.filter((i) => i.status !== "closed") ?? [];
    if (openIncidents.some((i) => i.severity === "critical")) {
      alertMap.set("sala-reuniao", "critical");
      alertMap.set("sala-reuniao:count", String(openIncidents.length));
    } else if (openIncidents.some((i) => i.severity === "high")) {
      alertMap.set("sala-reuniao", "warning");
      alertMap.set("sala-reuniao:count", String(openIncidents.length));
    }

    const syncData: SyncData = {
      agentStatuses: statusMap,
      agentActivities: activities,
      agentTargets: targets,
      alertRooms: alertMap,
      meetingAgents,
    };

    app.syncData(syncData);
  }, [agents, dispatches, incidents, tasks, meetingAgents]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center overflow-hidden"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
