// ── Room Assignment — Department-Based ────────────────────────────────────────
// Simple: agents sit in their department. Only move when explicitly called to meeting or idle.

import type { AgentConfig } from "../config/office-map";

export interface RoomAssignmentInput {
  status: "active" | "idle" | "degraded" | "down";
  isInMeeting: boolean;
  hasActiveTasks: boolean;
  hasActiveDispatch: boolean;
}

export function determineRoom(
  agent: AgentConfig,
  input: RoomAssignmentInput
): string {
  // 1. Explicitly called to meeting → sala de reunião
  if (input.isInMeeting) {
    return "sala-reuniao";
  }

  // 2. Idle with nothing to do → copa (break room)
  if (input.status === "idle" && !input.hasActiveTasks && !input.hasActiveDispatch) {
    return "copa";
  }

  // 3. Everything else → agent stays in their department
  return agent.defaultRoom;
}
