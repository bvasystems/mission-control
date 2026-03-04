"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

// ── Types ─────────────────────────────────────────────────────────────────────
type TaskType = "n8n" | "code" | "bug" | "improvement";
type UpdateType = "ACK" | "UPDATE" | "BLOCKED" | "DONE";
type EvidenceType = "print" | "log" | "link";
type Subtask = { id: string; title: string; status: "todo"|"doing"|"done"; owner?: string; };
type KanbanColumn = "backlog" | "assigned" | "in_progress" | "review" | "approved" | "done" | "blocked";

type Task = {
  subtasks_total?: string | number;
  subtasks_done?: string | number;
  id: string; dem_id?: string | null; title: string; objective?: string | null;
  type?: TaskType | null; priority: string; status: string; column: KanbanColumn;
  position: number; owner?: string | null; assigned_to?: string | null;
  supporter?: string | null; due_date?: string | null; acceptance_criteria?: string | null;
  project_key?: string | null; progress?: number | null; created_at: string; updated_at?: string | null;
};
type TaskUpdate = { id: string; task_id: string; update_type: UpdateType; message: string; progress?: number | null; author: string; created_at: string; };
type Evidence = { id: string; task_id: string; evidence_type: EvidenceType; content: string; note?: string | null; created_at: string; };

// ── Constants ────────────────────────────────────────────────────────────────
const COLUMNS: { key: KanbanColumn; label: string; border: string; hdr: string; accent: string }[] = [
  { key: "backlog",     label: "Backlog",     border: "border-zinc-700",        hdr: "text-zinc-400",    accent: "bg-zinc-500" },
  { key: "assigned",    label: "Assigned",    border: "border-blue-500/30",     hdr: "text-blue-400",    accent: "bg-blue-500" },
  { key: "in_progress", label: "In Progress", border: "border-indigo-500/30",   hdr: "text-indigo-400",  accent: "bg-indigo-500" },
  { key: "review",      label: "Review",      border: "border-yellow-500/30",   hdr: "text-yellow-400",  accent: "bg-yellow-500" },
  { key: "approved",    label: "Approved",    border: "border-teal-500/30",     hdr: "text-teal-400",    accent: "bg-teal-500" },
  { key: "done",        label: "Done",        border: "border-emerald-500/30",  hdr: "text-emerald-400", accent: "bg-emerald-500" },
];
const BLOCKED_COL = { key: "blocked" as KanbanColumn, label: "Blocked", border: "border-red-500/30", hdr: "text-red-400", accent: "bg-red-500" };

const P_BADGE: Record<string, string> = {
  P0: "bg-red-500/20 text-red-300 border-red-500/40", P1: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  P2: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40", critical: "bg-red-500/20 text-red-300 border-red-500/40",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/40", medium: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40",
  low: "bg-zinc-700/30 text-zinc-500 border-zinc-600/30",
};
const T_BADGE: Record<string, string> = {
  n8n: "bg-purple-500/20 text-purple-300 border-purple-500/30", code: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  bug: "bg-red-500/20 text-red-300 border-red-500/30", improvement: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};
const U_BADGE: Record<string, string> = {
  ACK: "bg-blue-500/20 text-blue-300 border-blue-500/30", UPDATE: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  BLOCKED: "bg-red-500/20 text-red-300 border-red-500/30", DONE: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};
const INPUT = "w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors";
const DEFAULT_WIP: Record<KanbanColumn, number> = { backlog: 0, assigned: 5, in_progress: 3, review: 4, approved: 10, done: 0, blocked: 0 };

const STATUS_MAP: Record<string, string> = {
  pending: "Backlog", backlog: "Backlog", assigned: "Assigned",
  in_progress: "In Progress", review: "Review", validation: "Review",
  approved: "Approved", done: "Done", blocked: "Blocked",
};

// ── Suspense wrapper ─────────────────────────────────────────────────────────
export default function KanbanPage() {
  return (
    <Suspense fallback={<div className="min-h-full flex items-center justify-center text-zinc-500 text-sm">Carregando board...</div>}>
      <KanbanBoard />
    </Suspense>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────
function KanbanBoard() {
  const sp = useSearchParams();
  const projectKey = sp.get("project_key");
  const { data: session } = useSession();
  const userName = session?.user?.name || "Operador";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<KanbanColumn | null>(null);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // WIP limits
  const [wipLimits, setWipLimits] = useState<Record<KanbanColumn, number>>(DEFAULT_WIP);
  const [showWip, setShowWip] = useState(false);

  // subtasks state
  const [taskSubtasks, setTaskSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [submittingSubtask, setSubmittingSubtask] = useState(false);
  
  // saved filters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [savedFilters, setSavedFilters] = useState<{id:string, name:string, filters:any}[]>([]);
  const [viewMode, setViewMode] = useState<"kanban" | "sprint" | "report">("kanban");
  type ReportData = { created7d: number, done7d: number, throughput: number, blockedPercent: number, bottlenecks: Task[] };
  const [reportData, setReportData] = useState<ReportData | null>(null);

  useEffect(() => {
    if (userName) {
      fetch(`/api/dashboard/filters?owner=${encodeURIComponent(userName)}`)
        .then(r => r.json())
        .then(j => { if (j.ok) setSavedFilters(j.data); });
    }
  }, [userName]);

  const loadReport = async () => {
    setViewMode("report");
    const r = await fetch("/api/dashboard/weekly-report").then(x=>x.json());
    if (r.ok) setReportData(r.data);
  };
  
  // evidence count cache (lazy – populated on modal open)
  const [evCounts, setEvCounts] = useState<Record<string, number>>({});

  // quick action on card
  const [quickTask, setQuickTask] = useState<Task | null>(null);
  const [quickType, setQuickType] = useState<UpdateType>("ACK");
  const [quickMsg, setQuickMsg] = useState("");
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  // modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([]);
  const [taskEvidences, setTaskEvidences] = useState<Evidence[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [newUpdateType, setNewUpdateType] = useState<UpdateType>("UPDATE");
  const [newUpdateMsg, setNewUpdateMsg] = useState("");
  const [newUpdateProgress, setNewUpdateProgress] = useState("");
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [newEvType, setNewEvType] = useState<EvidenceType>("link");
  const [newEvContent, setNewEvContent] = useState("");
  const [newEvNote, setNewEvNote] = useState("");
  const [submittingEv, setSubmittingEv] = useState(false);

  // create task modal
  const [showNew, setShowNew] = useState(false);
  const [newTask, setNewTask] = useState<NewTaskState>({ title: "", objective: "", type: "code", priority: "P1", owner: "", supporter: "", due_date: "", acceptance_criteria: "", subtasks: [] });
  const [creatingTask, setCreatingTask] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const url = projectKey ? `/api/dashboard/tasks?project_key=${projectKey}` : "/api/dashboard/tasks";
      const j = await fetch(url, { cache: "no-store" }).then(r => r.json());
      const allTasks: Task[] = j.data ?? [];
      const uniq = new Map<string, Task>();
      for (const t of allTasks) {
        if (!t.dem_id || !t.dem_id.startsWith("DEM-")) continue;
        if (!uniq.has(t.id)) uniq.set(t.id, t);
      }
      setTasks(Array.from(uniq.values()));
    } finally { setLoading(false); }
  }, [projectKey]);

  useEffect(() => { const t = setTimeout(refresh, 0); const i = setInterval(refresh, 30_000); return () => { clearTimeout(t); clearInterval(i); }; }, [refresh]);

  // unique owners/types for filter dropdowns
  const owners = useMemo(() => [...new Set(tasks.map(t => t.owner).filter(Boolean))] as string[], [tasks]);

  const isOverdue = (t: Task) => {
    const norm = STATUS_MAP[t.status?.toLowerCase()] || t.status;
    return !!(t.due_date && new Date(t.due_date) < new Date() && norm !== "Done" && norm !== "Approved");
  };

  // filtered + grouped
  const columns = useMemo(() => {
    const m: Record<KanbanColumn, Task[]> = { backlog: [], assigned: [], in_progress: [], review: [], approved: [], done: [], blocked: [] };
    const q = search.toLowerCase();
    for (const t of tasks) {
      if (q && !t.title.toLowerCase().includes(q) && !(t.dem_id ?? "").toLowerCase().includes(q)) continue;
      if (filterOwner && t.owner !== filterOwner) continue;
      if (filterPriority && t.priority !== filterPriority) continue;
      if (filterType && t.type !== filterType) continue;
      const col = (t.column ?? "backlog") as KanbanColumn;
      (m[col] ?? m.backlog).push(t);
    }
    for (const col of Object.keys(m) as KanbanColumn[]) m[col].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return m;
  }, [tasks, search, filterOwner, filterPriority, filterType]);

  // DnD
  async function moveTask(id: string, col: KanbanColumn) {
    setError(null);
    const res = await fetch("/api/kanban/move", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, column: col, position: columns[col].length }) });
    const j = await res.json();
    if (!res.ok || !j.ok) {
      if (j.code === "MISSING_EVIDENCE") {
        setError("🚫 Guardrail: para mover para Done anexe ao menos uma evidência. Abra o card → aba Evidências → Anexar.");
      } else {
        setError(j.error ?? "Erro ao mover card.");
      }
      return;
    }
    await refresh();
  }
  function onDragStart(e: React.DragEvent, id: string) { setDragging(id); e.dataTransfer.effectAllowed = "move"; }
  function onDragOver(e: React.DragEvent, col: KanbanColumn) { e.preventDefault(); setDragOver(col); }
  async function onDrop(e: React.DragEvent, col: KanbanColumn) { e.preventDefault(); if (dragging) { await moveTask(dragging, col); setDragging(null); setDragOver(null); } }

  // quick action
  async function submitQuick() {
    if (!quickTask || !quickMsg.trim()) return;
    setQuickSubmitting(true);
    try {
      const res = await fetch(`/api/dashboard/tasks/${quickTask.id}/updates`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ update_type: quickType, message: quickMsg.trim(), author: userName }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "Erro no quick action."); return; }
      setQuickTask(null); setQuickMsg("");
      await refresh();
    } finally { setQuickSubmitting(false); }
  }

  // modal open
  async function openTask(task: Task) {
    setSelectedTask(task); setModalLoading(true); setTaskUpdates([]); setTaskEvidences([]);
    try {
      const [up, ev] = await Promise.all([
        fetch(`/api/dashboard/tasks/${task.id}/updates`, { cache: "no-store" }).then(r => r.json()),
        fetch(`/api/dashboard/tasks/${task.id}/evidences`, { cache: "no-store" }).then(r => r.json()),
      ]);
      setTaskUpdates(up.data ?? []);
      const subs = await fetch(`/api/dashboard/tasks/${task.id}/subtasks`).then(r=>r.json());
      setTaskSubtasks(subs.data ?? []);
      const evs: Evidence[] = ev.data ?? [];
      setTaskEvidences(evs);
      setEvCounts(prev => ({ ...prev, [task.id]: evs.length }));
    } finally { setModalLoading(false); }
  }

  function closeTask() {
    setTaskSubtasks([]); setSelectedTask(null); setTaskUpdates([]); setTaskEvidences([]); setNewUpdateMsg(""); setNewEvContent(""); setNewEvNote(""); setError(null); }

  async function submitUpdate() {
    const isUpdate = newUpdateType === "UPDATE";
    if (!selectedTask || !newUpdateMsg.trim()) return;
    if (isUpdate && !newUpdateProgress) {
        setError("O progresso (%) é obrigatório para o tipo UPDATE.");
        return;
    }

    setSubmittingUpdate(true); setError(null);
    try {
      const res = await fetch(`/api/dashboard/tasks/${selectedTask.id}/updates`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ update_type: newUpdateType, message: newUpdateMsg.trim(), progress: newUpdateProgress ? Number(newUpdateProgress) : undefined, author: userName }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "Erro ao registrar update."); return; }
      setNewUpdateMsg(""); setNewUpdateProgress("");
      const [up] = await Promise.all([fetch(`/api/dashboard/tasks/${selectedTask.id}/updates`, { cache: "no-store" }).then(r => r.json()), refresh()]);
      setTaskUpdates(up.data ?? []);
    } finally { setSubmittingUpdate(false); }
  }

  async function submitSubtask() {
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    setSubmittingSubtask(true);
    try {
      const res = await fetch(`/api/dashboard/tasks/${selectedTask.id}/subtasks`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: newSubtaskTitle.trim(), owner: userName }),
      });
      const j = await res.json();
      if (res.ok) {
        setTaskSubtasks(prev => [...prev, j.data]);
        setNewSubtaskTitle("");
      }
    } finally { setSubmittingSubtask(false); }
  }

  async function updateSubtaskStatus(subId: string, status: string) {
    if (!selectedTask) return;
    setTaskSubtasks(prev => prev.map(s => s.id === subId ? { ...s, status: status as "todo"|"doing"|"done" } : s));
    await fetch(`/api/dashboard/tasks/${selectedTask.id}/subtasks/${subId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });
    refresh();
  }

  async function submitEvidence() {
    if (!selectedTask || !newEvContent.trim()) return;
    setSubmittingEv(true); setError(null);
    try {
      const res = await fetch(`/api/dashboard/tasks/${selectedTask.id}/evidences`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidence_type: newEvType, content: newEvContent.trim(), note: newEvNote || undefined }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "Erro ao anexar evidência."); return; }
      setNewEvContent(""); setNewEvNote("");
      const ev = await fetch(`/api/dashboard/tasks/${selectedTask.id}/evidences`, { cache: "no-store" }).then(r => r.json());
      const evs: Evidence[] = ev.data ?? [];
      setTaskEvidences(evs);
      setEvCounts(prev => ({ ...prev, [selectedTask.id]: evs.length }));
    } finally { setSubmittingEv(false); }
  }

  async function createTask() {
    if (!newTask.title.trim() || !newTask.objective.trim() || !newTask.owner.trim() || !newTask.acceptance_criteria.trim()) return;
    setCreatingTask(true); setError(null);
    try {
      const res = await fetch("/api/dashboard/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...newTask, project_key: projectKey ?? undefined, due_date: newTask.due_date || undefined, supporter: newTask.supporter || undefined }) });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "Erro ao criar tarefa."); return; }
      setShowNew(false); setNewTask({ title: "", objective: "", type: "code", priority: "P1", owner: "", supporter: "", due_date: "", acceptance_criteria: "", subtasks: [] });
      await refresh();
    } finally { setCreatingTask(false); }
  }

  const activeFilters = [search, filterOwner, filterPriority, filterType].filter(Boolean).length;

  return (
    <main className="min-h-full text-zinc-100 p-4 md:p-5 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-[1700px] mx-auto space-y-4 relative z-10">

        {/* ── Header ── */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-semibold mb-0.5">{projectKey ? `Projeto: ${projectKey}` : "Todas as Demandas"}</p>
            <h1 className="text-xl font-medium tracking-tight">Kanban Board</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar DEM-ID ou título..." className="bg-zinc-900 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 w-52" />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">⌕</span>
            </div>
            {/* Filters toggle */}
            <button onClick={() => setShowFilters(v => !v)} className={`relative border rounded-lg px-3 py-1.5 text-xs transition-colors ${showFilters || activeFilters ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300" : "border-zinc-700 text-zinc-400 hover:bg-white/[0.04]"}`}>
              Filtros {activeFilters > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-indigo-500 rounded-full text-[9px] flex items-center justify-center text-white font-bold">{activeFilters}</span>}
            </button>
            {/* WIP */}
            <div className="flex items-center gap-1 border-r border-zinc-800 pr-2 mr-1">
              <button onClick={() => setViewMode("kanban")} className={`px-2 py-1 text-xs rounded ${viewMode === "kanban" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Kanban</button>
              <button onClick={() => setViewMode("sprint")} className={`px-2 py-1 text-xs rounded ${viewMode === "sprint" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Sprint</button>
              <button onClick={loadReport} className={`px-2 py-1 text-xs rounded ${viewMode === "report" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Report</button>
            </div>
            <button onClick={() => setShowWip(v => !v)} className={`border rounded-lg px-3 py-1.5 text-xs transition-colors ${showWip ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" : "border-zinc-700 text-zinc-400 hover:bg-white/[0.04]"}`}>WIP</button>
            <button onClick={refresh} disabled={loading} className="border border-zinc-700 text-zinc-400 rounded-lg px-3 py-1.5 text-xs hover:bg-white/[0.04] disabled:opacity-50 transition-colors">{loading ? "..." : "↻"}</button>
            <button onClick={() => setShowNew(true)} className="border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-indigo-500/20 transition-colors">+ Nova Demanda</button>
          </div>
        </header>

        {/* ── Filter bar ── */}
        {showFilters && (
          <div className="glass rounded-xl border border-white/10 p-3 flex gap-3 flex-wrap items-center animate-in fade-in">
            <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300">
              <option value="">Todos owners</option>
              {owners.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300">
              <option value="">Todas prioridades</option>
              {["P0", "P1", "P2"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300">
              <option value="">Todos tipos</option>
              {["code", "n8n", "bug", "improvement"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {activeFilters > 0 && <button onClick={() => { setSearch(""); setFilterOwner(""); setFilterPriority(""); setFilterType(""); }} className="text-xs text-red-400 hover:text-red-300 transition-colors">✕ Limpar filtros</button>}
            {savedFilters.length > 0 && (
              <select onChange={e => {
                const f = savedFilters.find(x => x.id === e.target.value);
                if (f && f.filters) {
                  const o = f.filters as Record<string, string>;
                  setSearch(o.search || ""); setFilterOwner(o.owner || "");
                  setFilterPriority(o.priority || ""); setFilterType(o.type || "");
                }
              }} className="ml-auto bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2 py-1.5 text-xs text-indigo-300">
                <option value="">Filtros Salvos...</option>
                {savedFilters.map(sf => <option key={sf.id} value={sf.id}>{sf.name}</option>)}
              </select>
            )}
          </div>
        )}

        {/* ── WIP config ── */}
        {showWip && (
          <div className="glass rounded-xl border border-yellow-500/20 p-3 flex gap-4 flex-wrap items-center">
            <span className="text-[10px] uppercase tracking-widest text-yellow-400 font-semibold">WIP Limits</span>
            {COLUMNS.filter(c => c.key !== "backlog" && c.key !== "done").map(col => (
              <label key={col.key} className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className={col.hdr}>{col.label}</span>
                <input type="number" min={0} max={20} value={wipLimits[col.key] || 0}
                  onChange={e => setWipLimits(prev => ({ ...prev, [col.key]: Number(e.target.value) }))}
                  className="w-10 bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-center text-zinc-200"
                />
              </label>
            ))}
            <span className="text-[10px] text-zinc-600">(0 = sem limite)</span>
          </div>
        )}

        {/* ── Error banner ── */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3 text-sm text-red-300 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠</span>
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-200 ml-2">✕</button>
          </div>
        )}

        {/* ── Blocked lane ── */}
        <div
          className={`glass rounded-xl border ${BLOCKED_COL.border} p-3 transition-all duration-200 ${dragOver === "blocked" ? "bg-red-500/10 border-red-500/60" : ""}`}
          onDragOver={e => onDragOver(e, "blocked")} onDrop={e => onDrop(e, "blocked")}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse" />
            <p className="text-[10px] uppercase tracking-widest text-red-400 font-semibold">Blocked ({columns.blocked.length})</p>
          </div>
          <div className="flex gap-2 flex-wrap min-h-[32px]">
            {columns.blocked.map(t => (
              <div key={t.id} draggable onDragStart={e => onDragStart(e, t.id)} onClick={() => openTask(t)}
                className="cursor-pointer bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/20 hover:border-red-500/40 transition-colors flex items-center gap-1.5">
                <span className="font-mono text-[9px] text-red-500/70">{t.dem_id ?? t.id.slice(0, 8)}</span>
                <span className="truncate max-w-[120px]">{t.title}</span>
                <span className={`font-mono text-[8px] border rounded px-1 ${P_BADGE[t.priority] ?? ""}`}>{t.priority}</span>
              </div>
            ))}
            {columns.blocked.length === 0 && <p className="text-[11px] text-zinc-600 italic self-center">Sem bloqueios ativos.</p>}
          </div>
        </div>

        {/* ── Main board ── */}
        {viewMode === "report" ? (
          <div className="glass rounded-xl border border-white/10 p-6 space-y-6">
            <h2 className="text-xl font-semibold mb-4 text-indigo-400">Relatório Automático (MVP 7d)</h2>
            {!reportData ? <p>Carregando...</p> : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl">
                    <p className="text-[10px] uppercase text-zinc-500">Dem. Criadas</p>
                    <p className="text-2xl font-light text-zinc-200">{String(reportData.created7d ?? 0)}</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl">
                    <p className="text-[10px] uppercase text-zinc-500">Dem. Concluídas</p>
                    <p className="text-2xl font-light text-zinc-200">{String(reportData.done7d ?? 0)}</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl">
                    <p className="text-[10px] uppercase text-zinc-500">Throughput</p>
                    <p className="text-2xl font-light text-zinc-200">{String(reportData.throughput ?? 0)} / semana</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl">
                    <p className="text-[10px] uppercase text-zinc-500">Gargalo / Bloqueio</p>
                    <p className="text-2xl font-light text-orange-400">{String(reportData.blockedPercent ?? 0)}%</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm border-b border-zinc-800 pb-2 mb-2">Principais DEMs Bloqueadas</h3>
                  {reportData.bottlenecks && Array.isArray(reportData.bottlenecks) && reportData.bottlenecks.length === 0 && <p className="text-xs text-zinc-500">Sem demandas em bottleneck aberto.</p>}
                  {(reportData.bottlenecks as Task[])?.map((b) => (
                    <div key={b.dem_id || b.id} className="text-xs flex gap-2 p-2 border-b border-zinc-800 last:border-0">
                      <span className="text-red-400 font-mono">{b.dem_id}</span>
                      <span className="text-zinc-300">{b.title}</span>
                      <span className="text-zinc-500">@{b.owner}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : viewMode === "sprint" ? (
           <div className="glass rounded-xl border border-white/10 p-6 w-full">
            <h2 className="text-xl font-semibold mb-4 text-emerald-400">Visão de Sprint</h2>
            <div className="flex gap-4 p-4 bg-zinc-900 rounded-xl">
               <div className="flex-1">
                 <p className="text-zinc-500 text-xs">Aberto (Planejado)</p>
                 <p className="text-xl font-light">{columns.backlog.length + columns.assigned.length + columns.in_progress.length + columns.review.length + columns.approved.length}</p>
               </div>
               <div className="flex-1">
                 <p className="text-emerald-500 text-xs">Entregue (Done)</p>
                 <p className="text-xl font-light">{columns.done.length}</p>
               </div>
               <div className="flex-1">
                 <p className="text-red-500 text-xs">Bloqueado</p>
                 <p className="text-xl font-light">{columns.blocked.length}</p>
               </div>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {COLUMNS.map(col => {
            const count = columns[col.key].length;
            const limit = wipLimits[col.key];
            const overWip = limit > 0 && count > limit;
            return (
              <div key={col.key}
                className={`glass rounded-xl border flex flex-col min-h-[520px] transition-all duration-200 ${overWip ? "border-orange-500/50" : col.border} ${dragOver === col.key ? "bg-white/[0.03]" : ""}`}
                onDragOver={e => onDragOver(e, col.key)} onDrop={e => onDrop(e, col.key)}
              >
                {/* Column header */}
                <div className={`p-3 border-b border-white/5 ${overWip ? "bg-orange-500/5" : ""}`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-[10px] uppercase tracking-widest font-semibold ${overWip ? "text-orange-400" : col.hdr}`}>{col.label}</p>
                    {limit > 0 && (
                      <span className={`text-[9px] font-mono ${overWip ? "text-orange-400 font-bold" : "text-zinc-600"}`}>{count}/{limit}</span>
                    )}
                  </div>
                  <p className={`text-xl font-light mt-0.5 ${overWip ? "text-orange-300" : "text-zinc-300"}`}>{count}</p>
                  {overWip && <p className="text-[9px] text-orange-400/80 mt-0.5">⚠ WIP excedido</p>}
                </div>
                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                  {columns[col.key].map(t => (
                    <TaskCard key={t.id} task={t} onDragStart={onDragStart} onClick={() => openTask(t)}
                      isOverdue={isOverdue(t)} evCount={evCounts[t.id]}
                      onQuickAction={type => { setQuickTask(t); setQuickType(type); setQuickMsg(""); }}
                    />
                  ))}
                  {count === 0 && (
                    <div className="flex items-center justify-center h-16 border border-dashed border-white/10 rounded-lg mt-2">
                      <p className="text-[10px] text-zinc-700">Drop here</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Quick action drawer */}
      {quickTask && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
          <div className="bg-zinc-950 border border-zinc-700 rounded-2xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-mono text-indigo-400">{quickTask.dem_id}</p>
                <p className="text-sm font-medium text-zinc-200 truncate">{quickTask.title}</p>
              </div>
              <button onClick={() => setQuickTask(null)} className="text-zinc-500 hover:text-zinc-200 text-lg">✕</button>
            </div>
            <div className="flex gap-2">
              {(["ACK","UPDATE","BLOCKED","DONE"] as UpdateType[]).map(t => (
                <button key={t} onClick={() => setQuickType(t)} className={`flex-1 rounded-lg py-1.5 text-[10px] font-mono uppercase border transition-colors ${quickType === t ? U_BADGE[t] : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}>{t}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={quickMsg} onChange={e => setQuickMsg(e.target.value)} placeholder="Mensagem rápida..." onKeyDown={e => { if (e.key === "Enter") submitQuick(); }}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50" />
              <button onClick={submitQuick} disabled={quickSubmitting || !quickMsg.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 text-sm font-medium disabled:opacity-50 transition-colors">
                {quickSubmitting ? "..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task modal */}
      {selectedTask && (
        <TaskModal task={selectedTask} updates={taskUpdates} evidences={taskEvidences} loading={modalLoading} error={error}
          onClose={closeTask}
          subtasks={taskSubtasks} submittingSubtask={submittingSubtask}
          newSubtaskTitle={newSubtaskTitle} setNewSubtaskTitle={setNewSubtaskTitle}
          onSubmitSubtask={submitSubtask} onUpdateSubtaskStatus={updateSubtaskStatus}
          newUpdateType={newUpdateType} setNewUpdateType={setNewUpdateType}
          newUpdateMsg={newUpdateMsg} setNewUpdateMsg={setNewUpdateMsg}
          newUpdateProgress={newUpdateProgress} setNewUpdateProgress={setNewUpdateProgress}
          submittingUpdate={submittingUpdate} onSubmitUpdate={submitUpdate}
          newEvType={newEvType} setNewEvType={setNewEvType}
          newEvContent={newEvContent} setNewEvContent={setNewEvContent}
          newEvNote={newEvNote} setNewEvNote={setNewEvNote}
          submittingEv={submittingEv} onSubmitEv={submitEvidence}
        />
      )}

      {/* New task modal */}
      {showNew && (
        <NewTaskModal task={newTask} setTask={setNewTask} submitting={creatingTask} error={error}
          onClose={() => { setShowNew(false); setError(null); }} onSubmit={createTask}
        />
      )}
    </main>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task: t, onDragStart, onClick, isOverdue, evCount, onQuickAction }: {
  task: Task; onDragStart: (e: React.DragEvent, id: string) => void; onClick: () => void;
  isOverdue: boolean; evCount?: number; onQuickAction: (type: UpdateType) => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div draggable onDragStart={e => onDragStart(e, t.id)}
      className={`rounded-xl border p-3 space-y-2.5 transition-all duration-150 group relative
        ${isOverdue ? "bg-red-500/5 border-red-500/30" : t.column === "done" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-black/40 border-white/10"}
        hover:border-white/25 hover:bg-black/60 hover:shadow-lg hover:-translate-y-px cursor-pointer`}
    >
      {/* Top row: DEM-ID + type badge */}
      <div className="flex items-center justify-between gap-1" onClick={onClick}>
        <span className="text-[9px] font-mono text-zinc-600">{t.dem_id ?? "–"}</span>
        <div className="flex items-center gap-1">
          {t.type && <span className={`text-[8px] font-mono uppercase border rounded px-1 py-0.5 ${T_BADGE[t.type] ?? ""}`}>{t.type}</span>}
          {isOverdue && <span className="text-[8px] bg-red-500/20 text-red-300 border border-red-500/30 rounded px-1 py-0.5 font-mono">OVERDUE</span>}
          {t.column === "blocked" && <span className="text-[8px] bg-red-500/20 text-red-300 border border-red-500/30 rounded px-1 py-0.5 font-mono animate-pulse">BLOCKED</span>}
        </div>
      </div>

      {/* Title */}
      <p className="text-xs font-medium text-zinc-200 leading-snug line-clamp-2" onClick={onClick}>{t.title}</p>

      {/* Meta row: priority + owner + due + evidence count */}
      <div className="flex items-center gap-1.5 flex-wrap" onClick={onClick}>
        <span className={`text-[8px] font-mono uppercase border rounded px-1 py-0.5 ${P_BADGE[t.priority] ?? ""}`}>{t.priority}</span>
        {t.owner && <span className="text-[8px] text-zinc-500">@{t.owner}</span>}
        {(t.subtasks_total as number) > 0 && (
          <span className="text-[8px] font-mono text-indigo-400">
            {t.subtasks_done}/{t.subtasks_total} subs ({Math.round((Number(t.subtasks_done)/Number(t.subtasks_total))*100)}%)
          </span>
        )}
        {t.due_date && (
          <span className={`text-[8px] font-mono ml-auto ${isOverdue ? "text-red-400 font-bold" : "text-zinc-600"}`}>
            {isOverdue ? "⚠ " : "📅 "}{new Date(t.due_date).toLocaleDateString("pt-BR")}
          </span>
        )}
        {evCount !== undefined && (
          <span className={`text-[8px] font-mono ml-auto ${evCount === 0 ? "text-yellow-600" : "text-emerald-600"}`}>
            {evCount === 0 ? "⚠ sem evidência" : `✓ ${evCount} evidência${evCount !== 1 ? "s" : ""}`}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {t.progress != null && t.progress > 0 && (
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden" onClick={onClick}>
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${t.progress}%` }} />
        </div>
      )}

      {/* Quick actions (hover) */}
      <div className={`transition-all duration-150 overflow-hidden ${showActions ? "max-h-20 opacity-100" : "max-h-0 opacity-0 group-hover:max-h-20 group-hover:opacity-100"}`}>
        <div className="flex gap-1 pt-1 border-t border-white/5">
          {([
            { type: "ACK" as UpdateType, label: "ACK", cls: "hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/30" },
            { type: "BLOCKED" as UpdateType, label: "Block", cls: "hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30" },
            { type: "DONE" as UpdateType, label: "Done", cls: "hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30" },
          ]).map(({ type, label, cls }) => (
            <button key={type}
              onClick={e => { e.stopPropagation(); onQuickAction(type); setShowActions(false); }}
              className={`flex-1 text-[9px] font-mono uppercase border border-white/10 rounded px-1 py-1 text-zinc-500 transition-colors ${cls}`}
            >{label}</button>
          ))}
          <button onClick={e => { e.stopPropagation(); onClick(); }}
            className="flex-1 text-[9px] font-mono uppercase border border-white/10 rounded px-1 py-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 transition-colors">
            Info
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Task Modal (2-col layout) ──────────────────────────────────────────────────
type ModalProps = {
  task: Task; updates: TaskUpdate[]; evidences: Evidence[]; loading: boolean; error: string | null; onClose: () => void;
  subtasks: Subtask[]; submittingSubtask: boolean; newSubtaskTitle: string; setNewSubtaskTitle: (v: string) => void;
  onSubmitSubtask: () => void; onUpdateSubtaskStatus: (id: string, s: string) => void;
  newUpdateType: UpdateType; setNewUpdateType: (v: UpdateType) => void;
  newUpdateMsg: string; setNewUpdateMsg: (v: string) => void;
  newUpdateProgress: string; setNewUpdateProgress: (v: string) => void;
  submittingUpdate: boolean; onSubmitUpdate: () => void;
  newEvType: EvidenceType; setNewEvType: (v: EvidenceType) => void;
  newEvContent: string; setNewEvContent: (v: string) => void;
  newEvNote: string; setNewEvNote: (v: string) => void;
  submittingEv: boolean; onSubmitEv: () => void;
};

function TaskModal(p: ModalProps) {
  const t = p.task;
  const noEvidence = p.evidences.length === 0 && !p.loading;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") p.onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm p-4 pt-10 overflow-y-auto" onClick={p.onClose}>
      <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Sticky header */}
        <div className="sticky top-0 bg-zinc-950/98 backdrop-blur border-b border-zinc-800 flex items-start justify-between p-5 gap-3 z-10 rounded-t-2xl shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-mono text-indigo-400">{t.dem_id ?? "DEM-?"}</span>
              {t.type && <span className={`text-[8px] font-mono uppercase border rounded px-1.5 py-0.5 ${T_BADGE[t.type] ?? ""}`}>{t.type}</span>}
              <span className={`text-[8px] font-mono uppercase border rounded px-1.5 py-0.5 ${P_BADGE[t.priority] ?? ""}`}>{t.priority}</span>
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{STATUS_MAP[t.status?.toLowerCase()] || t.status}</span>
              {noEvidence && <span className="text-[8px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded px-1.5 py-0.5 font-mono animate-pulse">⚠ SEM EVIDÊNCIA</span>}
            </div>
            <h2 className="text-lg font-semibold text-zinc-100 leading-snug">{t.title}</h2>
          </div>
          <button onClick={p.onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors text-xl shrink-0">✕</button>
        </div>

        {/* Error banner */}
        {p.error && (
          <div className="mx-5 mt-4 bg-red-500/10 border border-red-500/40 rounded-xl p-3 text-sm text-red-300 flex items-start gap-2 shrink-0">
            <span>⚠</span><span className="flex-1">{p.error}</span>
          </div>
        )}

        {/* 2-column body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-x divide-zinc-800/80 min-h-0">

          {/* Left: details + updates */}
          <div className="flex flex-col overflow-y-auto custom-scrollbar">
            <div className="p-5 space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {t.objective && <MF label="Objetivo" value={t.objective} full />}
                {t.owner && <MF label="Owner" value={t.owner} />}
                {t.supporter && <MF label="Supporter" value={t.supporter} />}
                {t.due_date && <MF label="Due Date" value={new Date(t.due_date).toLocaleDateString("pt-BR")} />}
                {t.acceptance_criteria && <MF label="Critérios de Aceite" value={t.acceptance_criteria} full />}
              </div>

              {/* Subtasks */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">Subtasks ({p.subtasks.filter(s => s.status === 'done').length}/{p.subtasks.length})</p>
                <div className="space-y-1.5 mb-2">
                  {p.subtasks.map(s => (
                    <div key={s.id} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs">
                      <select value={s.status} onChange={e => p.onUpdateSubtaskStatus(s.id, e.target.value)}
                        className={`bg-black/20 text-[10px] font-mono border rounded px-1 min-w-[60px] cursor-pointer outline-none ${s.status==='done'?'text-emerald-400 border-emerald-500/30':s.status==='doing'?'text-blue-400 border-blue-500/30':'text-zinc-500 border-zinc-700'}`}>
                        <option value="todo">TODO</option>
                        <option value="doing">DOING</option>
                        <option value="done">DONE</option>
                      </select>
                      <span className={`flex-1 truncate ${s.status==='done'?'line-through text-zinc-500':'text-zinc-300'}`}>{s.title}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={p.newSubtaskTitle} onChange={e => p.setNewSubtaskTitle(e.target.value)} placeholder="Nova subtask..." onKeyDown={e => { if (e.key === 'Enter') p.onSubmitSubtask(); }} className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50" />
                  <button onClick={p.onSubmitSubtask} disabled={p.submittingSubtask || !p.newSubtaskTitle.trim()} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-50 transition-colors">Adicionar</button>
                </div>
              </div>

              {/* Updates timeline */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">Timeline ({p.updates.length})</p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {p.loading && <div className="h-8 bg-zinc-800 animate-pulse rounded-lg" />}
                  {!p.loading && p.updates.length === 0 && <p className="text-xs text-zinc-600 italic">Nenhum update ainda.</p>}
                  {p.updates.map(u => (
                    <div key={u.id} className="flex gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs">
                      <span className={`font-mono uppercase border rounded px-1.5 py-0.5 text-[8px] shrink-0 self-start mt-0.5 ${U_BADGE[u.update_type] ?? ""}`}>{u.update_type}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-200 leading-snug">{u.message}</p>
                        <p className="text-[9px] text-zinc-600 mt-0.5 font-mono">{u.author} · {new Date(u.created_at).toLocaleString("pt-BR")}{u.progress != null ? ` · ${u.progress}%` : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Fixed update form at bottom of left col */}
            <div className="sticky bottom-0 bg-zinc-950/95 border-t border-zinc-800 p-4 space-y-2 shrink-0">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Registrar update</p>
              <div className="flex gap-2 flex-wrap">
                {(["ACK","UPDATE","BLOCKED","DONE"] as UpdateType[]).map(tp => (
                  <button key={tp} onClick={() => p.setNewUpdateType(tp)} className={`flex-1 rounded-lg py-1 text-[10px] font-mono uppercase border transition-colors ${p.newUpdateType === tp ? U_BADGE[tp] : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}>{tp}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={p.newUpdateProgress} onChange={e => p.setNewUpdateProgress(e.target.value)} type="number" min={0} max={100} placeholder="Progresso %" className="w-28 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/50" />
                <textarea value={p.newUpdateMsg} onChange={e => p.setNewUpdateMsg(e.target.value)} placeholder="Mensagem..." rows={2} className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none" />
                <button onClick={p.onSubmitUpdate} disabled={p.submittingUpdate || !p.newUpdateMsg.trim() || (p.newUpdateType === "UPDATE" && !p.newUpdateProgress)} className="bg-blue-600/80 hover:bg-blue-500 text-white rounded-lg px-3 text-xs font-medium disabled:opacity-50 transition-colors self-stretch">
                  {p.submittingUpdate ? "..." : "Enviar"}
                </button>
              </div>
            </div>
          </div>

          {/* Right: evidences */}
          <div className="flex flex-col overflow-y-auto custom-scrollbar">
            <div className="p-5 space-y-3 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Evidências ({p.evidences.length})</p>

              {/* Guardrail warning */}
              {noEvidence && (
                <div className="bg-yellow-500/8 border border-yellow-500/25 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-semibold text-yellow-400">⚠ Nenhuma evidência anexada</p>
                  <p className="text-[11px] text-yellow-400/70">A transição para <strong>Done</strong> será bloqueada pelo guardrail de negócio até que ao menos 1 evidência seja anexada abaixo.</p>
                  <p className="text-[10px] text-zinc-500 mt-1">→ Adicione um link, print ou log abaixo para desbloquear.</p>
                </div>
              )}

              <div className="space-y-1.5">
                {p.evidences.map(ev => (
                  <div key={ev.id} className="flex items-start gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs">
                    <span className="font-mono text-indigo-400 shrink-0 uppercase">{ev.evidence_type}</span>
                    <a href={ev.content.startsWith("http") ? ev.content : undefined} target="_blank" rel="noreferrer"
                      className="text-zinc-300 truncate hover:text-indigo-300 transition-colors flex-1">{ev.content}</a>
                    {ev.note && <span className="text-zinc-600 shrink-0 italic text-[10px]">{ev.note}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Fixed evidence form at bottom of right col */}
            <div className="sticky bottom-0 bg-zinc-950/95 border-t border-zinc-800 p-4 space-y-2 shrink-0">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Adicionar evidência</p>
              <div className="flex gap-2 flex-wrap">
                {(["link","print","log"] as EvidenceType[]).map(et => (
                  <button key={et} onClick={() => p.setNewEvType(et)} className={`flex-1 rounded-lg py-1 text-[10px] font-mono uppercase border transition-colors ${p.newEvType === et ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}>{et}</button>
                ))}
              </div>
              <input value={p.newEvContent} onChange={e => p.setNewEvContent(e.target.value)} placeholder="URL ou conteúdo da evidência..." className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50" />
              <div className="flex gap-2">
                <input value={p.newEvNote} onChange={e => p.setNewEvNote(e.target.value)} placeholder="Nota opcional..." className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50" />
                <button onClick={p.onSubmitEv} disabled={p.submittingEv || !p.newEvContent.trim()} className="bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-lg px-4 py-1.5 text-xs font-medium disabled:opacity-50 transition-colors shrink-0">
                  {p.submittingEv ? "..." : "Anexar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function MF({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5">{label}</p>
      <p className="text-zinc-300 leading-snug text-xs">{value}</p>
    </div>
  );
}

type NewTaskState = { title: string; objective: string; type: TaskType; priority: string; owner: string; supporter: string; due_date: string; acceptance_criteria: string; subtasks: string[] };

const PRESET_TEMPLATES: Record<string, Partial<NewTaskState>> = {
  limpo: { title: "", objective: "", type: "code", priority: "P1", acceptance_criteria: "", subtasks: [] },
  n8n: { title: "[n8n] ", objective: "Criar ou ajustar workflow no n8n...", type: "n8n", priority: "P1", acceptance_criteria: "- Fluxo executa path feliz\n- Erros tratados", subtasks: ["Desenhar path feliz", "Tratar path de erro", "Publicar"] },
  code: { title: "[Feature] ", objective: "Implementar funcionalidade...", type: "code", priority: "P1", acceptance_criteria: "- Atende aos requisitos\n- Nenhum console error", subtasks: ["Implementar core", "Validar e iterar", "Revisão de código"] },
  bug: { title: "[BUG] ", objective: "Corrigir erro onde...", type: "bug", priority: "P0", acceptance_criteria: "- Erro principal não ocorre mais\n- Causa raiz identificada e resolvida", subtasks: ["Reproduzir bug", "Implementar correção", "Validar"] },
  improvement: { title: "[Melhoria] ", objective: "Otimizar funcionalidade...", type: "improvement", priority: "P2", acceptance_criteria: "- UX/Perf melhorada\n- Sem regressões", subtasks: ["Identificar melhorias", "Aplicar ajustes", "Validar"] }
};

function NewTaskModal({ task, setTask, submitting, error, onClose, onSubmit }: { task: NewTaskState; setTask: (t: NewTaskState) => void; submitting: boolean; error: string | null; onClose: () => void; onSubmit: () => void; }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  const set = (k: keyof NewTaskState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setTask({ ...task, [k]: e.target.value });
  const ok = task.title.trim() && task.objective.trim() && task.owner.trim() && task.acceptance_criteria.trim();
  
  const applyTemplate = (key: string) => {
    if (key && PRESET_TEMPLATES[key]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTask({ ...task, ...PRESET_TEMPLATES[key] as any });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-xl" onClick={e => e.stopPropagation()}>
        <div className="border-b border-zinc-800 flex items-center justify-between p-5">
          <div><p className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold">Nova Demanda</p><h2 className="text-lg font-semibold text-zinc-100 mt-0.5">Criar DEM-*</h2></div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-xl">✕</button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {error && <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3 text-sm text-red-300">⚠ {error}</div>}
          <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl flex gap-3 items-center">
            <span className="text-xs text-indigo-300">Aplicar Template:</span>
            <select onChange={(e) => applyTemplate(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-200 outline-none">
               <option value="limpo">Limpo (Em branco)</option>
               <option value="n8n">n8n Workflow</option>
               <option value="code">Code / Feature</option>
               <option value="bug">Bug Fix</option>
               <option value="improvement">Melhoria</option>
            </select>
          </div>
          <F label="Título *"><input value={task.title} onChange={set("title")} placeholder="Ex: Revisar cron watchdog" className={INPUT} /></F>
          <F label="Objetivo *"><textarea value={task.objective} onChange={set("objective")} rows={2} placeholder="O que essa demanda resolve..." className={INPUT + " resize-none"} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Tipo *"><select value={task.type} onChange={set("type")} className={INPUT}><option value="code">Code</option><option value="n8n">n8n</option><option value="bug">Bug</option><option value="improvement">Improvement</option></select></F>
            <F label="Prioridade *"><select value={task.priority} onChange={set("priority")} className={INPUT}><option value="P0">P0 — Crítico</option><option value="P1">P1 — Alta</option><option value="P2">P2 — Normal</option></select></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Owner *"><input value={task.owner} onChange={set("owner")} placeholder="@handle" className={INPUT} /></F>
            <F label="Supporter"><input value={task.supporter} onChange={set("supporter")} placeholder="Opcional" className={INPUT} /></F>
          </div>
          <F label="Due Date"><input type="date" value={task.due_date} onChange={set("due_date")} className={INPUT} /></F>
          <F label="Critérios de Aceite *"><textarea value={task.acceptance_criteria} onChange={set("acceptance_criteria")} rows={3} placeholder="O que precisa ser verdade para Done..." className={INPUT + " resize-none"} /></F>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 border border-zinc-700 text-zinc-400 rounded-lg py-2 text-sm hover:bg-white/[0.04] transition-colors">Cancelar</button>
            <button onClick={onSubmit} disabled={submitting || !ok} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 transition-colors">{submitting ? "Criando..." : "Criar Demanda"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</p>{children}</div>;
}
