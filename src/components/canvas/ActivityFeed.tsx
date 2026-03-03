import React, { useState } from "react";
import { ActivityEvent } from "@/hooks/useAgentStream";
import { Play, CheckCircle2, AlertCircle, RefreshCcw, TerminalSquare, Info, X } from "lucide-react";

function formatRelativeTime(dateString: string) {
  if (!dateString) return "agora";
  const date = new Date(dateString);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
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
}

export function ActivityFeed({ activities, open, onClose }: Props) {
  const [filter, setFilter] = useState("all");
  const uniqueAgents = Array.from(new Set(activities.map(a => a.agent_id || a.source || "Sistema").filter(Boolean)));
  const filtered = activities.filter(a => filter === "all" || (a.agent_id || a.source || "Sistema") === filter);

  return (
    <div
      className={`flex flex-col glass border-l border-white/[0.08] shadow-2xl absolute top-0 right-0 bottom-0 z-30 transition-all duration-300 ease-in-out overflow-hidden ${open ? "w-[340px]" : "w-0"}`}
    >
      {open && (
        <>
          {/* Header */}
          <div className="shrink-0 px-4 py-4 border-b border-white/[0.08] flex items-center gap-3">
            <TerminalSquare size={16} className="text-blue-400" />
            <span className="text-sm font-medium tracking-wide text-zinc-200 flex-1">Live Feed</span>
            <span className="text-[10px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-md">
              {filtered.length}
            </span>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors ml-1">
              <X size={16} />
            </button>
          </div>

          {/* Filter tabs */}
          <div className="shrink-0 flex gap-2 px-3 py-2 border-b border-white/[0.05] overflow-x-auto scrollbar-hide">
            {["all", ...uniqueAgents].map(ag => (
              <button
                key={ag}
                onClick={() => setFilter(ag)}
                className={`px-3 py-1 rounded text-[10px] font-mono whitespace-nowrap uppercase tracking-wider border transition-colors ${
                  filter === ag
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                    : "bg-black/60 text-zinc-500 border-transparent hover:text-zinc-300"
                }`}
              >
                {ag === "all" ? "Global" : ag}
              </button>
            ))}
          </div>

          {/* Events list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filtered.length === 0 ? (
              <p className="text-center text-zinc-600 text-sm mt-10 italic">Sem intercepções...</p>
            ) : (
              filtered.map((ev, i) => (
                <div
                  key={ev.id || i}
                  className="flex items-start gap-3 px-3 py-2.5 bg-black/40 border border-white/[0.04] rounded-xl hover:bg-black/60 hover:border-white/[0.08] transition-colors group"
                >
                  <div className="mt-0.5 bg-black/60 border border-white/10 p-1.5 rounded-lg shrink-0">
                    {getEventIcon(ev.event_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider truncate">
                        {ev.agent_id || ev.source || "Sistema"}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-mono shrink-0 ml-2">
                        {formatRelativeTime(ev.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate">
                      <span className="font-mono text-[9px] text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded mr-1.5">
                        {ev.event_type}
                      </span>
                      {extractMessage(ev.payload)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <style dangerouslySetInnerHTML={{ __html: `.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{scrollbar-width:none}` }} />
        </>
      )}
    </div>
  );
}
