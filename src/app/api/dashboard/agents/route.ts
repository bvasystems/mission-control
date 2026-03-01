import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  const q = await db.query(
    `
    SELECT
      a.id,
      a.name,
      a.level,
      a.status,
      a.last_seen,
      a.messages_24h,
      a.errors_24h,
      a.updated_at,
      s.reliability_score,
      s.reliability_meta
    FROM agents_status a
    LEFT JOIN LATERAL (
      SELECT reliability_score, reliability_meta
      FROM agent_stats st
      WHERE 
        st.agent_id = a.id OR
        st.agent_id = lower(a.name) OR
        (lower(a.name) = 'main' AND st.agent_id IN ('main', 'jota', 'faisca', 'faísca')) OR
        (lower(a.name) = 'leticia' AND st.agent_id IN ('leticia', 'letícia'))
      ORDER BY st.date DESC, st.created_at DESC
      LIMIT 1
    ) s ON true
    ORDER BY
      CASE a.status
        WHEN 'down' THEN 0
        WHEN 'degraded' THEN 1
        WHEN 'active' THEN 2
        WHEN 'idle' THEN 3
      END,
      a.name ASC
    `
  );

return NextResponse.json({ ok: true, data: q.rows });
}
