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
update tasks
set dispatch_status='failed',
status='blocked',
"column"='blocked',
updated_at=now()
where id=$1
`,
[t.id]
);

// Abre incidente de timeout de ACK
await db.query(
`
insert into incidents (dem_id, title, severity, status, owner, source, impact, next_action, created_at, updated_at)
values ($1, $2, 'high', 'open', $3, 'dispatch-watchdog', 'Sem ACK no prazo, risco de demanda sem dono ativo', 'Reatribuir owner e reenviar ASSIGN', now(), now())
`,
[
t.dem_id,
`ACK timeout: ${t.title || t.dem_id}`,
t.assigned_to || "jota",
]
);

updated++;
}

return NextResponse.json({ ok: true, overdue: overdue.rowCount, updated });
}
