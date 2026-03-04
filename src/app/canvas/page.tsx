"use client";

import React, { useMemo, useState } from "react";
import { useAgentStream, AgentWithStats } from "@/hooks/useAgentStream";
import { AgentCard } from "@/components/canvas/AgentCard";
import { ActivityFeed } from "@/components/canvas/ActivityFeed";
import { StatusBar } from "@/components/canvas/StatusBar";
import { NeuralPulse } from "@/components/canvas/NeuralPulse";

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

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Agent grid — centered */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-10 relative">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[140px] rounded-full pointer-events-none" />
          <div className="grid grid-cols-3 gap-8 w-full max-w-[580px] relative z-10">
            {agents.length === 0
              ? Array.from({ length: 6 }).map((_, i) => <AgentCardSkeleton key={i} />)
              : agents.map((agent: AgentWithStats) => <AgentCard key={agent.id} agent={agent} />)
            }
          </div>
        </div>

        {/* Activity feed drawer */}
        <div className={`transition-all duration-300 shrink-0 overflow-hidden ${feedOpen ? "w-[300px]" : "w-12"} border-l border-white/[0.06] bg-black/20`}>
          <ActivityFeed
            activities={activities}
            open={feedOpen}
            onClose={() => setFeedOpen(false)}
            onOpen={() => setFeedOpen(true)}
          />
        </div>
      </div>

      {/* Neural Pulse — fixed bottom command bar */}
      <NeuralPulse />
    </div>
  );
}
