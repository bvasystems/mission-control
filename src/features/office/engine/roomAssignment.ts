// ── Room Assignment — with Idle Roaming ───────────────────────────────────────
// Agents roam between leisure areas when not working, changing every ~45s.

import type { AgentConfig } from "../config/office-map";
import { IDLE_ROOMS } from "../config/office-map";

export interface RoomAssignmentInput {
  status: "active" | "idle" | "degraded" | "down";
  isInMeeting: boolean;
  hasActiveTasks: boolean;
  hasActiveDispatch: boolean;
}

// Roaming interval in ms — each agent changes area every ~45s
const ROAM_INTERVAL = 45_000;

// Each agent gets a time offset so they don't all move at the same time
function agentHash(id: string): number {
  return id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

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

  // 4. No work → roam between leisure areas
  // Time-based rotation: each agent picks a different room over time
  const hash = agentHash(agent.id);
  const offset = hash * 11_000; // stagger so agents don't move in sync
  const cycle = Math.floor((Date.now() + offset) / ROAM_INTERVAL);
  const roomIndex = (cycle + hash) % IDLE_ROOMS.length;
  return IDLE_ROOMS[roomIndex];
}
