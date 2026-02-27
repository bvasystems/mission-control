import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
const q = await db.query(
`select id, name, level, status, last_seen, messages_24h, errors_24h, updated_at
from agents_status
order by
case status
when 'down' then 0
when 'degraded' then 1
when 'active' then 2
when 'idle' then 3
end,
name asc`
);

return NextResponse.json({ ok: true, data: q.rows });
}
