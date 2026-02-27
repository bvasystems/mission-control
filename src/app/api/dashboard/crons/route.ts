import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const q = await db.query(
    `select id, name, schedule, last_run, next_run, status, last_result, consecutive_errors, updated_at
from cron_jobs
order by
  case status
    when 'error' then 0
    when 'active' then 1
    when 'paused' then 2
  end,
  name asc`
  );

  return NextResponse.json({ ok: true, data: q.rows });
}
