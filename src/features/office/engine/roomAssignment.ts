// ── Room Assignment — Department-Based ────────────────────────────────────────
// Agents sit in their department. Only move for meetings, incidents, or breaks.

import type { AgentConfig } from "../config/office-map";

export interface RoomAssignmentInput {
  status: "active" | "idle" | "degraded" | "down";
  hasActiveDispatch: boolean;
  isInMeeting: boolean;
  isIncidentOwner: boolean;
  incidentSeverity: string | null;
  hasActiveTasks: boolean;
}

export function determineRoom(
  agent: AgentConfig,
  input: RoomAssignmentInput
): string {
  // 1. Called to meeting → sala de reunião
  if (input.isInMeeting) {
    return "sala-reuniao";
  }

  // 2. Critical incident → sala de reunião (war room style)
  if (input.isIncidentOwner && input.incidentSeverity === "critical") {
    return "sala-reuniao";
  }

  // 3. Active dispatch → stays in department (processes at their desk)
  // (changed: agents don't need to walk to a "command center" to read a message)

  // 4. Idle with no tasks → copa (break)
  if (input.status === "idle" && !input.hasActiveTasks && !input.hasActiveDispatch) {
    return "copa";
  }

  // 5. Default → agent's department
  return agent.defaultRoom;
}
