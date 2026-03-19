import useSWR, { mutate } from "swr";
import { useCallback, useState } from "react";
import type { AgentDispatch, DispatchPayload } from "../types";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()).then((d) => d.data ?? []);

// ── Dispatch history for a specific agent ─────────────────────────────────────
export function useDispatchHistory(agentName: string | null) {
  const key = agentName ? `/api/office/dispatch?agent=${agentName}&limit=20` : null;
  return useSWR<AgentDispatch[]>(key, fetcher, {
    refreshInterval: 10_000,
  });
}

// ── All recent dispatches (for canvas indicators) ─────────────────────────────
export function useAllDispatches() {
  return useSWR<AgentDispatch[]>("/api/office/dispatch?limit=50", fetcher, {
    refreshInterval: 15_000,
  });
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

      // Revalidate caches
      mutate(
        (key: unknown) => typeof key === "string" && key.startsWith("/api/office/dispatch"),
        undefined,
        { revalidate: true }
      );

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
