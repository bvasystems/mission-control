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
    <main className="min-h-screen text-zinc-100 p-6 md:p-10 relative">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-red-500/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-red-400 font-semibold mb-2">Monitoramento de Risco</p>
            <h1 className="text-3xl font-medium tracking-tight">Registro de Incidentes</h1>
            <p className="text-zinc-500 text-sm mt-1">Acompanhamento e mitigação de falhas e anomalias críticas.</p>
          </div>
          <button
            onClick={refresh}
            className="border border-red-500/30 bg-red-500/10 text-red-400 rounded-lg px-4 py-2 text-xs uppercase tracking-wider font-medium hover:bg-red-500/20 transition-colors"
          >
            {loading ? "Verificando..." : "Sincronizar"}
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Total" value={String(counters.total)} />
          <Card title="Open" value={String(counters.open)} />
          <Card title="Critical" value={String(counters.critical)} isCritical />
          <Card title="Investigating" value={String(counters.investigating)} />
        </section>

        <section className="glass rounded-2xl p-4 md:p-6 shadow-2xl shadow-black/50 border-t-[3px] border-t-red-500/50">
          <h2 className="text-sm uppercase tracking-widest text-zinc-400 font-medium mb-4">Declarar Novo Incidente</h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <input
              className="md:col-span-4 bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all placeholder:text-zinc-600"
              placeholder="Ex: API Gateway instável"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <select
              className="md:col-span-2 bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-all text-zinc-300"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <input
              className="md:col-span-2 bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-all placeholder:text-zinc-600"
              placeholder="Lead Owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
            <input
              className="md:col-span-2 bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 transition-all placeholder:text-zinc-600"
              placeholder="System Source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <button
              onClick={createIncident}
              className="md:col-span-2 rounded-xl bg-red-600/80 text-white font-medium hover:bg-red-500 px-4 py-2.5 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)] shadow-red-500/10 border border-red-500/50"
            >
              Reportar
            </button>
          </div>
        </section>

        <div className="glass rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900/60 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-white/10">
                <tr>
                  <th className="font-medium p-4">Incidente / ID</th>
                  <th className="font-medium p-4">Severity</th>
                  <th className="font-medium p-4">Status</th>
                  <th className="font-medium p-4">Lead</th>
                  <th className="font-medium p-4">Source</th>
                  <th className="font-medium p-4">Atualização</th>
                  <th className="font-medium p-4">Ações Mitigadoras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <p className="font-medium text-zinc-200">{r.title}</p>
                      <p className="text-[10px] text-zinc-600 font-mono mt-1">{r.id.split('-')[0]}</p>
                    </td>
                    <td className="p-4">
                      <span className={`text-[9px] uppercase tracking-wider font-mono border rounded px-1.5 py-0.5 ${sevBadge[r.severity]}`}>
                        {r.severity}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-[9px] uppercase tracking-wider font-mono border rounded px-1.5 py-0.5 whitespace-nowrap ${stBadge[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400 font-medium">{r.owner || "-"}</td>
                    <td className="p-4 text-zinc-400 font-mono text-[11px]">{r.source || "-"}</td>
                    <td className="p-4 text-zinc-500 text-[11px] uppercase tracking-wide">
                      {new Date(r.updated_at).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(["open", "investigating", "mitigated", "closed"] as IncidentStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => updateStatus(r.id, s)}
                            className="text-[9px] font-mono tracking-widest uppercase border border-white/10 rounded-md px-2 py-1 hover:bg-white/10 hover:text-white text-zinc-500 transition-colors"
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
                    <td colSpan={7} className="p-8 text-center text-zinc-500 italic">
                      Zero anomalias detectadas no quadrante atual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function Card({ title, value, isCritical }: { title: string; value: string; isCritical?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-5 shadow-xl shadow-black/50 relative overflow-hidden group border ${isCritical ? 'border-red-500/20' : 'border-white/10'}`}>
      <div className={`absolute top-0 left-0 w-[2px] h-full transition-colors ${isCritical ? 'bg-red-500/50 group-hover:bg-red-400' : 'bg-blue-500/50 group-hover:bg-blue-400'}`}></div>
      <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-medium">{title}</p>
      <p className={`text-3xl font-light tracking-tight mt-2 ${isCritical && Number(value) > 0 ? 'text-red-400' : 'text-zinc-100'}`}>{value}</p>
    </div>
  );
}
