"use client";

import React, { useMemo, useState } from "react";
import { useAgentStream, AgentWithStats } from "@/hooks/useAgentStream";
import { AgentCard } from "@/components/canvas/AgentCard";
import { ActivityFeed } from "@/components/canvas/ActivityFeed";
import { CommandBar } from "@/components/canvas/CommandBar";
import { StatusBar } from "@/components/canvas/StatusBar";

function AgentCardSkeleton() {
  return (
    <div className="bg-zinc-900/80 border border-white/[0.07] rounded-2xl flex flex-col items-center justify-center text-center p-6 gap-4 animate-pulse ring-1 ring-zinc-800/60 aspect-square">
      <div className="w-16 h-16 rounded-full bg-zinc-800" />
      <div className="space-y-2">
        <div className="h-3 bg-zinc-800 rounded w-20 mx-auto" />
        <div className="h-2 bg-zinc-800/50 rounded w-12 mx-auto" />
      </div>
    </div>
  );
}

export default function CanvasPage() {
  const { agents, activities, tasks, isConnected } = useAgentStream();
  const [feedOpen, setFeedOpen] = useState(false);

  const agentCounts = useMemo(() => ({
    total:    agents.length,
    active:   agents.filter(a => a.status === "active").length,
    degraded: agents.filter(a => a.status === "degraded").length,
    down:     agents.filter(a => a.status === "down").length,
  }), [agents]);

  const displayAgents = agents.length === 0
    ? Array.from({ length: 6 })
    : agents;

  return (
    <div className="h-full flex flex-col bg-transparent text-zinc-100 overflow-hidden">
      <StatusBar tasks={tasks} agentCounts={agentCounts} isConnected={isConnected} />

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: Agent canvas ── */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-10">
          <div className="grid grid-cols-3 gap-8 w-full max-w-[580px]">
            {displayAgents.map((agent, i) =>
              agent
                ? <AgentCard key={(agent as AgentWithStats).id} agent={agent as AgentWithStats} />
                : <AgentCardSkeleton key={i} />
            )}
          </div>
        </div>

        {/* ── Right: Activity feed ── */}
        <div className={`transition-all duration-300 shrink-0 overflow-hidden ${feedOpen ? "w-[300px]" : "w-12"} border-l border-white/[0.06] bg-black/20 relative`}>
          <ActivityFeed activities={activities} open={feedOpen} onClose={() => setFeedOpen(false)} onOpen={() => setFeedOpen(true)} />
        </div>

      </div>

      <CommandBar />
    </div>
  );
}
