import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  project_key: z.string().min(2),
  name: z.string().min(1),
  owner: z.string().optional(),
  status: z.enum(["active", "at_risk", "blocked", "done"]).default("active"),
  priority: z.string().optional(),
  objective: z.string().optional(),
  start_date: z.string().optional(),
  target_date: z.string().optional(),
});

// ── GET /api/dashboard/projects ───────────────────────────────────────────────

export async function GET() {
  try {
    const q = await db.query(`
      SELECT
        p.project_key,
        p.name,
        p.owner,
        p.status,
        p.priority,
        p.objective,
        p.start_date,
        p.target_date,
        p.created_at,
        p.updated_at,
        m.snapshot_at,
        m.progress_pct,
        m.total_tasks,
        m.todo_tasks,
        m.doing_tasks,
        m.review_tasks,
        m.done_tasks,
        m.blocked_tasks,
        m.incidents_open,
        m.risk_score,
        m.reliability_avg,
        m.last_update_at
      FROM projects p
      LEFT JOIN LATERAL (
        SELECT *
        FROM project_metrics pm
        WHERE pm.project_key = p.project_key
        ORDER BY pm.snapshot_at DESC
        LIMIT 1
      ) m ON true
      ORDER BY
        CASE p.status
          WHEN 'blocked'  THEN 0
          WHEN 'at_risk'  THEN 1
          WHEN 'active'   THEN 2
          WHEN 'done'     THEN 3
        END,
        p.updated_at DESC
    `);

    const data = q.rows.map((r) => ({
      project_key: r.project_key,
      name: r.name,
      owner: r.owner,
      status: r.status,
      priority: r.priority,
      objective: r.objective,
      start_date: r.start_date,
      target_date: r.target_date,
      created_at: r.created_at,
      updated_at: r.updated_at,
      metrics: r.snapshot_at
        ? {
            snapshot_at: r.snapshot_at,
            progress_pct: Number(r.progress_pct ?? 0),
            total_tasks: Number(r.total_tasks ?? 0),
            todo_tasks: Number(r.todo_tasks ?? 0),
            doing_tasks: Number(r.doing_tasks ?? 0),
            review_tasks: Number(r.review_tasks ?? 0),
            done_tasks: Number(r.done_tasks ?? 0),
            blocked_tasks: Number(r.blocked_tasks ?? 0),
            incidents_open: Number(r.incidents_open ?? 0),
            risk_score: Number(r.risk_score ?? 0),
            reliability_avg: Number(r.reliability_avg ?? 0),
            last_update_at: r.last_update_at,
          }
        : null,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("Failed to list projects:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// ── POST /api/dashboard/projects ─────────────────────────────────────────────

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
    await db.query(
      `INSERT INTO projects
         (project_key, name, owner, status, priority, objective, start_date, target_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, NOW(), NOW())
       ON CONFLICT (project_key) DO UPDATE SET
         name        = EXCLUDED.name,
         owner       = COALESCE(EXCLUDED.owner, projects.owner),
         status      = EXCLUDED.status,
         priority    = COALESCE(EXCLUDED.priority, projects.priority),
         objective   = COALESCE(EXCLUDED.objective, projects.objective),
         start_date  = COALESCE(EXCLUDED.start_date, projects.start_date),
         target_date = COALESCE(EXCLUDED.target_date, projects.target_date),
         updated_at  = NOW()`,
      [
        d.project_key,
        d.name,
        d.owner ?? null,
        d.status,
        d.priority ?? null,
        d.objective ?? null,
        d.start_date ?? null,
        d.target_date ?? null,
      ]
    );

    return NextResponse.json({ ok: true, data: { project_key: d.project_key } }, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
