import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ── GET /api/dashboard/tasks ─────────────────────────────────────────────────
// Returns all tasks ordered by priority then created_at desc.
// Consumers: Kanban page, dashboard counters.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectKey = searchParams.get("project_key");

  try {
    const q = projectKey
      ? await db.query(
          `SELECT * FROM tasks WHERE project_key = $1 ORDER BY created_at DESC`,
          [projectKey]
        )
      : await db.query(
          `SELECT * FROM tasks ORDER BY created_at DESC LIMIT 200`
        );

    return NextResponse.json({ ok: true, data: q.rows });
  } catch (err) {
    console.error("GET /api/dashboard/tasks:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ── POST /api/dashboard/tasks ─────────────────────────────────────────────────
// Create a new DEM task with all Phase-1 fields.

const createSchema = z.object({
  title:               z.string().min(3),
  objective:           z.string().min(1),
  type:                z.enum(["n8n", "code", "bug", "improvement"]),
  priority:            z.enum(["P0", "P1", "P2"]).default("P1"),
  owner:               z.string().min(1),
  supporter:           z.string().optional(),
  due_date:            z.string().optional(),
  acceptance_criteria: z.string().min(1),
  project_key:         z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  try {
    // Generate DEM-* ID
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const rnd = Math.floor(Math.random() * 9000 + 1000);
    const demId = `DEM-${y}${m}${day}-${rnd}`;

    const q = await db.query(
      `INSERT INTO tasks
         (dem_id, title, objective, type, priority, status, "column", position,
          owner, assigned_to, supporter, due_date, acceptance_criteria, project_key, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, 'Backlog', 'backlog', 0,
          $6, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        demId,
        d.title,
        d.objective,
        d.type,
        d.priority,
        d.owner,
        d.supporter ?? null,
        d.due_date ?? null,
        d.acceptance_criteria,
        d.project_key ?? null,
      ]
    );

    return NextResponse.json({ ok: true, data: q.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("POST /api/dashboard/tasks:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
