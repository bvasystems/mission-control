import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
const board = req.nextUrl.searchParams.get("board") || "geral";

const q = await db.query(
`select id, title, status, priority, assigned_to, due_date, board, "column", position, project, risk
from tasks
where board = $1
order by "column" asc, position asc, created_at asc`,
[board]
);

return NextResponse.json({ ok: true, data: q.rows });
}
