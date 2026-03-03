import React from "react";
import { AgentWithStats, ReliabilityMeta } from "@/hooks/useAgentStream";
import { Clock, Wifi, ShieldCheck } from "lucide-react";

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

function formatLastPing(dateString: string | null) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const STATUS_CONFIG = {
  active:   { label: "Em Operação", dot: "bg-emerald-500", glow: "shadow-emerald-500/40", border: "border-emerald-500/20", accent: "from-emerald-500/25 to-transparent", pulse: true },
  idle:     { label: "Ocioso",      dot: "bg-zinc-400",    glow: "shadow-zinc-400/10",   border: "border-zinc-700/40",    accent: "from-zinc-500/15 to-transparent",  pulse: false },
  degraded: { label: "Instável",    dot: "bg-yellow-500",  glow: "shadow-yellow-500/40", border: "border-yellow-500/20", accent: "from-yellow-500/25 to-transparent", pulse: true },
  down:     { label: "Offline",     dot: "bg-red-500",     glow: "shadow-red-500/40",    border: "border-red-500/20",    accent: "from-red-500/25 to-transparent",    pulse: true },
} as const;

const LEVEL_CONFIG = {
  "1": { label: "L1", color: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  "2": { label: "L2", color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25" },
  "3": { label: "L3", color: "bg-purple-500/15 text-purple-400 border-purple-500/25" },
  "4": { label: "L4", color: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25" },
} as const;

function ReliabilityBadge({ score, meta }: { score?: number; meta?: ReliabilityMeta }) {
  if (score == null) return <span className="text-zinc-500 font-mono text-sm">—</span>;
  const s = Math.round(score);
  const colorClass = s >= 80
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
    : s >= 60
    ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25"
    : "bg-red-500/15 text-red-400 border-red-500/25";

  return (
    <div className="group relative inline-flex items-center cursor-help">
      <span className={`text-[11px] font-bold border rounded-md px-2 py-0.5 font-mono tracking-wider ${colorClass}`}>
        {s}
      </span>
      {meta && (
        <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 p-3 rounded-xl shadow-2xl w-48 space-y-1.5">
          <p className="font-semibold text-zinc-100 mb-2 text-sm">Score SLA</p>
          {meta.sla_rate != null && <p>SLA: <span className="text-white font-medium">{Math.round(meta.sla_rate)}%</span></p>}
          {meta.completion_rate != null && <p>Conclusão: <span className="text-white font-medium">{Math.round(meta.completion_rate)}%</span></p>}
          {meta.error_rate != null && <p>Erro: <span className="text-white font-medium">{Math.round(meta.error_rate)}%</span></p>}
          {meta.avg_ack_min != null && <p>ACK médio: <span className="text-white font-medium">{Math.round(meta.avg_ack_min)} min</span></p>}
          {meta.sample_size != null && <p className="text-zinc-500">Amostra: {meta.sample_size}</p>}
        </div>
      )}
    </div>
  );
}

export function AgentCard({ agent }: { agent: AgentWithStats }) {
  const cfg = STATUS_CONFIG[agent.status ?? "idle"] ?? STATUS_CONFIG.idle;
  const levelKey = String(agent.level || "1") as keyof typeof LEVEL_CONFIG;
  const levelCfg = LEVEL_CONFIG[levelKey] ?? LEVEL_CONFIG["1"];
  const avatarInitial = agent.name ? agent.name.charAt(0).toUpperCase() : "?";
  const errors = agent.errors_24h ?? 0;

  return (
    <div className={`glass rounded-2xl p-5 shadow-xl shadow-black/40 relative overflow-visible group transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl ${cfg.border}`}>
      {/* Top accent line */}
      <div className={`absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r ${cfg.accent}`} />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <div className="w-11 h-11 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-lg font-bold text-zinc-200 shadow-inner">
              {avatarInitial}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-zinc-950 ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""} shadow-lg ${cfg.glow}`} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-[15px] leading-tight mb-1 truncate">{agent.name}</h3>
            <p className="text-[11px] tracking-widest text-zinc-400 flex items-center gap-1.5 uppercase font-medium">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
              {cfg.label}
            </p>
          </div>
        </div>

        {/* Clearance badge */}
        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-md uppercase border font-mono font-bold tracking-widest ${levelCfg.color}`}>
          {levelCfg.label}
        </span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-black/40 border border-white/[0.05] rounded-xl p-2.5">
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1.5">Msg/24h</p>
          <p className="text-xl font-light text-white">{(agent.messages_24h ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-black/40 border border-white/[0.05] rounded-xl p-2.5">
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1.5">Tokens</p>
          <p className="text-xl font-light text-zinc-300">
            {agent.tokens ? (agent.tokens >= 1000 ? (agent.tokens / 1000).toFixed(0) + "k" : String(agent.tokens)) : "0"}
          </p>
        </div>
        <div className={`border rounded-xl p-2.5 ${errors > 0 ? "bg-red-500/10 border-red-500/20" : "bg-black/40 border-white/[0.05]"}`}>
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1.5">Erros/24h</p>
          <p className={`text-xl font-light ${errors > 0 ? "text-red-400" : "text-zinc-300"}`}>{errors}</p>
        </div>
      </div>

      {/* Secondary info */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pb-3.5 mb-3.5 border-b border-white/[0.05] text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 flex items-center gap-1.5"><ShieldCheck size={11} /> Reliability</span>
          <ReliabilityBadge score={agent.reliability_score} meta={agent.reliability_meta} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 flex items-center gap-1.5"><Wifi size={11} /> Last Ping</span>
          <span className="text-zinc-300 font-mono text-[10px]">{formatLastPing(agent.last_seen)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
        <Clock size={11} className="text-zinc-600 shrink-0" />
        Atualizado {formatRelativeTime(agent.updated_at || agent.last_seen)}
      </div>
    </div>
  );
}
