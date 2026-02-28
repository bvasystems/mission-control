"use client";

import { useEffect, useMemo, useState } from "react";

type Severity = "low" | "medium" | "high" | "critical";
type IncidentStatus = "open" | "investigating" | "mitigated" | "closed";

type Incident = {
id: string;
title: string;
severity: Severity;
status: IncidentStatus;
owner: string | null;
source: string | null;
impact: string | null;
next_action: string | null;
created_at: string;
updated_at: string;
};

const sevBadge = {
low: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
medium: "bg-blue-500/20 text-blue-300 border-blue-500/40",
high: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
critical: "bg-red-500/20 text-red-300 border-red-500/40",
};

const stBadge = {
open: "bg-red-500/20 text-red-300 border-red-500/40",
investigating: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
mitigated: "bg-blue-500/20 text-blue-300 border-blue-500/40",
closed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};

export default function IncidentsPage() {
const [rows, setRows] = useState<Incident[]>([]);
const [loading, setLoading] = useState(false);

const [title, setTitle] = useState("");
const [severity, setSeverity] = useState<Severity>("medium");
const [owner, setOwner] = useState("leticia");
const [source, setSource] = useState("n8n");

async function refresh() {
setLoading(true);
const res = await fetch("/api/dashboard/incidents", { cache: "no-store" });
const json = await res.json();
setRows(json.data ?? []);
setLoading(false);
}

useEffect(() => {
const t1 = setTimeout(refresh, 0);
const t2 = setInterval(refresh, 30000);
return () => { clearTimeout(t1); clearInterval(t2); };
}, []);

async function createIncident() {
if (!title.trim()) return;
await fetch("/api/dashboard/incidents", {
method: "POST",
headers: { "content-type": "application/json" },
body: JSON.stringify({
title: title.trim(),
severity,
owner,
source,
}),
});
setTitle("");
await refresh();
}

async function updateStatus(id: string, status: IncidentStatus) {
await fetch("/api/dashboard/incidents", {
method: "POST",
headers: { "content-type": "application/json" },
body: JSON.stringify({ id, status }),
});
await refresh();
}

const counters = useMemo(() => {
return {
total: rows.length,
open: rows.filter((r) => r.status === "open").length,
critical: rows.filter((r) => r.severity === "critical").length,
investigating: rows.filter((r) => r.status === "investigating").length,
};
}, [rows]);
return (
<main className="p-6 md:p-8">
<div className="flex items-end justify-between mb-5">
<div>
<p className="text-xs uppercase tracking-wider text-zinc-400">Mission Control</p>
<h1 className="text-3xl font-semibold">Incidents</h1>
<p className="text-zinc-400 text-sm">Monitoramento de incidentes e mitigação.</p>
</div>
<button
onClick={refresh}
className="border border-zinc-700 rounded-xl px-4 py-2 text-sm hover:bg-zinc-900"
>
{loading ? "Atualizando..." : "Atualizar"}
</button>
</div>

<section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
<Card title="Total" value={String(counters.total)} />
<Card title="Open" value={String(counters.open)} />
<Card title="Critical" value={String(counters.critical)} />
<Card title="Investigating" value={String(counters.investigating)} />
</section>

<section className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900/40 mb-5">
<h2 className="text-lg font-medium mb-3">Novo incidente</h2>
<div className="grid grid-cols-1 md:grid-cols-12 gap-3">
<input
className="md:col-span-6 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2"
placeholder="Ex: Workflow n8n falhando 3x seguidas"
value={title}
onChange={(e) => setTitle(e.target.value)}
/>
<select
className="md:col-span-2 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2"
value={severity}
onChange={(e) => setSeverity(e.target.value as Severity)}
>
<option value="low">low</option>
<option value="medium">medium</option>
<option value="high">high</option>
<option value="critical">critical</option>
</select>
<input
className="md:col-span-2 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2"
placeholder="owner"
value={owner}
onChange={(e) => setOwner(e.target.value)}
/>
<input
className="md:col-span-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2"
placeholder="source"
value={source}
onChange={(e) => setSource(e.target.value)}
/>
<button
onClick={createIncident}
className="md:col-span-1 rounded-xl bg-blue-600 hover:bg-blue-500 px-3 py-2"
>
Criar
</button>
</div>
</section>

<div className="border border-zinc-800 rounded-2xl overflow-hidden">
<table className="w-full text-sm">
<thead className="bg-zinc-900/60 text-zinc-400">
<tr>
<th className="text-left p-3">Incidente</th>
<th className="text-left p-3">Severity</th>
<th className="text-left p-3">Status</th>
<th className="text-left p-3">Owner</th>
<th className="text-left p-3">Source</th>
<th className="text-left p-3">Atualização</th>
<th className="text-left p-3">Ações</th>
</tr>
</thead>
<tbody>
{rows.map((r) => (
<tr key={r.id} className="border-t border-zinc-800">
<td className="p-3">
<p className="font-medium">{r.title}</p>
<p className="text-xs text-zinc-500">{r.id}</p>
</td>
<td className="p-3">
<span className={`text-xs border rounded-full px-2 py-1 ${sevBadge[r.severity]}`}>
{r.severity}
</span>
</td>
<td className="p-3">
<span className={`text-xs border rounded-full px-2 py-1 ${stBadge[r.status]}`}>
{r.status}
</span>
</td>
<td className="p-3 text-zinc-300">{r.owner || "-"}</td>
<td className="p-3 text-zinc-300">{r.source || "-"}</td>
<td className="p-3 text-zinc-300">
{new Date(r.updated_at).toLocaleString()}
</td>
<td className="p-3">
<div className="flex flex-wrap gap-1">
{(["open", "investigating", "mitigated", "closed"] as IncidentStatus[]).map((s) => (
<button
key={s}
onClick={() => updateStatus(r.id, s)}
className="text-xs border border-zinc-700 rounded-lg px-2 py-1 hover:bg-zinc-900"
>
{s}
</button>
))}
</div>
</td>
</tr>
))}
{rows.length === 0 && (
<tr>
<td colSpan={7} className="p-6 text-center text-zinc-500">
Sem incidentes ainda.
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
