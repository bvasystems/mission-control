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

  try {
    // Ensure task exists
    const exists = await db.query(`SELECT id FROM tasks WHERE id = $1`, [id]);
    if (exists.rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const q = await db.query(
      `INSERT INTO task_updates (task_id, update_type, message, progress, author)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, d.update_type, d.message, d.progress ?? null, d.author]
    );

    // If update is DONE type, auto-advance task status to Review
    if (d.update_type === "DONE") {
      await db.query(
        `UPDATE tasks SET status = 'Review', "column" = 'validation', updated_at = NOW()
         WHERE id = $1 AND status NOT IN ('Done','Approved')`,
        [id]
      );
    }

    // If update is BLOCKED type, auto-advance task status to Blocked
    if (d.update_type === "BLOCKED") {
      await db.query(
        `UPDATE tasks SET status = 'Blocked', "column" = 'blocked', updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    }

    return NextResponse.json({ ok: true, data: q.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("POST /api/dashboard/tasks/[id]/updates:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
