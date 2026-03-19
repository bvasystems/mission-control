import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── Webhook for external agents/systems to respond or send messages ───────────
// Used by: Discord bots, n8n workflows, agent processes, etc.
//
// Two modes:
// 1. Respond to a dispatch: { dispatch_id, message }
// 2. Send a new inbound message: { agent_name, message }

const webhookSchema = z.object({
  dispatch_id: z.string().uuid().optional(),
  agent_name: z.string().min(1),
  message: z.string().min(1),
  source: z.string().default("api"),
  status: z.enum(["acknowledged", "done", "blocked", "failed"]).optional(),
});

function validateAuth(req: NextRequest): boolean {
  const secret = process.env.OFFICE_WEBHOOK_SECRET;
  if (!secret) return true; // No secret configured = open (dev mode)

  const auth = req.headers.get("authorization");
  if (!auth) return false;

  const token = auth.replace(/^Bearer\s+/i, "");
  return token === secret;
}

export async function POST(req: NextRequest) {
  // ── Auth check ──────────────────────────────────────────────────────────────
  if (!validateAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { dispatch_id, agent_name, message, source, status } = parsed.data;

  try {
    // ── Mode 1: Respond to existing dispatch ────────────────────────────────
    if (dispatch_id) {
      const resolveStatus = status ?? "done";
      const q = await db.query(
        `UPDATE office_dispatches
         SET response = $1,
             responded_at = NOW(),
             status = $2,
             metadata = jsonb_set(COALESCE(metadata, '{}'), '{webhook_source}', $3::jsonb),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [message, resolveStatus, JSON.stringify(source), dispatch_id]
      );

      if (!q.rowCount) {
        return NextResponse.json({ error: "Dispatch not found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true, action: "responded", data: q.rows[0] });
    }

    // ── Mode 2: Agent sends unsolicited inbound message ─────────────────────
    const agentKey = agent_name.toLowerCase();

    // Check if there's an active outbound dispatch to respond to
    const pending = await db.query(
      `SELECT id FROM office_dispatches
       WHERE target_agent = $1
         AND direction = 'outbound'
         AND status IN ('queued', 'sent', 'acknowledged')
       ORDER BY created_at DESC
       LIMIT 1`,
      [agentKey]
    );

    if (pending.rowCount && pending.rowCount > 0) {
      // Auto-respond to the most recent pending dispatch
      const resolveStatus = status ?? "done";
      const q = await db.query(
        `UPDATE office_dispatches
         SET response = $1,
             responded_at = NOW(),
             status = $2,
             metadata = jsonb_set(COALESCE(metadata, '{}'), '{webhook_source}', $3::jsonb),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [message, resolveStatus, JSON.stringify(source), pending.rows[0].id]
      );

      return NextResponse.json({ ok: true, action: "responded_pending", data: q.rows[0] });
    }

    // No pending dispatch — create new inbound message
    const q = await db.query(
      `INSERT INTO office_dispatches
         (target_agent, command_text, action_type, status, direction, metadata, issued_by, response, responded_at)
       VALUES ($1, $2, 'inbound_message', 'done', 'inbound', $3::jsonb, $1, NULL, NULL)
       RETURNING *`,
      [agentKey, message, JSON.stringify({ source })]
    );

    return NextResponse.json({ ok: true, action: "inbound_created", data: q.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
