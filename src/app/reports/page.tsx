"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  BarChart3, Clock, RefreshCw, ArrowLeft,
} from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface WeeklyReport {
  created7d: number;
  done7d: number;
  throughput: number;
  blockedPercent: number;
  bottlenecks: { dem_id: string; title: string; owner: string | null; type: string }[];
}

interface ReconcileResult {
  ok: boolean;
  checked_agents: number;
  offline_marked: number;
  timed_out_tasks: number;
  drift_fixed: number;
  error?: string;
}

export default function ReportsPage() {
  const { data: weeklyRaw, isLoading, mutate } = useSWR("/api/reports/weekly", fetcher, {
    refreshInterval: 60_000,
  });
  const weekly: WeeklyReport | null = weeklyRaw?.ok ? weeklyRaw.data : null;

  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  const runReconcile = async () => {
    setReconcileLoading(true);
    setReconcileError(null);
    try {
      const res = await fetch("/api/reports/reconcile", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setReconcileResult(data);
    } catch (err) {
      setReconcileError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setReconcileLoading(false);
    }
  };

  return (
    <main className="min-h-screen text-zinc-100 p-6 md:p-10 relative">
      {/* Decorative blurs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-xs mb-3 transition-colors">
              <ArrowLeft size={12} /> Dashboard
            </Link>
            <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-semibold mb-2">Relatorios</p>
            <h1 className="text-3xl font-medium tracking-tight">Weekly Report</h1>
            <p className="text-zinc-500 text-sm mt-1">Metricas dos ultimos 7 dias e saude do sistema</p>
          </div>
          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="border border-blue-500/30 bg-blue-500/10 text-blue-400 rounded-lg px-4 py-2 text-xs uppercase tracking-wider font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> Atualizar
          </button>
        </header>

        {/* KPI Cards */}
        {isLoading && !weekly ? (
          <div className="flex items-center justify-center py-20 text-zinc-600">
            <RefreshCw size={20} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : weekly ? (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard
                title="Criadas"
                value={weekly.created7d}
                icon={<BarChart3 size={14} />}
                color="blue"
              />
              <KPICard
                title="Concluidas"
                value={weekly.done7d}
                icon={<CheckCircle2 size={14} />}
                color="emerald"
              />
              <KPICard
                title="Throughput"
                value={weekly.throughput}
                icon={weekly.throughput > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                color={weekly.throughput > 0 ? "emerald" : "zinc"}
              />
              <KPICard
                title="% Bloqueadas"
                value={`${weekly.blockedPercent}%`}
                icon={<AlertTriangle size={14} />}
                color={weekly.blockedPercent > 30 ? "red" : weekly.blockedPercent > 10 ? "amber" : "emerald"}
                warn={weekly.blockedPercent > 30}
              />
            </section>

            {/* Bottlenecks */}
            <div className="glass rounded-2xl p-5 shadow-xl shadow-black/50">
              <h2 className="text-sm uppercase tracking-widest text-zinc-400 font-medium mb-4 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400" />
                Gargalos
              </h2>
              {weekly.bottlenecks.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-400 text-sm py-4">
                  <CheckCircle2 size={16} /> Nenhuma task bloqueada
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="text-[10px] uppercase tracking-wider text-zinc-500 border-b border-white/10">
                      <tr>
                        <th className="font-medium p-3 text-left">DEM ID</th>
                        <th className="font-medium p-3 text-left">Titulo</th>
                        <th className="font-medium p-3 text-left">Owner</th>
                        <th className="font-medium p-3 text-left">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {weekly.bottlenecks.map((b) => (
                        <tr key={b.dem_id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 text-xs text-blue-400 font-mono">{b.dem_id}</td>
                          <td className="p-3 text-sm text-zinc-300 max-w-[300px] truncate">{b.title}</td>
                          <td className="p-3 text-xs text-zinc-500">{b.owner ?? "—"}</td>
                          <td className="p-3">
                            <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 bg-white/[0.04] px-2 py-0.5 rounded">
                              {b.type}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-zinc-500 text-sm">Erro ao carregar relatorio</p>
            <p className="text-zinc-700 text-xs mt-1">{weeklyRaw?.error ?? "Verifique a conexao com o banco"}</p>
          </div>
        )}

        {/* Reconciliation Section */}
        <div className="glass rounded-2xl p-5 shadow-xl shadow-black/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-widest text-zinc-400 font-medium flex items-center gap-2">
              <Clock size={14} className="text-indigo-400" />
              Reconciliacao de Agentes
            </h2>
            <button
              onClick={runReconcile}
              disabled={reconcileLoading}
              className="bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/15 hover:border-indigo-500/25 text-indigo-300 hover:text-indigo-200 text-xs font-medium px-4 py-2 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {reconcileLoading ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Executar agora
            </button>
          </div>

          {reconcileError && (
            <div className="bg-red-500/10 border border-red-500/15 rounded-xl p-3 mb-4">
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertTriangle size={12} /> {reconcileError}
              </p>
            </div>
          )}

          {reconcileResult ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ReconcileStat label="Agentes verificados" value={reconcileResult.checked_agents} />
              <ReconcileStat
                label="Marcados offline"
                value={reconcileResult.offline_marked}
                warn={reconcileResult.offline_marked > 0}
              />
              <ReconcileStat
                label="Tasks timeout"
                value={reconcileResult.timed_out_tasks}
                warn={reconcileResult.timed_out_tasks > 0}
              />
              <ReconcileStat label="Drift corrigido" value={reconcileResult.drift_fixed} />
            </div>
          ) : (
            <p className="text-xs text-zinc-600 py-4 text-center">
              Clique em &quot;Executar agora&quot; para verificar a saude dos agentes
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

// ── Components ────────────────────────────────────────────────────────────────

function KPICard({
  title, value, icon, color, warn,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  warn?: boolean;
}) {
  const colorMap: Record<string, { bar: string; text: string; icon: string }> = {
    blue:    { bar: "bg-blue-500",    text: "text-white",      icon: "text-blue-400" },
    emerald: { bar: "bg-emerald-500", text: "text-emerald-400", icon: "text-emerald-400" },
    amber:   { bar: "bg-amber-500",   text: "text-amber-400",  icon: "text-amber-400" },
    red:     { bar: "bg-red-500",     text: "text-red-400",    icon: "text-red-400" },
    zinc:    { bar: "bg-zinc-600",    text: "text-zinc-400",   icon: "text-zinc-500" },
  };
  const c = colorMap[color] ?? colorMap.zinc;

  return (
    <div className="glass rounded-2xl p-5 shadow-xl shadow-black/50 relative overflow-hidden group">
      <div className={`absolute top-0 left-0 w-[2px] h-full ${c.bar}`} />
      <div className="flex items-center gap-1.5 mb-1">
        <span className={c.icon}>{icon}</span>
        <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-medium">{title}</p>
      </div>
      <p className={`text-3xl font-light tracking-tight mt-2 ${warn ? "text-red-400" : c.text}`}>{value}</p>
    </div>
  );
}

function ReconcileStat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3.5 text-center">
      <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-medium mb-1">{label}</p>
      <p className={`text-2xl font-light ${warn ? "text-red-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
