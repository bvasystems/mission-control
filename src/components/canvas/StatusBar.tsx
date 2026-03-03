import React from "react";
import { TaskUpdate } from "@/hooks/useAgentStream";
import { Shield } from "lucide-react";

interface Props {
  tasks: TaskUpdate[];
  agentCounts: { active: number; degraded: number; down: number; total: number };
  isConnected: boolean;
}

export function StatusBar({ tasks, agentCounts, isConnected }: Props) {
  // Task status counters
  let pending = 0, executing = 0, blocked = 0, done = 0;
  tasks.forEach(t => {
    const s = t.status?.toLowerCase();
    if (s === "done") done++;
    else if (s === "blocked") blocked++;
    else if (t.stage?.toLowerCase() === "in_progress") executing++;
    else pending++;
  });

  return (
    <div className="w-full bg-black/40 backdrop-blur-md border-b border-white/[0.08] px-5 py-3 flex items-center justify-between shrink-0 gap-4 flex-wrap">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <Shield size={18} className="text-blue-500" />
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-blue-400 font-semibold leading-none mb-0.5">Visão Tática</p>
          <h1 className="font-medium text-base text-white tracking-tight leading-none">Canvas Operacional</h1>
        </div>
      </div>

      {/* Agent fleet status */}
      <div className="flex items-center gap-2 flex-wrap">
        <Pill label={`${agentCounts.total} agentes`} />
        <Pill label={`${agentCounts.active} ativos`} color="emerald" />
        {agentCounts.degraded > 0 && <Pill label={`${agentCounts.degraded} degradados`} color="yellow" />}
        {agentCounts.down > 0 && <Pill label={`${agentCounts.down} caídos`} color="red" />}

        <div className="w-px h-4 bg-white/10 mx-1" />

        {/* Task queue */}
        {pending > 0 && <Pill label={`${pending} pending`} />}
        {executing > 0 && <Pill label={`${executing} executando`} color="blue" />}
        {blocked > 0 && <Pill label={`${blocked} bloqueado${blocked > 1 ? "s" : ""}`} color="red" />}
        {done > 0 && <Pill label={`${done} concluído${done > 1 ? "s" : ""}`} color="emerald" />}
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-zinc-500 ml-auto">
        <span className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" : "bg-red-500"}`} />
        {isConnected ? "Live" : "Off"}
      </div>
    </div>
  );
}

type PillColor = "emerald" | "yellow" | "red" | "blue";
const pillColors: Record<PillColor, string> = {
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  yellow:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  red:     "bg-red-500/10 text-red-400 border-red-500/20",
  blue:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

function Pill({ label, color }: { label: string; color?: PillColor }) {
  const cls = color ? pillColors[color] : "bg-white/[0.04] text-zinc-400 border-white/[0.08]";
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-md px-2.5 py-1 ${cls}`}>{label}</span>
  );
}
