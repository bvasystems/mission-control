// ── Office Types ──────────────────────────────────────────────────────────────
// Shared between client and server.

export type OfficeAgentStatus = "idle" | "active" | "degraded" | "down";

// ── Agent Activity States (what the agent is visually doing) ──────────────────
export type AgentActivityState =
  | "idle"
  | "thinking"
  | "coding"
  | "reading"
  | "talking"
  | "waiting"
  | "done";

export interface AgentActivity {
  state: AgentActivityState;
  label: string;      // contextual text for speech bubble
  targetAgent?: string; // who they're talking to / waiting for
  since: number;       // timestamp when this state started
}

export type DispatchState =
  | "queued"
  | "sent"
  | "acknowledged"
  | "blocked"
  | "done"
  | "failed";

export type DispatchDirection = "outbound" | "inbound";

export interface AgentDispatch {
  id: string;
  target_agent: string;
  command_text: string;
  action_type: string | null;
  project_key: string | null;
  status: DispatchState;
  direction: DispatchDirection;
  metadata: Record<string, unknown>;
  issued_by: string;
  task_id: string | null;
  response: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DispatchPayload {
  targetAgent: string;
  commandText: string;
  actionType?: string;
  projectKey?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export interface QuickAction {
  id: string;
  label: string;
  actionType: string;
  icon: string;
  commandTemplate: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "ask-update",
    label: "Pedir update",
    actionType: "ask_update",
    icon: "💬",
    commandTemplate: "Por favor, envie um update do status atual das suas tarefas.",
  },
  {
    id: "delegate-task",
    label: "Delegar tarefa",
    actionType: "delegate_task",
    icon: "📋",
    commandTemplate: "",
  },
  {
    id: "mark-blocked",
    label: "Marcar bloqueado",
    actionType: "mark_blocked",
    icon: "🚫",
    commandTemplate: "Marcar status como bloqueado. Motivo: ",
  },
  {
    id: "request-review",
    label: "Pedir review",
    actionType: "request_review",
    icon: "🔍",
    commandTemplate: "Por favor, faça review do trabalho atual antes de prosseguir.",
  },
  {
    id: "escalate",
    label: "Escalar",
    actionType: "escalate",
    icon: "⚡",
    commandTemplate: "Escalar para atenção imediata: ",
  },
];
