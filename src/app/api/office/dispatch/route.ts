import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── Validation ────────────────────────────────────────────────────────────────

const createSchema = z.object({
  targetAgent: z.string().min(1),
  commandText: z.string().min(1),
  actionType: z.string().optional(),
  projectKey: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["queued", "sent", "acknowledged", "blocked", "done", "failed"]).optional(),
  response: z.string().optional(),
});

// ── GET /api/office/dispatch ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  try {
    // Auto-progress dispatches without responses:
    // queued > 3s → sent, sent > 8s → acknowledged, acknowledged > 20s → done
    await db.query(`
      UPDATE office_dispatches SET status = 'sent', updated_at = NOW()
      WHERE status = 'queued' AND created_at < NOW() - INTERVAL '3 seconds'
    `);
    await db.query(`
      UPDATE office_dispatches SET status = 'acknowledged', updated_at = NOW()
      WHERE status = 'sent' AND updated_at < NOW() - INTERVAL '8 seconds'
    `);
    await db.query(`
      UPDATE office_dispatches SET status = 'done', updated_at = NOW()
      WHERE status = 'acknowledged' AND updated_at < NOW() - INTERVAL '20 seconds'
    `);

    const q = agent
      ? await db.query(
          `SELECT * FROM office_dispatches
           WHERE target_agent = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [agent, limit]
        )
      : await db.query(
          `SELECT * FROM office_dispatches
           ORDER BY created_at DESC
           LIMIT $1`,
          [limit]
        );

    return NextResponse.json({ ok: true, data: q.rows });
  } catch (error) {
    console.error("Failed to fetch dispatches:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// ── POST /api/office/dispatch ─────────────────────────────────────────────────
// Creates a new dispatch, updates status, or adds a response.

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bodyObj = body as Record<string, unknown>;

  // ── Branch: update existing dispatch (status change or agent response) ─────
  if (bodyObj?.id) {
    const parsed = updateSchema.safeParse(bodyObj);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { id, status, response } = parsed.data;

    try {
      // Build dynamic SET clause
      const sets: string[] = ["updated_at = NOW()"];
      const vals: unknown[] = [];
      let idx = 1;

      if (status) {
        sets.push(`status = $${idx++}`);
        vals.push(status);
      }
      if (response) {
        sets.push(`response = $${idx++}`);
        vals.push(response);
        sets.push(`responded_at = NOW()`);
        // Auto-set to "done" when agent responds (if not already done/failed)
        if (!status) {
          sets.push(`status = CASE WHEN status NOT IN ('done', 'failed') THEN 'done' ELSE status END`);
        }
      }

      vals.push(id);

      const q = await db.query(
        `UPDATE office_dispatches
         SET ${sets.join(", ")}
         WHERE id = $${idx}
         RETURNING *`,
        vals
      );

      if (!q.rowCount) {
        return NextResponse.json({ error: "Dispatch not found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true, data: q.rows[0] });
    } catch (error) {
      console.error("Failed to update dispatch:", error);
      return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
  }

  // ── Branch: create new dispatch ─────────────────────────────────────────────
  const parsed = createSchema.safeParse(bodyObj);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  try {
    const q = await db.query(
      `INSERT INTO office_dispatches
         (target_agent, command_text, action_type, project_key, status, metadata, issued_by)
       VALUES ($1, $2, $3, $4, 'queued', $5::jsonb, 'joao')
       RETURNING *`,
      [
        d.targetAgent,
        d.commandText,
        d.actionType ?? null,
        d.projectKey ?? null,
        JSON.stringify(d.metadata ?? {}),
      ]
    );

    return NextResponse.json({ ok: true, data: q.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Failed to create dispatch:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
