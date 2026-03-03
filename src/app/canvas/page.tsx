"use client";

import React, { useMemo, useState } from "react";
import { useAgentStream, AgentWithStats } from "@/hooks/useAgentStream";
import { AgentCard } from "@/components/canvas/AgentCard";
import { ActivityFeed } from "@/components/canvas/ActivityFeed";
import { CommandBar } from "@/components/canvas/CommandBar";
import { StatusBar } from "@/components/canvas/StatusBar";
import { TerminalSquare } from "lucide-react";

function AgentCardSkeleton() {
  return (
    <div className="bg-zinc-900/80 border border-white/[0.07] rounded-2xl flex flex-col items-center justify-center text-center px-4 py-6 gap-3 animate-pulse ring-1 ring-zinc-700/30">
      <div className="w-14 h-14 rounded-full bg-zinc-800" />
      <div className="space-y-1.5">
        <div className="h-3 bg-zinc-800 rounded w-20 mx-auto" />
        <div className="h-2.5 bg-zinc-800/60 rounded w-14 mx-auto" />
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
      <StatusBar tasks={tasks} agentCounts={agentCounts} isConnected={isConnected} />

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Ambient background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[140px] rounded-full pointer-events-none" />

        {/* Feed toggle */}
        <div className="absolute top-4 right-4 z-40">
          <button
            onClick={() => setFeedOpen(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-200 shadow-lg ${
              feedOpen
                ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                : "bg-zinc-900/80 border-white/[0.1] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.2]"
            }`}
          >
            <TerminalSquare size={15} />
            <span className="hidden sm:inline text-xs uppercase tracking-widest font-mono">Feed</span>
            {activities.length > 0 && !feedOpen && (
              <span className="bg-blue-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activities.length > 99 ? "99" : activities.length}
              </span>
            )}
          </button>
        </div>

        {/* Agent grid */}
        <div className={`flex-1 overflow-y-auto transition-all duration-300 ${feedOpen ? "pr-[340px]" : ""}`}>
          <div className="p-8 pt-6">
            <div
              className="grid gap-4 relative z-10"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
            >
              {agents.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => <AgentCardSkeleton key={i} />)
              ) : (
                agents.map((agent: AgentWithStats) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Feed drawer */}
        <ActivityFeed
          activities={activities}
          open={feedOpen}
          onClose={() => setFeedOpen(false)}
        />
      </div>

      <CommandBar />
    </div>
  );
}
