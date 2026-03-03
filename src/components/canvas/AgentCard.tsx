import React from "react";
import { AgentWithStats } from "@/hooks/useAgentStream";
import { Clock, AlertTriangle } from "lucide-react";

function formatRelativeTime(dateString: string) {
  if (!dateString) return "desconhecido";
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `há ${diffInSeconds}s`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `há ${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `há ${diffInHours}h`;
  return `há ${Math.floor(diffInHours / 24)}d`;
}

const STATUS_CONFIG = {
  active:   { label: "Em Operação", color: "emerald", dot: "bg-emerald-500", glow: "shadow-emerald-500/30", border: "border-emerald-500/20", bg: "bg-emerald-500/5",   accent: "from-emerald-500/30 to-transparent" },
  idle:     { label: "Ocioso",      color: "zinc",    dot: "bg-zinc-400",    glow: "shadow-zinc-400/10",   border: "border-zinc-700/50",   bg: "bg-zinc-500/5",     accent: "from-zinc-500/20 to-transparent" },
  degraded: { label: "Instável",    color: "yellow",  dot: "bg-yellow-500",  glow: "shadow-yellow-500/30", border: "border-yellow-500/20", bg: "bg-yellow-500/5",   accent: "from-yellow-500/30 to-transparent" },
  down:     { label: "Offline",     color: "red",     dot: "bg-red-500",     glow: "shadow-red-500/30",    border: "border-red-500/20",    bg: "bg-red-500/5",      accent: "from-red-500/30 to-transparent" },
} as const;

export function AgentCard({ agent }: { agent: AgentWithStats }) {
  const cfg = STATUS_CONFIG[agent.status ?? "idle"] ?? STATUS_CONFIG.idle;
  const avatarInitial = agent.name ? agent.name.charAt(0).toUpperCase() : "?";
  const isActive = agent.status === "active";
  const isDegraded = agent.status === "degraded";
  const isDown = agent.status === "down";

  return (
    <div className={`glass rounded-2xl p-5 shadow-xl shadow-black/50 relative overflow-hidden group transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl ${cfg.border}`}>
      {/* Top accent gradient */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${cfg.accent}`} />
      
      {/* Background ambient */}
      {(isActive || isDegraded || isDown) && (
        <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 ${cfg.dot}`} />
      )}

      {/* Header: Avatar + Name + Status */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-xl font-semibold text-zinc-200 shadow-inner">
            {avatarInitial}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-zinc-950 ${cfg.dot} ${isActive || isDegraded || isDown ? "animate-pulse" : ""} shadow-lg ${cfg.glow}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white text-base leading-tight truncate">{agent.name}</h3>
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md uppercase bg-blue-500/15 text-blue-400 border border-blue-500/25 font-mono font-bold tracking-wider">
              L{agent.level || "0"}
            </span>
          </div>
          <p className="text-xs tracking-wide text-zinc-400 flex items-center gap-1.5 uppercase font-medium">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
            {cfg.label}
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-black/40 border border-white/[0.05] rounded-xl p-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Msg / 24h</p>
          <p className="text-2xl font-light text-white tracking-tight">
            {(agent.messages_24h ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-black/40 border border-white/[0.05] rounded-xl p-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Tokens</p>
          <p className="text-2xl font-light text-zinc-300 tracking-tight">
            {agent.tokens ? (agent.tokens / 1000).toFixed(1) + "k" : "0"}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
          <Clock size={11} className="text-zinc-600" />
          {formatRelativeTime(agent.updated_at || agent.last_seen)}
        </div>

        {(agent.errors_24h ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-2 py-0.5 rounded-md uppercase tracking-wider">
            <AlertTriangle size={11} />
            {agent.errors_24h} erro{agent.errors_24h > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
