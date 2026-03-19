// ── Agent Activity Engine ─────────────────────────────────────────────────────
// Computes the visual activity state for each agent based on real data:
// dispatches, tasks, and agent status.

import type { AgentActivity, AgentActivityState, AgentDispatch } from "../types";
import type { Task } from "../hooks/useOfficeData";

export interface ActivityInput {
  agentName: string;
  agentStatus: "active" | "idle" | "degraded" | "down";
  dispatches: AgentDispatch[];
  tasks: Task[];
}

export function computeActivity(input: ActivityInput): AgentActivity {
  const { agentName, agentStatus, dispatches, tasks } = input;
  const now = Date.now();

  // ── 1. Check for active outbound dispatches TO this agent ───────────────
  const pendingDispatches = dispatches.filter(
    (d) => d.target_agent === agentName &&
           d.direction === "outbound" &&
           (d.status === "queued" || d.status === "sent")
  );

  if (pendingDispatches.length > 0) {
    const newest = pendingDispatches[0];
    const age = now - new Date(newest.created_at).getTime();

    // Just received (< 5s) → thinking
    if (age < 5000) {
      return { state: "thinking", label: "Analisando...", since: now };
    }

    // Processing (5s - 30s) → depends on task type
    const linkedTask = tasks.find((t) => t.id === newest.task_id);
    if (linkedTask) {
      if (linkedTask.type === "code" || linkedTask.type === "bug") {
        return { state: "coding", label: `Codando: ${truncate(linkedTask.title)}`, since: now };
      }
      return { state: "reading", label: `Analisando: ${truncate(linkedTask.title)}`, since: now };
    }

    // Generic processing
    if (newest.action_type === "ask_update") {
      return { state: "reading", label: "Preparando update...", since: now };
    }
    if (newest.action_type === "request_review") {
      return { state: "reading", label: "Fazendo review...", since: now };
    }
    return { state: "thinking", label: "Processando...", since: now };
  }

  // ── 2. Check for acknowledged dispatches (agent is working) ─────────────
  const ackDispatches = dispatches.filter(
    (d) => d.target_agent === agentName &&
           d.direction === "outbound" &&
           d.status === "acknowledged"
  );

  if (ackDispatches.length > 0) {
    const task = tasks.find((t) => t.id === ackDispatches[0].task_id);
    if (task) {
      if (task.type === "code" || task.type === "bug") {
        return { state: "coding", label: truncate(task.title), since: now };
      }
      return { state: "reading", label: truncate(task.title), since: now };
    }
    return { state: "coding", label: "Trabalhando...", since: now };
  }

  // ── 3. Check for outbound dispatches FROM this agent (waiting) ──────────
  const waitingFor = dispatches.filter(
    (d) => d.issued_by === agentName &&
           d.direction === "outbound" &&
           (d.status === "queued" || d.status === "sent")
  );

  if (waitingFor.length > 0) {
    return {
      state: "waiting",
      label: `Aguardando @${waitingFor[0].target_agent}`,
      targetAgent: waitingFor[0].target_agent,
      since: now,
    };
  }

  // ── 4. Check for recently completed dispatches (done effect, < 5s) ──────
  const recentDone = dispatches.filter(
    (d) => d.target_agent === agentName &&
           d.status === "done" &&
           d.responded_at &&
           (now - new Date(d.responded_at).getTime()) < 5000
  );

  if (recentDone.length > 0) {
    return { state: "done", label: "Concluído!", since: now };
  }

  // ── 5. Check active tasks (in_progress) ─────────────────────────────────
  const activeTasks = tasks.filter(
    (t) => (t.owner?.toLowerCase() === agentName || t.assigned_to?.toLowerCase() === agentName) &&
           t.column === "in_progress"
  );

  if (activeTasks.length > 0) {
    const t = activeTasks[0];
    if (t.type === "code" || t.type === "bug") {
      return { state: "coding", label: truncate(t.title), since: now };
    }
    if (t.type === "improvement") {
      return { state: "reading", label: truncate(t.title), since: now };
    }
    return { state: "coding", label: truncate(t.title), since: now };
  }

  // ── 6. Tasks in review ──────────────────────────────────────────────────
  const reviewTasks = tasks.filter(
    (t) => (t.owner?.toLowerCase() === agentName || t.assigned_to?.toLowerCase() === agentName) &&
           t.column === "review"
  );

  if (reviewTasks.length > 0) {
    return { state: "reading", label: `Review: ${truncate(reviewTasks[0].title)}`, since: now };
  }

  // ── 7. Agent status degraded → thinking about problems ──────────────────
  if (agentStatus === "degraded") {
    return { state: "thinking", label: "Diagnosticando...", since: now };
  }

  // ── 8. Default → idle ──────────────────────────────────────────────────
  return { state: "idle", label: "", since: now };
}

function truncate(text: string, max = 18): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}
