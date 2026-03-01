import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── Column mapping: tasks."column" → bucket name ──────────────────────────────

// The tasks table uses "column" values: backlog, in_progress, blocked, validation, done
// We map them to: todo, doing, review, done, blocked

function buildMetricsFromRows(rows: { column: string; cnt: string }[]) {
  let total = 0, todo = 0, doing = 0, review = 0, done = 0, blocked = 0;
  for (const r of rows) {
    const cnt = Number(r.cnt);
    total += cnt;
    switch (r.column) {
      case "backlog":     todo    += cnt; break;
      case "in_progress": doing   += cnt; break;
      case "validation":  review  += cnt; break;
      case "done":        done    += cnt; break;
      case "blocked":     blocked += cnt; break;
    }
  }
  const progress_pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total_tasks: total, todo_tasks: todo, doing_tasks: doing, review_tasks: review, done_tasks: done, blocked_tasks: blocked, progress_pct };
}

// ── GET /api/dashboard/projects ─────────────────────────────────────────────

export async function GET() {
  try {
    // 1) Fetch all projects with latest incidents_open and reliability from project_metrics
    const projectsRes = await db.query(`
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
        m.incidents_open,
        m.risk_score,
        m.reliability_avg,
        m.last_update_at
      FROM projects p
      LEFT JOIN LATERAL (
        SELECT snapshot_at, incidents_open, risk_score, reliability_avg, last_update_at
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

    // 2) Fetch real task counters per project from tasks table
    const taskCountRes = await db.query(`
      SELECT project_key, "column", COUNT(*) AS cnt
      FROM tasks
      WHERE project_key IS NOT NULL
      GROUP BY project_key, "column"
    `);

    // Build map: project_key → column buckets
    const taskMap: Record<string, { column: string; cnt: string }[]> = {};
    for (const row of taskCountRes.rows) {
      if (!taskMap[row.project_key]) taskMap[row.project_key] = [];
      taskMap[row.project_key].push(row);
    }

    const data = projectsRes.rows.map((r) => {
      const taskRows = taskMap[r.project_key] ?? [];
      const realMetrics = buildMetricsFromRows(taskRows);

      return {
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
        metrics: {
          // Real-time task counters from tasks table (source of truth)
          ...realMetrics,
          // Supplementary fields from project_metrics snapshot (reliability, risk, incidents)
          snapshot_at: r.snapshot_at ?? null,
          incidents_open: Number(r.incidents_open ?? 0),
          risk_score: Number(r.risk_score ?? 0),
          reliability_avg: Number(r.reliability_avg ?? 0),
          last_update_at: r.last_update_at ?? null,
        },
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("Failed to list projects:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// ── POST /api/dashboard/projects ─────────────────────────────────────────────

import { z } from "zod";

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
      [d.project_key, d.name, d.owner ?? null, d.status, d.priority ?? null, d.objective ?? null, d.start_date ?? null, d.target_date ?? null]
    );

    return NextResponse.json({ ok: true, data: { project_key: d.project_key } }, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
