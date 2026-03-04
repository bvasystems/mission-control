import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guardApiRoute } from "@/lib/apiAuth";

// DELETE /api/dashboard/filters/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authError = await guardApiRoute(req);
    if (authError) return authError;

    const res = await db.query(`DELETE FROM saved_filters WHERE id = $1`, [params.id]);

    if (res.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "Filter não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
