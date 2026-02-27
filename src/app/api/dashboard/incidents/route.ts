import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const createSchema = z.object({
title: z.string().min(3),
severity: z.enum(["low", "medium", "high", "critical"]),
owner: z.string().optional(),
source: z.string().optional(),
impact: z.string().optional(),
next_action: z.string().optional(),
});

const updateSchema = z.object({
id: z.string().uuid(),
status: z.enum(["open", "investigating", "mitigated", "closed"]),
next_action: z.string().optional(),
});

export async function GET() {
const q = await db.query(
`select id, title, severity, status, owner, source, impact, next_action, created_at, updated_at
from incidents
order by
case severity
when 'critical' then 0
when 'high' then 1
when 'medium' then 2
when 'low' then 3
end,
created_at desc`
);

return NextResponse.json({ ok: true, data: q.rows });
}

export async function POST(req: NextRequest) {
const body = await req.json();

// update status
if (body?.id && body?.status) {
const parsed = updateSchema.safeParse(body);
if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

const q = await db.query(
`update incidents
set status = $1,
next_action = coalesce($2, next_action),
updated_at = now()
where id = $3
returning *`,
[parsed.data.status, parsed.data.next_action ?? null, parsed.data.id]
);

return NextResponse.json({ ok: true, data: q.rows[0] ?? null });
}

// create
const parsed = createSchema.safeParse(body);
if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

const q = await db.query(
`insert into incidents (title, severity, status, owner, source, impact, next_action, created_at, updated_at)
values ($1, $2, 'open', $3, $4, $5, $6, now(), now())
returning *`,
[
parsed.data.title,
parsed.data.severity,
parsed.data.owner ?? null,
parsed.data.source ?? null,
parsed.data.impact ?? null,
parsed.data.next_action ?? null,
]
);

return NextResponse.json({ ok: true, data: q.rows[0] });
}
