import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ projectKey: string }> };

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

// ── GET /api/dashboard/projects/[projectKey] ──────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { projectKey } = await params;

  try {
    // 1) Project row
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

    // 2) Real task counts from tasks.project_key
    const taskCountRes = await db.query(
      `SELECT "column", COUNT(*) AS cnt
       FROM tasks
       WHERE project_key = $1
       GROUP BY "column"`,
      [projectKey]
    );
    const realMetrics = buildMetricsFromRows(taskCountRes.rows);

    // 3) Latest snapshot (for incidents_open, risk_score, reliability_avg)
    const latestRes = await db.query(
      `SELECT snapshot_at, incidents_open, risk_score, reliability_avg, last_update_at
       FROM project_metrics
       WHERE project_key = $1
       ORDER BY snapshot_at DESC
       LIMIT 1`,
      [projectKey]
    );
    const latest = latestRes.rows[0] ?? null;

    // 4) History
    const historyRes = await db.query(
      `SELECT snapshot_at, progress_pct, total_tasks, done_tasks, blocked_tasks,
              incidents_open, risk_score, reliability_avg
       FROM project_metrics
       WHERE project_key = $1
       ORDER BY snapshot_at DESC
       LIMIT 10`,
      [projectKey]
    );

    // 5) Links
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
        latest_metrics: {
          // Real-time from tasks (source of truth)
          ...realMetrics,
          // Supplementary snapshot fields
          snapshot_at: latest?.snapshot_at ?? null,
          incidents_open: Number(latest?.incidents_open ?? 0),
          risk_score: Number(latest?.risk_score ?? 0),
          reliability_avg: Number(latest?.reliability_avg ?? 0),
          last_update_at: latest?.last_update_at ?? null,
        },
        history: historyRes.rows.reverse(),
        links: linksRes.rows,
      },
    });
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
