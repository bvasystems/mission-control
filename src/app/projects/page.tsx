"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectStatus = "active" | "at_risk" | "blocked" | "done";

type ProjectMetrics = {
  snapshot_at: string;
  progress_pct: number;
  total_tasks: number;
  todo_tasks: number;
  doing_tasks: number;
  review_tasks: number;
  done_tasks: number;
  blocked_tasks: number;
  incidents_open: number;
  risk_score: number;
  reliability_avg: number;
  last_update_at: string | null;
};

type Project = {
  project_key: string;
  name: string;
  owner: string | null;
  status: ProjectStatus;
  priority: string | null;
  objective: string | null;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
  metrics: ProjectMetrics | null;
};

type ProjectLink = {
  id: string;
  dem_id: string | null;
  task_id: string | null;
  command_id: string | null;
  agent_id: string | null;
  created_at: string;
};

type ProjectDetail = {
  project: Project;
  latest_metrics: ProjectMetrics | null;
  history: ProjectMetrics[];
  links: ProjectLink[];
};

// ── Badge maps ────────────────────────────────────────────────────────────────

const statusBadge: Record<ProjectStatus, string> = {
  active:  "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  at_risk: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  blocked: "bg-red-500/20 text-red-300 border-red-500/40",
  done:    "bg-zinc-500/20 text-zinc-400 border-zinc-500/40",
};

const statusLabel: Record<ProjectStatus, string> = {
  active:  "Active",
  at_risk: "At Risk",
  blocked: "Blocked",
  done:    "Done",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/projects", { cache: "no-store" });
      const json = await res.json();
      setProjects(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(refresh, 0);
    const i = setInterval(refresh, 60_000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [refresh]);

  const openModal = useCallback(async (key: string) => {
    setSelectedKey(key);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/dashboard/projects/${key}`, { cache: "no-store" });
      const json = await res.json();
      setDetail(json.data ?? null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setSelectedKey(null);
    setDetail(null);
  }, []);

  const counters = useMemo(() => ({
    total: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    at_risk: projects.filter((p) => p.status === "at_risk").length,
    blocked: projects.filter((p) => p.status === "blocked").length,
  }), [projects]);

  return (
    <main className="min-h-full text-zinc-100 p-6 md:p-10 relative">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-semibold mb-2">Gestão Estratégica</p>
            <h1 className="text-3xl font-medium tracking-tight">Projetos</h1>
            <p className="text-zinc-500 text-sm mt-1">Visão consolidada de progresso, risco e saúde dos projetos ativos.</p>
          </div>
          <button
            onClick={refresh}
            className="border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 rounded-lg px-4 py-2 text-xs uppercase tracking-wider font-medium hover:bg-indigo-500/20 transition-colors"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Total" value={String(counters.total)} />
          <KpiCard title="Ativos" value={String(counters.active)} />
          <KpiCard title="Em risco" value={String(counters.at_risk)} warn={counters.at_risk > 0} />
          <KpiCard title="Bloqueados" value={String(counters.blocked)} crit={counters.blocked > 0} />
        </section>

        {/* Project cards grid */}
        {projects.length === 0 && !loading ? (
          <div className="glass rounded-2xl p-12 text-center text-zinc-500 italic">
            Nenhum projeto cadastrado. Use <span className="font-mono text-zinc-400">POST /api/dashboard/projects</span> para criar.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {projects.map((p) => (
              <ProjectCard
                key={p.project_key}
                project={p}
                onDetail={() => openModal(p.project_key)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedKey && (
        <DetailModal
          loading={detailLoading}
          data={detail}
          onClose={closeModal}
        />
      )}
    </main>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ title, value, warn, crit }: { title: string; value: string; warn?: boolean; crit?: boolean }) {
  const color = crit ? "bg-red-500/50 group-hover:bg-red-400" : warn ? "bg-yellow-500/50 group-hover:bg-yellow-400" : "bg-indigo-500/50 group-hover:bg-indigo-400";
  const textColor = crit && Number(value) > 0 ? "text-red-400" : warn && Number(value) > 0 ? "text-yellow-400" : "text-zinc-100";
  return (
    <div className="glass rounded-2xl p-5 shadow-xl shadow-black/50 relative overflow-hidden group border border-white/10">
      <div className={`absolute top-0 left-0 w-[2px] h-full transition-colors ${color}`} />
      <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-medium">{title}</p>
      <p className={`text-3xl font-light tracking-tight mt-2 ${textColor}`}>{value}</p>
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({ project: p, onDetail }: { project: Project; onDetail: () => void }) {
  const m = p.metrics;
  const pct = m ? Math.round(m.progress_pct) : null;

  return (
    <article className="glass rounded-2xl border border-white/10 p-5 flex flex-col gap-4 hover:border-indigo-500/30 transition-colors shadow-xl shadow-black/40">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-100 truncate">{p.name}</p>
          <p className="text-[10px] font-mono text-indigo-400/70 mt-0.5">{p.project_key}</p>
        </div>
        <span className={`shrink-0 text-[9px] uppercase tracking-wider font-mono border rounded px-1.5 py-0.5 ${statusBadge[p.status]}`}>
          {statusLabel[p.status]}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
          <span>Progresso</span>
          <span className="font-mono text-zinc-300">{pct != null ? `${pct}%` : "--"}</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          {pct != null && (
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      </div>

      {/* Task counters */}
      {m ? (
        <div className="grid grid-cols-5 gap-1 text-center">
          {([
            { label: "Todo", value: m.todo_tasks, color: "text-zinc-400" },
            { label: "Doing", value: m.doing_tasks, color: "text-blue-400" },
            { label: "Review", value: m.review_tasks, color: "text-indigo-400" },
            { label: "Done", value: m.done_tasks, color: "text-emerald-400" },
            { label: "Block", value: m.blocked_tasks, color: m.blocked_tasks > 0 ? "text-red-400" : "text-zinc-600" },
          ] as const).map(({ label, value, color }) => (
            <div key={label} className="bg-black/30 rounded-lg p-1.5">
              <p className={`text-sm font-semibold font-mono ${color}`}>{value}</p>
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-600 italic">Sem métricas ainda.</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-600 pt-1 border-t border-white/5">
        <div className="flex gap-3">
          {m && m.incidents_open > 0 && (
            <span className="text-red-400">⚠ {m.incidents_open} incidente{m.incidents_open !== 1 ? "s" : ""}</span>
          )}
          {p.owner && <span>owner: {p.owner}</span>}
          {p.target_date && <span>até {new Date(p.target_date).toLocaleDateString("pt-BR")}</span>}
        </div>
        {m?.last_update_at && (
          <span className="shrink-0">{new Date(m.last_update_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onDetail}
          className="flex-1 text-xs border border-white/10 rounded-lg py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors"
        >
          Ver detalhes
        </button>
        <Link
          href={`/kanban?project=${p.project_key}`}
          className="flex-1 text-center text-xs border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 rounded-lg py-1.5 hover:bg-indigo-500/20 transition-colors"
        >
          Abrir board →
        </Link>
      </div>
    </article>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({
  loading,
  data,
  onClose,
}: {
  loading: boolean;
  data: ProjectDetail | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const p = data?.project;
  const m = data?.latest_metrics;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 flex items-start justify-between p-5 gap-3 z-10">
          {loading ? (
            <div className="h-6 w-48 bg-zinc-800 animate-pulse rounded" />
          ) : (
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold">Detalhe do Projeto</p>
              <h2 className="text-lg font-semibold text-zinc-100 mt-0.5 truncate">{p?.name ?? "—"}</h2>
              <p className="text-[10px] font-mono text-zinc-600 mt-0.5">{p?.project_key}</p>
            </div>
          )}
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors text-xl leading-none mt-0.5 shrink-0">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 bg-zinc-800 animate-pulse rounded" style={{ width: `${60 + i * 10}%` }} />
              ))}
            </div>
          ) : !data ? (
            <p className="text-zinc-500 italic text-sm text-center py-8">Falha ao carregar detalhes.</p>
          ) : (
            <>
              {/* Meta */}
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className={`border rounded px-1.5 py-0.5 font-mono uppercase ${statusBadge[p!.status]}`}>{statusLabel[p!.status]}</span>
                {p!.priority && <span className="border border-zinc-700 text-zinc-400 rounded px-1.5 py-0.5 font-mono uppercase">{p!.priority}</span>}
                {p!.owner && <span className="border border-zinc-700 text-zinc-400 rounded px-1.5 py-0.5">owner: {p!.owner}</span>}
              </div>

              {/* Objective */}
              {p!.objective && (
                <Section title="Objetivo">
                  <p className="text-sm text-zinc-300">{p!.objective}</p>
                </Section>
              )}

              {/* Dates */}
              {(p!.start_date || p!.target_date) && (
                <Section title="Datas">
                  <div className="flex gap-6">
                    {p!.start_date && <StatItem label="Início" value={new Date(p!.start_date).toLocaleDateString("pt-BR")} />}
                    {p!.target_date && <StatItem label="Prazo" value={new Date(p!.target_date).toLocaleDateString("pt-BR")} />}
                  </div>
                </Section>
              )}

              {/* Latest metrics */}
              {m ? (
                <Section title="Métricas Atuais">
                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Progresso</span>
                      <span className="font-mono text-zinc-200">{Math.round(m.progress_pct)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${m.progress_pct}%` }} />
                    </div>
                  </div>
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <StatItem label="Tasks" value={String(m.total_tasks)} />
                    <StatItem label="Done" value={String(m.done_tasks)} />
                    <StatItem label="Bloqueadas" value={String(m.blocked_tasks)} highlight={m.blocked_tasks > 0} />
                    <StatItem label="Incidentes" value={String(m.incidents_open)} highlight={m.incidents_open > 0} />
                    <StatItem label="Risk score" value={String(Math.round(m.risk_score))} highlight={m.risk_score > 50} />
                    <StatItem label="Reliability" value={`${Math.round(m.reliability_avg)}%`} />
                    {m.last_update_at && <StatItem label="Último update" value={new Date(m.last_update_at).toLocaleString("pt-BR")} />}
                    {m.snapshot_at && <StatItem label="Snapshot" value={new Date(m.snapshot_at).toLocaleString("pt-BR")} />}
                  </div>
                </Section>
              ) : (
                <Section title="Métricas">
                  <p className="text-sm text-zinc-600 italic">Sem métricas disponíveis.</p>
                </Section>
              )}

              {/* History */}
              {data.history.length > 1 && (
                <Section title="Histórico Recente">
                  <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {data.history.map((h, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                        <span className="text-zinc-600 font-mono shrink-0">{new Date(h.snapshot_at).toLocaleDateString("pt-BR")}</span>
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500/70 rounded-full" style={{ width: `${h.progress_pct}%` }} />
                        </div>
                        <span className="text-zinc-400 font-mono shrink-0">{Math.round(Number(h.progress_pct))}%</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Links */}
              {data.links.length > 0 && (
                <Section title="DEMs / Tasks Relacionados">
                  <div className="flex flex-wrap gap-2">
                    {data.links.map((l) => (
                      <span key={l.id} className="text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded">
                        {l.dem_id ?? l.task_id ?? l.command_id ?? l.agent_id ?? "—"}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Board link */}
              <div className="border-t border-zinc-800 pt-4">
                <Link
                  href={`/kanban?project=${p!.project_key}`}
                  className="inline-flex items-center gap-2 text-xs border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 rounded-lg px-4 py-2 hover:bg-indigo-500/20 transition-colors"
                >
                  Abrir Kanban Board →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

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
    <div className="flex flex-col bg-zinc-900/60 border border-zinc-800 rounded-lg p-2.5">
      <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{label}</span>
      <span className={`font-mono font-semibold text-sm mt-0.5 ${highlight ? "text-red-400" : "text-zinc-200"}`}>{value}</span>
    </div>
  );
}
