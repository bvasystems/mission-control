"use client";

import React, { useMemo, useState } from "react";
import { useAgentStream, AgentWithStats } from "@/hooks/useAgentStream";
import { AgentCard } from "@/components/canvas/AgentCard";
import { ActivityFeed } from "@/components/canvas/ActivityFeed";
import { StatusBar } from "@/components/canvas/StatusBar";
import { KanbanBoard } from "@/components/canvas/KanbanBoard";
import { NeuralPulse } from "@/components/canvas/NeuralPulse";
import { LayoutGrid, Kanban } from "lucide-react";

type View = "agents" | "kanban";

function AgentCardSkeleton() {
  return (
    <div className="bg-zinc-900/80 border border-white/[0.07] rounded-2xl flex flex-col items-center justify-center text-center p-5 gap-3 animate-pulse ring-1 ring-zinc-800/60 aspect-square">
      <div className="w-14 h-14 rounded-full bg-zinc-800" />
      <div className="space-y-1.5">
        <div className="h-3 bg-zinc-800 rounded w-20 mx-auto" />
        <div className="h-2.5 bg-zinc-800/50 rounded w-14 mx-auto" />
      </div>
    </div>
  );
}

export default function CanvasPage() {
  const { agents, activities, tasks, isConnected } = useAgentStream();
  const [view, setView] = useState<View>("agents");
  const [feedOpen, setFeedOpen] = useState(false);

  const agentCounts = useMemo(() => ({
    total:    agents.length,
    active:   agents.filter(a => a.status === "active").length,
    degraded: agents.filter(a => a.status === "degraded").length,
    down:     agents.filter(a => a.status === "down").length,
  }), [agents]);

  return (
    <div className="h-full flex flex-col bg-transparent text-zinc-100 overflow-hidden">
      {/* Top status bar */}
      <StatusBar tasks={tasks} agentCounts={agentCounts} isConnected={isConnected} />

      {/* View toggle */}
      <div className="shrink-0 px-6 py-2.5 border-b border-white/[0.06] bg-black/20 flex items-center gap-2">
        <div className="flex items-center bg-zinc-900/80 border border-white/[0.08] rounded-xl p-1 gap-1">
          <button
            onClick={() => setView("agents")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all duration-150 ${
              view === "agents"
                ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <LayoutGrid size={14} /> Agents
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all duration-150 ${
              view === "kanban"
                ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Kanban size={14} /> Kanban
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {view === "agents" ? (
          <>
            {/* Agent grid */}
            <div className="flex-1 flex items-center justify-center overflow-auto p-10">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[140px] rounded-full pointer-events-none" />
              <div className="grid grid-cols-3 gap-8 w-full max-w-[580px] relative z-10">
                {agents.length === 0
                  ? Array.from({ length: 6 }).map((_, i) => <AgentCardSkeleton key={i} />)
                  : agents.map((agent: AgentWithStats) => <AgentCard key={agent.id} agent={agent} />)
                }
              </div>
            </div>

            {/* Activity feed */}
            <div className={`transition-all duration-300 shrink-0 overflow-hidden ${feedOpen ? "w-[300px]" : "w-12"} border-l border-white/[0.06] bg-black/20`}>
              <ActivityFeed activities={activities} open={feedOpen} onClose={() => setFeedOpen(false)} onOpen={() => setFeedOpen(true)} />
            </div>
          </>
        ) : (
          /* Kanban full-width */
          <div className="flex-1 overflow-hidden">
            <KanbanBoard />
          </div>
        )}
      </div>

      {/* Neural Pulse — bottom, always visible */}
      <NeuralPulse />
    </div>
  );
}
