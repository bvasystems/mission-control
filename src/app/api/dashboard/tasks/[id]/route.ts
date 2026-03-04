import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status:       z.string().optional(),
  stage:        z.string().optional(),
  progress:     z.number().min(0).max(100).optional(),
  deliverables: z.array(z.string()).optional(),
  label:        z.string().optional(),
  assigned_to:  z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const d = parsed.data;
  if (d.status !== undefined)       { updates.push(`status = $${idx++}`);       values.push(d.status); }
  if (d.stage !== undefined)        { updates.push(`stage = $${idx++}`);        values.push(d.stage); }
  if (d.progress !== undefined)     { updates.push(`progress = $${idx++}`);     values.push(d.progress); }
  if (d.deliverables !== undefined) { updates.push(`deliverables = $${idx++}`); values.push(JSON.stringify(d.deliverables)); }
  if (d.label !== undefined)        { updates.push(`label = $${idx++}`);        values.push(d.label); }
  if (d.assigned_to !== undefined)  { updates.push(`assigned_to = $${idx++}`);  values.push(d.assigned_to); }

  if (updates.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await db.query(
    `UPDATE tasks SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (rows.length === 0) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: rows[0] });
}
