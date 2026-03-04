"use client";

import { useEffect, useMemo, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, Check, X, Square, RefreshCw } from "lucide-react";

type Column = "backlog" | "in_progress" | "blocked" | "validation" | "done";

type Task = {
  id: string;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  assigned_to?: string | null;
  column: Column;
  position: number;
  project_key?: string | null;
  deliverables?: string[];
  progress?: number;
  label?: string;
  created_at?: string;
};

const columns: { key: Column; label: string; color: string }[] = [
  { key: "backlog",    label: "Backlog",              color: "border-t-zinc-600" },
  { key: "in_progress",label: "Em Execução",          color: "border-t-blue-500" },
  { key: "blocked",   label: "Bloqueado",             color: "border-t-red-500" },
  { key: "validation",label: "Validação",             color: "border-t-yellow-500" },
  { key: "done",      label: "Concluído",             color: "border-t-emerald-500" },
];

const PRIORITY: Record<string, { label: string; cls: string }> = {
  critical: { label: "URGENT", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  high:     { label: "HIGH",   cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  medium:   { label: "MED",    cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  low:      { label: "LOW",    cls: "bg-zinc-700/60 text-zinc-500 border-zinc-600/30" },
};

const LABEL_CLS: Record<string, string> = {
  bug:     "bg-red-500/15 text-red-400",
  feature: "bg-blue-500/15 text-blue-400",
  docs:    "bg-purple-500/15 text-purple-400",
  infra:   "bg-amber-500/15 text-amber-400",
};

const AGENT_COLOR: Record<string, string> = {
  caio:    "bg-blue-500/25 text-blue-300 ring-blue-500/30",
  faísca:  "bg-fuchsia-500/25 text-fuchsia-300 ring-fuchsia-500/30",
  faisca:  "bg-fuchsia-500/25 text-fuchsia-300 ring-fuchsia-500/30",
  letícia: "bg-indigo-500/25 text-indigo-300 ring-indigo-500/30",
  leticia: "bg-indigo-500/25 text-indigo-300 ring-indigo-500/30",
  jota:    "bg-purple-500/25 text-purple-300 ring-purple-500/30",
  clara:   "bg-emerald-500/25 text-emerald-300 ring-emerald-500/30",
};

function relTime(d?: string) {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)}m`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)}d`;
}

// ─── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  inValidation,
  onApprove,
  onDecline,
}: {
  task: Task;
  inValidation?: boolean;
  onApprove?: (id: string) => void;
  onDecline?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const pCfg = PRIORITY[task.priority] ?? PRIORITY.low;
  const agentKey = (task.assigned_to ?? "").toLowerCase();
  const agentColor = AGENT_COLOR[agentKey] ?? "bg-zinc-700/40 text-zinc-400 ring-zinc-600/30";
  const agentInitial = (task.assigned_to ?? "?").charAt(0).toUpperCase();
  const labelCls = LABEL_CLS[(task.label ?? "").toLowerCase()] ?? "bg-zinc-700/40 text-zinc-500";
  const deliverables = task.deliverables ?? [];
  const progress = task.progress ?? 0;

  const progressColor =
    progress >= 100 ? "#10b981" :
    progress >= 60  ? "#3b82f6" :
    progress >= 30  ? "#6366f1" : "#71717a";

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing rounded-xl border bg-zinc-900/90 p-4 space-y-3 transition-all duration-150 select-none group
        ${isDragging ? "opacity-30 scale-95 border-white/5" : "border-white/[0.07] hover:border-white/[0.16] hover:bg-zinc-800/80"}
      `}
    >
      {/* Row 1: Priority badge + Label + Agent avatar */}
      <div className="flex items-center gap-2">
        <span className={`text-[9px] font-bold font-mono uppercase tracking-wider border rounded px-1.5 py-0.5 ${pCfg.cls}`}>
          {pCfg.label}
        </span>
        {task.label && (
          <span className={`text-[9px] font-medium uppercase tracking-wider rounded px-1.5 py-0.5 ${labelCls}`}>
            {task.label}
          </span>
        )}
        <div className="ml-auto shrink-0">
          <div
            title={task.assigned_to ?? "Unassigned"}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ring-1 ${agentColor}`}
          >
            {agentInitial}
          </div>
        </div>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-zinc-100 leading-snug">{task.title}</p>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-[9px] text-zinc-600 uppercase tracking-wider">Progresso</span>
          <span className="text-[9px] font-mono text-zinc-500">{progress}%</span>
        </div>
        <div className="h-[3px] bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: progressColor }}
          />
        </div>
      </div>

      {/* Deliverables checklist */}
      {deliverables.length > 0 && (
        <div className="space-y-1 pt-0.5">
          {deliverables.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-500">
              <Square size={10} className="mt-[2px] shrink-0 text-zinc-700" />
              <span className="leading-tight">{item}</span>
            </div>
          ))}
          {deliverables.length > 3 && (
            <p className="text-[10px] text-zinc-700 pl-4">+{deliverables.length - 3} mais</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.05]">
        <div className="flex items-center gap-1 text-[10px] text-zinc-600">
          <Clock size={10} />
          {relTime(task.created_at)}
        </div>

        {/* Validation actions */}
        {inValidation && onApprove && onDecline && (
          <div className="flex items-center gap-1.5">
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onApprove(task.id); }}
              className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors"
            >
              <Check size={10} /> Approve
            </button>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onDecline(task.id); }}
              className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors"
            >
              <X size={10} /> Decline
            </button>
          </div>
        )}

        {task.project_key && !inValidation && (
          <span className="text-[9px] font-mono text-indigo-400/60">{task.project_key}</span>
        )}
      </div>
    </article>
  );
}

// ─── Column ────────────────────────────────────────────────────────────────────
function ColumnView({
  col,
  tasks,
  onApprove,
  onDecline,
}: {
  col: typeof columns[number];
  tasks: Task[];
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });

  return (
    <section
      className={`glass rounded-2xl p-4 flex flex-col h-[calc(100vh-220px)] border-t-[3px] transition-colors ${col.color} ${
        isOver ? "bg-white/[0.03]" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.07] shrink-0">
        <h2 className="font-medium text-sm text-zinc-300 tracking-wide">{col.label}</h2>
        <span className="text-[10px] bg-white/5 border border-white/10 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
          {tasks.length}
        </span>
      </div>

      <div ref={setNodeRef} className="flex-1 overflow-y-auto pr-0.5 space-y-2.5 min-h-[80px]">
        <SortableContext items={tasks.map(t => t.id)} strategy={rectSortingStrategy}>
          {tasks.length === 0 && (
            <div className="border border-dashed border-white/[0.06] rounded-xl h-16 flex items-center justify-center text-[11px] text-zinc-700 italic">
              Sem tarefas
            </div>
          )}
          {tasks.map(t => (
            <TaskCard
              key={t.id}
              task={t}
              inValidation={col.key === "validation"}
              onApprove={onApprove}
              onDecline={onDecline}
            />
          ))}
        </SortableContext>
      </div>
    </section>
  );
}

// ─── Inner page ────────────────────────────────────────────────────────────────
function KanbanInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectKeyParam = searchParams.get("project_key") ?? searchParams.get("project") ?? null;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const buildUrl = useCallback((pk: string | null) => {
    if (pk) return `/api/kanban?project_key=${encodeURIComponent(pk)}`;
    return "/api/kanban?board=geral";
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(buildUrl(projectKeyParam), { cache: "no-store" });
      const json = await res.json();
      setTasks(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectKeyParam, buildUrl]);

  useEffect(() => { refresh(); }, [refresh]);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(columns.map(c => [c.key, [] as Task[]])) as Record<Column, Task[]>;
    for (const t of tasks) {
      if (map[t.column]) map[t.column].push(t);
    }
    for (const col of columns) map[col.key].sort((a, b) => a.position - b.position);
    return map;
  }, [tasks]);

  async function persistMove(id: string, column: Column, position: number) {
    await fetch("/api/kanban/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, column, position }),
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find(t => t.id === String(e.active.id)) ?? null);
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId   = String(over.id);
    const activeTask = tasks.find(t => t.id === activeId);
    const overTask   = tasks.find(t => t.id === overId);
    if (!activeTask || !overTask) return;

    const fromCol = activeTask.column;
    const toCol   = overTask.column;

    if (fromCol === toCol) {
      const col = grouped[fromCol];
      const reordered = arrayMove(col, col.findIndex(t => t.id === activeId), col.findIndex(t => t.id === overId));
      setTasks(tasks.map(t => {
        const idx = reordered.findIndex(x => x.id === t.id);
        return idx >= 0 ? { ...t, position: idx } : t;
      }));
      await Promise.all(reordered.map((t, i) => persistMove(t.id, fromCol, i)));
      return;
    }

    const fromList = [...grouped[fromCol]].filter(t => t.id !== activeId);
    const toList   = [...grouped[toCol]];
    const insertAt = toList.findIndex(t => t.id === overId);
    toList.splice(insertAt >= 0 ? insertAt : toList.length, 0, { ...activeTask, column: toCol });

    setTasks(tasks.map(t => {
      if (t.id === activeId) return { ...t, column: toCol };
      const fi = fromList.findIndex(x => x.id === t.id);
      if (fi >= 0) return { ...t, position: fi };
      const ti = toList.findIndex(x => x.id === t.id);
      if (ti >= 0) return { ...t, position: ti };
      return t;
    }));

    await Promise.all([
      ...fromList.map((t, i) => persistMove(t.id, fromCol, i)),
      ...toList.map((t, i)   => persistMove(t.id, toCol, i)),
    ]);
  }

  async function handleApprove(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, column: "done", progress: 100 } : t));
    await fetch(`/api/dashboard/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "done", status: "done", progress: 100 }),
    }).catch(console.error);
    await fetch("/api/kanban/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, column: "done", position: 999 }),
    }).catch(console.error);
  }

  async function handleDecline(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, column: "in_progress" } : t));
    await fetch("/api/kanban/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, column: "in_progress", position: 999 }),
    }).catch(console.error);
  }

  return (
    <main className="min-h-full text-zinc-100 p-6 md:p-8 relative">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/8 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-[1600px] mx-auto relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-semibold mb-1">Fluxo de Trabalho</p>
            <h1 className="text-3xl font-medium tracking-tight">Kanban Operacional</h1>
          </div>
          <div className="flex items-center gap-3">
            {projectKeyParam && (
              <div className="flex items-center gap-2 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs rounded-lg px-3 py-1.5">
                <span className="text-indigo-500">⬡</span>
                <span className="font-mono font-medium">{projectKeyParam}</span>
                <button onClick={() => router.push("/kanban")} className="text-indigo-500 hover:text-indigo-200 ml-1" title="Limpar filtro">✕</button>
              </div>
            )}
            <button
              onClick={refresh}
              className="flex items-center gap-2 border border-blue-500/30 bg-blue-500/10 text-blue-400 rounded-lg px-4 py-2 text-xs uppercase tracking-wider font-medium hover:bg-blue-500/20 transition-colors"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Sincronizar
            </button>
          </div>
        </header>

        {/* Board */}
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {columns.map(col => (
              <ColumnView
                key={col.key}
                col={col}
                tasks={grouped[col.key]}
                onApprove={handleApprove}
                onDecline={handleDecline}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <TaskCard task={activeTask} inValidation={activeTask.column === "validation"} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </main>
  );
}

export default function KanbanPage() {
  return (
    <Suspense fallback={
      <main className="min-h-full text-zinc-100 p-6 md:p-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="h-8 w-48 bg-zinc-800 animate-pulse rounded mb-8" />
          <div className="grid grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => <div key={i} className="glass rounded-2xl h-96 animate-pulse" />)}
          </div>
        </div>
      </main>
    }>
      <KanbanInner />
    </Suspense>
  );
}
