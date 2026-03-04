import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/dashboard/tasks/[id]/evidences
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const q = await db.query(
      `SELECT * FROM task_evidences WHERE task_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    return NextResponse.json({ ok: true, data: q.rows });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// POST /api/dashboard/tasks/[id]/evidences
const schema = z.object({
  evidence_type: z.enum(["print", "log", "link"]),
  content:       z.string().min(1),
  note:          z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  try {
    // Ensure task exists
    const exists = await db.query(`SELECT id FROM tasks WHERE id = $1`, [id]);
    if (exists.rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const q = await db.query(
      `INSERT INTO task_evidences (task_id, evidence_type, content, note)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, d.evidence_type, d.content, d.note ?? null]
    );

    return NextResponse.json({ ok: true, data: q.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("POST /api/dashboard/tasks/[id]/evidences:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// DELETE /api/dashboard/tasks/[id]/evidences?evidence_id=<uuid>
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const evidenceId = new URL(req.url).searchParams.get("evidence_id");

  if (!evidenceId) {
    return NextResponse.json({ error: "evidence_id required" }, { status: 400 });
  }

  try {
    const { rows } = await db.query(
      `DELETE FROM task_evidences WHERE id = $1 AND task_id = $2 RETURNING id`,
      [evidenceId, id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
