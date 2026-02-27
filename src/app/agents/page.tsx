"use client";

import { useEffect, useMemo, useState } from "react";

type AgentRow = {
id: string;
name: string;
level: "L1" | "L2" | "L3" | "L4";
status: "active" | "idle" | "degraded" | "down";
last_seen: string | null;
messages_24h: number;
errors_24h: number;
updated_at: string;
};

const statusBadge = {
active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
idle: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
degraded: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
down: "bg-red-500/20 text-red-300 border-red-500/40",
};

const levelBadge = {
L1: "bg-blue-500/20 text-blue-300 border-blue-500/40",
L2: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
L3: "bg-purple-500/20 text-purple-300 border-purple-500/40",
L4: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
};

export default function AgentsPage() {
const [rows, setRows] = useState<AgentRow[]>([]);
const [loading, setLoading] = useState(false);

async function refresh() {
setLoading(true);
const res = await fetch("/api/dashboard/agents", { cache: "no-store" });
const json = await res.json();
setRows(json.data ?? []);
setLoading(false);
}

useEffect(() => {
refresh();
const t = setInterval(refresh, 30000);
return () => clearInterval(t);
}, []);

const totals = useMemo(() => {
return {
total: rows.length,
degraded: rows.filter((r) => r.status === "degraded").length,
down: rows.filter((r) => r.status === "down").length,
errors: rows.reduce((acc, r) => acc + (r.errors_24h || 0), 0),
};
}, [rows]);
return (
<main className="p-6 md:p-8">
<div className="flex items-end justify-between mb-5">
<div>
<p className="text-xs uppercase tracking-wider text-zinc-400">Mission Control</p>
<h1 className="text-3xl font-semibold">Agents</h1>
<p className="text-zinc-400 text-sm">Nível, saúde e desempenho dos agentes.</p>
</div>
<button
onClick={refresh}
className="border border-zinc-700 rounded-xl px-4 py-2 text-sm hover:bg-zinc-900"
>
{loading ? "Atualizando..." : "Atualizar"}
</button>
</div>

<section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
<Card title="Total" value={String(totals.total)} />
<Card title="Degraded" value={String(totals.degraded)} />
<Card title="Down" value={String(totals.down)} />
<Card title="Errors 24h" value={String(totals.errors)} />
</section>

<div className="border border-zinc-800 rounded-2xl overflow-hidden">
<table className="w-full text-sm">
<thead className="bg-zinc-900/60 text-zinc-400">
<tr>
<th className="text-left p-3">Agent</th>
<th className="text-left p-3">Level</th>
<th className="text-left p-3">Status</th>
<th className="text-left p-3">Last Seen</th>
<th className="text-left p-3">Msgs 24h</th>
<th className="text-left p-3">Errors 24h</th>
</tr>
</thead>
<tbody>
{rows.map((r) => (
<tr key={r.id} className="border-t border-zinc-800">
<td className="p-3">
<p className="font-medium">{r.name}</p>
<p className="text-xs text-zinc-500">{r.id}</p>
</td>
<td className="p-3">
<span className={`text-xs border rounded-full px-2 py-1 ${levelBadge[r.level]}`}>
{r.level}
</span>
</td>
<td className="p-3">
<span className={`text-xs border rounded-full px-2 py-1 ${statusBadge[r.status]}`}>
{r.status}
</span>
</td>
<td className="p-3 text-zinc-300">
{r.last_seen ? new Date(r.last_seen).toLocaleString() : "-"}
</td>
<td className="p-3 text-zinc-300">{r.messages_24h}</td>
<td className={r.errors_24h > 0 ? "p-3 text-red-300" : "p-3 text-zinc-300"}>
{r.errors_24h}
</td>
</tr>
))}
{rows.length === 0 && (
<tr>
<td colSpan={6} className="p-6 text-center text-zinc-500">
Sem dados de agentes ainda.
</td>
</tr>
)}
</tbody>
</table>
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
