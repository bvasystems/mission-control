import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/reports/weekly — weekly report without auth (internal dashboard use)
export async function GET() {
  try {
    const [createdQ, doneQ, boardQ, bottlenecksQ] = await Promise.all([
      db.query(`
        SELECT COUNT(*) as count FROM tasks
        WHERE created_at >= NOW() - INTERVAL '7 days'
          AND dem_id IS NOT NULL
      `),
      db.query(`
        SELECT COUNT(*) as count FROM tasks
        WHERE status = 'Done'
          AND updated_at >= NOW() - INTERVAL '7 days'
          AND dem_id IS NOT NULL
      `),
      db.query(`
        SELECT status, COUNT(*) as count FROM tasks
        WHERE dem_id IS NOT NULL
          AND status IN ('Backlog', 'Assigned', 'In Progress', 'Review', 'Approved', 'Blocked')
        GROUP BY status
      `),
      db.query(`
        SELECT dem_id, title, owner, type FROM tasks
        WHERE status = 'Blocked' AND dem_id IS NOT NULL
        ORDER BY updated_at ASC LIMIT 5
      `),
    ]);

    let openTasks = 0;
    let blockedTasks = 0;
    for (const row of boardQ.rows) {
      if (row.status === "Blocked") {
        blockedTasks += parseInt(row.count, 10);
      } else {
        openTasks += parseInt(row.count, 10);
      }
    }

    const totalActive = openTasks + blockedTasks;
    const blockedPercent = totalActive > 0 ? Math.round((blockedTasks / totalActive) * 100) : 0;

    return NextResponse.json({
      ok: true,
      data: {
        created7d: parseInt(createdQ.rows[0].count, 10),
        done7d: parseInt(doneQ.rows[0].count, 10),
        throughput: parseInt(doneQ.rows[0].count, 10),
        blockedPercent,
        bottlenecks: bottlenecksQ.rows,
      },
    });
  } catch (err) {
    console.error("GET /api/reports/weekly:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
