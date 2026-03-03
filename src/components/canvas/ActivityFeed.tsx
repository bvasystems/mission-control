import React from "react";
import { ActivityEvent } from "@/hooks/useAgentStream";
import { Play, CheckCircle2, AlertCircle, RefreshCcw, Info, X, Activity } from "lucide-react";

function formatRelativeTime(dateString: string) {
  if (!dateString) return "agora";
  const d = new Date(dateString);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function getEventIcon(type: string) {
  switch (type?.toUpperCase()) {
    case "ASSIGN": return <Play size={12} className="text-emerald-400" />;
    case "ACK":
    case "UPDATE": return <RefreshCcw size={12} className="text-blue-400" />;
    case "DONE":
    case "CLOSE": return <CheckCircle2 size={12} className="text-zinc-400" />;
    case "BLOCKED": return <AlertCircle size={12} className="text-rose-400" />;
    default: return <Info size={12} className="text-zinc-500" />;
  }
}

function extractMessage(payload: unknown): string {
  if (!payload) return "Evento computado";
  if (typeof payload === "string") return payload.slice(0, 60);
  if (typeof payload === "object" && payload !== null) {
    const p = payload as Record<string, unknown>;
    const msg = p.title || p.status_text || p.message;
    if (typeof msg === "string") return msg.slice(0, 60);
  }
  return "Evento computado";
}

interface Props {
  activities: ActivityEvent[];
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
}

export function ActivityFeed({ activities, open, onClose, onOpen }: Props) {
  if (!open) {
    // Collapsed strip — just a clickable icon column
    return (
      <button
        onClick={onOpen}
        className="w-full h-full flex flex-col items-center justify-start pt-5 gap-3 text-zinc-500 hover:text-zinc-300 transition-colors"
        title="Abrir Activity Feed"
      >
        <Activity size={18} />
        {activities.length > 0 && (
          <span className="bg-blue-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {activities.length > 99 ? "99" : activities.length}
          </span>
        )}
        {/* Rotated label */}
        <span
          className="text-[9px] font-mono uppercase tracking-widest mt-2 whitespace-nowrap opacity-50"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Activity
        </span>
      </button>
    );
  }

  // Open state
  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2 shrink-0">
        <Activity size={15} className="text-blue-400" />
        <span className="text-xs font-medium tracking-wide text-zinc-300 flex-1">Activity</span>
        <span className="text-[9px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">
          {activities.length}
        </span>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors ml-1">
          <X size={14} />
        </button>
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3 pb-10">
            <Activity size={28} className="opacity-30" />
            <p className="text-xs text-center italic">No activity yet</p>
          </div>
        ) : (
          activities.map((ev, i) => (
            <div
              key={ev.id || i}
              className="flex items-start gap-2.5 px-3 py-2.5 bg-black/30 border border-white/[0.04] rounded-xl hover:bg-black/50 transition-colors"
            >
              <div className="mt-0.5 shrink-0">{getEventIcon(ev.event_type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider truncate">
                    {ev.agent_id || ev.source || "Sistema"}
                  </span>
                  <span className="text-[9px] text-zinc-600 font-mono shrink-0 ml-2">
                    {formatRelativeTime(ev.created_at)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 truncate">{extractMessage(ev.payload)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
