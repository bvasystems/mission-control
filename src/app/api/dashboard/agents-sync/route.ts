import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireIngestToken } from "@/lib/apiAuth";




const agentSchema = z.object({
id: z.string().min(2),
name: z.string().min(2),
level: z.enum(["L1", "L2", "L3", "L4"]),
status: z.enum(["active", "idle", "degraded", "down"]),
last_seen: z.string().datetime().nullable().optional(),
messages_24h: z.number().int().min(0).default(0),
errors_24h: z.number().int().min(0).default(0),
});

const bodySchema = z.object({ agents: z.array(agentSchema) });

export async function POST(req: NextRequest) {
const auth = requireIngestToken(req);
if (!auth.ok) {
return NextResponse.json({ error: auth.error }, { status: auth.status });
}

const body = await req.json();
const parsed = bodySchema.safeParse(body);
if (!parsed.success) {
return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}

const client = await db.connect();
try {
await client.query("begin");

for (const a of parsed.data.agents) {
await client.query(
`insert into agents_status
(id, name, level, status, last_seen, messages_24h, errors_24h, updated_at)
values ($1,$2,$3,$4,$5,$6,$7, now())
on conflict (id) do update set
name = excluded.name,
level = excluded.level,
status = excluded.status,
last_seen = excluded.last_seen,
messages_24h = excluded.messages_24h,
errors_24h = excluded.errors_24h,
updated_at = now()`,
[
a.id,
a.name,
a.level,
a.status,
a.last_seen ?? null,
a.messages_24h ?? 0,
a.errors_24h ?? 0,
]
);
}

await client.query("commit");
return NextResponse.json({ ok: true, count: parsed.data.agents.length });
} catch (e: unknown) {
  await client.query("rollback");
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: message }, { status: 500 });
} finally {
client.release();
}
}
