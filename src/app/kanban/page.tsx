"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

type TaskType = "n8n" | "code" | "bug" | "improvement";
type KanbanColumn =
  | "backlog"
  | "assigned"
  | "in_progress"
  | "review"
  | "approved"
  | "done"
  | "blocked";

type Task = {
  id: string;
  dem_id?: string | null;
  title: string;
  objective?: string | null;
  type?: TaskType | null;
  priority: string;
  status: string;
  column: KanbanColumn;
  position: number;
  owner?: string | null;
  assigned_to?: string | null;
  supporter?: string | null;
  due_date?: string | null;
  acceptance_criteria?: string | null;
  project_key?: string | null;
  progress?: number | null;
  created_at: string;
  updated_at?: string | null;
};

type TaskUpdate = {
  id: string;
  task_id: string;
  update_type: "ACK" | "UPDATE" | "BLOCKED" | "DONE";
  message: string;
  progress?: number | null;
  author: string;
  created_at: string;
};

type Evidence = {
  id: string;
  task_id: string;
  evidence_type: "print" | "log" | "link";
  content: string;
  note?: string | null;
  created_at: string;
};

// ── Kanban column config ───────────────────────────────────────────────────────

const COLUMNS: { key: KanbanColumn; label: string; color: string; headerColor: string }[] = [
  { key: "backlog",     label: "Backlog",     color: "border-zinc-700",        headerColor: "text-zinc-400" },
  { key: "assigned",    label: "Assigned",    color: "border-blue-500/30",     headerColor: "text-blue-400" },
  { key: "in_progress", label: "In Progress", color: "border-indigo-500/30",   headerColor: "text-indigo-400" },
  { key: "review",      label: "Review",      color: "border-yellow-500/30",   headerColor: "text-yellow-400" },
  { key: "approved",    label: "Approved",    color: "border-teal-500/30",     headerColor: "text-teal-400" },
  { key: "done",        label: "Done",        color: "border-emerald-500/30",  headerColor: "text-emerald-400" },
];
const BLOCKED_COL = { key: "blocked" as KanbanColumn, label: "Blocked", color: "border-red-500/30", headerColor: "text-red-400" };

// ── Priority / type badges ────────────────────────────────────────────────────

const priorityBadge: Record<string, string> = {
  P0: "bg-red-500/20 text-red-300 border-red-500/40",
  P1: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  P2: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40",
  critical: "bg-red-500/20 text-red-300 border-red-500/40",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  medium: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40",
  low: "bg-zinc-700/30 text-zinc-500 border-zinc-600/30",
};

const typeBadge: Record<string, string> = {
  n8n:         "bg-purple-500/20 text-purple-300 border-purple-500/30",
  code:        "bg-sky-500/20 text-sky-300 border-sky-500/30",
  bug:         "bg-red-500/20 text-red-300 border-red-500/30",
  improvement: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

const updateTypeBadge: Record<string, string> = {
  ACK:     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  UPDATE:  "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  BLOCKED: "bg-red-500/20 text-red-300 border-red-500/30",
  DONE:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

// ── Page (Suspense wrapper required for useSearchParams) ─────────────────────
export default function KanbanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-full flex items-center justify-center text-zinc-500 text-sm">
        Carregando board...
      </div>
    }>
      <KanbanBoard />
    </Suspense>
  );
}

function KanbanBoard() {
  const searchParams = useSearchParams();
  const projectKey = searchParams.get("project_key");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<KanbanColumn | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([]);
  const [taskEvidences, setTaskEvidences] = useState<Evidence[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // New update form
  const [newUpdateType, setNewUpdateType] = useState<"ACK" | "UPDATE" | "BLOCKED" | "DONE">("UPDATE");
  const [newUpdateMsg, setNewUpdateMsg] = useState("");
  const [newUpdateProgress, setNewUpdateProgress] = useState<string>("");
  const [newUpdateAuthor, setNewUpdateAuthor] = useState("operador");
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  // New evidence form
  const [newEvidenceType, setNewEvidenceType] = useState<"print" | "log" | "link">("link");
  const [newEvidenceContent, setNewEvidenceContent] = useState("");
  const [newEvidenceNote, setNewEvidenceNote] = useState("");
  const [submittingEvidence, setSubmittingEvidence] = useState(false);

  // New task modal
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "", objective: "", type: "code" as TaskType,
    priority: "P1", owner: "", supporter: "",
    due_date: "", acceptance_criteria: "",
  });
  const [submittingTask, setSubmittingTask] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const url = projectKey
        ? `/api/dashboard/tasks?project_key=${projectKey}`
        : "/api/dashboard/tasks";
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      setTasks(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectKey]);

  useEffect(() => {
    const t = setTimeout(refresh, 0);
    const i = setInterval(refresh, 30_000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [refresh]);

  // Group tasks by column
  const columns = useMemo(() => {
    const m: Record<KanbanColumn, Task[]> = {
      backlog: [], assigned: [], in_progress: [], review: [], approved: [], done: [], blocked: [],
    };
    for (const t of tasks) {
      const col = (t.column ?? "backlog") as KanbanColumn;
      if (m[col]) m[col].push(t);
      else m.backlog.push(t);
    }
    // Sort each column by position
    for (const col of Object.keys(m) as KanbanColumn[]) {
      m[col].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }
    return m;
  }, [tasks]);

  // ── Drag & Drop ─────────────────────────────────────────────────────────────

  async function moveTask(taskId: string, targetColumn: KanbanColumn, position: number) {
    setError(null);
    const res = await fetch("/api/kanban/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: taskId, column: targetColumn, position }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Erro ao mover card.");
      return;
    }
    await refresh();
  }

  function onDragStart(e: React.DragEvent, taskId: string) {
    setDragging(taskId);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent, col: KanbanColumn) {
    e.preventDefault();
    setDragOver(col);
  }

  async function onDrop(e: React.DragEvent, col: KanbanColumn) {
    e.preventDefault();
    if (!dragging) return;
    const targetLen = columns[col].length;
    await moveTask(dragging, col, targetLen);
    setDragging(null);
    setDragOver(null);
  }

  // ── Task detail modal ────────────────────────────────────────────────────────

  async function openTask(task: Task) {
    setSelectedTask(task);
    setModalLoading(true);
    setTaskUpdates([]);
    setTaskEvidences([]);
    try {
      const [up, ev] = await Promise.all([
        fetch(`/api/dashboard/tasks/${task.id}/updates`, { cache: "no-store" }).then(r => r.json()),
        fetch(`/api/dashboard/tasks/${task.id}/evidences`, { cache: "no-store" }).then(r => r.json()),
      ]);
      setTaskUpdates(up.data ?? []);
      setTaskEvidences(ev.data ?? []);
    } finally {
      setModalLoading(false);
    }
  }

  function closeTask() {
    setSelectedTask(null);
    setTaskUpdates([]);
    setTaskEvidences([]);
    setNewUpdateMsg("");
    setNewEvidenceContent("");
    setNewEvidenceNote("");
    setError(null);
  }

  async function submitUpdate() {
    if (!selectedTask || !newUpdateMsg.trim()) return;
    setSubmittingUpdate(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/tasks/${selectedTask.id}/updates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          update_type: newUpdateType,
          message: newUpdateMsg.trim(),
          progress: newUpdateProgress ? Number(newUpdateProgress) : undefined,
          author: newUpdateAuthor || "operador",
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao registrar update."); return; }
      setNewUpdateMsg(""); setNewUpdateProgress("");
      // Reload updates + refresh task list (status may have changed)
      const [up] = await Promise.all([
        fetch(`/api/dashboard/tasks/${selectedTask.id}/updates`, { cache: "no-store" }).then(r => r.json()),
        refresh(),
      ]);
      setTaskUpdates(up.data ?? []);
    } finally {
      setSubmittingUpdate(false);
    }
  }

  async function submitEvidence() {
    if (!selectedTask || !newEvidenceContent.trim()) return;
    setSubmittingEvidence(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/tasks/${selectedTask.id}/evidences`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          evidence_type: newEvidenceType,
          content: newEvidenceContent.trim(),
          note: newEvidenceNote || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao anexar evidência."); return; }
      setNewEvidenceContent(""); setNewEvidenceNote("");
      const ev = await fetch(`/api/dashboard/tasks/${selectedTask.id}/evidences`, { cache: "no-store" }).then(r => r.json());
      setTaskEvidences(ev.data ?? []);
    } finally {
      setSubmittingEvidence(false);
    }
  }

  // ── Create new task ──────────────────────────────────────────────────────────

  async function createTask() {
    if (!newTask.title.trim() || !newTask.objective.trim() || !newTask.owner.trim() || !newTask.acceptance_criteria.trim()) return;
    setSubmittingTask(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...newTask,
          project_key: projectKey ?? undefined,
          due_date: newTask.due_date || undefined,
          supporter: newTask.supporter || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao criar tarefa."); return; }
      setShowNewTask(false);
      setNewTask({ title: "", objective: "", type: "code", priority: "P1", owner: "", supporter: "", due_date: "", acceptance_criteria: "" });
      await refresh();
    } finally {
      setSubmittingTask(false);
    }
  }

  const isOverdue = (t: Task) =>
    t.due_date && new Date(t.due_date) < new Date() && t.status !== "Done" && t.status !== "Approved";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-full text-zinc-100 p-4 md:p-6 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-[1600px] mx-auto space-y-5 relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-semibold mb-1">
              {projectKey ? `Projeto: ${projectKey}` : "Todas as Demandas"}
            </p>
            <h1 className="text-2xl font-medium tracking-tight">Kanban Board</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={refresh}
              disabled={loading}
              className="border border-zinc-700 text-zinc-400 rounded-lg px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-white/[0.04] transition-colors disabled:opacity-50"
            >
              {loading ? "..." : "Atualizar"}
            </button>
            <button
              onClick={() => setShowNewTask(true)}
              className="border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 rounded-lg px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-indigo-500/20 transition-colors font-medium"
            >
              + Nova Demanda
            </button>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3 text-sm text-red-300 flex items-center gap-2">
            <span>⚠</span> {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {/* Blocked lane */}
        <div
          className={`glass rounded-xl border ${BLOCKED_COL.color} p-3 transition-all duration-200 ${dragOver === "blocked" ? "bg-red-500/10 border-red-500/60" : ""}`}
          onDragOver={(e) => onDragOver(e, "blocked")}
          onDrop={(e) => onDrop(e, "blocked")}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse" />
            <p className="text-[10px] uppercase tracking-widest text-red-400 font-semibold">
              Blocked ({columns.blocked.length})
            </p>
          </div>
          <div className="flex gap-2 flex-wrap min-h-[36px]">
            {columns.blocked.map(t => (
              <TaskChip key={t.id} task={t} onDragStart={onDragStart} onClick={() => openTask(t)} />
            ))}
            {columns.blocked.length === 0 && (
              <p className="text-[11px] text-zinc-600 italic self-center">Sem bloqueios ativos.</p>
            )}
          </div>
        </div>

        {/* Main board */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {COLUMNS.map(col => (
            <div
              key={col.key}
              className={`glass rounded-xl border ${col.color} flex flex-col min-h-[480px] transition-all duration-200 ${dragOver === col.key ? "border-opacity-100 bg-white/[0.03]" : ""}`}
              onDragOver={(e) => onDragOver(e, col.key)}
              onDrop={(e) => onDrop(e, col.key)}
            >
              {/* Column header */}
              <div className="p-3 border-b border-white/5">
                <p className={`text-[10px] uppercase tracking-widest font-semibold ${col.headerColor}`}>
                  {col.label}
                </p>
                <p className="text-xl font-light text-zinc-300 mt-1">{columns[col.key].length}</p>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                {columns[col.key].map(t => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onDragStart={onDragStart}
                    onClick={() => openTask(t)}
                    isOverdue={!!isOverdue(t)}
                  />
                ))}
                {columns[col.key].length === 0 && (
                  <div className="flex items-center justify-center h-20 border border-dashed border-white/10 rounded-lg mt-2">
                    <p className="text-[10px] text-zinc-700">Drop here</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          updates={taskUpdates}
          evidences={taskEvidences}
          loading={modalLoading}
          error={error}
          onClose={closeTask}
          // Update form
          newUpdateType={newUpdateType}
          setNewUpdateType={setNewUpdateType}
          newUpdateMsg={newUpdateMsg}
          setNewUpdateMsg={setNewUpdateMsg}
          newUpdateProgress={newUpdateProgress}
          setNewUpdateProgress={setNewUpdateProgress}
          newUpdateAuthor={newUpdateAuthor}
          setNewUpdateAuthor={setNewUpdateAuthor}
          submittingUpdate={submittingUpdate}
          onSubmitUpdate={submitUpdate}
          // Evidence form
          newEvidenceType={newEvidenceType}
          setNewEvidenceType={setNewEvidenceType}
          newEvidenceContent={newEvidenceContent}
          setNewEvidenceContent={setNewEvidenceContent}
          newEvidenceNote={newEvidenceNote}
          setNewEvidenceNote={setNewEvidenceNote}
          submittingEvidence={submittingEvidence}
          onSubmitEvidence={submitEvidence}
        />
      )}

      {/* New task modal */}
      {showNewTask && (
        <NewTaskModal
          task={newTask}
          setTask={setNewTask}
          submitting={submittingTask}
          error={error}
          onClose={() => { setShowNewTask(false); setError(null); }}
          onSubmit={createTask}
        />
      )}
    </main>
  );
}

// ── Task Chip (blocked lane) ────────────────────────────────────────────────────

function TaskChip({ task: t, onDragStart, onClick }: {
  task: Task;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, t.id)}
      onClick={onClick}
      className="cursor-pointer bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5 text-xs text-red-300 hover:border-red-500/40 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
    >
      <span className="font-mono text-[10px] text-red-500/70">{t.dem_id ?? t.id.slice(0, 8)}</span>
      <span className="truncate max-w-[120px]">{t.title}</span>
    </div>
  );
}

// ── Task Card (main board) ──────────────────────────────────────────────────────

function TaskCard({ task: t, onDragStart, onClick, isOverdue }: {
  task: Task;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: () => void;
  isOverdue: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, t.id)}
      onClick={onClick}
      className={`cursor-pointer rounded-lg border p-3 space-y-2 transition-all duration-150 hover:translate-y-[-1px] hover:shadow-lg group ${
        isOverdue
          ? "bg-red-500/5 border-red-500/30 hover:border-red-500/50"
          : "bg-black/40 border-white/10 hover:border-white/20 hover:bg-black/60"
      }`}
    >
      {/* DEM ID + type */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] font-mono text-zinc-600">{t.dem_id ?? "–"}</span>
        {t.type && (
          <span className={`text-[8px] font-mono uppercase border rounded px-1 py-0.5 ${typeBadge[t.type] ?? ""}`}>
            {t.type}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-xs font-medium text-zinc-200 leading-snug line-clamp-2">{t.title}</p>

      {/* Priority + owner */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className={`text-[8px] font-mono uppercase border rounded px-1 py-0.5 ${priorityBadge[t.priority] ?? ""}`}>
          {t.priority}
        </span>
        {t.owner && (
          <span className="text-[8px] text-zinc-600 truncate max-w-[80px]">@{t.owner}</span>
        )}
      </div>

      {/* Due date */}
      {t.due_date && (
        <p className={`text-[9px] font-mono ${isOverdue ? "text-red-400" : "text-zinc-600"}`}>
          {isOverdue ? "⚠ " : ""}
          {new Date(t.due_date).toLocaleDateString("pt-BR")}
        </p>
      )}

      {/* Progress bar */}
      {t.progress != null && t.progress > 0 && (
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${t.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Task Detail Modal ─────────────────────────────────────────────────────────

type ModalProps = {
  task: Task;
  updates: TaskUpdate[];
  evidences: Evidence[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  newUpdateType: "ACK" | "UPDATE" | "BLOCKED" | "DONE";
  setNewUpdateType: (v: "ACK" | "UPDATE" | "BLOCKED" | "DONE") => void;
  newUpdateMsg: string;
  setNewUpdateMsg: (v: string) => void;
  newUpdateProgress: string;
  setNewUpdateProgress: (v: string) => void;
  newUpdateAuthor: string;
  setNewUpdateAuthor: (v: string) => void;
  submittingUpdate: boolean;
  onSubmitUpdate: () => void;
  newEvidenceType: "print" | "log" | "link";
  setNewEvidenceType: (v: "print" | "log" | "link") => void;
  newEvidenceContent: string;
  setNewEvidenceContent: (v: string) => void;
  newEvidenceNote: string;
  setNewEvidenceNote: (v: string) => void;
  submittingEvidence: boolean;
  onSubmitEvidence: () => void;
};

function TaskModal(p: ModalProps) {
  const t = p.task;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") p.onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [p]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 pt-12 overflow-y-auto"
      onClick={p.onClose}
    >
      <div
        className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-950/98 backdrop-blur border-b border-zinc-800 flex items-start justify-between p-5 gap-3 z-10 rounded-t-2xl">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-indigo-400">{t.dem_id ?? "DEM-?"}</span>
              {t.type && (
                <span className={`text-[8px] font-mono uppercase border rounded px-1.5 py-0.5 ${typeBadge[t.type] ?? ""}`}>{t.type}</span>
              )}
              <span className={`text-[8px] font-mono uppercase border rounded px-1.5 py-0.5 ${priorityBadge[t.priority] ?? ""}`}>{t.priority}</span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-100 leading-snug">{t.title}</h2>
            {t.status && (
              <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">{t.status}</p>
            )}
          </div>
          <button onClick={p.onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors text-xl leading-none shrink-0">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Error */}
          {p.error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3 text-sm text-red-300">
              ⚠ {p.error}
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {t.objective && <MetaField label="Objetivo" value={t.objective} fullWidth />}
            {t.owner && <MetaField label="Owner" value={t.owner} />}
            {t.supporter && <MetaField label="Supporter" value={t.supporter} />}
            {t.due_date && <MetaField label="Due Date" value={new Date(t.due_date).toLocaleDateString("pt-BR")} />}
            {t.acceptance_criteria && <MetaField label="Critérios de Aceite" value={t.acceptance_criteria} fullWidth />}
          </div>

          {/* Evidences */}
          <section>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
              Evidências ({p.evidences.length})
            </p>
            {p.evidences.length === 0 && !p.loading && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-2 text-xs text-yellow-400/80 mb-2">
                ⚠ Nenhuma evidência. Obrigatório para mover para Done.
              </div>
            )}
            <div className="space-y-1.5 mb-3">
              {p.evidences.map(ev => (
                <div key={ev.id} className="flex items-start gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs">
                  <span className="font-mono text-indigo-400 shrink-0 uppercase">{ev.evidence_type}</span>
                  <a
                    href={ev.content.startsWith("http") ? ev.content : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-300 truncate hover:text-indigo-300 transition-colors"
                  >
                    {ev.content}
                  </a>
                  {ev.note && <span className="text-zinc-600 ml-auto shrink-0 italic">{ev.note}</span>}
                </div>
              ))}
            </div>
            {/* Add evidence */}
            <div className="flex gap-2 flex-wrap">
              <select
                value={p.newEvidenceType}
                onChange={(e) => p.setNewEvidenceType(e.target.value as "print" | "log" | "link")}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300"
              >
                <option value="link">Link</option>
                <option value="print">Print</option>
                <option value="log">Log</option>
              </select>
              <input
                value={p.newEvidenceContent}
                onChange={(e) => p.setNewEvidenceContent(e.target.value)}
                placeholder="URL ou conteúdo..."
                className="flex-1 min-w-[160px] bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
              />
              <input
                value={p.newEvidenceNote}
                onChange={(e) => p.setNewEvidenceNote(e.target.value)}
                placeholder="Nota (opt)"
                className="w-28 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
              />
              <button
                onClick={p.onSubmitEvidence}
                disabled={p.submittingEvidence || !p.newEvidenceContent.trim()}
                className="bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 transition-colors"
              >
                {p.submittingEvidence ? "..." : "Anexar"}
              </button>
            </div>
          </section>

          {/* Updates feed */}
          <section>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
              Timeline de Updates ({p.updates.length})
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar mb-3 pr-1">
              {p.loading && <div className="h-8 bg-zinc-800 animate-pulse rounded-lg" />}
              {!p.loading && p.updates.length === 0 && (
                <p className="text-xs text-zinc-600 italic">Nenhum update registrado.</p>
              )}
              {p.updates.map(u => (
                <div key={u.id} className="flex gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs">
                  <span className={`font-mono uppercase border rounded px-1.5 py-0.5 text-[8px] shrink-0 self-start mt-0.5 ${updateTypeBadge[u.update_type] ?? ""}`}>
                    {u.update_type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-200 leading-snug">{u.message}</p>
                    <p className="text-[9px] text-zinc-600 mt-1 font-mono">
                      {u.author} · {new Date(u.created_at).toLocaleString("pt-BR")}
                      {u.progress != null && ` · ${u.progress}%`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {/* Add update */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={p.newUpdateType}
                  onChange={(e) => p.setNewUpdateType(e.target.value as "ACK" | "UPDATE" | "BLOCKED" | "DONE")}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300"
                >
                  <option value="ACK">ACK</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="BLOCKED">BLOCKED</option>
                  <option value="DONE">DONE</option>
                </select>
                <input
                  value={p.newUpdateAuthor}
                  onChange={(e) => p.setNewUpdateAuthor(e.target.value)}
                  placeholder="Autor"
                  className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                />
                <input
                  value={p.newUpdateProgress}
                  onChange={(e) => p.setNewUpdateProgress(e.target.value)}
                  placeholder="%"
                  type="number"
                  min={0}
                  max={100}
                  className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div className="flex gap-2">
                <textarea
                  value={p.newUpdateMsg}
                  onChange={(e) => p.setNewUpdateMsg(e.target.value)}
                  placeholder="Mensagem do update..."
                  rows={2}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                />
                <button
                  onClick={p.onSubmitUpdate}
                  disabled={p.submittingUpdate || !p.newUpdateMsg.trim()}
                  className="bg-blue-600/80 hover:bg-blue-500 text-white rounded-lg px-3 text-xs font-medium disabled:opacity-50 transition-colors self-stretch"
                >
                  {p.submittingUpdate ? "..." : "Registrar"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── New Task Modal ─────────────────────────────────────────────────────────────

type NewTaskState = {
  title: string; objective: string; type: TaskType;
  priority: string; owner: string; supporter: string;
  due_date: string; acceptance_criteria: string;
};

function NewTaskModal({ task, setTask, submitting, error, onClose, onSubmit }: {
  task: NewTaskState;
  setTask: (t: NewTaskState) => void;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const set = (k: keyof NewTaskState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setTask({ ...task, [k]: e.target.value });

  const isValid = task.title.trim() && task.objective.trim() && task.owner.trim() && task.acceptance_criteria.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-zinc-800 flex items-center justify-between p-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold">Nova Demanda</p>
            <h2 className="text-lg font-semibold text-zinc-100 mt-0.5">Criar DEM-*</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-3">
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3 text-sm text-red-300">⚠ {error}</div>
          )}

          <Field label="Título *">
            <input value={task.title} onChange={set("title")} placeholder="Ex: Revisar cron watchdog" className={INPUT} />
          </Field>
          <Field label="Objetivo *">
            <textarea value={task.objective} onChange={set("objective")} rows={2} placeholder="O que essa demanda resolve..." className={INPUT + " resize-none"} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo *">
              <select value={task.type} onChange={set("type")} className={INPUT}>
                <option value="code">Code</option>
                <option value="n8n">n8n</option>
                <option value="bug">Bug</option>
                <option value="improvement">Improvement</option>
              </select>
            </Field>
            <Field label="Prioridade *">
              <select value={task.priority} onChange={set("priority")} className={INPUT}>
                <option value="P0">P0 — Crítico</option>
                <option value="P1">P1 — Alta</option>
                <option value="P2">P2 — Normal</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner *">
              <input value={task.owner} onChange={set("owner")} placeholder="@handle ou nome" className={INPUT} />
            </Field>
            <Field label="Supporter">
              <input value={task.supporter} onChange={set("supporter")} placeholder="Opcional" className={INPUT} />
            </Field>
          </div>
          <Field label="Due Date">
            <input type="date" value={task.due_date} onChange={set("due_date")} className={INPUT} />
          </Field>
          <Field label="Critérios de Aceite *">
            <textarea value={task.acceptance_criteria} onChange={set("acceptance_criteria")} rows={3} placeholder="O que precisa ser verdade para considerar Done..." className={INPUT + " resize-none"} />
          </Field>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-zinc-700 text-zinc-400 rounded-lg py-2 text-sm hover:bg-white/[0.04] transition-colors">
              Cancelar
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting || !isValid}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {submitting ? "Criando..." : "Criar Demanda"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const INPUT = "w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

function MetaField({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5">{label}</p>
      <p className="text-zinc-300 leading-snug">{value}</p>
    </div>
  );
}
