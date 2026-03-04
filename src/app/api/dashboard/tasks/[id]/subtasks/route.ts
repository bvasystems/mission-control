import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guardApiRoute } from "@/lib/apiAuth";

// GET /api/dashboard/tasks/[id]/subtasks -> Lista subtarefas de uma task
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await guardApiRoute(req);
    if (authError) return authError;

    const { id } = await context.params;

    const res = await db.query(
      `SELECT * FROM task_subtasks WHERE task_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    return NextResponse.json({ ok: true, data: res.rows });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "Unknown error" }, { status: 500 });
  }
}

// POST /api/dashboard/tasks/[id]/subtasks -> Cria subtarefa
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await guardApiRoute(req);
    if (authError) return authError;

    const { id } = await context.params;

    const body = await req.json();
    const { title, owner } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ ok: false, error: "Título obrigatório" }, { status: 400 });
    }

    const res = await db.query(
      `INSERT INTO task_subtasks (task_id, title, owner) VALUES ($1, $2, $3) RETURNING *`,
      [id, title.trim(), owner || null]
    );

    return NextResponse.json({ ok: true, data: res.rows[0] });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "Unknown error" }, { status: 500 });
  }
}

// PATCH /api/dashboard/tasks/[id]/subtasks -> Atualiza subtarefa (como array) - não é muito RESTful mas é fácil
// Ou em um endpoint separado /api/dashboard/tasks/[id]/subtasks/[subtaskId]
