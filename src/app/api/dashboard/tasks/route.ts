import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── GET /api/dashboard/tasks ─────────────────────────────────────────────────
// Returns all tasks ordered by priority then created_at desc.
// Consumers: Kanban page, dashboard counters.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectKey = searchParams.get("project_key");

  try {
    const q = projectKey
      ? await db.query(
          `SELECT t.*, 
             COALESCE(st.total, 0) as subtasks_total,
             COALESCE(st.done, 0) as subtasks_done
           FROM tasks t
           LEFT JOIN (
             SELECT task_id, COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
             FROM task_subtasks GROUP BY task_id
           ) st ON st.task_id = t.id
           WHERE t.project_key = $1 ORDER BY t.created_at DESC`,
          [projectKey]
        )
      : await db.query(
          `SELECT t.*, 
             COALESCE(st.total, 0) as subtasks_total,
             COALESCE(st.done, 0) as subtasks_done
           FROM tasks t
           LEFT JOIN (
             SELECT task_id, COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
             FROM task_subtasks GROUP BY task_id
           ) st ON st.task_id = t.id
           ORDER BY t.created_at DESC LIMIT 200`
        );

    return NextResponse.json({ ok: true, data: q.rows });
  } catch (err) {
    console.error("GET /api/dashboard/tasks:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ── POST /api/dashboard/tasks ─────────────────────────────────────────────────
// Create a new DEM task with all Phase-1 fields.

const createSchema = z.object({
  title:               z.string().min(3),
  objective:           z.string().min(1),
  type:                z.enum(["n8n", "code", "bug", "improvement"]),
  priority:            z.enum(["P0", "P1", "P2"]).default("P1"),
  owner:               z.string().min(1),
  supporter:           z.string().optional(),
  due_date:            z.string().optional(),
  acceptance_criteria: z.string().min(1),
  project_key:         z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  try {
    // Generate DEM-* ID
    const now = new Date();
    const boardParam = d.project_key ? d.project_key : "Global";
    const demIdPrefix = "DEM-" + Math.floor(Date.now() / 1000).toString().slice(-6) + "-";

    // Start a transaction if we have subtasks, but simplify using separate queries for simplicity mapping ID
    const res = await db.query(
      `INSERT INTO tasks (
        dem_id, title, objective, type, priority, status, 
        "column", position, owner, supporter, acceptance_criteria, 
        project_key, board, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, 'Backlog', 'backlog', 0, $6, $7, $8, $9, $10, NOW(), NOW()
      ) RETURNING *`,
      [
        demIdPrefix + Math.floor(Math.random() * 1000), // temp dem_id generator
        d.title.trim(),
        d.objective.trim(),
        d.type,
        d.priority,
        d.owner.trim(),
        d.supporter?.trim() || null,
        d.acceptance_criteria.trim(),
        d.project_key || null,
        boardParam
      ]
    );

    const newTask = res.rows[0];

    // Assuming `body` might contain `subtasks` array
    // The `createSchema` does not define `subtasks`, so `body.subtasks` would be `unknown`
    // We need to cast `body` to a type that includes `subtasks` or access it carefully.
    // For now, assuming `body` is an object that might have `subtasks`.
    const requestBody = body as { subtasks?: string[] };

    if (requestBody.subtasks && Array.isArray(requestBody.subtasks) && requestBody.subtasks.length > 0) {
      for (const stitle of requestBody.subtasks) {
        if (stitle.trim()) {
           await db.query(
             `INSERT INTO task_subtasks (task_id, title, owner) VALUES ($1, $2, $3)`,
             [newTask.id, stitle.trim(), d.owner.trim()]
           );
        }
      }
    }

    return NextResponse.json({ ok: true, data: newTask }, { status: 201 });
  } catch (err) {
    console.error("POST /api/dashboard/tasks:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
