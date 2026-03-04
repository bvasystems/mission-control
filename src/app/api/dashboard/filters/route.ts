import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guardApiRoute } from "@/lib/apiAuth";

// GET /api/dashboard/filters -> Lista os filtros do user
export async function GET(req: NextRequest) {
  try {
    const authError = await guardApiRoute(req);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner");

    if (!owner) {
      return NextResponse.json({ ok: false, error: "Missign owner parameter" }, { status: 400 });
    }

    const res = await db.query(
      `SELECT * FROM saved_filters WHERE owner = $1 ORDER BY created_at DESC`,
      [owner]
    );

    return NextResponse.json({ ok: true, data: res.rows });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// POST /api/dashboard/filters -> Cria novo filtro salvo
export async function POST(req: NextRequest) {
  try {
    const authError = await guardApiRoute(req);
    if (authError) return authError;

    const body = await req.json();
    const { owner, name, filters } = body;

    if (!owner || !name || !filters) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const res = await db.query(
      `INSERT INTO saved_filters (owner, name, filters) VALUES ($1, $2, $3) RETURNING *`,
      [owner, name, JSON.stringify(filters)]
    );

    return NextResponse.json({ ok: true, data: res.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
