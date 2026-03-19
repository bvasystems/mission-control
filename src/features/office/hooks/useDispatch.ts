import useSWR, { mutate } from "swr";
import { useCallback, useState } from "react";
import type { AgentDispatch, DispatchPayload } from "../types";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()).then((d) => d.data ?? []);

// ── Dispatch history for a specific agent (excludes meeting messages) ────────
export function useDispatchHistory(agentName: string | null) {
  const key = agentName ? `/api/office/dispatch?agent=${agentName}&limit=20&exclude_action=meeting_command` : null;
  return useSWR<AgentDispatch[]>(key, fetcher, {
    refreshInterval: 3_000, // Fast polling to see status transitions
  });
}

// ── All recent dispatches (for canvas indicators) ─────────────────────────────
export function useAllDispatches() {
  return useSWR<AgentDispatch[]>("/api/office/dispatch?limit=50", fetcher, {
    refreshInterval: 3_000, // Fast polling for movement triggers
  });
}

// ── Force revalidate all dispatch caches ──────────────────────────────────────
function revalidateAll() {
  mutate(
    (key: unknown) => typeof key === "string" && key.includes("/api/office/dispatch"),
    undefined,
    { revalidate: true }
  );
}

// ── Send a dispatch command ───────────────────────────────────────────────────
export function useSendDispatch() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (payload: DispatchPayload): Promise<AgentDispatch | null> => {
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/office/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error?.toString() ?? "Falha ao enviar comando");
        return null;
      }

      // Immediate revalidation
      revalidateAll();

      // Also revalidate again after 1s to catch status transition
      setTimeout(revalidateAll, 1000);
      setTimeout(revalidateAll, 4000);
      setTimeout(revalidateAll, 10000);

      return data.data as AgentDispatch;
    } catch (err) {
      setError(String(err));
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  return { send, sending, error };
}
