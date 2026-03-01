import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireIngestToken } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const metricsSchema = z.object({
  snapshot_at: z.string().optional(),
  progress_pct: z.number().min(0).max(100).default(0),
  total_tasks: z.number().int().default(0),
  todo_tasks: z.number().int().default(0),
  doing_tasks: z.number().int().default(0),
  review_tasks: z.number().int().default(0),
  done_tasks: z.number().int().default(0),
  blocked_tasks: z.number().int().default(0),
  incidents_open: z.number().int().default(0),
  risk_score: z.number().default(0),
  reliability_avg: z.number().default(0),
  last_update_at: z.string().optional(),
});

const linkSchema = z.object({
  dem_id: z.string().optional(),
  task_id: z.string().uuid().optional(),
  command_id: z.string().optional(),
  agent_id: z.string().optional(),
});

const bodySchema = z.object({
  project: z.object({
    project_key: z.string().min(2),
    name: z.string().min(1),
    owner: z.string().optional(),
    status: z.enum(["active", "at_risk", "blocked", "done"]).default("active"),
    priority: z.string().optional(),
    objective: z.string().optional(),
    start_date: z.string().optional(),
    target_date: z.string().optional(),
  }),
  metrics: metricsSchema.optional(),
  links: z.array(linkSchema).optional(),
});

// ── POST /api/dashboard/projects-sync ────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = requireIngestToken(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { project: p, metrics: m, links } = parsed.data;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // 1) Upsert project
    await client.query(
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
        p.project_key,
        p.name,
        p.owner ?? null,
        p.status,
        p.priority ?? null,
        p.objective ?? null,
        p.start_date ?? null,
        p.target_date ?? null,
      ]
    );

    // 2) Insert metrics snapshot (if provided)
    let snapshotSaved = false;
    if (m) {
      const snapshotAt = m.snapshot_at ? new Date(m.snapshot_at).toISOString() : new Date().toISOString();
      await client.query(
        `INSERT INTO project_metrics
           (project_key, snapshot_at, progress_pct, total_tasks, todo_tasks, doing_tasks,
            review_tasks, done_tasks, blocked_tasks, incidents_open, risk_score, reliability_avg, last_update_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          p.project_key,
          snapshotAt,
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
          m.last_update_at ? new Date(m.last_update_at).toISOString() : null,
        ]
      );
      snapshotSaved = true;
    }

    // 3) Insert links (if provided)
    let linksSaved = 0;
    if (links && links.length > 0) {
      for (const link of links) {
        await client.query(
          `INSERT INTO project_links (project_key, dem_id, task_id, command_id, agent_id, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            p.project_key,
            link.dem_id ?? null,
            link.task_id ?? null,
            link.command_id ?? null,
            link.agent_id ?? null,
          ]
        );
        linksSaved++;
      }
    }

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      data: {
        project_key: p.project_key,
        snapshot_saved: snapshotSaved,
        links_saved: linksSaved,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to sync project:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  } finally {
    client.release();
  }
}
