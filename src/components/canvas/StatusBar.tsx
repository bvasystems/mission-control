import React from "react";
import { TaskUpdate } from "@/hooks/useAgentStream";

export function StatusBar({ tasks }: { tasks: TaskUpdate[] }) {
  // Counters based on statuses
  // status: "pending", "blocked", "done" -> map from prompt or standard task workflow
  let pendingCount = 0;
  let executingCount = 0;
  let blockedCount = 0;
  let doneCount = 0;

  tasks.forEach((task) => {
    // Handling standard task.status from previous findings
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
    <div className="w-full bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50 px-5 py-3.5 flex items-center justify-between shrink-0">
      <div className="flex items-center space-x-2">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
        <h1 className="font-bold text-lg text-white tracking-wide">
          Mission Control <span className="text-zinc-500 font-light mx-2">|</span> Canvas
        </h1>
      </div>

      <div className="flex gap-4 text-xs font-semibold mr-2 border border-zinc-800 rounded-lg bg-zinc-900/50 p-1">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 rounded-md text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
          Pending
          <span className="font-mono text-zinc-100 ml-1">{pendingCount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 rounded-md text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.6)] animate-pulse"></span>
          Em Execução
          <span className="font-mono text-blue-200 ml-1">{executingCount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 rounded-md text-rose-400">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          Bloqueado
          <span className="font-mono text-rose-200 ml-1">{blockedCount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 rounded-md text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Concluído
          <span className="font-mono text-emerald-200 ml-1">{doneCount}</span>
        </div>
      </div>
    </div>
  );
}
