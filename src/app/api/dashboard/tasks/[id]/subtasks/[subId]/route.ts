import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guardApiRoute } from "@/lib/apiAuth";

// PATCH /api/dashboard/tasks/[id]/subtasks/[subId]
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; subId: string }> }
) {
  try {
    const authError = await guardApiRoute(req);
    if (authError) return authError;

    const { subId } = await context.params;

    const body = await req.json();
    const { title, status, owner } = body;

    // build dynamic set
    const sets = [];
    const values: unknown[] = [subId];
    let idx = 2;

    if (title !== undefined) {
      sets.push(`title = $${idx++}`);
      values.push(title);
    }
    if (status !== undefined) {
      sets.push(`status = $${idx++}`);
      values.push(status);
    }
    if (owner !== undefined) {
      sets.push(`owner = $${idx++}`);
      values.push(owner);
    }

    if (sets.length === 0) {
      return NextResponse.json({ ok: true, message: "No changes" });
    }

    sets.push(`updated_at = NOW()`);

    const query = `UPDATE task_subtasks SET ${sets.join(", ")} WHERE id = $1 RETURNING *`;
    const res = await db.query(query, values);

    if (res.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "Subtask não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: res.rows[0] });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "Unknown error" }, { status: 500 });
  }
}

// DELETE /api/dashboard/tasks/[id]/subtasks/[subId]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; subId: string }> }
) {
  try {
    const authError = await guardApiRoute(req);
    if (authError) return authError;

    const { subId } = await context.params;

    const res = await db.query(`DELETE FROM task_subtasks WHERE id = $1`, [subId]);

    if (res.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "Subtask não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "Unknown error" }, { status: 500 });
  }
}
