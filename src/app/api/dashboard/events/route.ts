import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireIngestToken } from "@/lib/apiAuth";

const schema = z.object({
source: z.enum(["discord", "telegram"]),
channel_id: z.string().optional(),
message_id: z.string().min(3),
dem_id: z.string().min(5), // ex: DEM-20260226-08
event_type: z.enum(["ASSIGN", "ACK", "UPDATE", "BLOCKED", "DONE", "CLOSE"]),
owner: z.string().optional(), // caio | leticia | joao
support: z.string().optional(),
title: z.string().optional(),
status_text: z.string().optional(),
severity: z.enum(["low", "medium", "high", "critical"]).optional(),
});

function mapOwner(raw?: string) {
if (!raw) return null;
const s = raw.toLowerCase();
if (s.includes("caio")) return "caio";
if (s.includes("leticia") || s.includes("letícia")) return "leticia";
if (s.includes("joao") || s.includes("joão")) return "joao";
return raw;
}

export async function POST(req: NextRequest) {
const auth = requireIngestToken(req);
if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

const body = await req.json();
const parsed = schema.safeParse(body);
if (!parsed.success) {
return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}

const e = parsed.data;
const owner = mapOwner(e.owner);

const client = await db.connect();
try {
await client.query("begin");

// 1) anti-duplicação por message_id
const insertedEvent = await client.query(
`insert into agent_events (source, channel_id, message_id, dem_id, event_type, payload)
values ($1, $2, $3, $4, $5, $6::jsonb)
on conflict (message_id) do nothing
returning id`,
[e.source, e.channel_id ?? null, e.message_id, e.dem_id, e.event_type, JSON.stringify(e)]
);

if (insertedEvent.rowCount === 0) {
await client.query("commit");
return NextResponse.json({ ok: true, deduped: true });
}

// helpers
const taskTitle = e.title ?? `Demanda ${e.dem_id}`;
const taskPriority = e.severity === "critical" ? "critical" : e.severity === "high" ? "high" : "medium";

// 2) regra por evento
if (e.event_type === "ASSIGN") {
await client.query(
`insert into tasks
(dem_id, title, status, priority, assigned_to, board, "column", position, created_at, updated_at)
values
($1, $2, 'pending', $3, $4, 'geral', 'backlog', 0, now(), now())
on conflict (dem_id) do update set
title = excluded.title,
assigned_to = coalesce(excluded.assigned_to, tasks.assigned_to),
updated_at = now()`,
[e.dem_id, taskTitle, taskPriority, owner]
);
}

if (e.event_type === "ACK" || e.event_type === "UPDATE") {
await client.query(
`update tasks
set "column"='in_progress',
status='pending',
updated_at=now()
where dem_id=$1`,
[e.dem_id]
);
}

if (e.event_type === "BLOCKED") {
await client.query(
`update tasks
set "column"='blocked',
status='blocked',
updated_at=now()
where dem_id=$1`,
[e.dem_id]
);
await client.query(
`insert into incidents
(dem_id, title, severity, status, owner, source, impact, next_action, created_at, updated_at)
values
($1, $2, $3, 'open', $4, $5, $6, $7, now(), now())
on conflict do nothing`,
[
e.dem_id,
e.title ?? `Bloqueio ${e.dem_id}`,
e.severity ?? "high",
owner,
e.source,
e.status_text ?? "Bloqueio reportado pelo agente",
"Mitigar bloqueio e retomar fluxo",
]
);

await client.query(
`update incidents
set status='investigating',
updated_at=now(),
next_action=coalesce($2, next_action)
where dem_id=$1 and status <> 'closed'`,
[e.dem_id, e.status_text ?? null]
);
}

if (e.event_type === "DONE") {
await client.query(
`update tasks
set "column"='validation',
status='pending',
updated_at=now()
where dem_id=$1`,
[e.dem_id]
);

await client.query(
`update incidents
set status='mitigated',
updated_at=now()
where dem_id=$1 and status in ('open','investigating')`,
[e.dem_id]
);
}

if (e.event_type === "CLOSE") {
await client.query(
`update tasks
set "column"='done',
status='done',
updated_at=now()
where dem_id=$1`,
[e.dem_id]
);

await client.query(
`update incidents
set status='closed',
updated_at=now()
where dem_id=$1`,
[e.dem_id]
);
}

await client.query("commit");
return NextResponse.json({ ok: true, processed: true });
} catch (err: unknown) {
await client.query("rollback");
return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
} finally {
client.release();
}
}
