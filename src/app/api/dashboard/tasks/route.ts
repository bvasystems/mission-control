import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET all tasks enriched with deliverables, progress, label
export async function GET() {
  try {
    const { rows } = await db.query(
      `SELECT id, title, status, priority, stage, assigned_to, due_date,
              project_key, created_at, updated_at,
              COALESCE(deliverables, '[]'::jsonb) AS deliverables,
              COALESCE(progress, 0) AS progress,
              label
       FROM tasks
       ORDER BY created_at DESC
       LIMIT 200`
    );
    return NextResponse.json({ ok: true, data: rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
