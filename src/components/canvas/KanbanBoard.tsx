"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useDraggable } from "@dnd-kit/core";
import { CheckSquare, Square, Clock, ChevronRight, Check, X } from "lucide-react";

export interface KanbanTask {
  id: string;
  title: string;
  status: string;
  stage: string;
  priority?: string;
  label?: string;
  assigned_to?: string;
  progress?: number;
  deliverables?: string[];
  created_at?: string;
}

const COLUMNS: { id: string; label: string }[] = [
  { id: "inbox",       label: "Inbox" },
  { id: "assigned",    label: "Assigned" },
  { id: "in_progress", label: "In Progress" },
  { id: "review",      label: "Review" },
  { id: "done",        label: "Done" },
];

const PRIORITY_CFG: Record<string, { label: string; cls: string }> = {
  critical: { label: "URGENT", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  high:     { label: "HIGH",   cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  medium:   { label: "MED",    cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  low:      { label: "LOW",    cls: "bg-zinc-600/40 text-zinc-400 border-zinc-600/30" },
};

const LABEL_COLORS: Record<string, string> = {
  bug:     "bg-red-500/15 text-red-400",
  feature: "bg-blue-500/15 text-blue-400",
  docs:    "bg-purple-500/15 text-purple-400",
  infra:   "bg-amber-500/15 text-amber-400",
  task:    "bg-zinc-600/40 text-zinc-400",
};

const AGENT_COLORS: Record<string, string> = {
  caio:    "bg-blue-500/20 text-blue-300",
  faísca:  "bg-fuchsia-500/20 text-fuchsia-300",
  faisca:  "bg-fuchsia-500/20 text-fuchsia-300",
  letícia: "bg-indigo-500/20 text-indigo-300",
  leticia: "bg-indigo-500/20 text-indigo-300",
  jota:    "bg-purple-500/20 text-purple-300",
  clara:   "bg-emerald-500/20 text-emerald-300",
};

function relativeTime(d?: string) {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)}m`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)}d`;
}

// ─── Task Card ──────────────────────────────────────────────────────────────
function TaskCard({
  task,
  isOverlay = false,
  onApprove,
  onDecline,
}: {
  task: KanbanTask;
  isOverlay?: boolean;
  onApprove?: (id: string) => void;
  onDecline?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const pCfg = PRIORITY_CFG[task.priority ?? "low"] ?? PRIORITY_CFG.low;
  const agentKey = (task.assigned_to ?? "").toLowerCase();
  const agentColor = AGENT_COLORS[agentKey] ?? "bg-zinc-700/40 text-zinc-400";
  const agentInitial = (task.assigned_to ?? "?").charAt(0).toUpperCase();
  const labelCls = LABEL_COLORS[(task.label ?? "").toLowerCase()] ?? LABEL_COLORS.task;
  const deliverables = task.deliverables ?? [];
  const progress = task.progress ?? 0;
  const inReview = task.stage === "review";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`bg-zinc-900 border border-white/[0.07] rounded-xl p-3.5 space-y-3 cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
        isDragging && !isOverlay ? "opacity-30 scale-95" : "hover:border-white/[0.14] hover:bg-zinc-800/80"
      } ${isOverlay ? "shadow-2xl shadow-black/70 rotate-1 scale-105" : ""}`}
    >
      {/* Top row: priority + label + agent avatar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[9px] font-bold font-mono uppercase tracking-wider border rounded px-1.5 py-0.5 ${pCfg.cls}`}>
          {pCfg.label}
        </span>
        {task.label && (
          <span className={`text-[9px] font-medium uppercase tracking-wider rounded px-1.5 py-0.5 ${labelCls}`}>
            {task.label}
          </span>
        )}
        <div className="ml-auto shrink-0">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${agentColor}`}>
            {agentInitial}
          </div>
        </div>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-zinc-100 leading-snug">{task.title}</p>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Progresso</span>
          <span className="text-[9px] font-mono text-zinc-400">{progress}%</span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: progress >= 100 ? "#10b981" : progress >= 60 ? "#3b82f6" : "#6366f1",
            }}
          />
        </div>
      </div>

      {/* Deliverables */}
      {deliverables.length > 0 && (
        <div className="space-y-1">
          {deliverables.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-400">
              <Square size={11} className="mt-0.5 shrink-0 text-zinc-600" />
              <span className="leading-tight">{item}</span>
            </div>
          ))}
          {deliverables.length > 3 && (
            <p className="text-[10px] text-zinc-600 pl-4">+{deliverables.length - 3} mais</p>
          )}
        </div>
      )}

      {/* Footer: timestamp + review actions */}
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
        <div className="flex items-center gap-1 text-[10px] text-zinc-600">
          <Clock size={10} />
          {relativeTime(task.created_at)}
        </div>
        {inReview && onApprove && onDecline && (
          <div className="flex items-center gap-1.5">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onApprove(task.id); }}
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors flex items-center gap-0.5"
            >
              <Check size={10} /> OK
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDecline(task.id); }}
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors flex items-center gap-0.5"
            >
              <X size={10} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Column ──────────────────────────────────────────────────────────────────
function KanbanColumn({
  col,
  tasks,
  onApprove,
  onDecline,
}: {
  col: { id: string; label: string };
  tasks: KanbanTask[];
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div className={`flex flex-col min-w-[260px] max-w-[280px] flex-shrink-0 rounded-2xl border transition-colors ${isOver ? "border-blue-500/40 bg-blue-500/5" : "border-white/[0.06] bg-black/20"}`}>
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${
            col.id === "done" ? "bg-emerald-500" :
            col.id === "review" ? "bg-yellow-500" :
            col.id === "in_progress" ? "bg-blue-500" :
            "bg-zinc-500"
          }`} />
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">{col.label}</h3>
        </div>
        <span className="text-[11px] font-mono text-zinc-500 bg-zinc-800/60 rounded px-2 py-0.5">{tasks.length}</span>
      </div>

      {/* Cards */}
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[120px]">
        {tasks.length === 0 && (
          <div className="border border-dashed border-white/[0.07] rounded-xl h-20 flex items-center justify-center text-xs text-zinc-600 italic">
            Sem tasks
          </div>
        )}
        {tasks.map(t => (
          <TaskCard key={t.id} task={t} onApprove={onApprove} onDecline={onDecline} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────
export function KanbanBoard() {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/tasks");
      const json = await res.json();
      setTasks(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function getColumnId(task: KanbanTask): string {
    const s = (task.stage ?? task.status ?? "").toLowerCase();
    if (s === "done" || task.status === "done") return "done";
    if (s === "review") return "review";
    if (s === "in_progress") return "in_progress";
    if (s === "assigned") return "assigned";
    return "inbox";
  }

  function onDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find(t => t.id === e.active.id) ?? null);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const targetCol = over.id as string;
    const task = tasks.find(t => t.id === active.id);
    if (!task) return;
    if (getColumnId(task) === targetCol) return;

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === task.id ? { ...t, stage: targetCol, status: targetCol === "done" ? "done" : "queued" } : t
    ));

    // Persist
    await fetch(`/api/dashboard/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: targetCol, status: targetCol === "done" ? "done" : "queued" }),
    }).catch(console.error);
  }

  async function handleApprove(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, stage: "done", status: "done", progress: 100 } : t));
    await fetch(`/api/dashboard/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "done", status: "done", progress: 100 }),
    }).catch(console.error);
  }

  async function handleDecline(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, stage: "in_progress" } : t));
    await fetch(`/api/dashboard/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "in_progress" }),
    }).catch(console.error);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 text-sm animate-pulse">Carregando tasks...</div>
      </div>
    );
  }

  const tasksByColumn = Object.fromEntries(
    COLUMNS.map(col => [col.id, tasks.filter(t => getColumnId(t) === col.id)])
  );

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto px-6 py-4 pb-2">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            col={col}
            tasks={tasksByColumn[col.id] ?? []}
            onApprove={handleApprove}
            onDecline={handleDecline}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <TaskCard task={activeTask} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
