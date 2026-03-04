import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Official kanban columns for Phase 1
const COLUMNS = ["backlog", "assigned", "in_progress", "review", "approved", "done", "blocked"] as const;
type KanbanColumn = (typeof COLUMNS)[number];

// Column → official status label
const COLUMN_TO_STATUS: Record<KanbanColumn, string> = {
  backlog:     "Backlog",
  assigned:    "Assigned",
  in_progress: "In Progress",
  review:      "Review",
  approved:    "Approved",
  done:        "Done",
  blocked:     "Blocked",
};

const schema = z.object({
  id:       z.string().uuid(),
  column:   z.enum(COLUMNS),
  position: z.number().int().min(0),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, column, position } = parsed.data;

  // ── Guardrail: cannot move to "done" without evidence ──────────
  if (column === "done") {
    const evCount = await db.query(
      `SELECT COUNT(*) AS cnt FROM task_evidences WHERE task_id = $1`,
      [id]
    );
    const cnt = Number(evCount.rows[0]?.cnt ?? 0);
    if (cnt === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Guardrail: não é possível mover para Done sem ao menos uma evidência anexada.",
          code: "MISSING_EVIDENCE",
        },
        { status: 422 }
      );
    }
  }

  const newStatus = COLUMN_TO_STATUS[column];

  try {
    const q = await db.query(
      `UPDATE tasks
       SET "column" = $1, position = $2, status = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [column, position, newStatus, id]
    );

    if (q.rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: q.rows[0] });
  } catch (err) {
    console.error("POST /api/kanban/move:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
