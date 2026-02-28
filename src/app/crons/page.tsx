"use client";

import { useEffect, useState } from "react";

type CronRow = {
id: string;
name: string;
schedule: string;
last_run: string | null;
next_run: string | null;
status: "active" | "paused" | "error";
last_result: string | null;
consecutive_errors: number;
updated_at: string;
};

const badge = {
active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
paused: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
error: "bg-red-500/20 text-red-300 border-red-500/40",
};

export default function CronsPage() {
const [rows, setRows] = useState<CronRow[]>([]);
const [loading, setLoading] = useState(false);

async function refresh() {
setLoading(true);
const res = await fetch("/api/dashboard/crons", { cache: "no-store" });
const json = await res.json();
setRows(json.data ?? []);
setLoading(false);
}

useEffect(() => {
const t1 = setTimeout(refresh, 0);
const t2 = setInterval(refresh, 30000);
return () => { clearTimeout(t1); clearInterval(t2); };
}, []);
return (
<main className="p-6 md:p-8">
<div className="flex items-end justify-between mb-5">
<div>
<p className="text-xs uppercase tracking-wider text-zinc-400">Mission Control</p>
<h1 className="text-3xl font-semibold">Crons</h1>
<p className="text-zinc-400 text-sm">Saúde e execução das automações.</p>
</div>
<button
onClick={refresh}
className="border border-zinc-700 rounded-xl px-4 py-2 text-sm hover:bg-zinc-900"
>
{loading ? "Atualizando..." : "Atualizar"}
</button>
</div>

<div className="border border-zinc-800 rounded-2xl overflow-hidden">
<table className="w-full text-sm">
<thead className="bg-zinc-900/60 text-zinc-400">
<tr>
<th className="text-left p-3">Name</th>
<th className="text-left p-3">Schedule</th>
<th className="text-left p-3">Status</th>
<th className="text-left p-3">Last Run</th>
<th className="text-left p-3">Next Run</th>
<th className="text-left p-3">Errors</th>
</tr>
</thead>
<tbody>
{rows.map((r) => (
<tr key={r.id} className="border-t border-zinc-800">
<td className="p-3">
<p className="font-medium">{r.name}</p>
<p className="text-xs text-zinc-500">{r.id}</p>
</td>
<td className="p-3 text-zinc-300">{r.schedule}</td>
<td className="p-3">
<span className={`text-xs border rounded-full px-2 py-1 ${badge[r.status]}`}>
{r.status}
</span>
</td>
<td className="p-3 text-zinc-300">
{r.last_run ? new Date(r.last_run).toLocaleString() : "-"}
</td>
<td className="p-3 text-zinc-300">
{r.next_run ? new Date(r.next_run).toLocaleString() : "-"}
</td>
<td className="p-3">
<span className={r.consecutive_errors > 0 ? "text-red-300" : "text-zinc-300"}>
{r.consecutive_errors}
</span>
</td>
</tr>
))}
{rows.length === 0 && (
<tr>
<td colSpan={6} className="p-6 text-center text-zinc-500">
Sem dados de cron ainda.
</td>
</tr>
)}
</tbody>
</table>
</div>
</main>
);
}
