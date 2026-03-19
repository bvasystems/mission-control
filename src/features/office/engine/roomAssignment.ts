// ── Room Assignment Engine ────────────────────────────────────────────────────
// Pure function that determines which room an agent should be in based on
// their status, tasks, dispatches, and incidents.
//
// Agent roles affect behavior:
// - "leader" agents (Jota) stay in their default room (Diretoria) and only
//   move for direct dispatches or critical incidents. They delegate tasks,
//   they don't go to task rooms.
// - Regular agents move freely based on their tasks/status.

import type { AgentConfig } from "../config/office-map";

export interface RoomAssignmentInput {
  status: "active" | "idle" | "degraded" | "down";
  hasActiveDispatch: boolean;
  activeTasks: Array<{
    column: string;
    type: string;
    priority: string;
  }>;
  isIncidentOwner: boolean;
  incidentSeverity: string | null;
}

// Leader agents: stay in default room, only move for critical situations
const LEADER_AGENTS = new Set(["jota"]);

export function determineRoom(
  agent: AgentConfig,
  input: RoomAssignmentInput
): string {
  const isLeader = LEADER_AGENTS.has(agent.id);

  // 1. Active dispatch → command-center (all agents)
  if (input.hasActiveDispatch) {
    return "command-center";
  }

  // 2. Critical incident → war-room (all agents)
  if (input.isIncidentOwner && input.incidentSeverity === "critical") {
    return "war-room";
  }

  // ── Leader agents: only move for the above critical reasons ──────────────
  if (isLeader) {
    // High incident (not critical) — leader goes to war room too
    if (input.isIncidentOwner && input.incidentSeverity === "high") {
      return "war-room";
    }
    // Otherwise: leader stays in their office
    return agent.defaultRoom;
  }

  // ── Regular agents: full movement logic ─────────────────────────────────

  // 3. High incident owner → war-room
  if (input.isIncidentOwner && input.incidentSeverity === "high") {
    return "war-room";
  }

  // 4. Agent is down
  if (input.status === "down") {
    return "server-room";
  }

  // 5-7. Task-based assignment
  if (input.activeTasks.length > 0) {
    const sorted = [...input.activeTasks].sort((a, b) => a.priority.localeCompare(b.priority));
    const topTask = sorted[0];

    // Review tasks → sprint room
    if (topTask.column === "review" || topTask.column === "approved") {
      return "sprint-room";
    }

    // Deploy/infra tasks
    if (topTask.type === "n8n" || topTask.column === "validation") {
      return "deploy-room";
    }

    // Code/bug tasks in progress
    if ((topTask.type === "code" || topTask.type === "bug") &&
        (topTask.column === "in_progress" || topTask.column === "assigned")) {
      return "dev-area";
    }
  }

  // 8. Idle with no tasks → lounge
  if (input.status === "idle" && input.activeTasks.length === 0) {
    return "lounge";
  }

  // 9. Default
  return agent.defaultRoom;
}
