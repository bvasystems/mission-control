import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireIngestToken } from "@/lib/apiAuth";

const schema = z.object({
service: z.string().min(2),
status: z.enum(["healthy", "degraded", "down"]),
uptime_pct: z.number().min(0).max(100).optional(),
});

export async function POST(req: NextRequest) {
const auth = requireIngestToken(req);
if (!auth.ok) {
return NextResponse.json({ error: auth.error }, { status: auth.status });
}

const body = await req.json();
const parsed = schema.safeParse(body);
if (!parsed.success) {
return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}

const { service, status, uptime_pct } = parsed.data;

const q = await db.query(
`
insert into health_checks (service, status, uptime_pct, last_check)
values ($1, $2, $3, now())
on conflict (service) do update set
status = excluded.status,
uptime_pct = excluded.uptime_pct,
last_check = now()
returning *
`,
[service, status, uptime_pct ?? null]
);

return NextResponse.json({ ok: true, data: q.rows[0] });
}
