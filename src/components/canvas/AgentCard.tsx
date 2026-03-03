import React from "react";
import { AgentWithStats } from "@/hooks/useAgentStream";
import { MessageSquare, Coins, AlertTriangle, Clock } from "lucide-react";

function formatRelativeTime(dateString: string) {
  if (!dateString) return "Desconhecido";
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `há ${diffInSeconds}s`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `há ${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `há ${diffInHours}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `há ${diffInDays}d`;
}

export function AgentCard({ agent }: { agent: AgentWithStats }) {
  const isDown = agent.status === "down";
  const isDegraded = agent.status === "degraded";
  const isActive = agent.status === "active";
  const isIdle = agent.status === "idle";

  const colorClass = isActive 
    ? "bg-emerald-500" 
    : isDown 
    ? "bg-red-500" 
    : isDegraded 
    ? "bg-amber-500" 
    : "bg-zinc-500";

  const statusText = isActive 
    ? "Em Operação" 
    : isDown 
    ? "Offline" 
    : isDegraded 
    ? "Instável" 
    : "Ocioso";

  const avatarInitial = agent.name ? agent.name.charAt(0).toUpperCase() : "?";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden group hover:border-zinc-700 transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold bg-zinc-800 text-zinc-100`}>
              {avatarInitial}
            </div>
            {/* Status dot */}
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-zinc-900 bg-zinc-900 flex items-center justify-center">
              <div className={`w-full h-full rounded-full ${colorClass} ${isActive ? 'animate-pulse' : ''}`} />
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
              {agent.name}
              <span className="text-xs px-2 py-0.5 rounded capitalize bg-zinc-800 text-zinc-400 border border-zinc-700">
                L{agent.level || "0"}
              </span>
            </h3>
            <p className="text-sm text-zinc-400 flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${colorClass}`}></span>
              {statusText}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800/50">
          <div className="flex items-center gap-1.5 mb-1 text-zinc-500">
            <MessageSquare size={14} />
            <span className="text-xs">Msgs 24h</span>
          </div>
          <p className="text-sm font-medium text-zinc-300">
            {agent.messages_24h?.toLocaleString() || 0}
          </p>
        </div>
        
        <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800/50">
          <div className="flex items-center gap-1.5 mb-1 text-zinc-500">
            <Coins size={14} />
            <span className="text-xs">Tokens</span>
          </div>
          <p className="text-sm font-medium text-zinc-300">
            {agent.tokens ? (agent.tokens / 1000).toFixed(1) + 'k' : '0'}
          </p>
        </div>

        <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800/50">
          <div className="flex items-center gap-1.5 mb-1 text-zinc-500">
            <AlertTriangle size={14} className={agent.errors_24h > 0 ? "text-red-400" : ""} />
            <span className="text-xs">Erros</span>
          </div>
          <p className={`text-sm font-medium ${agent.errors_24h > 0 ? "text-red-400" : "text-zinc-300"}`}>
            {agent.errors_24h || 0}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800/50 mt-1">
        <div className="flex items-center gap-1.5">
          <Clock size={12} />
          Última atividade: {formatRelativeTime(agent.updated_at || agent.last_seen)}
        </div>
      </div>
    </div>
  );
}
