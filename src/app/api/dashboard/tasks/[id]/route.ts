import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── PATCH /api/dashboard/tasks/[id] ─────────────────────────────────────────
// Edits a task. To transition to "Done" status, the task must have
// at least 1 evidence attached (guardrail).

const patchSchema = z.object({
  title:               z.string().min(3).optional(),
  objective:           z.string().optional(),
  type:                z.enum(["n8n", "code", "bug", "improvement"]).optional(),
  priority:            z.enum(["P0", "P1", "P2", "low", "medium", "high", "critical"]).optional(),
  status:              z.string().optional(),
  owner:               z.string().optional(),
  assigned_to:         z.string().optional(),
  supporter:           z.string().optional(),
  due_date:            z.string().nullable().optional(),
  acceptance_criteria: z.string().optional(),
  stage:               z.string().optional(),
  progress:            z.number().min(0).max(100).optional(),
  deliverables:        z.array(z.string()).optional(),
  label:               z.string().optional(),
  project_key:         z.string().optional(),
  "column":            z.string().optional(),
  position:            z.number().int().min(0).optional(),
});

// Official status → column mapping
const STATUS_COLUMN: Record<string, string> = {
  Backlog:      "backlog",
  Assigned:     "backlog",
  "In Progress": "in_progress",
  Review:       "validation",
  Approved:     "validation",
  Done:         "done",
  Blocked:      "blocked",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  // ── Guardrail: cannot transition to Done without evidence ──────
  if (d.status === "Done" || d["column"] === "done") {
    const evCount = await db.query(
      `SELECT COUNT(*) AS cnt FROM task_evidences WHERE task_id = $1`,
      [id]
    );
    const cnt = Number(evCount.rows[0]?.cnt ?? 0);
    if (cnt === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Guardrail: não é possível marcar como Done sem ao menos uma evidência anexada.",
          code: "MISSING_EVIDENCE",
        },
        { status: 422 }
      );
    }
  }

  // ── Build dynamic SET clause ───────────────────────────────────
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const push = (col: string, val: unknown) => {
    updates.push(`${col} = $${idx++}`);
    values.push(val);
  };

  if (d.title               !== undefined) push("title", d.title);
  if (d.objective           !== undefined) push("objective", d.objective);
  if (d.type                !== undefined) push("type", d.type);
  if (d.priority            !== undefined) push("priority", d.priority);
  if (d.owner               !== undefined) { push("owner", d.owner); push("assigned_to", d.owner); }
  if (d.assigned_to         !== undefined) push("assigned_to", d.assigned_to);
  if (d.supporter           !== undefined) push("supporter", d.supporter);
  if (d.due_date            !== undefined) push("due_date", d.due_date);
  if (d.acceptance_criteria !== undefined) push("acceptance_criteria", d.acceptance_criteria);
  if (d.stage               !== undefined) push("stage", d.stage);
  if (d.progress            !== undefined) push("progress", d.progress);
  if (d.deliverables        !== undefined) push("deliverables", JSON.stringify(d.deliverables));
  if (d.label               !== undefined) push("label", d.label);
  if (d.project_key         !== undefined) push("project_key", d.project_key);

  // Status drives column (and vice-versa)
  if (d.status !== undefined) {
    push("status", d.status);
    const autoCol = STATUS_COLUMN[d.status];
    if (autoCol) push('"column"', autoCol);
  }
  if (d["column"] !== undefined && d.status === undefined) {
    push('"column"', d["column"]);
  }
  if (d.position !== undefined) push("position", d.position);

  if (updates.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  try {
    const { rows } = await db.query(
      `UPDATE tasks SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("PATCH /api/dashboard/tasks/[id]:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ── GET /api/dashboard/tasks/[id] ─────────────────────────────────────────────
// Returns a single task with its updates and evidences.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [taskRes, updatesRes, evidencesRes] = await Promise.all([
      db.query(`SELECT * FROM tasks WHERE id = $1`, [id]),
      db.query(`SELECT * FROM task_updates WHERE task_id = $1 ORDER BY created_at DESC`, [id]),
      db.query(`SELECT * FROM task_evidences WHERE task_id = $1 ORDER BY created_at DESC`, [id]),
    ]);

    if (taskRes.rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        task: taskRes.rows[0],
        updates: updatesRes.rows,
        evidences: evidencesRes.rows,
      },
    });
  } catch (err) {
    console.error("GET /api/dashboard/tasks/[id]:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ── DELETE /api/dashboard/tasks/[id] ─────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { rows } = await db.query(
      `DELETE FROM tasks WHERE id = $1 RETURNING id, dem_id, title`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("DELETE /api/dashboard/tasks/[id]:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
