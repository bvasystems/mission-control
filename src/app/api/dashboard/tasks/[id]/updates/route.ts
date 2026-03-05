import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/dashboard/tasks/[id]/updates
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const q = await db.query(
      `SELECT * FROM task_updates WHERE task_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    return NextResponse.json({ ok: true, data: q.rows });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// POST /api/dashboard/tasks/[id]/updates
const schema = z.object({
  update_type: z.enum(["ACK", "UPDATE", "BLOCKED", "DONE"]),
  message:     z.string().min(1),
  progress:    z.number().min(0).max(100).optional(),
  author:      z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  // Acquire a dedicated client for transaction support
  const client = await db.connect();
  try {
    // Ensure task exists
    const exists = await client.query(`SELECT id FROM tasks WHERE id = $1`, [id]);
    if (exists.rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // ── Guardrail: DONE update requires at least one evidence ──────────────
    if (d.update_type === "DONE") {
      const evCount = await client.query(
        `SELECT COUNT(*) AS cnt FROM task_evidences WHERE task_id = $1`,
        [id]
      );
      const cnt = Number(evCount.rows[0]?.cnt ?? 0);
      if (cnt === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "Guardrail: não é possível marcar como Concluído sem ao menos uma evidência anexada. Vá na aba Evidências e anexe antes de marcar DONE.",
            code: "MISSING_EVIDENCE",
          },
          { status: 422 }
        );
      }
    }

    // ── Atomic transaction: insert update + sync task status ───────────────
    await client.query("BEGIN");

    const q = await client.query(
      `INSERT INTO task_updates (task_id, update_type, message, progress, author)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, d.update_type, d.message, d.progress ?? null, d.author]
    );

    // DONE → transition task to Done/done column
    if (d.update_type === "DONE") {
      await client.query(
        `UPDATE tasks SET status = 'Done', "column" = 'done', updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    }

    // BLOCKED → transition task to Blocked/blocked column
    if (d.update_type === "BLOCKED") {
      await client.query(
        `UPDATE tasks SET status = 'Blocked', "column" = 'blocked', updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({ ok: true, data: q.rows[0] }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/dashboard/tasks/[id]/updates:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
