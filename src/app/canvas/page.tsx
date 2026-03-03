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
    <div className="glass rounded-2xl px-5 py-4 border border-white/[0.05] animate-pulse flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-white/10 rounded w-2/3" />
        <div className="h-3 bg-white/10 rounded w-1/3" />
      </div>
      <div className="w-2 h-2 rounded-full bg-white/10" />
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

  const unreadCount = activities.length;

  return (
    <div className="h-full flex flex-col bg-transparent text-zinc-100 overflow-hidden">
      {/* Top bar */}
      <StatusBar tasks={tasks} agentCounts={agentCounts} isConnected={isConnected} />

      {/* Main body — positioned relative for absolute drawer */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Feed toggle button — always visible top-right */}
        <button
          onClick={() => setFeedOpen(v => !v)}
          className={`absolute top-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-200 shadow-lg ${
            feedOpen
              ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
              : "glass border-white/[0.1] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.2]"
          }`}
        >
          <TerminalSquare size={16} />
          <span className="hidden sm:inline">Feed</span>
          {unreadCount > 0 && !feedOpen && (
            <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center font-mono">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Agent grid — narrows when feed is open */}
        <div className={`flex-1 overflow-y-auto transition-all duration-300 ${feedOpen ? "pr-[340px]" : ""}`}>
          <div className="p-6">
            {/* Ambient */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 relative z-10">
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

        {/* Activity Feed drawer */}
        <ActivityFeed
          activities={activities}
          open={feedOpen}
          onClose={() => setFeedOpen(false)}
        />
      </div>

      {/* Command bar */}
      <CommandBar />
    </div>
  );
}
