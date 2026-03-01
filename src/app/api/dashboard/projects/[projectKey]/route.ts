import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ projectKey: string }> };

// ── GET /api/dashboard/projects/[projectKey] ──────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { projectKey } = await params;

  try {
    // 1) Fetch project
    const projectRes = await db.query(
      `SELECT project_key, name, owner, status, priority, objective,
              start_date, target_date, created_at, updated_at
       FROM projects
       WHERE project_key = $1`,
      [projectKey]
    );

    if (!projectRes.rowCount || projectRes.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    const project = projectRes.rows[0];

    // 2) Latest metrics
    const latestRes = await db.query(
      `SELECT snapshot_at, progress_pct, total_tasks, todo_tasks, doing_tasks,
              review_tasks, done_tasks, blocked_tasks, incidents_open,
              risk_score, reliability_avg, last_update_at
       FROM project_metrics
       WHERE project_key = $1
       ORDER BY snapshot_at DESC
       LIMIT 1`,
      [projectKey]
    );

    const latest = latestRes.rows[0] ?? null;

    // 3) History (last 10 snapshots, oldest first for charting)
    const historyRes = await db.query(
      `SELECT snapshot_at, progress_pct, total_tasks, done_tasks, blocked_tasks,
              incidents_open, risk_score, reliability_avg
       FROM project_metrics
       WHERE project_key = $1
       ORDER BY snapshot_at DESC
       LIMIT 10`,
      [projectKey]
    );

    // 4) Links
    const linksRes = await db.query(
      `SELECT id, dem_id, task_id, command_id, agent_id, created_at
       FROM project_links
       WHERE project_key = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [projectKey]
    );

    return NextResponse.json({
      ok: true,
      data: {
        project,
        latest_metrics: latest
          ? {
              snapshot_at: latest.snapshot_at,
              progress_pct: Number(latest.progress_pct ?? 0),
              total_tasks: Number(latest.total_tasks ?? 0),
              todo_tasks: Number(latest.todo_tasks ?? 0),
              doing_tasks: Number(latest.doing_tasks ?? 0),
              review_tasks: Number(latest.review_tasks ?? 0),
              done_tasks: Number(latest.done_tasks ?? 0),
              blocked_tasks: Number(latest.blocked_tasks ?? 0),
              incidents_open: Number(latest.incidents_open ?? 0),
              risk_score: Number(latest.risk_score ?? 0),
              reliability_avg: Number(latest.reliability_avg ?? 0),
              last_update_at: latest.last_update_at,
            }
          : null,
        history: historyRes.rows.reverse(), // chronological order
        links: linksRes.rows,
      },
    });
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
