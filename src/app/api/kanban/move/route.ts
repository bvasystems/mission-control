import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
id: z.string().uuid(),
column: z.enum(["backlog", "in_progress", "blocked", "validation", "done"]),
position: z.number().int().min(0),
});

const mapStatus: Record<string, "pending" | "blocked" | "done"> = {
backlog: "pending",
in_progress: "pending",
blocked: "blocked",
validation: "pending",
done: "done",
};

export async function POST(req: NextRequest) {
const body = await req.json();
const parsed = schema.safeParse(body);
if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

const { id, column, position } = parsed.data;
const status = mapStatus[column];

const q = await db.query(
`update tasks
set "column" = $1, position = $2, status = $3, updated_at = now()
where id = $4
returning *`,
[column, position, status, id]
);

return NextResponse.json({ ok: true, data: q.rows[0] ?? null });
}
