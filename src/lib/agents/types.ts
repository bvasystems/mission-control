export type AgentEventType = "heartbeat" | "ack" | "running" | "progress" | "done" | "failed";
export type AgentTaskStatus = "queued" | "ack" | "running" | "done" | "failed" | "timeout";
export type AgentStage = "backlog" | "todo" | "doing" | "review" | "done" | "blocked";

export interface AgentEventPayload {
  event_id: string;
  agent_id: string;
  task_id?: string;
  command_id?: string;
  type: AgentEventType;
  status: AgentTaskStatus;
  stage?: AgentStage;
  message?: string;
  meta?: Record<string, unknown>;
}
