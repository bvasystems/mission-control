import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BRIDGE_URL = "https://bridge.axiushub.online";

function normalizeName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const approveSchema = z.object({
  actionId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

// ── Execute approved action ──────────────────────────────────────────────────

async function executeApprovedAction(actionId: string) {
  const res = await db.query(
    `SELECT * FROM autonomous_actions WHERE id = $1`,
    [actionId]
  );
  const action = res.rows[0];
  if (!action) return;

  const payload = action.payload as Record<string, unknown>;
  const type = action.action_type as string;
  const result: Record<string, unknown> = { type, status: "executed" };

  try {
    if (type === "delegate_task") {
      const agent = normalizeName(payload.agent as string);
      const title = payload.task as string;
      const priority = (payload.priority as string) ?? "medium";

      // Create the task
      const taskRes = await db.query(
        `INSERT INTO tasks (title, assigned_to, owner, priority, status, "column")
         VALUES ($1, $2, 'faisca', $3, 'Assigned', 'in_progress') RETURNING id`,
        [title, agent, priority]
      );
      const taskId = taskRes.rows[0]?.id;

      // Notify the agent via dispatch
      await db.query(
        `INSERT INTO office_dispatches (target_agent, command_text, action_type, issued_by, task_id, status)
         VALUES ($1, $2, 'delegate_task', 'faisca', $3, 'queued')`,
        [agent, `[Delegado por Faísca] ${title}`, taskId]
      );

      // Call Bridge to notify
      await callBridge(agent, `Faísca delegou uma task para você: "${title}" (prioridade: ${priority}). Confirme o recebimento.`);

      result.detail = `Task "${title}" criada e delegada para ${agent}`;
      result.taskId = taskId;
    } else if (type === "create_task") {
      const title = payload.title as string;
      const assignee = payload.assignee ? normalizeName(payload.assignee as string) : null;
      const priority = (payload.priority as string) ?? "medium";

      const taskRes = await db.query(
        `INSERT INTO tasks (title, assigned_to, owner, priority, status, "column")
         VALUES ($1, $2, 'faisca', $3, $4, $5) RETURNING id`,
        [title, assignee, priority, assignee ? "Assigned" : "pending", assignee ? "in_progress" : "backlog"]
      );

      result.detail = `Task "${title}" criada`;
      result.taskId = taskRes.rows[0]?.id;
    } else if (type === "move_task") {
      const taskId = payload.taskId as string;
      const column = payload.column as string;
      const statusMap: Record<string, string> = {
        backlog: "Backlog", in_progress: "In Progress", review: "Review",
        done: "Done", blocked: "Blocked",
      };

      await db.query(
        `UPDATE tasks SET "column" = $1, status = $2, updated_at = NOW() WHERE id = $3`,
        [column, statusMap[column] ?? column, taskId]
      );

      result.detail = `Task ${taskId} movida para ${column}`;
    } else if (type === "escalate") {
      const issue = payload.issue as string;

      // Create dispatch to João (shows in office as notification)
      await db.query(
        `INSERT INTO office_dispatches (target_agent, command_text, action_type, issued_by, direction, status)
         VALUES ('joao', $1, 'escalate', 'faisca', 'inbound', 'done')`,
        [`[ESCALAÇÃO — Faísca] ${issue}`]
      );

      result.detail = `Escalado para João: ${issue}`;
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

    if (!res.ok) return;
    const data = await res.json();
    const payloads = data?.data?.response?.result?.payloads;
    if (Array.isArray(payloads) && payloads.length) {
      const text = payloads.map((p: { text?: string }) => p.text).filter(Boolean).join("\n");
      await db.query(
        `UPDATE office_dispatches
         SET response = $1, responded_at = NOW(), status = 'done', updated_at = NOW()
         WHERE target_agent = $2 AND issued_by = 'faisca' AND status = 'queued'
         ORDER BY created_at DESC LIMIT 1`,
        [text, agent]
      );
    }
  } catch {
    // non-critical
  }
}

// ── POST: Approve or reject an action ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { actionId, decision } = approveSchema.parse(body);

    // Verify action exists and is pending
    const existing = await db.query(
      `SELECT id, action_type, approval_status FROM autonomous_actions WHERE id = $1`,
      [actionId]
    );
    if (!existing.rows[0]) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }
    if (existing.rows[0].approval_status !== "pending") {
      return NextResponse.json({ error: "Action already processed" }, { status: 400 });
    }

    // Update status
    await db.query(
      `UPDATE autonomous_actions SET approval_status = $1, approved_by = 'joao', updated_at = NOW() WHERE id = $2`,
      [decision, actionId]
    );

    if (decision === "approved") {
      // Execute in background
      after(async () => {
        await executeApprovedAction(actionId);
      });
    }

    return NextResponse.json({ ok: true, actionId, decision });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
