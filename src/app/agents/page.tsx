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
const t1 = setTimeout(refresh, 0);
const t2 = setInterval(refresh, 30000);
return () => { clearTimeout(t1); clearInterval(t2); };
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
    <main className="min-h-screen text-zinc-100 p-6 md:p-10 relative">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-purple-400 font-semibold mb-2">Comando de Frota</p>
            <h1 className="text-3xl font-medium tracking-tight">Telemetria de Agentes</h1>
            <p className="text-zinc-500 text-sm mt-1">Hierarquia, saúde e custos inferenciais dos agentes LLM.</p>
          </div>
          <button
            onClick={refresh}
            className="border border-purple-500/30 bg-purple-500/10 text-purple-400 rounded-lg px-4 py-2 text-xs uppercase tracking-wider font-medium hover:bg-purple-500/20 transition-colors"
          >
            {loading ? "Varrendo..." : "Verificar Frota"}
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Agentes Ativos" value={String(totals.total)} />
          <Card title="Sistemas Degradados" value={String(totals.degraded)} isWarning />
          <Card title="Sistemas Caídos" value={String(totals.down)} isCritical />
          <Card title="Erros Geração (24h)" value={String(totals.errors)} isCritical />
        </section>

        <div className="glass rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border-t-[3px] border-t-purple-500/50">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-black/60 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-white/10">
                <tr>
                  <th className="font-medium p-4">Agente I.A</th>
                  <th className="font-medium p-4">Clearance Level</th>
                  <th className="font-medium p-4">Health Status</th>
                  <th className="font-medium p-4">Last Ping</th>
                  <th className="font-medium p-4">Carga (Msgs/24h)</th>
                  <th className="font-medium p-4">Falhas Deteção (24h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4 flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${r.status === 'active' || r.status === 'idle' ? 'bg-emerald-500' : r.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`}></div>
                      <div>
                        <p className="font-medium text-zinc-200">{r.name}</p>
                        <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{r.id.split('-')[0]}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-[9px] uppercase tracking-wider font-mono border rounded px-1.5 py-0.5 ${levelBadge[r.level]}`}>
                        [{r.level}]
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-[9px] uppercase tracking-wider font-mono border rounded px-1.5 py-0.5 whitespace-nowrap ${statusBadge[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-500 font-mono text-[11px]">
                      {r.last_seen ? new Date(r.last_seen).toLocaleString() : "-"}
                    </td>
                    <td className="p-4 text-purple-400 font-mono">{r.messages_24h.toLocaleString()}</td>
                    <td className="p-4">
                      {r.errors_24h > 0 ? (
                        <span className="text-red-400 font-mono bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">{r.errors_24h}</span>
                      ) : (
                        <span className="text-zinc-600 font-mono">{r.errors_24h}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-zinc-500 italic">
                      Frota offline. Nenhum agente responde ao ping.
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

function Card({ title, value, isWarning, isCritical }: { title: string; value: string; isWarning?: boolean; isCritical?: boolean }) {
  const isRed = isCritical && Number(value) > 0;
  const isYellow = isWarning && Number(value) > 0;

  return (
    <div className={`glass rounded-2xl p-5 shadow-xl shadow-black/50 relative overflow-hidden group border ${isRed ? 'border-red-500/20' : isYellow ? 'border-yellow-500/20' : 'border-white/5'}`}>
      <div className={`absolute top-0 left-0 w-[2px] h-full transition-colors ${isRed ? 'bg-red-500/50 group-hover:bg-red-400' : isYellow ? 'bg-yellow-500/50 group-hover:bg-yellow-400' : 'bg-purple-500/50 group-hover:bg-purple-400'}`}></div>
      <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-medium">{title}</p>
      <p className={`text-3xl font-light tracking-tight mt-2 ${isRed ? 'text-red-400' : isYellow ? 'text-yellow-400' : 'text-zinc-100'}`}>{value}</p>
    </div>
  );
}
