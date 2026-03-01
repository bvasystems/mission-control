import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(3),
  severity: z.enum(["low", "medium", "high", "critical"]),
  owner: z.string().optional(),
  source: z.string().optional(),
  impact: z.string().optional(),
  next_action: z.string().optional(),
  // dedupe fields
  fingerprint: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "investigating", "mitigated", "closed"]),
  next_action: z.string().optional(),
});

export async function GET() {
  try {
    const q = await db.query(
      `SELECT id, title, severity, status, owner, source, impact, next_action,
              fingerprint, details, created_at, updated_at
       FROM incidents
       ORDER BY
         CASE severity
           WHEN 'critical' THEN 0
           WHEN 'high'     THEN 1
           WHEN 'medium'   THEN 2
           WHEN 'low'      THEN 3
         END,
         created_at DESC`
    );
    return NextResponse.json({ ok: true, data: q.rows });
  } catch (error) {
    console.error("Failed to list incidents:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // ── update status ────────────────────────────────────────────────────────────
  if (body?.id && body?.status) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const q = await db.query(
      `UPDATE incidents
       SET status = $1,
           next_action = COALESCE($2, next_action),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [parsed.data.status, parsed.data.next_action ?? null, parsed.data.id]
    );

    return NextResponse.json({ ok: true, data: q.rows[0] ?? null });
  }

  // ── create / dedupe by fingerprint ───────────────────────────────────────────
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  try {
    // If fingerprint provided: try to find existing open incident first
    if (d.fingerprint) {
      const existing = await db.query(
        `SELECT id, details FROM incidents
         WHERE fingerprint = $1 AND status IN ('open', 'investigating')
         LIMIT 1`,
        [d.fingerprint]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        const row = existing.rows[0];

        // Merge details: increment count, update last_seen_at and last_message
        let prevDetails: Record<string, unknown> = {};
        try {
          prevDetails = typeof row.details === "string"
            ? JSON.parse(row.details)
            : (row.details ?? {});
        } catch { /* keep empty */ }

        const newDetails: Record<string, unknown> = {
          ...prevDetails,
          ...(d.details ?? {}),
          count: ((prevDetails.count as number) ?? 1) + 1,
          last_seen_at: new Date().toISOString(),
          last_message: d.details?.last_messages?.[0] ?? prevDetails.last_message,
        };

        await db.query(
          `UPDATE incidents
           SET updated_at = NOW(),
               details = $1::jsonb
           WHERE id = $2`,
          [JSON.stringify(newDetails), row.id]
        );

        return NextResponse.json({ ok: true, deduped: true, id: row.id });
      }
    }

    // No duplicate found – create fresh incident
    const detailsJson = d.details ? JSON.stringify(d.details) : null;

    const q = await db.query(
      `INSERT INTO incidents
         (title, severity, status, owner, source, impact, next_action,
          fingerprint, details, created_at, updated_at)
       VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW())
       RETURNING *`,
      [
        d.title,
        d.severity,
        d.owner ?? null,
        d.source ?? null,
        d.impact ?? null,
        d.next_action ?? null,
        d.fingerprint ?? null,
        detailsJson,
      ]
    );

    return NextResponse.json({ ok: true, data: q.rows[0] });
  } catch (error) {
    console.error("Failed to create incident:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
