"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type Severity = "low" | "medium" | "high" | "critical";
type IncidentStatus = "open" | "investigating" | "mitigated" | "closed";

type Incident = {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  owner: string | null;
  source: string | null;
  impact: string | null;
  next_action: string | null;
  fingerprint: string | null;
  details: IncidentDetails | null;
  created_at: string;
  updated_at: string;
};

type IncidentDetails = {
  agent_id?: string;
  dominant_cause?: string;
  cause_breakdown?: Record<string, number>;
  sample_size?: number;
  window_hours?: number;
  first_seen_at?: string;
  last_seen_at?: string;
  related_dem_ids?: string[];
  last_messages?: string[];
  count?: number;
  recommended_action?: string;
};

type AgentEvent = {
  id: string;
  source: string;
  event_type: string;
  dem_id: string;
  created_at: string;
};

type RelatedTask = {
  id: string;
  title: string;
  status: string;
  column: string;
  assigned_to: string | null;
  updated_at: string;
};

type IncidentDetail = Incident & {
  evidence?: {
    last_events: AgentEvent[];
    related_tasks: RelatedTask[];
  };
};

const sevBadge: Record<Severity, string> = {
  low: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
  medium: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  high: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  critical: "bg-red-500/20 text-red-300 border-red-500/40",
};

const stBadge: Record<IncidentStatus, string> = {
  open: "bg-red-500/20 text-red-300 border-red-500/40",
  investigating: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  mitigated: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  closed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};

export default function IncidentsPage() {
  const [rows, setRows] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [owner, setOwner] = useState("leticia");
  const [source, setSource] = useState("n8n");

  // Modal state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/incidents", { cache: "no-store" });
      const json = await res.json();
      setRows(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t1 = setTimeout(refresh, 0);
    const t2 = setInterval(refresh, 30000);
    return () => { clearTimeout(t1); clearInterval(t2); };
  }, [refresh]);

  const openModal = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/dashboard/incidents/${id}`, { cache: "no-store" });
      const json = await res.json();
      setDetail(json.data ?? null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
  }, []);

  async function createIncident() {
    if (!title.trim()) return;
    await fetch("/api/dashboard/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: title.trim(), severity, owner, source }),
    });
    setTitle("");
    await refresh();
  }

  async function updateStatus(id: string, status: IncidentStatus) {
    await fetch("/api/dashboard/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await refresh();
  }

  const counters = useMemo(() => ({
    total: rows.length,
    open: rows.filter((r) => r.status === "open").length,
    critical: rows.filter((r) => r.severity === "critical").length,
    investigating: rows.filter((r) => r.status === "investigating").length,
  }), [rows]);

  return (
    <main className="min-h-screen text-zinc-100 p-6 md:p-10 relative">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-red-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-red-400 font-semibold mb-2">Monitoramento de Risco</p>
            <h1 className="text-3xl font-medium tracking-tight">Registro de Incidentes</h1>
            <p className="text-zinc-500 text-sm mt-1">Acompanhamento e mitigação de falhas e anomalias críticas.</p>
          </div>
          <button
            onClick={refresh}
            className="border border-red-500/30 bg-red-500/10 text-red-400 rounded-lg px-4 py-2 text-xs uppercase tracking-wider font-medium hover:bg-red-500/20 transition-colors"
          >
            {loading ? "Verificando..." : "Sincronizar"}
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Total" value={String(counters.total)} />
          <Card title="Open" value={String(counters.open)} />
          <Card title="Critical" value={String(counters.critical)} isCritical />
          <Card title="Investigating" value={String(counters.investigating)} />
        </section>

        <section className="glass rounded-2xl p-4 md:p-6 shadow-2xl shadow-black/50 border-t-[3px] border-t-red-500/50">
          <h2 className="text-sm uppercase tracking-widest text-zinc-400 font-medium mb-4">Declarar Novo Incidente</h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <input
              className="md:col-span-4 bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all placeholder:text-zinc-600"
              placeholder="Ex: API Gateway instável"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <select
              className="md:col-span-2 bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-all text-zinc-300"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <input
              className="md:col-span-2 bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-all placeholder:text-zinc-600"
              placeholder="Lead Owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
            <input
              className="md:col-span-2 bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-all placeholder:text-zinc-600"
              placeholder="System Source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <button
              onClick={createIncident}
              className="md:col-span-2 rounded-xl bg-red-600/80 text-white font-medium hover:bg-red-500 px-4 py-2.5 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)] shadow-red-500/10 border border-red-500/50"
            >
              Reportar
            </button>
          </div>
        </section>

        <div className="glass rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-black/60 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-white/10">
                <tr>
                  <th className="font-medium p-4">Incidente / ID</th>
                  <th className="font-medium p-4">Severity</th>
                  <th className="font-medium p-4">Status</th>
                  <th className="font-medium p-4">Lead</th>
                  <th className="font-medium p-4">Source</th>
                  <th className="font-medium p-4">Recorrência</th>
                  <th className="font-medium p-4">Atualização</th>
                  <th className="font-medium p-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => {
                  const count = r.details?.count;
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      onClick={() => openModal(r.id)}
                    >
                      <td className="p-4">
                        <p className="font-medium text-zinc-200">{r.title}</p>
                        <p className="text-[10px] text-zinc-600 font-mono mt-1">{r.id.split("-")[0]}</p>
                      </td>
                      <td className="p-4">
                        <span className={`text-[9px] uppercase tracking-wider font-mono border rounded px-1.5 py-0.5 ${sevBadge[r.severity]}`}>
                          {r.severity}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-[9px] uppercase tracking-wider font-mono border rounded px-1.5 py-0.5 whitespace-nowrap ${stBadge[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-400 font-medium">{r.owner || "-"}</td>
                      <td className="p-4 text-zinc-400 font-mono text-[11px]">{r.source || "-"}</td>
                      <td className="p-4 text-zinc-400 text-[11px]">
                        {count != null && count > 1 ? (
                          <span className="bg-orange-500/20 text-orange-300 border border-orange-500/40 text-[9px] font-mono rounded px-1.5 py-0.5">
                            ×{count}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="p-4 text-zinc-500 text-[11px] uppercase tracking-wide">
                        {new Date(r.updated_at).toLocaleString()}
                      </td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {(["open", "investigating", "mitigated", "closed"] as IncidentStatus[]).map((s) => (
                            <button
                              key={s}
                              onClick={() => updateStatus(r.id, s)}
                              className="text-[9px] font-mono tracking-widest uppercase border border-white/10 rounded-md px-2 py-1 hover:bg-white/10 hover:text-white text-zinc-500 transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-zinc-500 italic">
                      Zero anomalias detectadas no quadrante atual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      {selectedId && (
        <IncidentModal
          loading={detailLoading}
          data={detail}
          onClose={closeModal}
        />
      )}
    </main>
  );
}

/* ───────────── Card ───────────── */
function Card({ title, value, isCritical }: { title: string; value: string; isCritical?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-5 shadow-xl shadow-black/50 relative overflow-hidden group border ${isCritical ? "border-red-500/20" : "border-white/10"}`}>
      <div className={`absolute top-0 left-0 w-[2px] h-full transition-colors ${isCritical ? "bg-red-500/50 group-hover:bg-red-400" : "bg-blue-500/50 group-hover:bg-blue-400"}`} />
      <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-medium">{title}</p>
      <p className={`text-3xl font-light tracking-tight mt-2 ${isCritical && Number(value) > 0 ? "text-red-400" : "text-zinc-100"}`}>{value}</p>
    </div>
  );
}

/* ───────────── Modal ───────────── */
function IncidentModal({
  loading,
  data,
  onClose,
}: {
  loading: boolean;
  data: IncidentDetail | null;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const det = data?.details;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 flex items-start justify-between p-5 gap-3 z-10">
          {loading ? (
            <div className="h-6 w-48 bg-zinc-800 animate-pulse rounded" />
          ) : (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-red-400 font-semibold">Diagnóstico</p>
              <h2 className="text-lg font-semibold text-zinc-100 mt-0.5 leading-snug">{data?.title ?? "—"}</h2>
            </div>
          )}
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors text-xl leading-none mt-0.5 shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 bg-zinc-800 animate-pulse rounded w-full" />
              ))}
            </div>
          ) : !data ? (
            <p className="text-zinc-500 italic text-sm text-center py-6">Falha ao carregar detalhes. Tente novamente.</p>
          ) : (
            <>
              {/* Meta row */}
              <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-widest">
                <Badge variant={data.severity === "critical" ? "red" : data.severity === "high" ? "yellow" : "blue"}>
                  {data.severity}
                </Badge>
                <Badge variant={data.status === "open" ? "red" : data.status === "closed" ? "green" : "yellow"}>
                  {data.status}
                </Badge>
                {data.owner && <Badge variant="neutral">{data.owner}</Badge>}
                {data.source && <Badge variant="neutral">{data.source}</Badge>}
              </div>

              {/* No structured details fallback */}
              {!det ? (
                <div className="border border-zinc-800 rounded-xl p-4 text-zinc-500 text-sm italic">
                  Sem detalhes estruturados para este incidente.
                </div>
              ) : (
                <>
                  {/* Dominant cause */}
                  {det.dominant_cause && (
                    <Section title="Causa Dominante">
                      <p className="font-mono text-orange-300 font-semibold">{det.dominant_cause}</p>
                      {det.cause_breakdown && (
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          {Object.entries(det.cause_breakdown).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-2 text-xs">
                              <span className="text-zinc-600 font-mono">{k}</span>
                              <div className="flex-1 h-1 bg-zinc-800 rounded">
                                <div
                                  className="h-full bg-orange-500/60 rounded"
                                  style={{ width: `${Math.min(100, (v / (det.sample_size || 1)) * 100)}%` }}
                                />
                              </div>
                              <span className="text-zinc-400 w-4 text-right">{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Section>
                  )}

                  {/* Window + sample */}
                  {(det.sample_size != null || det.window_hours != null) && (
                    <Section title="Janela de Análise">
                      <div className="flex gap-6 text-sm">
                        {det.window_hours != null && (
                          <StatItem label="Janela" value={`${det.window_hours}h`} />
                        )}
                        {det.sample_size != null && (
                          <StatItem label="Amostra" value={String(det.sample_size)} />
                        )}
                        {det.count != null && det.count > 1 && (
                          <StatItem label="Recorrências" value={`×${det.count}`} highlight />
                        )}
                      </div>
                    </Section>
                  )}

                  {/* Evidences */}
                  {det.last_messages && det.last_messages.length > 0 && (
                    <Section title="Evidências — Últimas Mensagens">
                      <ul className="space-y-1.5">
                        {det.last_messages.map((m, i) => (
                          <li key={i} className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono leading-relaxed">
                            {m}
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}

                  {/* Related DEMs */}
                  {det.related_dem_ids && det.related_dem_ids.length > 0 && (
                    <Section title="Demandas Relacionadas">
                      <div className="flex flex-wrap gap-2">
                        {det.related_dem_ids.map((d, i) => (
                          <span key={i} className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                            {d}
                          </span>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Recommended action */}
                  {det.recommended_action && (
                    <Section title="Ação Recomendada">
                      <div className="flex gap-3 items-start bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                        <span className="text-emerald-400 text-base mt-0.5">✦</span>
                        <p className="text-sm text-emerald-300">{det.recommended_action}</p>
                      </div>
                    </Section>
                  )}
                </>
              )}

              {/* Evidence from DB */}
              {data.evidence && (
                <>
                  {data.evidence.related_tasks.length > 0 && (
                    <Section title="Tarefas Impactadas">
                      <div className="space-y-1.5">
                        {data.evidence.related_tasks.map((t) => (
                          <div key={t.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs">
                            <span className="text-zinc-300 truncate">{t.title}</span>
                            <span className="text-zinc-600 font-mono ml-3 shrink-0">{t.column}</span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {data.evidence.last_events.length > 0 && (
                    <Section title="Eventos do Agente">
                      <div className="space-y-1.5">
                        {data.evidence.last_events.map((ev) => (
                          <div key={ev.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs">
                            <span className="font-mono text-blue-400 shrink-0">{ev.event_type}</span>
                            <span className="text-zinc-500 truncate">{ev.dem_id}</span>
                            <span className="text-zinc-600 shrink-0 ml-auto">{new Date(ev.created_at).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </>
              )}

              {/* Timestamps */}
              <div className="border-t border-zinc-800 pt-4 flex gap-6 text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                <span>Criado: {new Date(data.created_at).toLocaleString()}</span>
                <span>Atualizado: {new Date(data.updated_at).toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════ Small helpers ═══════════ */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">{title}</p>
      {children}
    </div>
  );
}

function StatItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{label}</span>
      <span className={`font-mono font-semibold ${highlight ? "text-orange-300" : "text-zinc-200"}`}>{value}</span>
    </div>
  );
}

type BadgeVariant = "red" | "yellow" | "blue" | "green" | "neutral";
const badgeVariants: Record<BadgeVariant, string> = {
  red: "bg-red-500/20 text-red-300 border-red-500/40",
  yellow: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  blue: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  neutral: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
};
function Badge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  return (
    <span className={`border rounded px-1.5 py-0.5 ${badgeVariants[variant]}`}>
      {children}
    </span>
  );
}
