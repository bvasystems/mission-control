import React from "react";
import { AgentWithStats } from "@/hooks/useAgentStream";
import { Clock } from "lucide-react";

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
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4 relative overflow-hidden group hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-zinc-800 text-zinc-100">
            {avatarInitial}
          </div>
          {/* Status dot */}
          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-900 bg-zinc-900 flex items-center justify-center">
            <div className={`w-full h-full rounded-full ${colorClass} ${isActive ? 'animate-pulse' : ''}`} />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-zinc-100 truncate flex-1">{agent.name}</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded uppercase bg-zinc-800 text-zinc-400 border border-zinc-700 flex-shrink-0">
              L{agent.level || "0"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 flex items-center gap-1.5 truncate">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colorClass}`}></span>
            <span className="truncate">{statusText}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-950 rounded-lg p-2.5 border border-zinc-800/50 flex flex-col justify-center overflow-hidden">
          <span className="text-[10px] text-zinc-500 mb-0.5 truncate uppercase tracking-wider">Msg/24h</span>
          <p className="text-sm font-medium text-zinc-300 truncate">
            {agent.messages_24h?.toLocaleString() || 0}
          </p>
        </div>
        
        <div className="bg-zinc-950 rounded-lg p-2.5 border border-zinc-800/50 flex flex-col justify-center overflow-hidden">
          <span className="text-[10px] text-zinc-500 mb-0.5 truncate uppercase tracking-wider">Tokens</span>
          <p className="text-sm font-medium text-zinc-300 truncate" title={agent.tokens?.toString() || '0'}>
            {agent.tokens ? (agent.tokens / 1000).toFixed(1) + 'k' : '0'}
          </p>
        </div>

        <div className="bg-zinc-950 rounded-lg p-2.5 border border-zinc-800/50 flex flex-col justify-center overflow-hidden">
          <span className="text-[10px] text-zinc-500 mb-0.5 truncate uppercase tracking-wider">Erros</span>
          <p className={`text-sm font-medium truncate ${agent.errors_24h > 0 ? "text-red-400" : "text-zinc-300"}`}>
            {agent.errors_24h || 0}
          </p>
        </div>
      </div>

      <div className="flex items-center text-[10px] text-zinc-500 mt-1 pt-3 border-t border-zinc-800/50">
        <Clock size={10} className="mr-1.5 flex-shrink-0" />
        <span className="truncate">Última atividade: {formatRelativeTime(agent.updated_at || agent.last_seen)}</span>
      </div>
    </div>
  );
}
