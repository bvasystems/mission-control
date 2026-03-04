import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const board = searchParams.get("board") || "geral";
  const projectKey = searchParams.get("project_key") ?? null;

  try {
    let q;
    if (projectKey) {
      // Filtered by project_key — ignores board param for cross-board project views
      q = await db.query(
        `SELECT id, title, status, priority, assigned_to, due_date, board, "column", position, project, risk, project_key,
                COALESCE(deliverables, '[]'::jsonb) AS deliverables,
                COALESCE(progress, 0) AS progress,
                label, created_at
         FROM tasks
         WHERE project_key = $1
         ORDER BY "column" ASC, position ASC, created_at ASC`,
        [projectKey]
      );
    } else {
      // Default: board-scoped (unchanged behaviour)
      q = await db.query(
        `SELECT id, title, status, priority, assigned_to, due_date, board, "column", position, project, risk, project_key,
                COALESCE(deliverables, '[]'::jsonb) AS deliverables,
                COALESCE(progress, 0) AS progress,
                label, created_at
         FROM tasks
         WHERE board = $1
         ORDER BY "column" ASC, position ASC, created_at ASC`,
        [board]
      );
    }

    return NextResponse.json({ ok: true, data: q.rows });
  } catch (error) {
    console.error("Failed to fetch kanban tasks:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
