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
  status: z.enum(["queued", "sent", "acknowledged", "blocked", "done", "failed"]),
});

// ── GET /api/office/dispatch ──────────────────────────────────────────────────
// Returns dispatch history, optionally filtered by agent.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  try {
    // Auto-progress stale dispatches:
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
// Creates a new dispatch or updates status of an existing one.

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bodyObj = body as Record<string, unknown>;

  // ── Branch: status update ───────────────────────────────────────────────────
  if (bodyObj?.id && bodyObj?.status) {
    const parsed = updateSchema.safeParse(bodyObj);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try {
      const q = await db.query(
        `UPDATE office_dispatches
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [parsed.data.status, parsed.data.id]
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
