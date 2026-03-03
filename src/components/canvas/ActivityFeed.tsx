import React from "react";
import { ActivityEvent } from "@/hooks/useAgentStream";
import { 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCcw, 
  Power,
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
    case "ASSIGN": return <Play size={14} className="text-emerald-400" />;
    case "ACK":
    case "UPDATE": return <RefreshCcw size={14} className="text-blue-400" />;
    case "DONE": 
    case "CLOSE": return <CheckCircle2 size={14} className="text-zinc-400" />;
    case "BLOCKED": return <AlertCircle size={14} className="text-rose-400" />;
    default: return <Info size={14} className="text-zinc-500" />;
  }
}

function truncateString(str: string, num: number) {
  if (!str) return "";
  if (str.length <= num) return str;
  return str.slice(0, num) + "...";
}

function extractMessageFromPayload(payload: any) {
  if (!payload) return "Evento sem payload";
  if (typeof payload === "string") return truncateString(payload, 45);
  // Support custom shapes like { title: "..." } or { status_text: "..." }
  return truncateString(
    payload.title || payload.status_text || payload.message || "Evento executado",
    45
  );
}

export function ActivityFeed({ activities }: { activities: ActivityEvent[] }) {
  // To implement "Filtrável por agente (tabs no topo)", extracting unique agents:
  const [filter, setFilter] = React.useState<string>("all");
  
  const uniqueAgents = Array.from(new Set(activities.map(a => a.agent_id || a.source || "Sistema").filter(Boolean)));
  
  const filteredActivities = activities.filter(a => {
    if (filter === "all") return true;
    const agent = a.agent_id || a.source || "Sistema";
    return agent === filter;
  });

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Power size={14} className="text-emerald-500 animate-pulse" />
          Live Feed
        </h2>
        <span className="text-xs text-zinc-500 font-mono tracking-wider">
          {filteredActivities.length} EVTS
        </span>
      </div>

      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 flex gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
            filter === "all" 
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
              : "bg-zinc-800 text-zinc-400 border-transparent hover:bg-zinc-700"
          }`}
        >
          Todos
        </button>
        {uniqueAgents.map(agent => (
          <button
            key={agent}
            onClick={() => setFilter(agent)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
              filter === agent 
                ? "bg-zinc-700 text-zinc-100 border-zinc-600" 
                : "bg-zinc-800 text-zinc-400 border-transparent hover:bg-zinc-700"
            }`}
          >
            {agent}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredActivities.length === 0 ? (
          <div className="text-center text-zinc-600 text-sm mt-10">
            Aguardando eventos...
          </div>
        ) : (
          filteredActivities.map((activity, index) => (
            <div 
              key={activity.id || index}
              className="flex items-start gap-3 animate-slide-in group relative"
              style={{ animationDuration: '300ms' }}
            >
              <div className="pt-0.5 mt-0.5">
                {getEventIcon(activity.event_type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-zinc-300 capitalize">
                    {activity.agent_id || activity.source || "Sistema"}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {formatRelativeTime(activity.created_at)}
                  </span>
                </div>
                
                <p className="text-xs text-zinc-400 leading-relaxed truncate">
                  <span className="font-mono text-[10px] text-zinc-600 mr-2 uppercase">
                    [{activity.event_type}]
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
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn ease-out forwards;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}} />
    </div>
  );
}
