"use client";

import React, { useMemo } from "react";
import { useAgentStream, AgentWithStats } from "@/hooks/useAgentStream";
import { AgentCard } from "@/components/canvas/AgentCard";
import { ActivityFeed } from "@/components/canvas/ActivityFeed";
import { CommandBar } from "@/components/canvas/CommandBar";
import { StatusBar } from "@/components/canvas/StatusBar";

function AgentCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-5 border border-white/[0.05] flex flex-col gap-5 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-white/10 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/10 rounded-lg w-2/3" />
          <div className="h-3 bg-white/10 rounded-lg w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="h-14 bg-white/[0.04] rounded-xl" />
        <div className="h-14 bg-white/[0.04] rounded-xl" />
        <div className="h-14 bg-white/[0.04] rounded-xl" />
      </div>
      <div className="h-px bg-white/[0.05]" />
      <div className="h-3 bg-white/10 rounded w-1/2" />
    </div>
  );
}

export default function CanvasPage() {
  const { agents, activities, tasks, isConnected } = useAgentStream();

  const kpis = useMemo(() => ({
    total:    agents.length,
    active:   agents.filter(a => a.status === "active").length,
    degraded: agents.filter(a => a.status === "degraded").length,
    down:     agents.filter(a => a.status === "down").length,
    errors:   agents.reduce((s, a) => s + (a.errors_24h ?? 0), 0),
    msgs:     agents.reduce((s, a) => s + (a.messages_24h ?? 0), 0),
    tokens:   agents.reduce((s, a) => s + (a.tokens ?? 0), 0),
  }), [agents]);

  return (
    <div className="h-full flex flex-col bg-transparent text-zinc-100 overflow-hidden">
      {/* Top bar: title + task counters */}
      <StatusBar tasks={tasks} />

      {/* KPI ribbon */}
      <div className="shrink-0 px-6 py-3 border-b border-white/[0.05] bg-black/20 flex flex-wrap gap-3 items-center">
        <KPIChip label="Agentes" value={kpis.total} />
        <KPIChip label="Ativos"    value={kpis.active}    color="emerald" />
        <KPIChip label="Degradados" value={kpis.degraded} color="yellow" />
        <KPIChip label="Caídos"    value={kpis.down}      color="red" />
        <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block" />
        <KPIChip label="Msgs/24h"  value={kpis.msgs.toLocaleString()} />
        <KPIChip label="Tokens"    value={kpis.tokens >= 1000 ? (kpis.tokens / 1000).toFixed(0) + "k" : String(kpis.tokens)} />
        <KPIChip label="Erros/24h" value={kpis.errors} color={kpis.errors > 0 ? "red" : undefined} />

        <div className="ml-auto flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-zinc-500">
          <span className={`w-2 h-2 rounded-full shadow-lg shrink-0 ${isConnected ? "bg-emerald-500 shadow-emerald-500/50 animate-pulse" : "bg-red-500 shadow-red-500/50"}`} />
          {isConnected ? "Live Stream" : "Reconectando..."}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 blur-[140px] rounded-full pointer-events-none z-0" />

        {/* Agent grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-4 relative z-10">
            {agents.length === 0 ? (
              <>
                <AgentCardSkeleton />
                <AgentCardSkeleton />
                <AgentCardSkeleton />
              </>
            ) : (
              agents.map((agent: AgentWithStats) => (
                <AgentCard key={agent.id} agent={agent} />
              ))
            )}
          </div>
        </div>

        {/* Activity feed */}
        <div className="w-[340px] shrink-0 flex flex-col overflow-hidden relative z-10">
          <ActivityFeed activities={activities} />
        </div>
      </div>

      {/* Command bar */}
      <CommandBar />
    </div>
  );
}

type KPIColor = "emerald" | "yellow" | "red";
const kpiColors: Record<KPIColor, string> = {
  emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  yellow:  "text-yellow-400 border-yellow-500/20 bg-yellow-500/10",
  red:     "text-red-400 border-red-500/20 bg-red-500/10",
};

function KPIChip({ label, value, color }: { label: string; value: string | number; color?: KPIColor }) {
  const cls = color ? kpiColors[color] : "text-zinc-300 border-white/[0.06] bg-white/[0.03]";
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-[11px] font-mono uppercase tracking-widest ${cls}`}>
      <span className="text-zinc-500">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
