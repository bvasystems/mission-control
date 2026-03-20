import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BRIDGE_URL = "https://bridge.axiushub.online";

// Actions that execute immediately without João's approval
const AUTO_EXECUTE_ACTIONS = new Set([
  "send_message",
  "call_meeting",
  "status_report",
]);

// Actions that require João's approval
const APPROVAL_REQUIRED_ACTIONS = new Set([
  "delegate_task",
  "move_task",
  "create_task",
  "escalate",
]);

function normalizeName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ── Context Builder ──────────────────────────────────────────────────────────

async function buildContext(): Promise<string> {
  const [tasksRes, agentsRes, dispatchesRes, incidentsRes] = await Promise.all([
    db.query(`
      SELECT id, title, status, priority, assigned_to, owner, "column", due_date, updated_at
      FROM tasks
      WHERE is_archived = false AND "column" NOT IN ('done')
      ORDER BY priority DESC, updated_at DESC
      LIMIT 30
    `),
    db.query(`
      SELECT name, status, last_seen, messages_24h, errors_24h
      FROM agents_status
      ORDER BY name
    `),
    db.query(`
      SELECT target_agent, command_text, response, status, action_type, created_at
      FROM office_dispatches
      WHERE created_at > NOW() - INTERVAL '2 hours'
      ORDER BY created_at DESC
      LIMIT 15
    `),
    db.query(`
      SELECT title, severity, status, source, created_at
      FROM incidents
      WHERE status NOT IN ('resolved', 'closed')
      ORDER BY severity DESC, created_at DESC
      LIMIT 10
    `).catch(() => ({ rows: [] })),
  ]);

  const tasks = tasksRes.rows;
  const agents = agentsRes.rows;
  const dispatches = dispatchesRes.rows;
  const incidents = incidentsRes.rows;

  const now = new Date().toISOString();

  const blockedTasks = tasks.filter((t) => t.column === "blocked" || t.status === "Blocked");
  const overdueTasks = tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date());
  const inProgressTasks = tasks.filter((t) => t.column === "in_progress");
  const reviewTasks = tasks.filter((t) => t.column === "review");

  return `
## Briefing para Faísca — ${now}

### Equipe (agents_status)
${agents.map((a) => `- ${a.name}: ${a.status} | last_seen: ${a.last_seen ?? "never"} | msgs_24h: ${a.messages_24h} | erros_24h: ${a.errors_24h}`).join("\n")}

### Tasks Ativas (${tasks.length} total)
**Bloqueadas (${blockedTasks.length}):**
${blockedTasks.map((t) => `- [${t.priority}] "${t.title}" — assigned: ${t.assigned_to ?? t.owner ?? "ninguém"}`).join("\n") || "Nenhuma"}

**Atrasadas (${overdueTasks.length}):**
${overdueTasks.map((t) => `- [${t.priority}] "${t.title}" — due: ${t.due_date} — assigned: ${t.assigned_to ?? t.owner ?? "ninguém"}`).join("\n") || "Nenhuma"}

**Em progresso (${inProgressTasks.length}):**
${inProgressTasks.map((t) => `- "${t.title}" — assigned: ${t.assigned_to ?? t.owner ?? "ninguém"}`).join("\n") || "Nenhuma"}

**Em review (${reviewTasks.length}):**
${reviewTasks.map((t) => `- "${t.title}" — assigned: ${t.assigned_to ?? t.owner ?? "ninguém"}`).join("\n") || "Nenhuma"}

### Incidents Abertos (${incidents.length})
${incidents.map((i) => `- [${i.severity}] "${i.title}" — status: ${i.status} — source: ${i.source}`).join("\n") || "Nenhum"}

### Últimos Dispatches (2h)
${dispatches.map((d) => `- [${d.action_type}] para ${d.target_agent}: "${d.command_text?.slice(0, 80)}" — ${d.status}`).join("\n") || "Nenhum"}
`.trim();
}

// ── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o Faísca, CTO e braço direito do João na Synkra.
Seu papel é gerenciar a equipe de agentes (Caio, Clara, Letícia) de forma autônoma.

Você recebe um briefing periódico com o estado atual das tasks, agentes e incidents.
Com base nisso, decida quais ações tomar.

REGRAS:
- Só tome ações quando necessário. Se tudo estiver ok, retorne actions: []
- Priorize: tasks bloqueadas, atrasadas, agentes ociosos, incidents abertos
- Seja conciso nas mensagens
- Não repita ações que já foram tomadas nos últimos dispatches
- Para ações críticas (delegate_task, create_task, move_task, escalate), explique o reasoning

RESPONDA EXCLUSIVAMENTE com JSON válido neste formato:
{
  "summary": "Resumo de 1-2 frases do estado geral",
  "actions": [
    {
      "type": "send_message",
      "agent": "caio",
      "message": "texto da mensagem"
    },
    {
      "type": "call_meeting",
      "agents": ["caio", "clara"],
      "topic": "motivo da reunião"
    },
    {
      "type": "status_report",
      "summary": "resumo executivo"
    },
    {
      "type": "delegate_task",
      "agent": "clara",
      "task": "título da task",
      "priority": "high",
      "reasoning": "por que delegar isso agora"
    },
    {
      "type": "move_task",
      "taskId": "uuid",
      "column": "review",
      "reasoning": "por que mover"
    },
    {
      "type": "create_task",
      "title": "título",
      "assignee": "leticia",
      "priority": "medium",
      "reasoning": "por que criar"
    },
    {
      "type": "escalate",
      "issue": "descrição do problema",
      "reasoning": "por que escalar para o João"
    }
  ]
}

Se não houver nada a fazer, retorne: { "summary": "Tudo em ordem.", "actions": [] }`;

// ── Action Executor ──────────────────────────────────────────────────────────

async function executeAction(action: Record<string, unknown>, actionId: string) {
  const type = action.type as string;
  const result: Record<string, unknown> = { type, status: "executed" };

  try {
    if (type === "send_message") {
      const agent = normalizeName(action.agent as string);
      const message = action.message as string;
      await db.query(
        `INSERT INTO office_dispatches (target_agent, command_text, action_type, issued_by, status)
         VALUES ($1, $2, 'free_command', 'faisca', 'queued')`,
        [agent, message]
      );
      // Fire Bridge call
      await callBridge(agent, message);
      result.detail = `Mensagem enviada para ${agent}`;
    } else if (type === "call_meeting") {
      const agents = (action.agents as string[]) ?? [];
      const topic = action.topic as string;
      for (const a of agents) {
        const agent = normalizeName(a);
        await db.query(
          `INSERT INTO office_dispatches (target_agent, command_text, action_type, issued_by, status)
           VALUES ($1, $2, 'meeting_command', 'faisca', 'queued')`,
          [agent, `[Reunião convocada por Faísca] ${topic}`]
        );
        await callBridge(agent, `[Reunião convocada por Faísca] Tema: ${topic}. Participe e contribua.`);
      }
      result.detail = `Reunião convocada: ${topic} (${agents.join(", ")})`;
    } else if (type === "status_report") {
      result.detail = `Relatório: ${action.summary}`;
    }

    await db.query(
      `UPDATE autonomous_actions SET executed_at = NOW(), result = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(result), actionId]
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await db.query(
      `UPDATE autonomous_actions SET result = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify({ type, status: "error", error: errorMsg }), actionId]
    );
  }
}

async function callBridge(agent: string, message: string) {
  const bridgeToken = process.env.BRIDGE_TOKEN;
  if (!bridgeToken) return;

  try {
    const res = await fetch(
      `${BRIDGE_URL}/agents/${encodeURIComponent(agent)}/command`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bridge-token": bridgeToken },
        body: JSON.stringify({
          command: message,
          actionType: "free_command",
          context: { source: "mission-control", requestedBy: "faisca" },
          timeoutSeconds: 55,
        }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const payloads = data?.data?.response?.result?.payloads;
    if (Array.isArray(payloads) && payloads.length) {
      const text = payloads.map((p: { text?: string }) => p.text).filter(Boolean).join("\n");
      // Update the dispatch with the response
      await db.query(
        `UPDATE office_dispatches
         SET response = $1, responded_at = NOW(), status = 'done', updated_at = NOW()
         WHERE target_agent = $2 AND issued_by = 'faisca' AND status = 'queued'
         ORDER BY created_at DESC LIMIT 1`,
        [text, agent]
      );
      return text;
    }
  } catch {
    // Bridge call failed — non-critical
  }
  return null;
}

// ── POST: Trigger autonomous loop ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Optional: verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startMs = Date.now();
  let runId: string | null = null;

  try {
    // Build context
    const context = await buildContext();

    // Call Faísca via Bridge
    const bridgeToken = process.env.BRIDGE_TOKEN;
    if (!bridgeToken) {
      return NextResponse.json({ error: "BRIDGE_TOKEN not configured" }, { status: 500 });
    }

    const bridgeRes = await fetch(
      `${BRIDGE_URL}/agents/faisca/command`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bridge-token": bridgeToken },
        body: JSON.stringify({
          command: `${SYSTEM_PROMPT}\n\n---\n\n${context}`,
          actionType: "autonomous_loop",
          context: { source: "mission-control", requestedBy: "system", loop: true },
          timeoutSeconds: 55,
        }),
      }
    );

    if (!bridgeRes.ok) {
      const errText = await bridgeRes.text();
      throw new Error(`Bridge API ${bridgeRes.status}: ${errText}`);
    }

    const bridgeData = await bridgeRes.json();

    // Extract text response
    let responseText = "";
    const payloads = bridgeData?.data?.response?.result?.payloads;
    if (Array.isArray(payloads) && payloads.length) {
      responseText = payloads.map((p: { text?: string }) => p.text).filter(Boolean).join("\n");
    }

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Faísca did not return valid JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      summary?: string;
      actions?: Array<Record<string, unknown>>;
    };
    const actions = parsed.actions ?? [];

    // Log the run
    const runRes = await db.query(
      `INSERT INTO autonomous_runs (context_summary, raw_response, actions_count, duration_ms)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [parsed.summary ?? "", responseText.slice(0, 5000), actions.length, Date.now() - startMs]
    );
    runId = runRes.rows[0]?.id;

    // Process actions
    const results: Array<{ type: string; approval: string }> = [];

    for (const action of actions) {
      const type = action.type as string;
      const needsApproval = APPROVAL_REQUIRED_ACTIONS.has(type);

      const insertRes = await db.query(
        `INSERT INTO autonomous_actions (agent_id, action_type, payload, reasoning, requires_approval, approval_status)
         VALUES ('faisca', $1, $2, $3, $4, $5) RETURNING id`,
        [
          type,
          JSON.stringify(action),
          (action.reasoning as string) ?? null,
          needsApproval,
          needsApproval ? "pending" : "auto_approved",
        ]
      );
      const actionId = insertRes.rows[0]?.id;

      if (!needsApproval) {
        // Execute immediately in background
        after(async () => {
          await executeAction(action, actionId);
        });
        results.push({ type, approval: "auto_executed" });
      } else {
        results.push({ type, approval: "pending" });
      }
    }

    return NextResponse.json({
      ok: true,
      runId,
      summary: parsed.summary,
      actionsCount: actions.length,
      results,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Log failed run
    if (runId) {
      await db.query(
        `UPDATE autonomous_runs SET error = $1, duration_ms = $2 WHERE id = $3`,
        [errorMsg, Date.now() - startMs, runId]
      ).catch(() => {});
    } else {
      await db.query(
        `INSERT INTO autonomous_runs (error, duration_ms) VALUES ($1, $2)`,
        [errorMsg, Date.now() - startMs]
      ).catch(() => {});
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// ── GET: Fetch pending actions and recent runs ───────────────────────────────

export async function GET() {
  try {
    const [pendingRes, recentRes, runsRes] = await Promise.all([
      db.query(
        `SELECT * FROM autonomous_actions WHERE approval_status = 'pending' ORDER BY created_at DESC`
      ),
      db.query(
        `SELECT * FROM autonomous_actions ORDER BY created_at DESC LIMIT 20`
      ),
      db.query(
        `SELECT * FROM autonomous_runs ORDER BY created_at DESC LIMIT 5`
      ),
    ]);

    return NextResponse.json({
      pending: pendingRes.rows,
      recent: recentRes.rows,
      runs: runsRes.rows,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
