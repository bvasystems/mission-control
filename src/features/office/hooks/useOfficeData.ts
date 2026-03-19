import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()).then((d) => d.data ?? []);

// ── Agents ────────────────────────────────────────────────────────────────────
export interface Agent {
  id: string;
  name: string;
  level: string;
  status: "active" | "idle" | "degraded" | "down";
  last_seen: string;
  messages_24h: number;
  errors_24h: number;
  reliability_score: number | null;
  updated_at: string;
}

export function useAgents() {
  return useSWR<Agent[]>("/api/dashboard/agents", fetcher, {
    refreshInterval: 15_000,
  });
}

// ── Projects ──────────────────────────────────────────────────────────────────
export interface Project {
  project_key: string;
  name: string;
  owner: string | null;
  status: "active" | "at_risk" | "blocked" | "done";
  priority: string | null;
  objective: string | null;
  metrics: {
    total_tasks: number;
    done_tasks: number;
    blocked_tasks: number;
    progress_pct: number;
    incidents_open: number;
    risk_score: number;
  };
}

export function useProjects() {
  return useSWR<Project[]>("/api/dashboard/projects", fetcher, {
    refreshInterval: 30_000,
  });
}

// ── Incidents ─────────────────────────────────────────────────────────────────
export interface Incident {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "mitigated" | "closed";
  owner: string | null;
  source: string | null;
  created_at: string;
}

export function useIncidents() {
  return useSWR<Incident[]>("/api/dashboard/incidents", fetcher, {
    refreshInterval: 15_000,
  });
}

// ── Crons ─────────────────────────────────────────────────────────────────────
export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  status: "active" | "paused" | "error";
  last_run: string | null;
  next_run: string | null;
  last_result: string | null;
  consecutive_errors: number;
}

export function useCrons() {
  return useSWR<CronJob[]>("/api/dashboard/crons", fetcher, {
    refreshInterval: 30_000,
  });
}

// ── Stats (dashboard general) ─────────────────────────────────────────────────
export function useStats() {
  return useSWR("/api/dashboard/stats", fetcher, {
    refreshInterval: 30_000,
  });
}
