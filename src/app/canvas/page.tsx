"use client";

import React from "react";
import { useAgentStream, AgentWithStats } from "@/hooks/useAgentStream";
import { AgentCard } from "@/components/canvas/AgentCard";
import { ActivityFeed } from "@/components/canvas/ActivityFeed";
import { CommandBar } from "@/components/canvas/CommandBar";
import { StatusBar } from "@/components/canvas/StatusBar";

function AgentCardSkeleton() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-zinc-800"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-zinc-800 rounded w-1/3"></div>
          <div className="h-3 bg-zinc-800 rounded w-1/4"></div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="h-16 bg-zinc-800/50 rounded-lg"></div>
        <div className="h-16 bg-zinc-800/50 rounded-lg"></div>
        <div className="h-16 bg-zinc-800/50 rounded-lg"></div>
      </div>
      <div className="h-4 bg-zinc-800/50 rounded w-1/2 mt-2"></div>
    </div>
  );
}

export default function CanvasPage() {
  const { agents, activities, tasks, isConnected } = useAgentStream();

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col font-sans text-zinc-100 overflow-hidden">
      {/* Top Status Bar */}
      <StatusBar tasks={tasks} />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden p-4 sm:p-6 lg:p-8">
        <div className="flex w-full max-w-[1600px] mx-auto gap-6 h-full">
          
          {/* Agent Grid */}
          <div className="flex-1 flex flex-col min-w-0 pr-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-600 truncate">
                Status Operacional
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 font-mono hidden sm:inline-block">LIVE STREAM</span>
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" : "bg-rose-500"}`}></div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent pb-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {agents.length === 0 && !isConnected ? (
                  <>
                    <AgentCardSkeleton />
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

          {/* Activity Feed Sidebar */}
          <div className="w-80 lg:w-96 flex-shrink-0 flex flex-col">
            <ActivityFeed activities={activities} />
          </div>

        </div>
      </div>

      {/* Bottom Command Bar */}
      <CommandBar />

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-thin::-webkit-scrollbar {
          width: 8px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: theme('colors.zinc.800');
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}
