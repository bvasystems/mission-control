import React from "react";
import { AgentWithStats, ReliabilityMeta } from "@/hooks/useAgentStream";
import { Clock, Wifi, ShieldCheck, MessageSquare, Fingerprint, AlertTriangle } from "lucide-react";

function formatRelativeTime(dateString: string) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatLastPing(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const STATUS = {
  active:   { dot: "bg-emerald-500 shadow-emerald-500/60", label: "Em Operação", pulse: true },
  idle:     { dot: "bg-zinc-400 shadow-zinc-400/30",       label: "Ocioso",       pulse: false },
  degraded: { dot: "bg-yellow-500 shadow-yellow-500/60",   label: "Instável",     pulse: true },
  down:     { dot: "bg-red-500 shadow-red-500/60",         label: "Offline",       pulse: true },
} as const;

const LEVEL_COLOR: Record<string, string> = {
  "1": "text-blue-400",
  "2": "text-indigo-400",
  "3": "text-purple-400",
  "4": "text-fuchsia-400",
};

function ReliabilityPill({ score, meta }: { score?: number; meta?: ReliabilityMeta }) {
  if (score == null) return <span className="text-zinc-600">—</span>;
  const s = Math.round(score);
  const cls = s >= 80 ? "text-emerald-400" : s >= 60 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="group/tt relative inline-flex cursor-help">
      <span className={`font-mono font-bold text-sm ${cls}`}>{s}</span>
      {meta && (
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 opacity-0 group-hover/tt:opacity-100 transition-opacity bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 p-3 rounded-xl shadow-2xl w-48 space-y-1">
          <p className="font-semibold text-white mb-1.5">Score SLA</p>
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
  const avatarInitial = agent.name.charAt(0).toUpperCase();
  const levelColor = LEVEL_COLOR[String(agent.level ?? "1")] ?? "text-blue-400";
  const errors = agent.errors_24h ?? 0;

  return (
    <div className={`glass rounded-2xl relative overflow-visible group transition-all duration-300 hover:shadow-2xl hover:shadow-black/40 border border-white/[0.06] hover:border-white/[0.12] cursor-default`}>

      {/* ── Default state ── compact, always visible */}
      <div className="flex items-center gap-4 px-5 py-4 transition-all duration-300 group-hover:opacity-0 group-hover:pointer-events-none absolute inset-0">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-base font-bold text-zinc-200 shadow-inner">
            {avatarInitial}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 shadow-lg shadow-current ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""}`} />
        </div>

        {/* Name + level */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-[15px] leading-tight truncate">
            {agent.name}
            <span className={`ml-2 text-[10px] font-mono ${levelColor}`}>L{agent.level}</span>
          </p>
          <p className={`text-[11px] font-mono tracking-widest uppercase mt-0.5 ${errors > 0 ? "text-red-400" : "text-zinc-500"}`}>
            {errors > 0 ? `${errors} erro${errors > 1 ? "s" : ""}` : cfg.label}
          </p>
        </div>

        {/* Status dot only indicator */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""} shadow-[0_0_8px] shadow-current`} />
      </div>

      {/* ── Hover state ── full detail panel */}
      <div className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 px-5 py-4 space-y-4">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-base font-bold text-zinc-200">
              {avatarInitial}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-[15px] leading-tight">{agent.name}</p>
            <p className={`text-[11px] uppercase tracking-widest font-mono ${cfg.dot.includes("emerald") ? "text-emerald-400" : cfg.dot.includes("yellow") ? "text-yellow-400" : cfg.dot.includes("red") ? "text-red-400" : "text-zinc-400"}`}>
              {cfg.label}
            </p>
          </div>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${levelColor} border-current bg-current/10`}>L{agent.level}</span>
        </div>

        {/* Metric chips */}
        <div className="grid grid-cols-3 gap-2">
          <MetricChip icon={<MessageSquare size={11} />} label="MSG/24H" value={(agent.messages_24h ?? 0).toLocaleString()} />
          <MetricChip icon={<Fingerprint size={11} />} label="TOKENS" value={agent.tokens ? (agent.tokens >= 1000 ? (agent.tokens / 1000).toFixed(0) + "k" : String(agent.tokens)) : "0"} />
          <MetricChip icon={<AlertTriangle size={11} />} label="ERROS" value={String(errors)} highlight={errors > 0} />
        </div>

        {/* Secondary row */}
        <div className="flex items-center justify-between text-[11px] pt-3 border-t border-white/[0.05]">
          <div className="flex items-center gap-1.5 text-zinc-500">
            <ShieldCheck size={11} />
            <span>Reliability</span>
            <ReliabilityPill score={agent.reliability_score} meta={agent.reliability_meta} />
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500">
            <Wifi size={11} />
            <span className="font-mono text-zinc-400 text-[10px]">{formatLastPing(agent.last_seen)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500">
            <Clock size={11} />
            <span className="font-mono text-[10px]">{formatRelativeTime(agent.updated_at || agent.last_seen)}</span>
          </div>
        </div>
      </div>

      {/* Height spacer to ensure consistent card height */}
      <div className="invisible px-5 py-4 space-y-4">
        <div className="flex items-center gap-3 h-10"></div>
        <div className="grid grid-cols-3 gap-2 h-12"></div>
        <div className="pt-3 border-t border-transparent h-7"></div>
      </div>
    </div>
  );
}

function MetricChip({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-2.5 border ${highlight ? "bg-red-500/10 border-red-500/20" : "bg-black/40 border-white/[0.05]"}`}>
      <p className={`text-[9px] uppercase tracking-widest mb-1.5 flex items-center gap-1 ${highlight ? "text-red-400" : "text-zinc-500"}`}>
        {icon} {label}
      </p>
      <p className={`text-lg font-light ${highlight ? "text-red-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
