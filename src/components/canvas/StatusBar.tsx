import React from "react";
import { TaskUpdate } from "@/hooks/useAgentStream";
import { Shield } from "lucide-react";

export function StatusBar({ tasks }: { tasks: TaskUpdate[] }) {
  let pendingCount = 0;
  let executingCount = 0;
  let blockedCount = 0;
  let doneCount = 0;

  tasks.forEach((task) => {
    const stat = task.status?.toLowerCase();
    const stage = task.stage?.toLowerCase();

    if (stat === "done") {
      doneCount++;
    } else if (stat === "blocked") {
      blockedCount++;
    } else if (stage === "in_progress") {
      executingCount++;
    } else {
      pendingCount++;
    }
  });

  return (
    <div className="w-full bg-black/40 backdrop-blur-md border-b border-white/[0.08] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between shrink-0 shadow-lg relative z-20">
      <div className="flex items-center space-x-3 mb-4 md:mb-0">
        <Shield size={20} className="text-blue-500" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-semibold mb-0.5 leading-none">Visão Tática</p>
          <h1 className="font-medium text-xl text-white tracking-tight leading-none">
            Canvas Operacional
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] font-mono font-medium tracking-wider uppercase">
        <div className="flex items-center gap-2 px-3 py-1.5 border border-white/[0.06] bg-black/40 rounded-lg text-zinc-400 shadow-inner">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 shadow-[0_0_5px_currentColor]"></span>
          Pending
          <span className="text-zinc-100 ml-1 badge-value">{pendingCount}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 border border-blue-500/20 bg-blue-500/10 rounded-lg text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_currentColor] animate-pulse"></span>
          Em Execução
          <span className="text-blue-200 ml-1 badge-value">{executingCount}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 border border-red-500/20 bg-red-500/10 rounded-lg text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_currentColor]"></span>
          Bloqueado
          <span className="text-red-200 ml-1 badge-value">{blockedCount}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 border border-emerald-500/20 bg-emerald-500/10 rounded-lg text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_currentColor]"></span>
          Concluído
          <span className="text-emerald-200 ml-1 badge-value">{doneCount}</span>
        </div>
      </div>
    </div>
  );
}
