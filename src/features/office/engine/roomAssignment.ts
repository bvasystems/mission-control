// ── Room Assignment Engine ────────────────────────────────────────────────────
// Pure function that determines which room an agent should be in based on
// their status, tasks, dispatches, and incidents.

import type { AgentConfig } from "../config/office-map";

export interface RoomAssignmentInput {
  status: "active" | "idle" | "degraded" | "down";
  hasActiveDispatch: boolean;
  activeTasks: Array<{
    column: string;
    type: string;
    priority: string;
  }>;
  isIncidentOwner: boolean;     // agent owns a high/critical incident
  incidentSeverity: string | null;
}

// Priority order (highest first):
// 1. Active dispatch → command-center
// 2. Critical/high incident owner → war-room
// 3. Agent down → server-room
// 4. Task in review → sprint-room
// 5. Task type code/bug in progress → dev-area
// 6. Task related to deploy/infra → deploy-room
// 7. Idle with no tasks → lounge
// 8. Default room from config

export function determineRoom(
  agent: AgentConfig,
  input: RoomAssignmentInput
): string {
  // 1. Active dispatch — agent goes to command center to process
  if (input.hasActiveDispatch) {
    return "command-center";
  }

  // 2. Critical incident — agent goes to war room
  if (input.isIncidentOwner && (input.incidentSeverity === "critical" || input.incidentSeverity === "high")) {
    return "war-room";
  }

  // 3. Agent is down
  if (input.status === "down") {
    return "server-room";
  }

  // 4-6. Task-based assignment
  if (input.activeTasks.length > 0) {
    // Sort by priority (P0 first)
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

  // 7. Idle with no tasks → lounge
  if (input.status === "idle" && input.activeTasks.length === 0) {
    return "lounge";
  }

  // 8. Default
  return agent.defaultRoom;
}
