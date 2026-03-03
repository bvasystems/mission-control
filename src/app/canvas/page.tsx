"use client";

import React from "react";
import { useAgentStream, AgentWithStats } from "@/hooks/useAgentStream";
import { AgentCard } from "@/components/canvas/AgentCard";
import { ActivityFeed } from "@/components/canvas/ActivityFeed";
import { CommandBar } from "@/components/canvas/CommandBar";
import { StatusBar } from "@/components/canvas/StatusBar";

function AgentCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-5 border border-white/[0.05] flex flex-col gap-5 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-white/10 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/10 rounded-lg w-2/3" />
          <div className="h-3 bg-white/10 rounded-lg w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-16 bg-white/[0.04] rounded-xl" />
        <div className="h-16 bg-white/[0.04] rounded-xl" />
      </div>
      <div className="h-px bg-white/[0.05]" />
      <div className="h-3 bg-white/10 rounded w-1/2" />
    </div>
  );
}

export default function CanvasPage() {
  const { agents, activities, tasks, isConnected } = useAgentStream();

  return (
    <div className="h-full flex flex-col bg-transparent text-zinc-100 overflow-hidden">
      {/* Top status bar */}
      <StatusBar tasks={tasks} />

      {/* Ambient background */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 blur-[140px] rounded-full pointer-events-none z-0" />

      {/* Body */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6 relative z-10">

        {/* Left: Agent Grid */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-5 shrink-0">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-semibold mb-1">Agentes Ativos</p>
              <h2 className="text-2xl font-medium tracking-tight text-white">Status Operacional</h2>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-zinc-500">
              <span className={`w-2 h-2 rounded-full shadow-lg ${isConnected ? "bg-emerald-500 shadow-emerald-500/50 animate-pulse" : "bg-red-500 shadow-red-500/50"}`} />
              {isConnected ? "Live" : "Offline"}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
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
        </div>

        {/* Right: Activity Feed – fixed width */}
        <div className="w-[340px] shrink-0 flex flex-col overflow-hidden">
          <ActivityFeed activities={activities} />
        </div>
      </div>

      {/* Bottom: Command bar */}
      <CommandBar />
    </div>
  );
}
