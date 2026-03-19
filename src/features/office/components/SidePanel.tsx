"use client";

import { useState } from "react";
import {
  X, ExternalLink, AlertTriangle, CheckCircle2, Clock, Bot,
  FolderKanban, Flame, Activity, Send, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { useOfficeStore, type PanelType } from "../store";
import {
  useAgents,
  useProjects,
  useIncidents,
  useCrons,
  useStats,
  useTasks,
  type Agent,
  type Project,
  type Incident,
  type CronJob,
  type Task,
} from "../hooks/useOfficeData";
import { useDispatchHistory, useSendDispatch } from "../hooks/useDispatch";
import { QUICK_ACTIONS, type AgentDispatch, type DispatchState } from "../types";
import Link from "next/link";

// ── Status badge colors ───────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  idle: "bg-zinc-500",
  degraded: "bg-yellow-500",
  down: "bg-red-500",
  at_risk: "bg-yellow-500",
  blocked: "bg-red-500",
  done: "bg-green-500",
  open: "bg-red-500",
  investigating: "bg-yellow-500",
  mitigated: "bg-blue-500",
  closed: "bg-zinc-500",
  error: "bg-red-500",
  paused: "bg-zinc-500",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10",
  high: "text-orange-400 bg-orange-500/10",
  medium: "text-yellow-400 bg-yellow-500/10",
  low: "text-zinc-400 bg-zinc-500/10",
};

const DISPATCH_STATUS_CONFIG: Record<DispatchState, { label: string; color: string; dot: string }> = {
  queued:       { label: "Na fila",      color: "text-zinc-400",   dot: "bg-zinc-400" },
  sent:         { label: "Enviado",      color: "text-blue-400",   dot: "bg-blue-400" },
  acknowledged: { label: "Recebido",    color: "text-indigo-400", dot: "bg-indigo-400" },
  blocked:      { label: "Bloqueado",    color: "text-red-400",    dot: "bg-red-400" },
  done:         { label: "Concluído",    color: "text-green-400",  dot: "bg-green-400" },
  failed:       { label: "Falhou",       color: "text-red-500",    dot: "bg-red-500" },
};

// ── Panel titles & icons ──────────────────────────────────────────────────────
const PANEL_CONFIG: Record<string, { title: string; icon: React.ReactNode; route: string }> = {
  agents: { title: "Agentes", icon: <Bot size={16} />, route: "/agents" },
  projects: { title: "Projetos", icon: <FolderKanban size={16} />, route: "/projects" },
  kanban: { title: "Kanban Board", icon: <Activity size={16} />, route: "/kanban" },
  incidents: { title: "Incidentes", icon: <Flame size={16} />, route: "/incidents" },
  crons: { title: "Cron Jobs", icon: <Clock size={16} />, route: "/crons" },
  stats: { title: "Dashboard", icon: <Activity size={16} />, route: "/" },
  meeting: { title: "Sala de Reunião", icon: <Activity size={16} />, route: "/office" },
  "agent-detail": { title: "Controle do Agente", icon: <Bot size={16} />, route: "/agents" },
};

// ── Agent Detail Panel (EXPANDED) ─────────────────────────────────────────────
function AgentDetailPanel({ agentId }: { agentId: string }) {
  const { data: agents } = useAgents();
  const { data: allTasks } = useTasks();
  const { data: history, isLoading: historyLoading } = useDispatchHistory(agentId);
  const { send, sending, error: sendError } = useSendDispatch();
  const { commandDraft, setCommandDraft } = useOfficeStore();
  const [showHistory, setShowHistory] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  const agent = agents?.find(
    (a) => a.name.toLowerCase() === agentId.toLowerCase() || a.id === agentId
  );

  if (!agent) return <p className="text-zinc-500 text-sm">Agente não encontrado</p>;

  // Tasks assigned to this agent
  const agentTasks = allTasks?.filter(
    (t) => (t.owner?.toLowerCase() === agent.name.toLowerCase() ||
            t.assigned_to?.toLowerCase() === agent.name.toLowerCase()) &&
           t.column !== "done"
  ) ?? [];

  const handleSend = async () => {
    if (!commandDraft.trim()) return;
    const result = await send({
      targetAgent: agent.name.toLowerCase(),
      commandText: commandDraft.trim(),
      actionType: "free_command",
    });
    if (result) {
      setLastSent(result.id);
      setCommandDraft("");
      setTimeout(() => setLastSent(null), 3000);
    }
  };

  const handleDelegateTask = async (task: Task) => {
    setShowTaskPicker(false);
    const result = await send({
      targetAgent: agent.name.toLowerCase(),
      commandText: `Tarefa delegada: ${task.title}`,
      actionType: "delegate_task",
      taskId: task.id,
      projectKey: task.project_key ?? undefined,
    });
    if (result) {
      setLastSent(result.id);
      setTimeout(() => setLastSent(null), 3000);
    }
  };

  const handleQuickAction = async (actionType: string, template: string) => {
    if (template && !template.endsWith(": ")) {
      // Full command — send immediately
      const result = await send({
        targetAgent: agent.name.toLowerCase(),
        commandText: template,
        actionType,
      });
      if (result) {
        setLastSent(result.id);
        setTimeout(() => setLastSent(null), 3000);
      }
    } else {
      // Partial template — pre-fill input
      setCommandDraft(template);
    }
  };

  return (
    <div className="space-y-5">
      {/* Agent header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: agentColor(agent.name) }}
          >
            {agent.name.charAt(0)}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-zinc-950 ${STATUS_DOT[agent.status]}`} />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-base">{agent.name}</p>
          <p className="text-zinc-500 text-xs">Level {agent.level} · {agent.status}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Msgs 24h" value={agent.messages_24h} />
        <Stat label="Erros 24h" value={agent.errors_24h} warn={agent.errors_24h > 0} />
        <Stat label="Reliability" value={agent.reliability_score != null ? `${agent.reliability_score}%` : "—"} />
        <Stat label="Último ping" value={timeAgo(agent.last_seen)} />
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.06]" />

      {/* Active tasks */}
      {agentTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowTasks(!showTasks)}
            className="flex items-center justify-between w-full text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-2"
          >
            <span>Tasks ativas ({agentTasks.length})</span>
            {showTasks ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showTasks && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {agentTasks.map((t: Task) => (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    t.priority === "P0" ? "bg-red-500/20 text-red-400" :
                    t.priority === "P1" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-zinc-500/20 text-zinc-400"
                  }`}>{t.priority}</span>
                  <p className="text-xs text-zinc-300 truncate flex-1">{t.title}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                    t.column === "blocked" ? "bg-red-500/10 text-red-400" :
                    t.column === "in_progress" ? "bg-blue-500/10 text-blue-400" :
                    t.column === "review" ? "bg-purple-500/10 text-purple-400" :
                    "bg-zinc-500/10 text-zinc-500"
                  }`}>{t.column}</span>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-white/[0.06] mt-3" />
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">Ações rápidas</p>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                if (action.actionType === "delegate_task") {
                  setShowTaskPicker(!showTaskPicker);
                } else {
                  handleQuickAction(action.actionType, action.commandTemplate);
                }
              }}
              disabled={sending}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] transition-all text-left text-xs text-zinc-300 hover:text-white disabled:opacity-50"
            >
              <span className="text-sm">{action.icon}</span>
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Task picker for "Delegar tarefa" */}
        {showTaskPicker && (
          <div className="mt-2 border border-white/[0.08] rounded-lg bg-white/[0.02] max-h-48 overflow-y-auto">
            <p className="text-[10px] text-zinc-500 px-3 py-2 border-b border-white/[0.06] sticky top-0 bg-zinc-950/95">
              Selecionar task para delegar:
            </p>
            {allTasks?.filter((t) => t.column !== "done").slice(0, 20).map((t: Task) => (
              <button
                key={t.id}
                onClick={() => handleDelegateTask(t)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.05] transition-colors text-left border-b border-white/[0.03] last:border-0"
              >
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded shrink-0 ${
                  t.priority === "P0" ? "bg-red-500/20 text-red-400" :
                  t.priority === "P1" ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-zinc-500/20 text-zinc-400"
                }`}>{t.priority}</span>
                <span className="text-xs text-zinc-300 truncate flex-1">{t.title}</span>
                <span className="text-[9px] text-zinc-600 shrink-0">{t.column}</span>
              </button>
            ))}
            {(!allTasks || allTasks.filter((t) => t.column !== "done").length === 0) && (
              <p className="text-xs text-zinc-600 text-center py-4">Nenhuma task disponível</p>
            )}
          </div>
        )}
      </div>

      {/* Command input */}
      <div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">Enviar comando</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={commandDraft}
            onChange={(e) => setCommandDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder={`Comando para ${agent.name}...`}
            disabled={sending}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !commandDraft.trim()}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition-colors flex items-center gap-1.5 text-sm shrink-0"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>

        {/* Feedback */}
        {lastSent && (
          <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
            <CheckCircle2 size={12} /> Comando enviado com sucesso
          </p>
        )}
        {sendError && (
          <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
            <AlertTriangle size={12} /> {sendError}
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.06]" />

      {/* Command history — chat-style */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-2"
        >
          <span>Conversas</span>
          {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showHistory && (
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {historyLoading && <Loading />}
            {!historyLoading && (!history || history.length === 0) && (
              <p className="text-xs text-zinc-600 text-center py-3">Nenhum comando enviado ainda</p>
            )}
            {history?.map((d: AgentDispatch) => {
              const sc = DISPATCH_STATUS_CONFIG[d.status];
              const isInbound = d.direction === "inbound";

              return (
                <div key={d.id} className="space-y-1.5">
                  {/* ── Inbound message (agent → operator) ─────────────── */}
                  {isInbound ? (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] bg-white/[0.05] border border-white/[0.08] rounded-xl rounded-bl-sm px-3 py-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ backgroundColor: agentColor(agent.name) }}
                          >
                            {agent.name.charAt(0)}
                          </div>
                          <span className="text-[10px] text-zinc-500 font-medium">{agent.name}</span>
                          {d.metadata && typeof d.metadata === "object" && "source" in d.metadata && (
                            <span className="text-[9px] text-zinc-700 bg-white/[0.04] px-1 rounded">via {String(d.metadata.source)}</span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-200 break-words leading-relaxed">{d.command_text}</p>
                        <p className="text-[10px] text-zinc-600 mt-1">{timeAgo(d.created_at)}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* ── Outbound command (operator → agent) ──────────── */}
                      <div className="flex justify-end">
                        <div className="max-w-[85%] bg-indigo-600/20 border border-indigo-500/20 rounded-xl rounded-br-sm px-3 py-2">
                          <p className="text-xs text-indigo-200 break-words leading-relaxed">{d.command_text}</p>
                          <div className="flex items-center justify-end gap-2 mt-1">
                            <span className="text-[10px] text-indigo-400/60">{timeAgo(d.created_at)}</span>
                            <span className={`text-[10px] ${sc.color}`}>{sc.label}</span>
                          </div>
                        </div>
                      </div>

                      {/* ── Agent response to outbound ───────────────────── */}
                      {d.response ? (
                        <div className="flex justify-start">
                          <div className="max-w-[85%] bg-white/[0.05] border border-white/[0.08] rounded-xl rounded-bl-sm px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                                style={{ backgroundColor: agentColor(agent.name) }}
                              >
                                {agent.name.charAt(0)}
                              </div>
                              <span className="text-[10px] text-zinc-500 font-medium">{agent.name}</span>
                            </div>
                            <p className="text-xs text-zinc-200 break-words leading-relaxed">{d.response}</p>
                            {d.responded_at && (
                              <p className="text-[10px] text-zinc-600 mt-1">{timeAgo(d.responded_at)}</p>
                            )}
                          </div>
                        </div>
                      ) : d.status === "failed" ? (
                        <div className="flex justify-start">
                          <div className="bg-red-500/5 border border-red-500/10 rounded-xl rounded-bl-sm px-3 py-1.5">
                            <span className="text-[10px] text-red-400 italic">Timeout — sem resposta</span>
                          </div>
                        </div>
                      ) : d.status !== "done" ? (
                        <div className="flex justify-start">
                          <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl rounded-bl-sm px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-0.5">
                                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                              <span className="text-[10px] text-zinc-600">Aguardando resposta...</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-start">
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl rounded-bl-sm px-3 py-1.5">
                            <span className="text-[10px] text-zinc-600 italic">Sem resposta</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agent color helper ────────────────────────────────────────────────────────
function agentColor(name: string): string {
  const colors: Record<string, string> = {
    "João": "#3b82f6",
    "Jota": "#8b5cf6",
    "Caio": "#10b981",
    "Letícia": "#f59e0b",
    "Clara": "#ec4899",
  };
  return colors[name] ?? "#6b7280";
}

// ── Agents List Panel ─────────────────────────────────────────────────────────
function AgentsPanel() {
  const { data: agents, isLoading } = useAgents();
  const selectAgent = useOfficeStore((s) => s.selectAgent);

  if (isLoading) return <Loading />;
  if (!agents?.length) return <Empty text="Nenhum agente encontrado" />;

  return (
    <div className="space-y-2">
      {agents.map((a: Agent) => (
        <button
          key={a.id}
          onClick={() => selectAgent(a.name.toLowerCase())}
          className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] transition-colors text-left"
        >
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[a.status]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{a.name}</p>
            <p className="text-xs text-zinc-500">L{a.level} · {a.messages_24h} msgs</p>
          </div>
          <span className="text-xs text-zinc-600">{a.status}</span>
        </button>
      ))}
    </div>
  );
}

// ── Projects Panel ────────────────────────────────────────────────────────────
function ProjectsPanel() {
  const { data: projects, isLoading } = useProjects();

  if (isLoading) return <Loading />;
  if (!projects?.length) return <Empty text="Nenhum projeto encontrado" />;

  return (
    <div className="space-y-2">
      {projects.map((p: Project) => (
        <div
          key={p.project_key}
          className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-2 h-2 rounded-full ${STATUS_DOT[p.status]}`} />
            <p className="text-sm text-white font-medium truncate">{p.name}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>{p.metrics.progress_pct}% concluído</span>
            <span>{p.metrics.total_tasks} tasks</span>
            {p.metrics.blocked_tasks > 0 && (
              <span className="text-red-400">{p.metrics.blocked_tasks} bloqueadas</span>
            )}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500/60 transition-all"
              style={{ width: `${p.metrics.progress_pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Incidents Panel ───────────────────────────────────────────────────────────
function IncidentsPanel() {
  const { data: incidents, isLoading } = useIncidents();

  if (isLoading) return <Loading />;

  const open = incidents?.filter((i: Incident) => i.status !== "closed") ?? [];
  if (!open.length) return <Empty text="Nenhum incidente ativo" icon={<CheckCircle2 size={20} className="text-green-500" />} />;

  return (
    <div className="space-y-2">
      {open.map((i: Incident) => (
        <div
          key={i.id}
          className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${SEVERITY_COLORS[i.severity]}`}>
              {i.severity.toUpperCase()}
            </span>
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[i.status]}`} />
          </div>
          <p className="text-sm text-white truncate">{i.title}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {i.source ?? "—"} · {timeAgo(i.created_at)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Crons Panel ───────────────────────────────────────────────────────────────
function CronsPanel() {
  const { data: crons, isLoading } = useCrons();

  if (isLoading) return <Loading />;
  if (!crons?.length) return <Empty text="Nenhum cron configurado" />;

  return (
    <div className="space-y-2">
      {crons.map((c: CronJob) => (
        <div
          key={c.id}
          className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03]"
        >
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[c.status]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{c.name}</p>
            <p className="text-xs text-zinc-500 font-mono">{c.schedule}</p>
          </div>
          {c.consecutive_errors > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle size={12} /> {c.consecutive_errors}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Stats Panel ───────────────────────────────────────────────────────────────
function StatsPanel() {
  const { data: stats, isLoading } = useStats();
  const { data: agents } = useAgents();
  const { data: incidents } = useIncidents();

  if (isLoading) return <Loading />;

  const activeAgents = agents?.filter((a: Agent) => a.status === "active").length ?? 0;
  const openIncidents = incidents?.filter((i: Incident) => i.status !== "closed").length ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Agentes ativos" value={activeAgents} total={agents?.length ?? 0} />
        <StatCard label="Incidentes abertos" value={openIncidents} warn={openIncidents > 0} />
      </div>
      {stats && typeof stats === "object" && (
        <pre className="text-xs text-zinc-500 bg-white/[0.02] p-3 rounded-lg overflow-auto max-h-40">
          {JSON.stringify(stats, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Shared subcomponents ──────────────────────────────────────────────────────
function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="bg-white/[0.03] rounded-lg p-2.5">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-semibold ${warn ? "text-red-400" : "text-white"}`}>{value}</p>
    </div>
  );
}

function StatCard({ label, value, total, warn }: { label: string; value: number; total?: number; warn?: boolean }) {
  return (
    <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${warn ? "text-red-400" : "text-white"}`}>
        {value}
        {total != null && <span className="text-sm text-zinc-600 font-normal">/{total}</span>}
      </p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-zinc-500 text-sm py-6 justify-center">
      <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
      Carregando...
    </div>
  );
}

function Empty({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 text-zinc-500 text-sm py-8">
      {icon ?? <CheckCircle2 size={20} className="text-zinc-600" />}
      {text}
    </div>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m atrás`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

// ── Panel content router ──────────────────────────────────────────────────────
// ── Meeting Panel ─────────────────────────────────────────────────────────────
function MeetingPanel() {
  const { data: agents } = useAgents();
  const { meetingAgents, addToMeeting, removeFromMeeting, dismissMeeting } = useOfficeStore();
  const { commandDraft, setCommandDraft } = useOfficeStore();
  const { send, sending } = useSendDispatch();
  const [lastSent, setLastSent] = useState<string | null>(null);

  // Match agents by normalized name (strip accents) to align with config IDs
  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const inMeeting = agents?.filter((a) =>
    meetingAgents.includes(normalize(a.name))
  ) ?? [];

  const available = agents?.filter((a) =>
    !meetingAgents.includes(normalize(a.name))
  ) ?? [];

  const handleGroupSend = async () => {
    if (!commandDraft.trim() || meetingAgents.length === 0) return;
    for (const agentName of meetingAgents) {
      await send({
        targetAgent: agentName,
        commandText: commandDraft.trim(),
        actionType: "meeting_command",
      });
    }
    setLastSent("group");
    setCommandDraft("");
    setTimeout(() => setLastSent(null), 3000);
  };

  return (
    <div className="space-y-5">
      {/* Meeting status */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">
            {meetingAgents.length > 0 ? `${meetingAgents.length} na reunião` : "Nenhuma reunião ativa"}
          </p>
          <p className="text-zinc-500 text-xs">Sala de Reunião</p>
        </div>
        {meetingAgents.length > 0 && (
          <button
            onClick={dismissMeeting}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 transition-colors"
          >
            Encerrar
          </button>
        )}
      </div>

      {/* Agents in meeting */}
      {inMeeting.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">Na reunião</p>
          <div className="space-y-1.5">
            {inMeeting.map((a) => (
              <div key={a.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/15">
                <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[a.status]}`} />
                <div className="flex-1">
                  <p className="text-sm text-white">{a.name}</p>
                  <p className="text-[10px] text-zinc-500">{a.status}</p>
                </div>
                <button
                  onClick={() => removeFromMeeting(normalize(a.name))}
                  className="text-zinc-600 hover:text-zinc-400 text-xs"
                >
                  Dispensar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add agents */}
      {available.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">Chamar para reunião</p>
          <div className="space-y-1">
            {available.map((a) => (
              <button
                key={a.id}
                onClick={() => addToMeeting(normalize(a.name))}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
              >
                <div className={`w-2 h-2 rounded-full ${STATUS_DOT[a.status]}`} />
                <span className="text-xs text-zinc-300">{a.name}</span>
                <span className="text-[10px] text-zinc-600 ml-auto">+ Chamar</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Group command */}
      {meetingAgents.length > 0 && (
        <div>
          <div className="border-t border-white/[0.06] mb-3" />
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">Comando para todos</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={commandDraft}
              onChange={(e) => setCommandDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGroupSend(); }}
              placeholder="Mensagem para a reunião..."
              disabled={sending}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
            />
            <button
              onClick={handleGroupSend}
              disabled={sending || !commandDraft.trim()}
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition-colors text-sm shrink-0"
            >
              <Send size={14} />
            </button>
          </div>
          {lastSent && (
            <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
              <CheckCircle2 size={12} /> Comando enviado para {meetingAgents.length} agentes
            </p>
          )}
        </div>
      )}

      {/* Call all shortcut */}
      {meetingAgents.length === 0 && (
        <button
          onClick={() => {
            const allIds = agents?.map((a) => normalize(a.name)) ?? [];
            useOfficeStore.getState().callToMeeting(allIds);
          }}
          className="w-full py-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/20 text-indigo-300 text-sm transition-colors"
        >
          Chamar todos para reunião
        </button>
      )}
    </div>
  );
}

function PanelContent({ panel, data }: { panel: PanelType; data: Record<string, unknown> | null }) {
  switch (panel) {
    case "agents":       return <AgentsPanel />;
    case "projects":     return <ProjectsPanel />;
    case "incidents":    return <IncidentsPanel />;
    case "crons":        return <CronsPanel />;
    case "stats":        return <StatsPanel />;
    case "meeting":      return <MeetingPanel />;
    case "agent-detail": return <AgentDetailPanel agentId={(data?.agentId as string) ?? ""} />;
    case "kanban":
      return (
        <div className="text-center py-8">
          <Link href="/kanban" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 justify-center">
            Abrir Kanban Board <ExternalLink size={14} />
          </Link>
        </div>
      );
    case "deploys":
      return <Empty text="Deploy panel em breve" />;
    default:
      return null;
  }
}

// ── Main SidePanel component ──────────────────────────────────────────────────
export function SidePanel() {
  const { activePanel, panelData, closePanel } = useOfficeStore();
  const config = activePanel ? PANEL_CONFIG[activePanel] : null;

  return (
    <div
      className={`fixed top-0 right-0 h-full z-50 transition-all duration-300 ease-out ${
        activePanel
          ? "w-[380px] translate-x-0"
          : "w-[380px] translate-x-full"
      }`}
    >
      {/* Backdrop */}
      {activePanel && (
        <div
          className="fixed inset-0 bg-black/30 -z-10"
          onClick={closePanel}
        />
      )}

      {/* Panel */}
      <div className="h-full bg-zinc-950/95 backdrop-blur-xl border-l border-white/[0.08] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-zinc-400">{config?.icon}</span>
            <h2 className="text-sm font-semibold text-white">{config?.title ?? ""}</h2>
          </div>
          <div className="flex items-center gap-2">
            {config?.route && (
              <Link
                href={config.route}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Abrir módulo completo"
              >
                <ExternalLink size={14} />
              </Link>
            )}
            <button
              onClick={closePanel}
              className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-white/[0.05]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <PanelContent panel={activePanel} data={panelData} />
        </div>
      </div>
    </div>
  );
}
