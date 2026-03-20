"use client";

// Remove accents for consistent agent IDs
function normalizeName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

import { useState, useRef, useEffect, useMemo } from "react";
import {
  X, ExternalLink, AlertTriangle, CheckCircle2, Clock, Bot,
  FolderKanban, Flame, Activity, Send, Loader2, ChevronDown, ChevronUp,
  Users, MessageSquare, Sparkles, CircleDot, ArrowUpRight, Zap, Check, XCircle, Shield,
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
import { useDispatchHistory, useAllDispatches, useSendDispatch } from "../hooks/useDispatch";
import { useAutonomous, useApproveAction } from "../hooks/useAutonomous";
import type { AutonomousAction } from "../hooks/useAutonomous";
import { QUICK_ACTIONS, type AgentDispatch, type DispatchState } from "../types";
import Link from "next/link";

// ── Color system ─────────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, { bg: string; text: string; ring: string; gradient: string }> = {
  "João":   { bg: "bg-blue-500",   text: "text-blue-400",   ring: "ring-blue-500/30",   gradient: "from-blue-500/20 to-blue-600/10" },
  "Faísca": { bg: "bg-violet-500", text: "text-violet-400", ring: "ring-violet-500/30", gradient: "from-violet-500/20 to-violet-600/10" },
  "Caio":   { bg: "bg-emerald-500",text: "text-emerald-400",ring: "ring-emerald-500/30",gradient: "from-emerald-500/20 to-emerald-600/10" },
  "Letícia":{ bg: "bg-amber-500",  text: "text-amber-400",  ring: "ring-amber-500/30",  gradient: "from-amber-500/20 to-amber-600/10" },
  "Clara":  { bg: "bg-pink-500",   text: "text-pink-400",   ring: "ring-pink-500/30",   gradient: "from-pink-500/20 to-pink-600/10" },
};
const DEFAULT_AGENT_COLOR = { bg: "bg-zinc-500", text: "text-zinc-400", ring: "ring-zinc-500/30", gradient: "from-zinc-500/20 to-zinc-600/10" };

function getAgentColor(name: string) {
  return AGENT_COLORS[name] ?? DEFAULT_AGENT_COLOR;
}

function agentColorHex(name: string): string {
  const map: Record<string, string> = {
    "João": "#3b82f6", "Faísca": "#8b5cf6", "Caio": "#10b981",
    "Letícia": "#f59e0b", "Clara": "#ec4899",
  };
  return map[name] ?? "#6b7280";
}

// ── Status configs ───────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500", idle: "bg-zinc-500", degraded: "bg-amber-500",
  down: "bg-red-500", at_risk: "bg-amber-500", blocked: "bg-red-500",
  done: "bg-emerald-500", open: "bg-red-500", investigating: "bg-amber-500",
  mitigated: "bg-blue-500", closed: "bg-zinc-500", error: "bg-red-500",
  paused: "bg-zinc-500",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/10",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/10",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/10",
  low: "text-zinc-400 bg-zinc-500/10 border-zinc-500/10",
};

const DISPATCH_STATUS: Record<DispatchState, { label: string; color: string; dot: string }> = {
  queued:       { label: "Na fila",    color: "text-zinc-400",    dot: "bg-zinc-400" },
  sent:         { label: "Enviado",    color: "text-blue-400",    dot: "bg-blue-400" },
  acknowledged: { label: "Recebido",   color: "text-indigo-400",  dot: "bg-indigo-400" },
  blocked:      { label: "Bloqueado",  color: "text-red-400",     dot: "bg-red-400" },
  done:         { label: "Concluído",  color: "text-emerald-400", dot: "bg-emerald-400" },
  failed:       { label: "Falhou",     color: "text-red-500",     dot: "bg-red-500" },
};

// ── Panel config ─────────────────────────────────────────────────────────────

const PANEL_CONFIG: Record<string, { title: string; icon: React.ReactNode; route: string }> = {
  agents:         { title: "Agentes",           icon: <Users size={15} />,       route: "/agents" },
  projects:       { title: "Projetos",          icon: <FolderKanban size={15} />,route: "/projects" },
  kanban:         { title: "Kanban Board",       icon: <Activity size={15} />,    route: "/kanban" },
  incidents:      { title: "Incidentes",         icon: <Flame size={15} />,       route: "/incidents" },
  crons:          { title: "Cron Jobs",          icon: <Clock size={15} />,       route: "/crons" },
  stats:          { title: "Dashboard",          icon: <Activity size={15} />,    route: "/" },
  meeting:        { title: "Sala de Reunião",    icon: <MessageSquare size={15} />,route: "/office" },
  "agent-detail": { title: "Controle do Agente", icon: <Bot size={15} />,         route: "/agents" },
  autonomous:     { title: "Faísca Autônomo",    icon: <Zap size={15} />,         route: "/office" },
};

// ── Agent Detail Panel (Chat-first layout) ──────────────────────────────────

function AgentDetailPanel({ agentId }: { agentId: string }) {
  const { data: agents } = useAgents();
  const { data: allTasks } = useTasks();
  const normalizedId = normalizeName(agentId);
  const { data: history, isLoading: historyLoading } = useDispatchHistory(normalizedId);
  const { send, sending, error: sendError } = useSendDispatch();
  const { commandDraft, setCommandDraft } = useOfficeStore();
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const agent = agents?.find(
    (a) => normalizeName(a.name) === normalizeName(agentId)
        || normalizeName(a.id) === normalizeName(agentId)
        // Bridge alias: "faisca" matches DB "jota" / "Jota"
        || (normalizeName(agentId) === "faisca" && ["jota", "faisca"].includes(normalizeName(a.name)))
        || (normalizeName(agentId) === "faisca" && ["jota", "faisca"].includes(normalizeName(a.id)))
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  if (!agent) return <p className="text-zinc-500 text-sm py-8 text-center">Agente nao encontrado</p>;

  // Bridge API name: "jota" in DB maps to "faisca" on Bridge
  const isJotaFaisca = ["jota", "faisca"].includes(normalizeName(agent.name));
  const bridgeName = isJotaFaisca ? "faisca" : normalizeName(agent.name);
  const displayName = isJotaFaisca ? "Faísca" : agent.name;

  const agentTasks = allTasks?.filter(
    (t) => (t.owner?.toLowerCase() === agent.name.toLowerCase() ||
            t.assigned_to?.toLowerCase() === agent.name.toLowerCase()) &&
           t.column !== "done"
  ) ?? [];

  const handleSend = async () => {
    if (!commandDraft.trim()) return;
    const result = await send({
      targetAgent: bridgeName,
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
      targetAgent: bridgeName,
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
      const result = await send({
        targetAgent: bridgeName,
        commandText: template,
        actionType,
      });
      if (result) {
        setLastSent(result.id);
        setTimeout(() => setLastSent(null), 3000);
      }
    } else {
      setCommandDraft(template);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Compact header ── */}
      <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-lg"
              style={{ backgroundColor: agentColorHex(displayName) }}
            >
              {displayName.charAt(0)}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${STATUS_DOT[agent.status]} ${agent.status === "active" ? "animate-pulse" : ""}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white font-semibold text-sm truncate">{displayName}</p>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                agent.status === "active" ? "text-emerald-400 bg-emerald-500/10" :
                agent.status === "degraded" ? "text-amber-400 bg-amber-500/10" :
                agent.status === "down" ? "text-red-400 bg-red-500/10" :
                "text-zinc-500 bg-zinc-500/10"
              }`}>{agent.status}</span>
            </div>
            {/* Inline metrics */}
            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-zinc-500">
              <span>L{agent.level}</span>
              <span>{agent.messages_24h} msgs</span>
              {agent.errors_24h > 0 && <span className="text-red-400">{agent.errors_24h} erros</span>}
              <span>{timeAgo(agent.last_seen)}</span>
            </div>
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`p-1.5 rounded-lg transition-all ${showInfo ? "bg-white/[0.08] text-zinc-300" : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04]"}`}
            title="Detalhes"
          >
            <Activity size={14} />
          </button>
        </div>

        {/* Active tasks — always visible when agent has work */}
        {agentTasks.filter((t) => t.column === "in_progress" || t.column === "review").length > 0 && (
          <div className="mt-2.5 space-y-1">
            {agentTasks.filter((t) => t.column === "in_progress" || t.column === "review").slice(0, 3).map((t: Task) => (
              <div key={t.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-500/[0.06] border border-blue-500/[0.08]">
                <PriorityBadge priority={t.priority} small />
                <span className="text-[11px] text-zinc-300 truncate flex-1">{t.title}</span>
                <ColumnBadge column={t.column} />
              </div>
            ))}
          </div>
        )}

        {/* Expandable info section */}
        {showInfo && (
          <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2.5">
            {/* Metrics row */}
            <div className="flex gap-2">
              <div className="flex-1 bg-white/[0.03] rounded-lg p-2 text-center">
                <p className="text-[9px] text-zinc-600 uppercase">Msgs 24h</p>
                <p className="text-sm font-semibold text-white">{agent.messages_24h}</p>
              </div>
              <div className="flex-1 bg-white/[0.03] rounded-lg p-2 text-center">
                <p className="text-[9px] text-zinc-600 uppercase">Erros</p>
                <p className={`text-sm font-semibold ${agent.errors_24h > 0 ? "text-red-400" : "text-white"}`}>{agent.errors_24h}</p>
              </div>
              <div className="flex-1 bg-white/[0.03] rounded-lg p-2 text-center">
                <p className="text-[9px] text-zinc-600 uppercase">Uptime</p>
                <p className="text-sm font-semibold text-white">{agent.reliability_score != null ? `${agent.reliability_score}%` : "--"}</p>
              </div>
            </div>

            {/* All tasks (including backlog, assigned, blocked) */}
            {agentTasks.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] text-zinc-600 uppercase font-medium">Todas as tasks ({agentTasks.length})</p>
                {agentTasks.map((t: Task) => (
                  <div key={t.id} className="flex items-center gap-1.5 text-[11px]">
                    <PriorityBadge priority={t.priority} small />
                    <span className="text-zinc-400 truncate flex-1">{t.title}</span>
                    <ColumnBadge column={t.column} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Quick actions (horizontal chips) ── */}
      <div className="px-4 py-2 border-b border-white/[0.04] shrink-0">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
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
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] hover:border-white/[0.10] text-[11px] text-zinc-400 hover:text-white whitespace-nowrap transition-all disabled:opacity-40"
            >
              <span className="text-xs">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>

        {/* Task picker */}
        {showTaskPicker && (
          <div className="mt-2 border border-white/[0.08] rounded-xl bg-zinc-900/90 backdrop-blur max-h-40 overflow-y-auto">
            <p className="text-[9px] text-zinc-500 px-3 py-1.5 border-b border-white/[0.06] sticky top-0 bg-zinc-900/95 font-semibold uppercase tracking-wider">
              Selecionar task
            </p>
            {allTasks?.filter((t) => t.column !== "done").slice(0, 15).map((t: Task) => (
              <button
                key={t.id}
                onClick={() => handleDelegateTask(t)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.05] transition-colors text-left border-b border-white/[0.03] last:border-0"
              >
                <PriorityBadge priority={t.priority} small />
                <span className="text-[11px] text-zinc-300 truncate flex-1">{t.title}</span>
              </button>
            ))}
            {(!allTasks || allTasks.filter((t) => t.column !== "done").length === 0) && (
              <p className="text-[11px] text-zinc-600 text-center py-3">Nenhuma task</p>
            )}
          </div>
        )}
      </div>

      {/* ── Chat area (flex-1, scrollable) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5">
        {historyLoading && <Loading />}
        {!historyLoading && (!history || history.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600">
            <MessageSquare size={24} className="mb-2 text-zinc-700" />
            <p className="text-xs">Envie uma mensagem para {displayName}</p>
          </div>
        )}
        {[...(history ?? [])].reverse().map((d: AgentDispatch) => {
          const sc = DISPATCH_STATUS[d.status];
          const isInbound = d.direction === "inbound";

          return (
            <div key={d.id} className="space-y-1.5">
              {isInbound ? (
                <ChatBubbleInbound
                  name={displayName}
                  text={d.command_text}
                  time={d.created_at}
                  source={d.metadata && typeof d.metadata === "object" && "source" in d.metadata ? String(d.metadata.source) : undefined}
                />
              ) : (
                <>
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-indigo-600/15 border border-indigo-500/12 rounded-2xl rounded-br-md px-3 py-2">
                      <p className="text-xs text-indigo-200 break-words leading-relaxed">{d.command_text}</p>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <span className="text-[9px] text-indigo-400/40">{timeAgo(d.created_at)}</span>
                        <span className={`text-[9px] font-medium ${sc.color}`}>{sc.label}</span>
                      </div>
                    </div>
                  </div>
                  {d.response ? (
                    <ChatBubbleInbound name={displayName} text={d.response} time={d.responded_at} />
                  ) : d.status === "failed" ? (
                    <div className="flex justify-start">
                      <div className="bg-red-500/[0.06] border border-red-500/10 rounded-2xl rounded-bl-md px-3 py-1.5">
                        <span className="text-[10px] text-red-400/80 italic">Falha na resposta</span>
                      </div>
                    </div>
                  ) : d.status !== "done" ? (
                    <div className="flex justify-start">
                      <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl rounded-bl-md px-3 py-2">
                        <TypingIndicator />
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <span className="text-[9px] text-zinc-700 italic px-2">Sem resposta</span>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* ── Input bar (always visible at bottom) ── */}
      <div className="px-4 py-3 border-t border-white/[0.06] shrink-0 bg-zinc-950/80">
        <div className="flex gap-2">
          <input
            type="text"
            value={commandDraft}
            onChange={(e) => setCommandDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder={`Mensagem para ${displayName}...`}
            disabled={sending}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-40 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={sending || !commandDraft.trim()}
            className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-700 text-white transition-all shrink-0 shadow-lg shadow-indigo-500/10 disabled:shadow-none"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        {lastSent && (
          <p className="text-[10px] text-emerald-400 mt-1.5 flex items-center gap-1">
            <CheckCircle2 size={10} /> Enviado
          </p>
        )}
        {sendError && (
          <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
            <AlertTriangle size={10} /> {sendError}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Autonomous Panel (Faísca) ────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  send_message:  { label: "Mensagem",     icon: <Send size={12} />,          color: "text-blue-400" },
  call_meeting:  { label: "Reunião",      icon: <Users size={12} />,         color: "text-indigo-400" },
  status_report: { label: "Relatório",    icon: <Activity size={12} />,      color: "text-emerald-400" },
  delegate_task: { label: "Delegar Task", icon: <ArrowUpRight size={12} />,  color: "text-amber-400" },
  move_task:     { label: "Mover Task",   icon: <Activity size={12} />,      color: "text-orange-400" },
  create_task:   { label: "Criar Task",   icon: <Sparkles size={12} />,      color: "text-purple-400" },
  escalate:      { label: "Escalar",      icon: <AlertTriangle size={12} />, color: "text-red-400" },
};

function ActionCard({ action, onApprove, onReject, loading }: {
  action: AutonomousAction;
  onApprove?: () => void;
  onReject?: () => void;
  loading?: boolean;
}) {
  const meta = ACTION_LABELS[action.action_type] ?? { label: action.action_type, icon: <Zap size={12} />, color: "text-zinc-400" };
  const payload = action.payload;
  const isPending = action.approval_status === "pending";

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${
      isPending
        ? "bg-amber-500/[0.06] border-amber-500/15"
        : action.approval_status === "rejected"
        ? "bg-red-500/[0.04] border-red-500/10 opacity-60"
        : "bg-white/[0.03] border-white/[0.06]"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={meta.color}>{meta.icon}</span>
          <span className="text-xs font-medium text-zinc-200">{meta.label}</span>
          {isPending && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium animate-pulse">
              Aguardando
            </span>
          )}
          {action.approval_status === "auto_approved" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Auto</span>
          )}
          {action.approval_status === "approved" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Aprovado</span>
          )}
          {action.approval_status === "rejected" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">Rejeitado</span>
          )}
        </div>
        <span className="text-[9px] text-zinc-600">{timeAgo(action.created_at)}</span>
      </div>

      {/* Payload summary */}
      <div className="text-xs text-zinc-400 leading-relaxed">
        {"agent" in payload && payload.agent != null && <span>Agente: <span className="text-zinc-300">{String(payload.agent)}</span> · </span>}
        {"message" in payload && payload.message != null && <p className="text-zinc-300 mt-0.5">&quot;{String(payload.message).slice(0, 120)}&quot;</p>}
        {"task" in payload && payload.task != null && <p className="text-zinc-300 mt-0.5">Task: {String(payload.task)}</p>}
        {"title" in payload && payload.title != null && <p className="text-zinc-300 mt-0.5">Task: {String(payload.title)}</p>}
        {"topic" in payload && payload.topic != null && <p className="text-zinc-300 mt-0.5">Tema: {String(payload.topic)}</p>}
        {"issue" in payload && payload.issue != null && <p className="text-zinc-300 mt-0.5">Problema: {String(payload.issue)}</p>}
        {"agents" in payload && Array.isArray(payload.agents) && <p className="text-zinc-300 mt-0.5">Participantes: {(payload.agents as string[]).join(", ")}</p>}
      </div>

      {action.reasoning && (
        <p className="text-[10px] text-zinc-500 italic">
          <Shield size={10} className="inline mr-1" />
          {action.reasoning}
        </p>
      )}

      {/* Approval buttons */}
      {isPending && onApprove && onReject && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={onApprove}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/15 hover:border-emerald-500/25 text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-all disabled:opacity-40"
          >
            <Check size={13} /> Aprovar
          </button>
          <button
            onClick={onReject}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/10 hover:bg-red-600/20 border border-red-500/10 hover:border-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium transition-all disabled:opacity-40"
          >
            <XCircle size={13} /> Rejeitar
          </button>
        </div>
      )}
    </div>
  );
}

function AutonomousPanel() {
  const { data, isLoading } = useAutonomous();
  const { approve, loading: approving } = useApproveAction();

  const pending = data?.pending ?? [];
  const recent = data?.recent ?? [];
  const lastRun = data?.runs?.[0];

  return (
    <div className="space-y-5 px-5 py-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center">
          <Zap size={20} className="text-purple-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Faísca Autônomo</h3>
          <p className="text-[10px] text-zinc-500">
            Loop a cada 15min · {lastRun ? `Último: ${timeAgo(lastRun.created_at)}` : "Nenhum run ainda"}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-zinc-600" />
        </div>
      )}

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Aguardando aprovação ({pending.length})
            </span>
          </SectionLabel>
          {pending.map((a) => (
            <ActionCard
              key={a.id}
              action={a}
              loading={approving}
              onApprove={() => approve(a.id, "approved")}
              onReject={() => approve(a.id, "rejected")}
            />
          ))}
        </div>
      )}

      {pending.length === 0 && !isLoading && (
        <div className="text-center py-4">
          <CheckCircle2 size={16} className="text-emerald-500/40 mx-auto mb-1.5" />
          <p className="text-xs text-zinc-500">Nenhuma ação pendente</p>
        </div>
      )}

      {/* Recent actions */}
      {recent.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>Ações recentes</SectionLabel>
          {recent.filter((a) => a.approval_status !== "pending").slice(0, 10).map((a) => (
            <ActionCard key={a.id} action={a} />
          ))}
        </div>
      )}

      {/* Last run info */}
      {lastRun && (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3">
          <p className="text-[10px] text-zinc-500 mb-1">Último ciclo autônomo</p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">{lastRun.actions_count} ações</span>
            <span className="text-zinc-600">{lastRun.duration_ms ? `${(lastRun.duration_ms / 1000).toFixed(1)}s` : "—"}</span>
          </div>
          {lastRun.context_summary && (
            <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">{lastRun.context_summary}</p>
          )}
          {lastRun.error && (
            <p className="text-[10px] text-red-400 mt-1.5">{lastRun.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Meeting Panel ────────────────────────────────────────────────────────────

function MeetingPanel() {
  const { data: agents } = useAgents();
  const { data: recentDispatches } = useAllDispatches();
  const { meetingAgents, addToMeeting, removeFromMeeting, dismissMeeting } = useOfficeStore();
  const { commandDraft, setCommandDraft } = useOfficeStore();
  const { send, sending } = useSendDispatch();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const agentKey = (a: Agent) => a.id?.toString() ?? a.name.toLowerCase();
  // Filter out "Jota" — it's the same agent as "Faísca" (alias on Bridge API)
  const isJotaDupe = (a: Agent) => normalizeName(a.name) === "jota" || normalizeName(a.id) === "jota";
  const filteredAgents = agents?.filter((a) => !isJotaDupe(a)) ?? [];
  const inMeeting = filteredAgents.filter((a) => meetingAgents.includes(agentKey(a)));
  const available = filteredAgents.filter((a) => !meetingAgents.includes(agentKey(a)));

  const meetingFeed = (recentDispatches?.filter(
    (d) => d.action_type === "meeting_command" && normalizeName(d.target_agent) !== "jota"
  ) ?? []).slice(0, 60);

  // Group dispatches with same command_text sent within 5s into a single user bubble
  const groupedFeed = useMemo(() => {
    const groups: { text: string; time: string; dispatches: typeof meetingFeed }[] = [];
    for (const d of meetingFeed) {
      const last = groups[groups.length - 1];
      if (
        last &&
        last.text === d.command_text &&
        Math.abs(new Date(d.created_at).getTime() - new Date(last.time).getTime()) < 5000
      ) {
        last.dispatches.push(d);
      } else {
        groups.push({ text: d.command_text, time: d.created_at, dispatches: [d] });
      }
    }
    return groups;
  }, [meetingFeed]);

  const agentName = (id: string) => {
    if (["jota", "faisca"].includes(normalizeName(id))) return "Faísca";
    return filteredAgents.find((a) => agentKey(a) === id)?.name ?? id;
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [meetingFeed.length]);

  const handleGroupSend = async () => {
    if (!commandDraft.trim() || meetingAgents.length === 0) return;
    const text = commandDraft.trim();
    setCommandDraft("");

    // Dedupe jota/faisca — base target list
    const allTargets = meetingAgents
      .filter((id) => id !== "joao" && normalizeName(id) !== "jota")
      .map((id) => normalizeName(id) === "faisca" ? "faisca" : id);

    // Detect @mention — if present, only that agent responds
    const mentionMatch = text.match(/@(\w+)/i);
    let targets = allTargets;
    if (mentionMatch) {
      const mentioned = normalizeName(mentionMatch[1]);
      const found = allTargets.find((id) => normalizeName(id) === mentioned
        || normalizeName(agentName(id)) === mentioned);
      if (found) targets = [found];
    }

    for (const aid of targets) {
      await send({ targetAgent: aid, commandText: text, actionType: "meeting_command" });
    }
  };

  // No meeting active
  if (meetingAgents.length === 0) {
    return (
      <div className="space-y-5">
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center mx-auto mb-3">
            <Users size={24} className="text-indigo-400" />
          </div>
          <p className="text-zinc-400 text-sm mb-1">Nenhuma reuniao ativa</p>
          <p className="text-zinc-600 text-xs">Chame os agentes para iniciar</p>
        </div>

        <button
          onClick={() => {
            const allIds = filteredAgents.map((a) => agentKey(a));
            if (!allIds.includes("joao")) allIds.push("joao");
            useOfficeStore.getState().callToMeeting(allIds);
          }}
          className="w-full py-3 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/15 hover:border-indigo-500/25 text-indigo-300 hover:text-indigo-200 text-sm font-medium transition-all"
        >
          Chamar todos para reuniao
        </button>

        {available.length > 0 && (
          <div>
            <SectionLabel>Ou selecione agentes</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {available.map((a) => (
                <button key={a.id} onClick={() => addToMeeting(agentKey(a))}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] text-zinc-400 hover:text-white transition-all">
                  + {a.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Meeting active — chat
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] shrink-0 bg-white/[0.02]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-white font-semibold">Reuniao ativa</span>
          </div>
          <button onClick={dismissMeeting} className="text-[10px] text-red-400 hover:text-red-300 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/15 border border-red-500/10 transition-all font-medium">
            Encerrar
          </button>
        </div>
        {/* Participants */}
        <div className="flex flex-wrap gap-1.5">
          {meetingAgents.includes("joao") && (
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/10 text-blue-300 font-medium">Voce</span>
          )}
          {inMeeting.map((a) => (
            <span key={a.id} className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.06] text-zinc-300 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[a.status]}`} />
              {a.name}
              <button onClick={() => removeFromMeeting(agentKey(a))} className="text-zinc-600 hover:text-zinc-400 transition-colors ml-0.5">&times;</button>
            </span>
          ))}
          {available.length > 0 && (
            <button onClick={() => available.forEach((a) => addToMeeting(agentKey(a)))}
              className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.03] border border-dashed border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12] transition-all">
              + mais
            </button>
          )}
        </div>
      </div>

      {/* Chat feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {meetingFeed.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare size={20} className="text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-600">Envie uma mensagem para iniciar</p>
          </div>
        )}
        {[...groupedFeed].reverse().map((group, gi) => (
          <div key={gi} className="space-y-1.5">
            {/* Single user bubble for the group */}
            <div className="flex justify-end">
              <div className="max-w-[80%] bg-indigo-600/15 border border-indigo-500/12 rounded-2xl rounded-br-md px-3.5 py-2">
                <p className="text-xs text-indigo-200 break-words leading-relaxed">{group.text}</p>
                <span className="text-[9px] text-indigo-400/40 mt-1 block text-right">
                  {group.dispatches.length === 1
                    ? `para ${agentName(group.dispatches[0].target_agent)}`
                    : "para todos"} · {timeAgo(group.time)}
                </span>
              </div>
            </div>
            {/* Each agent's response */}
            {group.dispatches.map((d) => (
              d.response ? (
                <ChatBubbleInbound key={d.id} name={agentName(d.target_agent)} text={d.response} time={d.responded_at ?? d.updated_at} />
              ) : d.status === "failed" ? (
                <div key={d.id} className="flex justify-start">
                  <span className="text-[10px] text-red-400/60 px-3 italic">{agentName(d.target_agent)}: falha</span>
                </div>
              ) : (
                <div key={d.id} className="flex justify-start pl-1">
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span className="text-[10px] text-zinc-600">{agentName(d.target_agent)}</span>
                    <TypingIndicator />
                  </div>
                </div>
              )
            ))}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/[0.06] shrink-0 bg-white/[0.02]">
        <div className="flex gap-2">
          <input
            type="text" value={commandDraft}
            onChange={(e) => setCommandDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleGroupSend(); }}
            placeholder="Mensagem para todos ou @nome..."
            disabled={sending}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-40 transition-all"
          />
          <button onClick={handleGroupSend} disabled={sending || !commandDraft.trim()}
            className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-700 text-white transition-all text-sm shrink-0 shadow-lg shadow-indigo-500/10 disabled:shadow-none">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Agents List Panel ────────────────────────────────────────────────────────

function AgentsPanel() {
  const { data: agents, isLoading } = useAgents();
  const selectAgent = useOfficeStore((s) => s.selectAgent);

  if (isLoading) return <Loading />;
  if (!agents?.length) return <EmptyState text="Nenhum agente encontrado" />;

  return (
    <div className="space-y-1.5">
      {agents.map((a: Agent) => {
        const colors = getAgentColor(a.name);
        return (
          <button
            key={a.id}
            onClick={() => selectAgent(a.name.toLowerCase())}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06] transition-all text-left group"
          >
            <div className="relative">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: agentColorHex(a.name) }}
              >
                {a.name.charAt(0)}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${STATUS_DOT[a.status]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-200 group-hover:text-white truncate transition-colors">{a.name}</p>
              <p className="text-[10px] text-zinc-600">L{a.level} · {a.messages_24h} msgs</p>
            </div>
            <ArrowUpRight size={14} className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

// ── Projects Panel ───────────────────────────────────────────────────────────

function ProjectsPanel() {
  const { data: projects, isLoading } = useProjects();

  if (isLoading) return <Loading />;
  if (!projects?.length) return <EmptyState text="Nenhum projeto encontrado" />;

  return (
    <div className="space-y-2">
      {projects.map((p: Project) => (
        <div key={p.project_key} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${STATUS_DOT[p.status]}`} />
            <p className="text-sm text-white font-medium truncate">{p.name}</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-zinc-500 mb-2.5">
            <span className="font-medium">{p.metrics.progress_pct}%</span>
            <span>{p.metrics.total_tasks} tasks</span>
            {p.metrics.blocked_tasks > 0 && (
              <span className="text-red-400 font-medium">{p.metrics.blocked_tasks} bloqueadas</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500/60 to-blue-500/60 transition-all duration-500"
              style={{ width: `${p.metrics.progress_pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Incidents Panel ──────────────────────────────────────────────────────────

function IncidentsPanel() {
  const { data: incidents, isLoading } = useIncidents();

  if (isLoading) return <Loading />;
  const open = incidents?.filter((i: Incident) => i.status !== "closed") ?? [];
  if (!open.length) return <EmptyState text="Nenhum incidente ativo" icon={<CheckCircle2 size={20} className="text-emerald-500/60" />} />;

  return (
    <div className="space-y-2">
      {open.map((i: Incident) => (
        <div key={i.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${SEVERITY_COLORS[i.severity]}`}>
              {i.severity.toUpperCase()}
            </span>
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[i.status]}`} />
          </div>
          <p className="text-sm text-white truncate">{i.title}</p>
          <p className="text-[10px] text-zinc-500 mt-1">
            {i.source ?? "--"} · {timeAgo(i.created_at)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Crons Panel ──────────────────────────────────────────────────────────────

function CronsPanel() {
  const { data: crons, isLoading } = useCrons();

  if (isLoading) return <Loading />;
  if (!crons?.length) return <EmptyState text="Nenhum cron configurado" />;

  return (
    <div className="space-y-1.5">
      {crons.map((c: CronJob) => (
        <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[c.status]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-200 truncate">{c.name}</p>
            <p className="text-[10px] text-zinc-600 font-mono">{c.schedule}</p>
          </div>
          {c.consecutive_errors > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md">
              <AlertTriangle size={10} /> {c.consecutive_errors}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Stats Panel ──────────────────────────────────────────────────────────────

function StatsPanel() {
  const { data: stats, isLoading } = useStats();
  const { data: agents } = useAgents();
  const { data: incidents } = useIncidents();

  if (isLoading) return <Loading />;

  const activeAgents = agents?.filter((a: Agent) => a.status === "active").length ?? 0;
  const openIncidents = incidents?.filter((i: Incident) => i.status !== "closed").length ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/10">
          <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-medium mb-1">Agentes ativos</p>
          <p className="text-2xl font-bold text-white">
            {activeAgents}
            <span className="text-sm text-zinc-600 font-normal">/{agents?.length ?? 0}</span>
          </p>
        </div>
        <div className={`p-3.5 rounded-xl border ${
          openIncidents > 0
            ? "bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/10"
            : "bg-white/[0.03] border-white/[0.05]"
        }`}>
          <p className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${openIncidents > 0 ? "text-red-400/60" : "text-zinc-500"}`}>
            Incidentes
          </p>
          <p className={`text-2xl font-bold ${openIncidents > 0 ? "text-red-400" : "text-white"}`}>{openIncidents}</p>
        </div>
      </div>
      {stats && typeof stats === "object" && (
        <pre className="text-[10px] text-zinc-600 bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl overflow-auto max-h-40 font-mono">
          {JSON.stringify(stats, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Shared UI components ─────────────────────────────────────────────────────

function ChatBubbleInbound({ name, text, time, source }: { name: string; text: string; time: string | null; source?: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md px-3.5 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <div
            className="w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-bold text-white"
            style={{ backgroundColor: agentColorHex(name) }}
          >
            {name.charAt(0)}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">{name}</span>
          {source && <span className="text-[9px] text-zinc-700 bg-white/[0.04] px-1.5 rounded">via {source}</span>}
        </div>
        <p className="text-xs text-zinc-200 break-words leading-relaxed whitespace-pre-wrap">{text}</p>
        {time && <p className="text-[10px] text-zinc-600 mt-1">{timeAgo(time)}</p>}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="text-[10px] text-zinc-600">Digitando...</span>
    </div>
  );
}

function MetricCard({ label, value, warn, icon }: { label: string; value: string | number; warn?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.04] rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-zinc-600">{icon}</span>}
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">{label}</p>
      </div>
      <p className={`text-lg font-semibold ${warn ? "text-red-400" : "text-white"}`}>{value}</p>
    </div>
  );
}

function PriorityBadge({ priority, small }: { priority: string; small?: boolean }) {
  const cls = priority === "P0" ? "bg-red-500/15 text-red-400 border-red-500/10"
    : priority === "P1" ? "bg-amber-500/15 text-amber-400 border-amber-500/10"
    : "bg-zinc-500/15 text-zinc-400 border-zinc-500/10";
  return (
    <span className={`${small ? "text-[8px] px-1" : "text-[9px] px-1.5"} py-0.5 rounded-md font-bold border ${cls}`}>
      {priority}
    </span>
  );
}

function ColumnBadge({ column }: { column: string }) {
  const cls = column === "blocked" ? "bg-red-500/10 text-red-400"
    : column === "in_progress" ? "bg-blue-500/10 text-blue-400"
    : column === "review" ? "bg-violet-500/10 text-violet-400"
    : "bg-zinc-500/10 text-zinc-500";
  return <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${cls}`}>{column}</span>;
}

function Section({ title, children, open, onToggle }: { title: string; children: React.ReactNode; open?: boolean; onToggle?: () => void }) {
  const isCollapsible = onToggle !== undefined;
  const isOpen = open ?? true;

  return (
    <div>
      {isCollapsible ? (
        <button onClick={onToggle} className="flex items-center justify-between w-full mb-2.5 group">
          <SectionLabel>{title}</SectionLabel>
          <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
            {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        </button>
      ) : (
        <div className="mb-2.5"><SectionLabel>{title}</SectionLabel></div>
      )}
      {isOpen && children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">{children}</span>;
}

function Loading() {
  return (
    <div className="flex items-center gap-2.5 text-zinc-500 text-sm py-8 justify-center">
      <Loader2 size={16} className="animate-spin text-zinc-600" />
      <span className="text-zinc-600">Carregando...</span>
    </div>
  );
}

function EmptyState({ text, icon, small }: { text: string; icon?: React.ReactNode; small?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-2 text-zinc-600 text-xs ${small ? "py-4" : "py-8"}`}>
      {icon ?? <CheckCircle2 size={18} className="text-zinc-700" />}
      {text}
    </div>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "--";
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ── Panel content router ─────────────────────────────────────────────────────

function PanelContent({ panel, data }: { panel: PanelType; data: Record<string, unknown> | null }) {
  switch (panel) {
    case "agents":       return <AgentsPanel />;
    case "projects":     return <ProjectsPanel />;
    case "incidents":    return <IncidentsPanel />;
    case "crons":        return <CronsPanel />;
    case "stats":        return <StatsPanel />;
    case "meeting":      return <MeetingPanel />;
    case "autonomous":   return <AutonomousPanel />;
    case "agent-detail": return <AgentDetailPanel agentId={(data?.agentId as string) ?? ""} />;
    case "kanban":
      return (
        <div className="text-center py-10">
          <Link href="/kanban" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors group">
            Abrir Kanban Board <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      );
    case "deploys":
      return <EmptyState text="Deploy panel em breve" />;
    default:
      return null;
  }
}

// ── Main SidePanel ───────────────────────────────────────────────────────────

export function SidePanel() {
  const { activePanel, panelData, closePanel } = useOfficeStore();
  const config = activePanel ? PANEL_CONFIG[activePanel] : null;

  return (
    <>
      {/* Backdrop */}
      {activePanel && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity duration-300"
          onClick={closePanel}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 transition-all duration-300 ease-out ${
          activePanel ? "w-[400px] translate-x-0" : "w-[400px] translate-x-full"
        }`}
      >
        <div className="h-full bg-zinc-950/95 backdrop-blur-2xl border-l border-white/[0.06] flex flex-col shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.05]">
                <span className="text-zinc-400">{config?.icon}</span>
              </div>
              <h2 className="text-sm font-semibold text-white tracking-tight">{config?.title ?? ""}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              {config?.route && (
                <Link
                  href={config.route}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors p-1.5 rounded-lg hover:bg-white/[0.05]"
                  title="Abrir modulo completo"
                >
                  <ExternalLink size={13} />
                </Link>
              )}
              <button
                onClick={closePanel}
                className="text-zinc-600 hover:text-zinc-300 transition-colors p-1.5 rounded-lg hover:bg-white/[0.05]"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Content — meeting e agent-detail gerenciam seu próprio scroll/layout */}
          <div className={`flex-1 min-h-0 ${
            activePanel === "meeting" || activePanel === "agent-detail"
              ? "flex flex-col"
              : "overflow-y-auto px-5 py-4"
          }`}>
            <PanelContent panel={activePanel} data={panelData} />
          </div>
        </div>
      </div>
    </>
  );
}
