import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireIngestToken } from "@/lib/apiAuth"

const cronSchema = z.object({
id: z.string(),
name: z.string(),
schedule: z.string(),
last_run: z.string().datetime().nullable().optional(),
next_run: z.string().datetime().nullable().optional(),
status: z.enum(["active", "paused", "error"]),
last_result: z.string().nullable().optional(),
consecutive_errors: z.number().int().min(0).default(0),
});

const bodySchema = z.object({
jobs: z.array(cronSchema),
});

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

for (const j of parsed.data.jobs) {
await client.query(
`
insert into cron_jobs
(id, name, schedule, last_run, next_run, status, last_result, consecutive_errors, updated_at)
values
($1, $2, $3, $4, $5, $6, $7, $8, now())
on conflict (id) do update set
name = excluded.name,
schedule = excluded.schedule,
last_run = excluded.last_run,
next_run = excluded.next_run,
status = excluded.status,
last_result = excluded.last_result,
consecutive_errors = excluded.consecutive_errors,
updated_at = now()
`,
[
j.id,
j.name,
j.schedule,
j.last_run ?? null,
j.next_run ?? null,
j.status,
j.last_result ?? null,
j.consecutive_errors ?? 0,
]
);
}

await client.query("commit");
return NextResponse.json({ ok: true, count: parsed.data.jobs.length });
} catch (e: unknown) {
    await client.query("rollback");
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
} finally {
client.release();
}
}


