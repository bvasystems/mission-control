import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guardApiRoute } from "@/lib/apiAuth";

// PATCH /api/dashboard/filters/[id] → renomear filtro
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await guardApiRoute(req);
    if (authError) return authError;

    const { id } = await context.params;
    const { name } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
    }

    const res = await db.query(
      `UPDATE saved_filters SET name = $1 WHERE id = $2 RETURNING *`,
      [name.trim(), id]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "Filter não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: res.rows[0] });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "Unknown error" }, { status: 500 });
  }
}

// DELETE /api/dashboard/filters/[id]
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await guardApiRoute(req);
    if (authError) return authError;

    const { id } = await context.params;

    const res = await db.query(`DELETE FROM saved_filters WHERE id = $1`, [id]);

    if (res.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "Filter não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "Unknown error" }, { status: 500 });
  }
}
