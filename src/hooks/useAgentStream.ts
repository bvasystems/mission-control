import { useState, useEffect, useCallback } from "react";

export type AgentStatus = "active" | "idle" | "degraded" | "down";

export interface AgentWithStats {
  id: string;
  name: string;
  level: string;
  status: AgentStatus;
  last_seen: string;
  messages_24h: number;
  errors_24h: number;
  updated_at: string;
  reliability_score?: number;
  reliability_meta?: any;
  tokens?: number;
}

export interface ActivityEvent {
  id: string;
  // Fallback to source/channel if the schema doesn't match the requested prompt exactly
  agent_id?: string;
  source?: string;
  event_type: string;
  payload?: any;
  created_at: string;
}

export interface TaskUpdate {
  id: string;
  title: string;
  status: string;
  stage: string;
  assigned_to: string;
  created_at: string;
  updated_at: string;
}

export function useAgentStream() {
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [tasks, setTasks] = useState<TaskUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let eventSource: EventSource;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      // Connect to SSE
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // Fetch last hour of events on init
      eventSource = new EventSource(`/api/agents/stream?since=${encodeURIComponent(since)}`);

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.addEventListener("agent_update", (e) => {
        try {
          const data = JSON.parse(e.data);
          setAgents(data);
        } catch (err) {
          console.error("Failed to parse agent_update event", err);
        }
      });

      eventSource.addEventListener("activity", (e) => {
        try {
          const newActivities: ActivityEvent[] = JSON.parse(e.data);
          setActivities((prev) => {
            const combined = [...newActivities, ...prev];
            // Sort by absolute created_at desc
            const sorted = combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            // Filter unique
            const unique = sorted.filter((val, i, arr) => arr.findIndex(t => t.id === val.id) === i);
            return unique.slice(0, 50);
          });
        } catch (err) {
          console.error("Failed to parse activity event", err);
        }
      });

      eventSource.addEventListener("task_update", (e) => {
        try {
          const updatedTasks: TaskUpdate[] = JSON.parse(e.data);
          setTasks((prev) => {
            const map = new Map(prev.map(t => [t.id, t]));
            updatedTasks.forEach(t => map.set(t.id, t));
            return Array.from(map.values());
          });
        } catch (err) {
          console.error("Failed to parse task_update event", err);
        }
      });

      eventSource.onerror = (e) => {
        console.error("SSE Error", e);
        setIsConnected(false);
        eventSource.close();
        reconnectTimer = setTimeout(connect, 2000); // 2s backoff
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return { agents, activities, tasks, isConnected };
}
