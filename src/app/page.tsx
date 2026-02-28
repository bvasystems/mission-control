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
const t1 = setTimeout(refresh, 0);
const t2 = setInterval(refresh, 20000);
return () => { clearTimeout(t1); clearInterval(t2); };
}, []);
  return (
    <main className="min-h-screen text-zinc-100 p-6 md:p-10 relative">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-semibold mb-2">Central de Operações</p>
            <h1 className="text-3xl font-medium tracking-tight">Painel Executivo</h1>
            <p className="text-zinc-500 text-sm mt-1">
              Visão macro: execução, risco e saúde dos serviços em tempo real.
            </p>
          </div>
          <button
            onClick={refresh}
            className="border border-blue-500/30 bg-blue-500/10 text-blue-400 rounded-lg px-4 py-2 text-xs uppercase tracking-wider font-medium hover:bg-blue-500/20 transition-colors"
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
        <section className="glass rounded-2xl p-4 md:p-6 shadow-2xl shadow-black/50">
          <h2 className="text-sm uppercase tracking-widest text-zinc-400 font-medium mb-4">Nova Demanda</h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <input
              className="md:col-span-6 bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
              placeholder="Ex: Revisar cron watchdog com retry x3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <select
              className="md:col-span-2 bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-zinc-300"
              value={priority}
              onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high" | "critical")}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <input
              className="md:col-span-2 bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-600"
              placeholder="Owner"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            />
            <button
              onClick={createTask}
              disabled={loading || !title.trim()}
              className="md:col-span-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)] shadow-blue-500/20"
            >
              {loading ? "Processando..." : "Despachar"}
            </button>
          </div>
        </section>

        {/* Tasks + Health */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-5 shadow-xl shadow-black/50">
            <h2 className="text-sm uppercase tracking-widest text-zinc-400 font-medium mb-4">Filas de Execução</h2>
            <div className="space-y-3 max-h-[420px] overflow-auto pr-2 custom-scrollbar">
              {taskList.length === 0 && <p className="text-sm text-zinc-500 italic">Sem tarefas ativas.</p>}
              {taskList.map((t) => (
                <div key={t.id} className="border border-white/10 rounded-xl p-4 bg-black/60 hover:bg-black/80 transition-colors group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-zinc-200 truncate">{t.title}</p>
                      <p className="text-[11px] text-zinc-500 mt-1 uppercase tracking-wider">
                        PRIORITY: <span className={t.priority === 'critical' ? 'text-red-400 font-bold' : 'text-zinc-300'}>{t.priority}</span> • OWNER: <span className="text-zinc-300">{t.assigned_to || "-"}</span>
                      </p>
                    </div>
                    <span className={`text-[10px] uppercase font-mono tracking-wider border rounded px-2 py-0.5 whitespace-nowrap ${badge[t.status]}`}>
                      {t.status}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button
                      onClick={() => updateTask(t.id, "pending")}
                      className="text-[10px] uppercase tracking-wider border border-white/10 rounded-md px-2 py-1 hover:bg-white/10 hover:text-white text-zinc-400 transition-colors"
                    >
                      Wait
                    </button>
                    <button
                      onClick={() => updateTask(t.id, "done")}
                      className="text-[10px] uppercase tracking-wider border border-white/10 rounded-md px-2 py-1 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30 text-zinc-400 transition-colors"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => updateTask(t.id, "blocked")}
                      className="text-[10px] uppercase tracking-wider border border-white/10 rounded-md px-2 py-1 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 text-zinc-400 transition-colors"
                    >
                      Block
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 shadow-xl shadow-black/50">
            <h2 className="text-sm uppercase tracking-widest text-zinc-400 font-medium mb-4">Monitoramento de Saúde</h2>
            <div className="space-y-3 max-h-[420px] overflow-auto pr-2 custom-scrollbar">
              {healthList.length === 0 && (
                <p className="text-sm text-zinc-500 italic">Varredura limpa. Sem serviços mapeados.</p>
              )}
              {healthList.map((h) => (
                <div key={h.id} className="border border-white/10 rounded-xl p-4 bg-black/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${h.status === 'healthy' ? 'bg-emerald-500 shadow-emerald-500' : h.status === 'down' ? 'bg-red-500 shadow-red-500 animate-pulse' : 'bg-yellow-500 shadow-yellow-500 animate-pulse'}`}></div>
                    <div>
                      <p className="font-medium text-sm text-zinc-200">{h.service}</p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-1">
                        LAST PING: {new Date(h.last_check).toLocaleTimeString()} • UP:{" "}
                        {h.uptime_pct != null ? <span className="text-emerald-400">{h.uptime_pct}%</span> : "-"}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase font-mono tracking-wider border rounded px-2 py-0.5 ${badge[h.status]}`}>
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Agent stats */}
        <section className="glass rounded-2xl p-5 shadow-xl shadow-black/50">
          <h2 className="text-sm uppercase tracking-widest text-zinc-400 font-medium mb-4">Telemetria de Agentes (7 dias)</h2>
          <div className="overflow-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase tracking-wider text-zinc-500 border-b border-white/10 bg-black/40">
                <tr>
                  <th className="font-medium p-3 rounded-tl-lg">Data</th>
                  <th className="font-medium p-3">Interações</th>
                  <th className="font-medium p-3">Habilidades Invocadas</th>
                  <th className="font-medium p-3">Erros Cognitivos</th>
                  <th className="font-medium p-3">Custo Computacional (Tokens)</th>
                  <th className="font-medium p-3 rounded-tr-lg">Uptime Ativo (h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {agentStats.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 text-zinc-300 font-mono">
                      {new Date(s.date).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-blue-400 font-medium">
                      {(Number(s.messages_sent) || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-zinc-300">
                      {(Number(s.skills_used) || 0).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className={(Number(s.errors) || 0) > 0 ? "text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 font-bold" : "text-zinc-500"}>
                        {Number(s.errors) || 0}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-400">
                      {(Number(s.model_tokens_used) || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-zinc-300">
                      {(Number(s.uptime_hours) || 0).toFixed(1)}
                    </td>
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
    <div className="glass rounded-2xl p-5 shadow-xl shadow-black/50 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-[2px] h-full bg-blue-500/50 group-hover:bg-blue-400 transition-colors"></div>
      <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-medium">{title}</p>
      <p className="text-3xl font-light tracking-tight mt-2 text-zinc-100">{value}</p>
    </div>
  );
}
