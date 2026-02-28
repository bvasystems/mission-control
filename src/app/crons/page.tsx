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
    <main className="min-h-screen text-zinc-100 p-6 md:p-10 relative">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-semibold mb-2">Automated Routines</p>
            <h1 className="text-3xl font-medium tracking-tight">Crons & Background Jobs</h1>
            <p className="text-zinc-500 text-sm mt-1">Saúde e execução das automações e fluxos em background.</p>
          </div>
          <button
            onClick={refresh}
            className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 rounded-lg px-4 py-2 text-xs uppercase tracking-wider font-medium hover:bg-emerald-500/20 transition-colors"
          >
            {loading ? "Testando pulso..." : "Verificar Jobs"}
          </button>
        </header>

        <div className="glass rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border-t-[3px] border-t-emerald-500/50 mt-8">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-black/40 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-white/5">
                <tr>
                  <th className="font-medium p-4">Cron Job</th>
                  <th className="font-medium p-4">Schedule</th>
                  <th className="font-medium p-4">Status</th>
                  <th className="font-medium p-4">Last Run</th>
                  <th className="font-medium p-4">Next Run</th>
                  <th className="font-medium p-4 border-l border-white/5">Sequência Falhas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4 flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${r.status === 'active' ? 'bg-emerald-500' : r.status === 'paused' ? 'bg-zinc-500' : 'bg-red-500'} animate-pulse shadow-[0_0_8px] shadow-current`}></div>
                      <div>
                        <p className="font-medium text-zinc-200">{r.name}</p>
                        <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{r.id.split('-')[0]}</p>
                      </div>
                    </td>
                    <td className="p-4 text-emerald-400 font-mono text-[11px]">{r.schedule}</td>
                    <td className="p-4">
                      <span className={`text-[9px] uppercase tracking-wider font-mono border rounded px-1.5 py-0.5 whitespace-nowrap ${badge[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400 font-mono text-[11px]">
                      {r.last_run ? new Date(r.last_run).toLocaleString() : "-"}
                    </td>
                    <td className="p-4 text-zinc-400 font-mono text-[11px]">
                      {r.next_run ? new Date(r.next_run).toLocaleString() : "-"}
                    </td>
                    <td className="p-4 border-l border-white/5">
                      {r.consecutive_errors > 0 ? (
                        <span className="text-red-400 font-mono bg-red-500/10 px-2.5 py-1 rounded border border-red-500/20 font-bold">{r.consecutive_errors}</span>
                      ) : (
                        <span className="text-zinc-600 font-mono">0</span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-zinc-500 italic">
                      Zero routines automatizadas ou falha no scanner mestre.
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
