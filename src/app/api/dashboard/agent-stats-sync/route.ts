import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireIngestToken } from "@/lib/apiAuth";

const rowSchema = z.object({
agent_id: z.string().min(2),
date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
messages_sent: z.number().int().min(0),
skills_used: z.number().int().min(0).default(0),
errors: z.number().int().min(0).default(0),
model_tokens_used: z.number().int().min(0).default(0),
uptime_hours: z.number().min(0).default(0),
});

const bodySchema = z.object({
rows: z.array(rowSchema),
});

export async function POST(req: NextRequest) {
const auth = requireIngestToken(req);
if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

const body = await req.json();
const parsed = bodySchema.safeParse(body);
if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

const client = await db.connect();
try {
await client.query("begin");

for (const r of parsed.data.rows) {
// upsert por agent_id+date
await client.query(
`
insert into agent_stats
(id, date, messages_sent, skills_used, errors, model_tokens_used, uptime_hours, agent_id)
values
(gen_random_uuid(), $1::date, $2, $3, $4, $5, $6, $7)
on conflict (agent_id, date) do update set
messages_sent = excluded.messages_sent,
skills_used = excluded.skills_used,
errors = excluded.errors,
model_tokens_used = excluded.model_tokens_used,
uptime_hours = excluded.uptime_hours
`,
[
r.date,
r.messages_sent,
r.skills_used,
r.errors,
r.model_tokens_used,
r.uptime_hours,
r.agent_id,
]
);
}

await client.query("commit");
return NextResponse.json({ ok: true, count: parsed.data.rows.length });
} catch (e: any) {
await client.query("rollback");
return NextResponse.json({ error: e.message }, { status: 500 });
} finally {
client.release();
}
}
