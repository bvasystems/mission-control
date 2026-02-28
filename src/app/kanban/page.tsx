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
<main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
<div className="max-w-[1500px] mx-auto">
<div className="flex items-end justify-between mb-5">
<div>
<p className="text-xs uppercase tracking-wider text-zinc-400">Mission Control</p>
<h1 className="text-3xl font-semibold">Kanban Operacional</h1>
</div>
<button
onClick={refresh}
className="border border-zinc-700 rounded-xl px-4 py-2 text-sm hover:bg-zinc-900"
>
Atualizar
</button>
</div>

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
<section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-3 min-h-[420px]">
<div className="flex items-center justify-between mb-3">
<h2 className="font-medium">{title}</h2>
<span className="text-xs text-zinc-400">{tasks.length}</span>
</div>
<SortableContext items={tasks.map((t) => t.id)} strategy={rectSortingStrategy}>
<div className="space-y-2">
{tasks.map((t) => (
<TaskCard key={t.id} task={t} />
))}
</div>
</SortableContext>
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
className="cursor-grab active:cursor-grabbing rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
>
<p className="font-medium text-sm">{task.title}</p>
<p className="text-xs text-zinc-400 mt-1">
prioridade: {task.priority} • owner: {task.assigned_to || "-"}
</p>
</article>
);
}
