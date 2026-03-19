// ── Room Assignment — Department-Based with Idle Roaming ──────────────────────
// Agents go to break areas when not actively working.

import type { AgentConfig } from "../config/office-map";

export interface RoomAssignmentInput {
  status: "active" | "idle" | "degraded" | "down";
  isInMeeting: boolean;
  hasActiveTasks: boolean;
  hasActiveDispatch: boolean;
}

// Idle spots: copa and recepcao positions where agents hang out
const IDLE_ROOMS = ["copa", "recepcao"];

export function determineRoom(
  agent: AgentConfig,
  input: RoomAssignmentInput
): string {
  // 1. Meeting takes priority
  if (input.isInMeeting) {
    return "sala-reuniao";
  }

  // 2. Actively working → stay at desk
  if (input.hasActiveDispatch || input.hasActiveTasks) {
    return agent.defaultRoom;
  }

  // 3. Down/degraded → stay at desk (visible problem)
  if (input.status === "down" || input.status === "degraded") {
    return agent.defaultRoom;
  }

  // 4. No work → go to break area
  // Use agent id hash to deterministically pick a room so each agent
  // goes to a consistent spot (not all to the same room)
  const hash = agent.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return IDLE_ROOMS[hash % IDLE_ROOMS.length];
}
