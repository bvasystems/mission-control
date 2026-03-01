import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── Schemas ───────────────────────────────────────────────────────────────────

const detailsSchema = z.object({
  agent_id: z.string().optional(),
  dominant_cause: z.string().optional(),
  cause_breakdown: z.record(z.string(), z.number()).optional(),
  sample_size: z.number().optional(),
  window_hours: z.number().optional(),
  first_seen_at: z.string().optional(),
  last_seen_at: z.string().optional(),
  related_dem_ids: z.array(z.string()).optional(),
  last_messages: z.array(z.string()).optional(),
  count: z.number().optional(),
  recommended_action: z.string().optional(),
  recommended_checklist: z.array(z.string()).optional(),
  definitive_action: z.string().optional(),
  rollback: z.string().optional(),
  eta_min: z.number().optional(),
  confidence: z.number().optional(),
}).passthrough(); // allow extra fields from VPS without breaking

/** Used for both create (no id) and upsert-by-fingerprint */
const createOrUpsertSchema = z.object({
  title: z.string().min(3),
  severity: z.enum(["low", "medium", "high", "critical"]),
  owner: z.string().optional(),
  source: z.string().optional(),
  impact: z.string().optional(),
  next_action: z.string().optional(),
  fingerprint: z.string().optional(),
  details: detailsSchema.optional(),
});

/** Used for explicit status update by id */
const updateByIdSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "investigating", "mitigated", "closed"]),
  next_action: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  impact: z.string().optional(),
  details: detailsSchema.optional(),
});

// ── Helper: safe JSON parse ───────────────────────────────────────────────────

function parseDetails(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

// ── Helper: merge details intelligently ──────────────────────────────────────

function mergeDetails(
  prev: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const now = new Date().toISOString();

  // Sum cause_breakdown instead of overwriting
  const prevBreakdown = (prev.cause_breakdown ?? {}) as Record<string, number>;
  const newBreakdown = (incoming.cause_breakdown ?? {}) as Record<string, number>;
  const mergedBreakdown: Record<string, number> = { ...prevBreakdown };
  for (const [k, v] of Object.entries(newBreakdown)) {
    mergedBreakdown[k] = (mergedBreakdown[k] ?? 0) + v;
  }

  // Merge related_dem_ids (dedupe)
  const prevDems = Array.isArray(prev.related_dem_ids) ? prev.related_dem_ids as string[] : [];
  const newDems = Array.isArray(incoming.related_dem_ids) ? incoming.related_dem_ids as string[] : [];
  const mergedDems = Array.from(new Set([...prevDems, ...newDems]));

  // Keep last 5 messages from both batches
  const prevMsgs = Array.isArray(prev.last_messages) ? prev.last_messages as string[] : [];
  const newMsgs = Array.isArray(incoming.last_messages) ? incoming.last_messages as string[] : [];
  const mergedMsgs = [...newMsgs, ...prevMsgs].slice(0, 5);

  return {
    // Spread prev first, then incoming overwrites scalars
    ...prev,
    ...incoming,
    // Computed / merged fields
    cause_breakdown: Object.keys(mergedBreakdown).length > 0 ? mergedBreakdown : undefined,
    related_dem_ids: mergedDems.length > 0 ? mergedDems : undefined,
    last_messages: mergedMsgs.length > 0 ? mergedMsgs : undefined,
    count: ((prev.count as number) ?? 1) + 1,
    first_seen_at: prev.first_seen_at ?? incoming.first_seen_at ?? now,
    last_seen_at: incoming.last_seen_at ?? now,
  };
}

// ── GET /api/dashboard/incidents ─────────────────────────────────────────────

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

// ── POST /api/dashboard/incidents ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bodyObj = body as Record<string, unknown>;

  // ── Branch 1: explicit update by id (status change from UI) ─────────────────
  if (bodyObj?.id && bodyObj?.status) {
    const parsed = updateByIdSchema.safeParse(bodyObj);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    let detailsUpdate: string | null = null;

    if (d.details) {
      // Fetch existing to merge
      const existing = await db.query(
        `SELECT details FROM incidents WHERE id = $1`, [d.id]
      );
      if (existing.rowCount && existing.rowCount > 0) {
        const prev = parseDetails(existing.rows[0].details);
        const merged = mergeDetails(prev, d.details as Record<string, unknown>);
        detailsUpdate = JSON.stringify(merged);
      } else {
        detailsUpdate = JSON.stringify(d.details);
      }
    }

    const q = await db.query(
      `UPDATE incidents
       SET status     = $1,
           next_action = COALESCE($2, next_action),
           severity   = COALESCE($3, severity),
           impact     = COALESCE($4, impact),
           details    = CASE WHEN $5::jsonb IS NOT NULL THEN $5::jsonb ELSE details END,
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        d.status,
        d.next_action ?? null,
        d.severity ?? null,
        d.impact ?? null,
        detailsUpdate,
        d.id,
      ]
    );

    return NextResponse.json({ ok: true, data: q.rows[0] ?? null });
  }

  // ── Branch 2: create or upsert-by-fingerprint ────────────────────────────────
  const parsed = createOrUpsertSchema.safeParse(bodyObj);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  try {
    if (d.fingerprint) {
      // Look for open/investigating incident with same fingerprint
      const existing = await db.query(
        `SELECT id, details FROM incidents
         WHERE fingerprint = $1 AND status IN ('open', 'investigating')
         ORDER BY created_at DESC
         LIMIT 1`,
        [d.fingerprint]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        const row = existing.rows[0];
        const prev = parseDetails(row.details);
        const incoming = (d.details ?? {}) as Record<string, unknown>;
        const merged = mergeDetails(prev, incoming);

        await db.query(
          `UPDATE incidents
           SET updated_at  = NOW(),
               details     = $1::jsonb,
               severity    = COALESCE($2, severity),
               impact      = COALESCE($3, impact),
               next_action = COALESCE($4, next_action)
           WHERE id = $5`,
          [
            JSON.stringify(merged),
            d.severity ?? null,
            d.impact ?? null,
            d.next_action ?? null,
            row.id,
          ]
        );

        return NextResponse.json({ ok: true, deduped: true, id: row.id });
      }
    }

    // No duplicate – create new incident
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
    console.error("Failed to create/upsert incident:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
