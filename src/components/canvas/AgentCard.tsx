import React from "react";
import { AgentWithStats, ReliabilityMeta } from "@/hooks/useAgentStream";
import { Clock, Wifi, ShieldCheck, MessageSquare, Fingerprint, AlertTriangle } from "lucide-react";

function fmt(d: string) {
  if (!d) return "—";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function ping(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const STATUS = {
  active:   { glow: "#10b981", ring: "ring-emerald-500/40", badge: "bg-emerald-500", label: "ativo",     pulse: true  },
  idle:     { glow: "#71717a", ring: "ring-zinc-600/40",    badge: "bg-zinc-500",    label: "ocioso",    pulse: false },
  degraded: { glow: "#eab308", ring: "ring-yellow-500/40",  badge: "bg-yellow-500",  label: "instável",  pulse: true  },
  down:     { glow: "#ef4444", ring: "ring-red-500/40",     badge: "bg-red-500",     label: "offline",   pulse: true  },
} as const;

function ReliabilityTip({ score, meta }: { score?: number; meta?: ReliabilityMeta }) {
  if (score == null) return <span className="text-zinc-600 font-mono">—</span>;
  const s = Math.round(score);
  const cls = s >= 80 ? "text-emerald-400" : s >= 60 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="group/tt relative">
      <span className={`font-mono font-bold text-xs cursor-help ${cls}`}>{s}</span>
      {meta && (
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 opacity-0 group-hover/tt:opacity-100 transition-opacity bg-zinc-900 border border-zinc-700 text-xs p-2.5 rounded-xl shadow-2xl w-44 space-y-1 text-zinc-300">
          <p className="font-semibold text-white text-[11px] mb-1">Score SLA</p>
          {meta.sla_rate != null && <p>SLA: <span className="text-white">{Math.round(meta.sla_rate)}%</span></p>}
          {meta.completion_rate != null && <p>Conclusão: <span className="text-white">{Math.round(meta.completion_rate)}%</span></p>}
          {meta.error_rate != null && <p>Erro: <span className="text-white">{Math.round(meta.error_rate)}%</span></p>}
          {meta.avg_ack_min != null && <p>ACK médio: <span className="text-white">{Math.round(meta.avg_ack_min)} min</span></p>}
        </div>
      )}
    </div>
  );
}

export function AgentCard({ agent }: { agent: AgentWithStats }) {
  const cfg = STATUS[agent.status ?? "idle"] ?? STATUS.idle;
  const initial = agent.name.charAt(0).toUpperCase();
  const errors = agent.errors_24h ?? 0;
  const tokens = agent.tokens ?? 0;

  return (
    <div className="relative group">
      {/* ── Compact card (always visible) ── */}
      <div
        className={`bg-zinc-900/80 border border-white/[0.07] rounded-2xl flex flex-col items-center justify-center text-center p-5 gap-3 cursor-default transition-all duration-200 aspect-square
          hover:bg-zinc-800/80 hover:border-white/[0.14] hover:shadow-2xl hover:shadow-black/60
          ring-1 ${cfg.ring}`}
      >
        {/* Avatar with status glow */}
        <div className="relative">
          {/* Outer ambient glow */}
          <div
            className="absolute inset-0 rounded-full blur-xl opacity-40"
            style={{ background: cfg.glow, transform: "scale(1.6)" }}
          />
          {/* Avatar circle */}
          <div
            className={`relative w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg ring-2 ${cfg.ring} bg-zinc-800 border border-white/10`}
          >
            {initial}
            {/* Status badge */}
            <span
              className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-zinc-900 ${cfg.badge} ${cfg.pulse ? "animate-pulse" : ""} shadow-lg`}
              style={{ boxShadow: `0 0 8px ${cfg.glow}` }}
            />
          </div>
          {/* Error badge */}
          {errors > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-zinc-900 shadow-lg">
              {errors > 9 ? "9+" : errors}
            </span>
          )}
        </div>

        {/* Name */}
        <div>
          <p className="text-sm font-semibold text-zinc-100 leading-tight truncate max-w-[120px]">{agent.name}</p>
          <p className={`text-[10px] font-mono uppercase tracking-widest mt-0.5 ${errors > 0 ? "text-red-400" : "text-zinc-500"}`}>
            {agent.level ? `L${agent.level}` : ""} {errors > 0 ? `· ${errors} err` : `· ${cfg.label}`}
          </p>
        </div>
      </div>

      {/* ── Hover details panel (tooltip overlay) ── */}
      <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-40 w-[220px] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 translate-y-2 group-hover:translate-y-0">
        <div className="bg-zinc-900 border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 p-4 space-y-3">
          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-0.5"><MessageSquare size={9} /> MSG</p>
              <p className="text-sm font-light text-white">{(agent.messages_24h ?? 0).toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-0.5"><Fingerprint size={9} /> TOK</p>
              <p className="text-sm font-light text-zinc-300">{tokens >= 1000 ? `${(tokens/1000).toFixed(0)}k` : tokens}</p>
            </div>
            <div className="text-center">
              <p className={`text-[9px] uppercase tracking-widest mb-1 flex items-center justify-center gap-0.5 ${errors > 0 ? "text-red-400" : "text-zinc-500"}`}><AlertTriangle size={9} /> ERR</p>
              <p className={`text-sm font-light ${errors > 0 ? "text-red-400" : "text-zinc-300"}`}>{errors}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/[0.06]" />

          {/* Secondary info */}
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-zinc-500">
              <span className="flex items-center gap-1"><ShieldCheck size={10} /> Reliability</span>
              <ReliabilityTip score={agent.reliability_score} meta={agent.reliability_meta} />
            </div>
            <div className="flex items-center justify-between text-zinc-500">
              <span className="flex items-center gap-1"><Wifi size={10} /> Last Ping</span>
              <span className="font-mono text-zinc-400 text-[10px]">{ping(agent.last_seen)}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-500">
              <span className="flex items-center gap-1"><Clock size={10} /> Update</span>
              <span className="font-mono text-zinc-400 text-[10px]">{fmt(agent.updated_at || agent.last_seen)}</span>
            </div>
          </div>
        </div>
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2.5 h-2.5 overflow-hidden">
          <div className="w-2.5 h-2.5 bg-zinc-900 border-r border-b border-white/[0.1] rotate-45 -translate-y-1.5" />
        </div>
      </div>
    </div>
  );
}
