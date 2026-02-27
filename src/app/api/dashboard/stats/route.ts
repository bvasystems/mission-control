import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const [tasks, health, stats] = await Promise.all([
    db.query('select status from tasks'),
    db.query('select * from health_checks order by last_check desc limit 10'),
    db.query('select * from agent_stats order by date desc limit 7'),
  ]);

  return NextResponse.json({
    ok: true,
    tasks: tasks.rows,
    health: health.rows,
    agent_stats: stats.rows,
  });
}
