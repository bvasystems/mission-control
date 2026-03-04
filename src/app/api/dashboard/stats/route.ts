import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [tasks, health, stats, taskCounters] = await Promise.all([
    db.query('SELECT status FROM tasks'),
    db.query('SELECT * FROM health_checks ORDER BY last_check DESC LIMIT 10'),
    db.query('SELECT * FROM agent_stats ORDER BY date DESC LIMIT 7'),
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('Done','done') AND status != 'Blocked' AND status != 'blocked') AS open_count,
        COUNT(*) FILTER (WHERE status IN ('Blocked','blocked'))                                               AS blocked_count,
        COUNT(*) FILTER (WHERE status IN ('Done','done','Approved'))                                         AS done_count,
        COUNT(*) FILTER (
          WHERE due_date IS NOT NULL
            AND due_date < NOW()
            AND status NOT IN ('Done','done','Approved')
        )                                                                                                     AS overdue_count
      FROM tasks
    `),
  ]);

  const counters = taskCounters.rows[0] ?? {};

  return NextResponse.json({
    ok: true,
    tasks: tasks.rows,
    health: health.rows,
    agent_stats: stats.rows,
    // Phase-1 operational counters
    task_counters: {
      open:    Number(counters.open_count    ?? 0),
      blocked: Number(counters.blocked_count ?? 0),
      done:    Number(counters.done_count    ?? 0),
      overdue: Number(counters.overdue_count ?? 0),
    },
  });
}
