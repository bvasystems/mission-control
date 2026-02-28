"use client";

import { useEffect, useMemo, useState } from "react";
import {
DndContext,
DragEndEvent,
PointerSensor,
useSensor,
useSensors,
} from "@dnd-kit/core";
import {
SortableContext,
arrayMove,
rectSortingStrategy,
useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Column = "backlog" | "in_progress" | "blocked" | "validation" | "done";

type Task = {
id: string;
title: string;
priority: "low" | "medium" | "high" | "critical";
assigned_to?: string | null;
column: Column;
position: number;
};

const columns: { key: Column; label: string }[] = [
{ key: "backlog", label: "Backlog" },
{ key: "in_progress", label: "Em execução" },
{ key: "blocked", label: "Bloqueado" },
{ key: "validation", label: "Entregue p/ validação" },
{ key: "done", label: "Concluído" },
];

export default function KanbanPage() {
const [tasks, setTasks] = useState<Task[]>([]);
const sensors = useSensors(useSensor(PointerSensor));

async function refresh() {
const res = await fetch("/api/kanban?board=geral", { cache: "no-store" });
const json = await res.json();
setTasks(json.data ?? []);
}

useEffect(() => {
const t1 = setTimeout(refresh, 0);
return () => clearTimeout(t1);
}, []);

const grouped = useMemo(() => {
const map: Record<Column, Task[]> = {
backlog: [],
in_progress: [],
blocked: [],
validation: [],
done: [],
};
for (const t of tasks) map[t.column].push(t);
for (const col of columns) {
map[col.key].sort((a, b) => a.position - b.position);
}
return map;
}, [tasks]);

async function persistMove(id: string, column: Column, position: number) {
await fetch("/api/kanban/move", {
method: "POST",
headers: { "content-type": "application/json" },
body: JSON.stringify({ id, column, position }),
});
}

async function onDragEnd(event: DragEndEvent) {
const { active, over } = event;
if (!over || active.id === over.id) return;

const activeId = String(active.id);
const overId = String(over.id);

const activeTask = tasks.find((t) => t.id === activeId);
const overTask = tasks.find((t) => t.id === overId);
if (!activeTask || !overTask) return;

const fromCol = activeTask.column;
const toCol = overTask.column;

if (fromCol === toCol) {
const colTasks = grouped[fromCol];
const oldIndex = colTasks.findIndex((t) => t.id === activeId);
const newIndex = colTasks.findIndex((t) => t.id === overId);
const reordered = arrayMove(colTasks, oldIndex, newIndex);

const updated = tasks.map((t) => {
const idx = reordered.findIndex((x) => x.id === t.id);
if (idx >= 0) return { ...t, position: idx };
return t;
});

setTasks(updated);
await Promise.all(reordered.map((t, idx) => persistMove(t.id, fromCol, idx)));
return;
}

// Cross-column move
const fromList = [...grouped[fromCol]].filter((t) => t.id !== activeId);
const toList = [...grouped[toCol]];
const insertIndex = toList.findIndex((t) => t.id === overId);
const movedTask: Task = { ...activeTask, column: toCol };
toList.splice(insertIndex >= 0 ? insertIndex : toList.length, 0, movedTask);

const nextTasks = tasks.map((t) => {
if (t.id === movedTask.id) return { ...t, column: toCol };
return t;
});

// Reindex positions in both columns
const reindexed = nextTasks.map((t) => {
if (t.column === fromCol) {
const idx = fromList.findIndex((x) => x.id === t.id);
if (idx >= 0) return { ...t, position: idx };
}
if (t.column === toCol) {
const idx = toList.findIndex((x) => x.id === t.id);
if (idx >= 0) return { ...t, position: idx };
}
return t;
});

setTasks(reindexed);

await Promise.all([
...fromList.map((t, idx) => persistMove(t.id, fromCol, idx)),
...toList.map((t, idx) => persistMove(t.id, toCol, idx)),
]);
}
  return (
    <main className="min-h-screen text-zinc-100 p-6 md:p-10 relative">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-[1600px] mx-auto relative z-10">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-semibold mb-2">Fluxo de Trabalho</p>
            <h1 className="text-3xl font-medium tracking-tight">Kanban Operacional</h1>
          </div>
          <button
            onClick={refresh}
            className="border border-blue-500/30 bg-blue-500/10 text-blue-400 rounded-lg px-4 py-2 text-xs uppercase tracking-wider font-medium hover:bg-blue-500/20 transition-colors"
          >
            Sincronizar
          </button>
        </header>

        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {columns.map((col) => (
              <ColumnView key={col.key} title={col.label} tasks={grouped[col.key]} />
            ))}
          </div>
        </DndContext>
      </div>
    </main>
  );
}

function ColumnView({ title, tasks }: { title: string; tasks: Task[] }) {
  return (
    <section className="glass rounded-2xl p-4 flex flex-col h-[calc(100vh-200px)] border-t-[3px] border-t-white/10">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
        <h2 className="font-medium text-sm text-zinc-300 tracking-wide">{title}</h2>
        <span className="text-[10px] bg-white/5 border border-white/10 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        <SortableContext items={tasks.map((t) => t.id)} strategy={rectSortingStrategy}>
          <div className="space-y-3 min-h-[100px]">
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        </SortableContext>
      </div>
    </section>
  );
}

function TaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing rounded-xl border border-white/5 bg-black/60 hover:bg-black/80 p-4 transition-colors shadow-lg shadow-black/20 group hover:border-blue-500/30 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/0 group-hover:bg-blue-500/50 transition-colors"></div>
      <p className="font-medium text-sm text-zinc-200 leading-snug">{task.title}</p>
      <div className="flex items-center justify-between mt-3">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
          <span className="font-mono text-blue-400/80">{task.assigned_to || "unassigned"}</span>
        </p>
        <span className={`text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded ${task.priority === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : task.priority === 'high' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-white/5 text-zinc-400'}`}>
          {task.priority}
        </span>
      </div>
    </article>
  );
}
