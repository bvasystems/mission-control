import React from "react";
import { ActivityEvent } from "@/hooks/useAgentStream";
import { 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCcw, 
  TerminalSquare,
  Info 
} from "lucide-react";

function formatRelativeTime(dateString: string) {
  if (!dateString) return "agora";
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds}s`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;
  return `${Math.floor(diffInHours / 24)}d`;
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

function truncateString(str: string, num: number) {
  if (!str) return "";
  if (str.length <= num) return str;
  return str.slice(0, num) + "...";
}

function extractMessageFromPayload(payload: unknown) {
  if (!payload) return "Evento executado em background";
  if (typeof payload === "string") return truncateString(payload, 50);
  
  if (typeof payload === "object" && payload !== null) {
    const p = payload as Record<string, unknown>;
    const msg = p.title || p.status_text || p.message;
    if (typeof msg === "string") {
      return truncateString(msg, 50);
    }
  }
  
  return "Evento computado";
}

export function ActivityFeed({ activities }: { activities: ActivityEvent[] }) {
  const [filter, setFilter] = React.useState<string>("all");
  
  const uniqueAgents = Array.from(new Set(activities.map(a => a.agent_id || a.source || "Sistema").filter(Boolean)));
  
  const filteredActivities = activities.filter(a => {
    if (filter === "all") return true;
    const agent = a.agent_id || a.source || "Sistema";
    return agent === filter;
  });

  return (
    <div className="flex flex-col h-full glass rounded-2xl overflow-hidden shadow-2xl relative">
      <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-blue-500/10 blur-[60px] rounded-full pointer-events-none -z-10"></div>
      
      <div className="px-5 py-4 border-b border-white/[0.08] bg-black/40">
        <h2 className="text-sm uppercase tracking-widest text-zinc-400 font-medium flex items-center justify-between">
          <span className="flex items-center gap-2"><TerminalSquare size={16} className="text-blue-400"/> Live Feed</span>
          <span className="text-[10px] text-blue-500 bg-blue-500/10 px-2 py-1 rounded font-mono border border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.2)]">
            {filteredActivities.length} PACKETS
          </span>
        </h2>
      </div>

      <div className="px-3 py-2 border-b border-white/[0.04] bg-black/20 flex gap-2 overflow-x-auto custom-scrollbar flex-shrink-0">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded text-[10px] font-mono whitespace-nowrap transition-colors uppercase tracking-wider border ${
            filter === "all" 
              ? "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.3)]" 
              : "bg-black/60 text-zinc-500 border-transparent hover:bg-black/80 hover:text-zinc-300"
          }`}
        >
          Stream Global
        </button>
        {uniqueAgents.map(agent => (
          <button
            key={agent}
            onClick={() => setFilter(agent)}
            className={`px-3 py-1 rounded text-[10px] font-mono whitespace-nowrap transition-colors uppercase tracking-wider border ${
              filter === agent 
                ? "bg-white/[0.08] text-zinc-100 border-white/[0.15]" 
                : "bg-black/60 text-zinc-500 border-transparent hover:bg-black/80 hover:text-zinc-300"
            }`}
          >
            {agent}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {filteredActivities.length === 0 ? (
          <div className="text-center text-zinc-600 text-sm mt-10 italic">
            Sem intercepções ativas...
          </div>
        ) : (
          filteredActivities.map((activity, index) => (
            <div 
              key={activity.id || index}
              className="flex items-start gap-3 animate-slide-in group p-3 bg-black/40 border border-white/[0.04] rounded-xl hover:bg-black/60 hover:border-white/[0.08] transition-colors relative overflow-hidden"
              style={{ animationDuration: '300ms' }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="pt-0.5 ml-1 bg-black/60 border border-white/10 p-1.5 rounded-lg shadow-inner">
                {getEventIcon(activity.event_type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_currentColor]"></span> {activity.agent_id || activity.source || "Sistema"}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono tracking-wider">
                    {formatRelativeTime(activity.created_at)}
                  </span>
                </div>
                
                <p className="text-xs text-zinc-400 leading-snug">
                  <span className="font-mono text-[9px] text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded mr-1.5 border border-blue-500/20">
                    {activity.event_type}
                  </span>
                  {extractMessageFromPayload(activity.payload)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in {
          animation: slideIn ease-out forwards;
        }
      `}} />
    </div>
  );
}
