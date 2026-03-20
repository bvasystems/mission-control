import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/reports/reconcile — run agent reconciliation (dashboard trigger)
export async function POST() {
  const client = await db.connect();
  let offline_marked = 0;
  let timed_out_tasks = 0;
  let checked_agents = 0;
  const drift_fixed = 0;

  try {
    await client.query("BEGIN");

    // Mark agents offline if no heartbeat for 3 minutes
    const offlineAgents = await client.query(`
      UPDATE agents_status
      SET status = 'down', updated_at = NOW()
      WHERE last_heartbeat_at < NOW() - INTERVAL '3 minutes'
        AND status = 'active'
      RETURNING id
    `);
    offline_marked = offlineAgents.rowCount ?? 0;

    // Create incidents for newly offline agents
    for (const row of offlineAgents.rows) {
      await client.query(
        `INSERT INTO incidents (title, severity, status, owner, source, impact, next_action, created_at, updated_at)
         VALUES ($1, 'high', 'open', 'system', 'reconciliation', 'Heartbeat lost', 'Investigar agente', NOW(), NOW())`,
        [`Agent ${row.id} offline`]
      );
    }

    checked_agents = parseInt(
      (await client.query("SELECT count(*) FROM agents_status")).rows[0].count,
      10
    );

    // Timeout queued tasks > 2 min without ACK
    const noAck = await client.query(`
      UPDATE tasks
      SET status = 'timeout', stage = 'blocked', updated_at = NOW(),
          error_code = 'ACK_TIMEOUT', error_message = 'Sem ACK > 2 min'
      WHERE status = 'queued' AND created_at < NOW() - INTERVAL '2 minutes'
      RETURNING id
    `);
    timed_out_tasks += noAck.rowCount ?? 0;

    // Timeout running tasks > 15 min without heartbeat
    const runTimeout = await client.query(`
      UPDATE tasks
      SET status = 'timeout', stage = 'blocked', updated_at = NOW(),
          error_code = 'RUNNING_TIMEOUT', error_message = 'Sem heartbeat > 15 min'
      WHERE status = 'running' AND updated_at < NOW() - INTERVAL '15 minutes'
      RETURNING id
    `);
    timed_out_tasks += runTimeout.rowCount ?? 0;

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      checked_agents,
      offline_marked,
      timed_out_tasks,
      drift_fixed,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/reports/reconcile:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
