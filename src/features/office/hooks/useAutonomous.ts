import useSWR, { mutate } from "swr";
import { useCallback, useState } from "react";

interface AutonomousAction {
  id: string;
  agent_id: string;
  action_type: string;
  payload: Record<string, unknown>;
  reasoning: string | null;
  requires_approval: boolean;
  approval_status: "pending" | "approved" | "rejected" | "auto_approved";
  approved_by: string | null;
  executed_at: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
}

interface AutonomousRun {
  id: string;
  context_summary: string | null;
  actions_count: number;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

interface AutonomousData {
  pending: AutonomousAction[];
  recent: AutonomousAction[];
  runs: AutonomousRun[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAutonomous() {
  return useSWR<AutonomousData>("/api/office/autonomous", fetcher, {
    refreshInterval: 10_000,
  });
}

export function useApproveAction() {
  const [loading, setLoading] = useState(false);

  const approve = useCallback(async (actionId: string, decision: "approved" | "rejected") => {
    setLoading(true);
    try {
      const res = await fetch("/api/office/autonomous/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, decision }),
      });
      if (!res.ok) throw new Error("Failed");
      mutate("/api/office/autonomous");
    } finally {
      setLoading(false);
    }
  }, []);

  return { approve, loading };
}

export type { AutonomousAction, AutonomousRun, AutonomousData };
