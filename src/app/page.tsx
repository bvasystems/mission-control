"use client";

import { useEffect, useMemo, useState } from "react";

type TaskStatus = "pending" | "done" | "blocked";
type HealthStatus = "healthy" | "degraded" | "down";

type Task = {
id: string;
title: string;
status: TaskStatus;
priority: "low" | "medium" | "high" | "critical";
assigned_to?: string | null;
due_date?: string | null;
created_at?: string;
};

type Health = {
id: string;
service: string;
status: HealthStatus;
last_check: string;
uptime_pct?: number | null;
};

type AgentStat = {
id: string;
date: string;
messages_sent: number;
skills_used: number;
errors: number;
model_tokens_used: number;
uptime_hours: number;
};

type StatsPayload = {
ok: boolean;
tasks: Array<{ status: TaskStatus }>;
health: Health[];
agent_stats: AgentStat[];
};

const badge = {
pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
done: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
blocked: "bg-red-500/20 text-red-300 border-red-500/40",
healthy: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
degraded: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
down: "bg-red-500/20 text-red-300 border-red-500/40",
};

export default function Page() {
const [title, setTitle] = useState("");
const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
const [assignedTo, setAssignedTo] = useState("caio");
const [loading, setLoading] = useState(false);

const [taskList, setTaskList] = useState<Task[]>([]);
const [healthList, setHealthList] = useState<Health[]>([]);
const [agentStats, setAgentStats] = useState<AgentStat[]>([]);

async function refresh() {
const statsRes = await fetch("/api/dashboard/stats", { cache: "no-store" });
const stats: StatsPayload = await statsRes.json();

setHealthList(stats.health ?? []);
setAgentStats(stats.agent_stats ?? []);

const tasksRes = await fetch("/api/dashboard/tasks", { cache: "no-store" }).catch(() => null);
if (tasksRes?.ok) {
const t = await tasksRes.json();
setTaskList(t.data ?? []);
}
}

async function createTask() {
if (!title.trim()) return;
setLoading(true);
await fetch("/api/dashboard/task", {
method: "POST",
headers: { "content-type": "application/json" },
body: JSON.stringify({
title: title.trim(),
priority,
assigned_to: assignedTo || null,
}),
});
setTitle("");
setLoading(false);
await refresh();
}

async function updateTask(id: string, status: TaskStatus) {
await fetch("/api/dashboard/task", {
method: "POST",
headers: { "content-type": "application/json" },
body: JSON.stringify({ id, status }),
});
await refresh();
}

const summary = useMemo(() => {
const counts = { pending: 0, done: 0, blocked: 0 };
taskList.forEach((t) => counts[t.status]++);
return counts;
}, [taskList]);

useEffect(() => {
refresh();
const timer = setInterval(refresh, 20000);
return () => clearInterval(timer);
}, []);
return (
<main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10">
<div className="max-w-7xl mx-auto space-y-6">
<header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
<div>
<p className="text-xs uppercase tracking-wider text-zinc-400">Mission Control</p>
<h1 className="text-3xl font-semibold">Painel Operacional</h1>
<p className="text-zinc-400 text-sm">
Founder + Dev view: execução, risco, saúde de serviços e ritmo do time.
</p>
</div>
<button
onClick={refresh}
className="border border-zinc-700 rounded-xl px-4 py-2 text-sm hover:bg-zinc-900"
>
Atualizar agora
</button>
</header>

{/* KPI cards */}
<section className="grid grid-cols-1 md:grid-cols-4 gap-4">
<Card title="Pending" value={String(summary.pending)} />
<Card title="Done" value={String(summary.done)} />
<Card title="Blocked" value={String(summary.blocked)} />
<Card title="Health Checks" value={String(healthList.length)} />
</section>

{/* Create task */}
<section className="border border-zinc-800 rounded-2xl p-4 md:p-5 bg-zinc-900/40">
<h2 className="text-lg font-medium mb-3">Nova Task</h2>
<div className="grid grid-cols-1 md:grid-cols-12 gap-3">
<input
className="md:col-span-6 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2"
placeholder="Ex: Revisar cron watchdog com retry x3"
value={title}
onChange={(e) => setTitle(e.target.value)}
/>
<select
className="md:col-span-2 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2"
value={priority}
onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high" | "critical")}
>
<option value="low">low</option>
<option value="medium">medium</option>
<option value="high">high</option>
<option value="critical">critical</option>
</select>
<input
className="md:col-span-2 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2"
placeholder="assigned_to"
value={assignedTo}
onChange={(e) => setAssignedTo(e.target.value)}
/>
<button
onClick={createTask}
disabled={loading}
className="md:col-span-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-2"
>
{loading ? "Criando..." : "Criar task"}
</button>
</div>
</section>

{/* Tasks + Health */}
<section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
<div className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900/40">
<h2 className="text-lg font-medium mb-3">Tasks</h2>
<div className="space-y-2 max-h-[420px] overflow-auto pr-1">
{taskList.length === 0 && <p className="text-sm text-zinc-400">Sem tasks ainda.</p>}
{taskList.map((t) => (
<div key={t.id} className="border border-zinc-800 rounded-xl p-3 bg-zinc-950/60">
<div className="flex items-start justify-between gap-3">
<div>
<p className="font-medium">{t.title}</p>
<p className="text-xs text-zinc-400">
prioridade: <b>{t.priority}</b> • owner: <b>{t.assigned_to || "-"}</b>
</p>
</div>
<span className={`text-xs border rounded-full px-2 py-1 ${badge[t.status]}`}>
{t.status}
</span>
</div>
<div className="flex gap-2 mt-3">
<button
onClick={() => updateTask(t.id, "pending")}
className="text-xs border border-zinc-700 rounded-lg px-2 py-1 hover:bg-zinc-900"
>
pending
</button>
<button
onClick={() => updateTask(t.id, "done")}
className="text-xs border border-zinc-700 rounded-lg px-2 py-1 hover:bg-zinc-900"
>
done
</button>
<button
onClick={() => updateTask(t.id, "blocked")}
className="text-xs border border-zinc-700 rounded-lg px-2 py-1 hover:bg-zinc-900"
>
blocked
</button>
</div>
</div>
))}
</div>
</div>

<div className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900/40">
<h2 className="text-lg font-medium mb-3">Health Checks</h2>
<div className="space-y-2 max-h-[420px] overflow-auto pr-1">
{healthList.length === 0 && (
<p className="text-sm text-zinc-400">Sem health checks ainda.</p>
)}
{healthList.map((h) => (
<div key={h.id} className="border border-zinc-800 rounded-xl p-3 bg-zinc-950/60">
<div className="flex items-start justify-between gap-3">
<div>
<p className="font-medium">{h.service}</p>
<p className="text-xs text-zinc-400">
{new Date(h.last_check).toLocaleString()} • uptime:{" "}
{h.uptime_pct != null ? `${h.uptime_pct}%` : "-"}
</p>
</div>
<span className={`text-xs border rounded-full px-2 py-1 ${badge[h.status]}`}>
{h.status}
</span>
</div>
</div>
))}
</div>
</div>
</section>

{/* Agent stats */}
<section className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900/40">
<h2 className="text-lg font-medium mb-3">Agent Stats (últimos 7 dias)</h2>
<div className="overflow-auto">
<table className="w-full text-sm">
<thead className="text-zinc-400">
<tr>
<th className="text-left p-2">date</th>
<th className="text-left p-2">messages</th>
<th className="text-left p-2">skills</th>
<th className="text-left p-2">errors</th>
<th className="text-left p-2">tokens</th>
<th className="text-left p-2">uptime(h)</th>
</tr>
</thead>
<tbody>
{agentStats.map((s) => (
<tr key={s.id} className="border-t border-zinc-800">
<td className="p-2">{s.date}</td>
<td className="p-2">{s.messages_sent}</td>
<td className="p-2">{s.skills_used}</td>
<td className="p-2">{s.errors}</td>
<td className="p-2">{s.model_tokens_used}</td>
<td className="p-2">{s.uptime_hours}</td>
</tr>
))}
</tbody>
</table>
</div>
</section>
</div>
</main>
);
}

function Card({ title, value }: { title: string; value: string }) {
return (
<div className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900/40">
<p className="text-xs uppercase tracking-wide text-zinc-400">{title}</p>
<p className="text-2xl font-semibold mt-1">{value}</p>
</div>
);
}
