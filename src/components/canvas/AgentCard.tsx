import React from "react";
import { AgentWithStats } from "@/hooks/useAgentStream";
import { Clock, MessageSquare, Coins, AlertTriangle, Fingerprint } from "lucide-react";

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
    ? "bg-yellow-500" 
    : "bg-zinc-500";

  const glowClass = isActive 
    ? "bg-emerald-500/50 group-hover:bg-emerald-400 shadow-emerald-500/50" 
    : isDown 
    ? "bg-red-500/50 group-hover:bg-red-400 shadow-red-500/50" 
    : isDegraded 
    ? "bg-yellow-500/50 group-hover:bg-yellow-400 shadow-yellow-500/50" 
    : "bg-zinc-500/50 group-hover:bg-zinc-400 shadow-zinc-500/50";

  const statusText = isActive 
    ? "Em Operação" 
    : isDown 
    ? "Offline" 
    : isDegraded 
    ? "Instável" 
    : "Ocioso";

  const avatarInitial = agent.name ? agent.name.charAt(0).toUpperCase() : "?";

  return (
    <div className="glass rounded-2xl p-5 shadow-xl shadow-black/50 relative overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:bg-white/[0.04]">
      {/* Left Accent Glow */}
      <div className={`absolute top-0 left-0 w-[2px] h-full transition-colors ${glowClass}`}></div>
      
      {/* Background Ambient Glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] -z-10 opacity-30 ${isActive ? "bg-emerald-500" : isDown ? "bg-red-500" : isDegraded ? "bg-yellow-500" : "bg-transparent"}`}></div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-lg font-bold bg-black/60 text-zinc-100 shadow-inner">
            {avatarInitial}
          </div>
          {/* Status dot */}
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-zinc-950 flex items-center justify-center bg-zinc-950">
            <div className={`w-full h-full rounded-full shadow-[0_0_8px] ${colorClass} ${isActive || isDown || isDegraded ? 'animate-pulse' : ''} shadow-current`} />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-medium text-zinc-100 truncate flex-1 tracking-tight text-lg">{agent.name}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 flex-shrink-0 font-mono font-semibold tracking-wider">
              L{agent.level || "0"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 flex items-center gap-1.5 truncate uppercase tracking-widest font-medium">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-[0_0_5px] shadow-current ${colorClass}`}></span>
            <span className="truncate">{statusText}</span>
          </p>
        </div>
      </div>

      <div className="mt-6 mb-4 grid grid-cols-2 gap-3 pb-4 border-b border-white/[0.06]">
        <div className="bg-black/40 rounded-xl p-3 border border-white/[0.04] flex items-center justify-between group-hover:bg-black/60 transition-colors">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><MessageSquare size={12}/>Msg/24h</span>
            <span className="text-lg font-light tracking-tight text-white">{agent.messages_24h?.toLocaleString() || 0}</span>
          </div>
        </div>
        <div className="bg-black/40 rounded-xl p-3 border border-white/[0.04] flex items-center justify-between group-hover:bg-black/60 transition-colors">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Fingerprint size={12}/>Tokens</span>
            <span className="text-lg font-light tracking-tight text-zinc-300" title={agent.tokens?.toString() || '0'}>
              {agent.tokens ? (agent.tokens / 1000).toFixed(1) + 'k' : '0'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
          <Clock size={12} className="mr-1.5 text-zinc-600 flex-shrink-0" />
          <span className="truncate">LAST UPDATE: {formatRelativeTime(agent.updated_at || agent.last_seen)}</span>
        </div>
        {agent.errors_24h > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 uppercase tracking-wider">
            <AlertTriangle size={12} /> {agent.errors_24h} ERR
          </div>
        )}
      </div>

    </div>
  );
}
