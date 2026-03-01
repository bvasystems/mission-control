import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireIngestToken } from "@/lib/apiAuth";

export async function POST(req: NextRequest) {
const auth = requireIngestToken(req);
if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

const now = new Date().toISOString();

// Tasks enviadas sem ACK e deadline expirado
const overdue = await db.query(
`
select id, dem_id, title, assigned_to, ack_deadline
from tasks
where dispatch_status = 'sent'
and ack_deadline is not null
and ack_deadline < $1::timestamptz
`,
[now]
);

let updated = 0;
for (const t of overdue.rows) {
// Task vira blocked + failed
await db.query(
`
UPDATE tasks
SET dispatch_status='failed',
    status='blocked',
    "column"='blocked',
    updated_at=NOW()
WHERE id=$1
`,
[t.id]
);

// Fingerprint para dedupe: source:owner:cause:day
const dayBucket = now.slice(0, 10); // YYYY-MM-DD
const fingerprint = `dispatch-watchdog:${t.assigned_to || "unknown"}:ACK_TIMEOUT:${dayBucket}`;

const details = {
  agent_id: t.assigned_to ?? null,
  dominant_cause: "ACK_TIMEOUT",
  cause_breakdown: { ACK_TIMEOUT: 1 },
  sample_size: 1,
  window_hours: 24,
  first_seen_at: now,
  last_seen_at: now,
  related_dem_ids: [t.dem_id],
  last_messages: [`ACK timeout: ${t.title || t.dem_id}`],
  count: 1,
  recommended_action: "Reatribuir owner e reenviar ASSIGN",
};

// Check dedupe
const existing = await db.query(
  `SELECT id, details FROM incidents
   WHERE fingerprint = $1 AND status IN ('open', 'investigating')
   LIMIT 1`,
  [fingerprint]
);

if (existing.rowCount && existing.rowCount > 0) {
  // Update existing: increment count, append dem_id
  const row = existing.rows[0];
  let prev: Record<string, unknown> = {};
  try {
    prev = typeof row.details === "string" ? JSON.parse(row.details) : (row.details ?? {});
  } catch { /* keep empty */ }

  const prevRelated = Array.isArray(prev.related_dem_ids) ? prev.related_dem_ids as string[] : [];
  const merged = {
    ...prev,
    count: ((prev.count as number) ?? 1) + 1,
    last_seen_at: now,
    related_dem_ids: Array.from(new Set([...prevRelated, t.dem_id])),
  };

  await db.query(
    `UPDATE incidents SET updated_at=NOW(), details=$1::jsonb WHERE id=$2`,
    [JSON.stringify(merged), row.id]
  );
} else {
  // Create new incident with fingerprint
  await db.query(
    `INSERT INTO incidents
       (dem_id, title, severity, status, owner, source, impact, next_action,
        fingerprint, details, created_at, updated_at)
     VALUES ($1, $2, 'high', 'open', $3, 'dispatch-watchdog',
             'Sem ACK no prazo, risco de demanda sem dono ativo',
             'Reatribuir owner e reenviar ASSIGN',
             $4, $5::jsonb, NOW(), NOW())`,
    [
      t.dem_id,
      `ACK timeout: ${t.title || t.dem_id}`,
      t.assigned_to || "jota",
      fingerprint,
      JSON.stringify(details),
    ]
  );
}

updated++;
}

return NextResponse.json({ ok: true, overdue: overdue.rowCount, updated });
}
