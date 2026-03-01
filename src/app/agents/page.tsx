"use client";

import { useEffect, useMemo, useState } from "react";

type AgentStatus = {
id: string;
name: string;
level: "L1" | "L2" | "L3" | "L4";
status: "active" | "idle" | "degraded" | "down";
last_seen: string | null;
messages_24h: number;
errors_24h: number;
updated_at: string;
};

type ReliabilityMeta = {
sla_rate?: number;
completion_rate?: number;
error_rate?: number;
avg_ack_min?: number;
sample_size?: number;
window_days?: number;
};

type AgentStat = {
id: string;
agent_id: string;
date: string;
messages_sent: number;
skills_used: number;
errors: number;
model_tokens_used: number;
uptime_hours: number;
reliability_score?: number;
reliability_meta?: ReliabilityMeta;
};

type Combined = AgentStatus & {
stat?: AgentStat;
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
const [rows, setRows] = useState<Combined[]>([]);
const [loading, setLoading] = useState(false);

async function refresh() {
setLoading(true);

const [statusRes, statsRes] = await Promise.all([
fetch("/api/dashboard/agents", { cache: "no-store" }),
fetch("/api/dashboard/stats", { cache: "no-store" }),
]);

const statusJson = await statusRes.json();
const statsJson = await statsRes.json();

const statuses: AgentStatus[] = statusJson.data ?? [];
const stats: AgentStat[] = statsJson.agent_stats ?? [];

const latestByAgent = new Map<string, AgentStat>();

const norm = (v?: string) => {
const s = (v || "").toLowerCase();
if (["jota", "faisca", "faísca", "main"].includes(s)) return "main";
if (s === "caio") return "caio";
if (["leticia", "letícia"].includes(s)) return "leticia";
return s;
};

for (const s of stats) {
const key = norm(s.agent_id);
if (!key) continue;
const prev = latestByAgent.get(key);
if (!prev || new Date(s.date) > new Date(prev.date)) {
latestByAgent.set(key, s);
}
}

const combined: Combined[] = statuses.map((s) => ({
...s,
stat: latestByAgent.get(s.id),
}));

setRows(combined);
setLoading(false);
}

  useEffect(() => {
    const t1 = setTimeout(refresh, 0);
    const t2 = setInterval(refresh, 30000);
    return () => { clearTimeout(t1); clearInterval(t2); };
  }, []);

const totals = useMemo(() => {
return {
total: rows.length,
degraded: rows.filter((r) => r.status === "degraded").length,
down: rows.filter((r) => r.status === "down").length,
errors: rows.reduce((acc, r) => acc + Number(r.stat?.errors ?? 0), 0),
msgs: rows.reduce((acc, r) => acc + Number(r.stat?.messages_sent ?? 0), 0),
tokens: rows.reduce((acc, r) => acc + Number(r.stat?.model_tokens_used ?? 0), 0),
};
}, [rows]);

return (
<main className="p-6 md:p-8">
<div className="flex items-end justify-between mb-5">
<div>
<p className="text-xs uppercase tracking-wider text-zinc-400">Mission Control</p>
<h1 className="text-3xl font-semibold">Telemetria de Agentes</h1>
<p className="text-zinc-400 text-sm">
Hierarquia, saúde e carga operacional dos agentes.
</p>
</div>
<button
onClick={refresh}
className="border border-zinc-700 rounded-xl px-4 py-2 text-sm hover:bg-zinc-900"
>
{loading ? "Atualizando..." : "Verificar frota"}
</button>
</div>

<section className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-5">
<Card title="Agentes ativos" value={String(totals.total)} />
<Card title="Sistemas degradados" value={String(totals.degraded)} />
<Card title="Sistemas caídos" value={String(totals.down)} />
<Card title="Erros (24h)" value={String(totals.errors)} />
<Card title="Mensagens (24h)" value={String(totals.msgs)} />
<Card title="Tokens (estim.)" value={String(totals.tokens)} />
</section>

<div className="border border-zinc-800 rounded-2xl overflow-hidden">
<table className="w-full text-sm">
<thead className="bg-zinc-900/60 text-zinc-400">
<tr>
<th className="text-left p-3">Agente IA</th>
<th className="text-left p-3">Clearance</th>
<th className="text-left p-3">Health</th>
<th className="text-left p-3">Reliability</th>
<th className="text-left p-3">Last Ping</th>
<th className="text-left p-3">Carga (msgs/24h)</th>
<th className="text-left p-3">Falhas (24h)</th>
<th className="text-left p-3">Tokens (estim.)</th>
<th className="text-left p-3">Uptime (h)</th>
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
<td className="p-3">
{(() => {
const score = r.stat?.reliability_score;
const meta = r.stat?.reliability_meta;
if (score == null) {
return <span className="text-zinc-500 font-mono">--</span>;
}
const s = Math.round(score);
let colorClass = "bg-red-500/20 text-red-300 border-red-500/40";
if (s >= 80) colorClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
else if (s >= 60) colorClass = "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";

const badge = (
<span className={`text-xs border rounded-full px-2 py-1 ${colorClass}`}>
{s}
</span>
);

if (!meta) return badge;

return (
<div className="group relative inline-block cursor-help">
{badge}
<div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 p-3 rounded-lg shadow-xl">
<p className="font-semibold mb-1 text-zinc-100">Métricas SLA</p>
<div className="space-y-1">
<p>SLA: <span className="text-zinc-100">{meta.sla_rate != null ? `${Math.round(meta.sla_rate)}%` : '--'}</span></p>
<p>Conclusão: <span className="text-zinc-100">{meta.completion_rate != null ? `${Math.round(meta.completion_rate)}%` : '--'}</span></p>
<p>Erro: <span className="text-zinc-100">{meta.error_rate != null ? `${Math.round(meta.error_rate)}%` : '--'}</span></p>
<p>ACK médio: <span className="text-zinc-100">{meta.avg_ack_min != null ? `${Math.round(meta.avg_ack_min)} min` : '--'}</span></p>
<p>Amostra: <span className="text-zinc-100">{meta.sample_size != null ? meta.sample_size : '--'}</span></p>
</div>
</div>
</div>
);
})()}
</td>
<td className="p-3 text-zinc-300">
{r.last_seen ? new Date(r.last_seen).toLocaleString() : "-"}
</td>
<td className="p-3 text-zinc-300">{r.stat?.messages_sent ?? 0}</td>
<td className={(r.stat?.errors ?? 0) > 0 ? "p-3 text-red-300" : "p-3 text-zinc-300"}>
{r.stat?.errors ?? 0}
</td>
<td className="p-3 text-zinc-300">{r.stat?.model_tokens_used ?? 0}</td>
<td className="p-3 text-zinc-300">{r.stat?.uptime_hours ?? 0}</td>
</tr>
))}
{rows.length === 0 && (
<tr>
<td colSpan={8} className="p-6 text-center text-zinc-500">
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
