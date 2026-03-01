import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

function parseDetails(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

// ── GET /api/dashboard/incidents/[id] ────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;

  try {
    const incidentRes = await db.query(
      `SELECT id, title, severity, status, owner, source, impact, next_action,
              fingerprint, details, created_at, updated_at, dem_id
       FROM incidents
       WHERE id = $1`,
      [id]
    );

    if (!incidentRes.rowCount || incidentRes.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "Incident not found" }, { status: 404 });
    }

    const incident = incidentRes.rows[0];
    incident.details = parseDetails(incident.details);

    // Evidence: agent events for owner/agent_id
    const agentId = (incident.details as Record<string, unknown>)?.agent_id ?? incident.owner ?? null;
    let lastEvents: unknown[] = [];
    if (agentId) {
      const evRes = await db.query(
        `SELECT id, source, event_type, dem_id, payload, created_at
         FROM agent_events
         WHERE payload::text ILIKE $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [`%${agentId}%`]
      );
      lastEvents = evRes.rows;
    }

    if (incident.dem_id) {
      const demRes = await db.query(
        `SELECT id, source, event_type, dem_id, payload, created_at
         FROM agent_events
         WHERE dem_id = $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [incident.dem_id]
      );
      const existingIds = new Set(lastEvents.map((e) => (e as { id: string }).id));
      for (const row of demRes.rows) {
        if (!existingIds.has(row.id)) lastEvents.push(row);
      }
    }

    // Evidence: related tasks
    let relatedTasks: unknown[] = [];
    if (incident.dem_id) {
      const taskRes = await db.query(
        `SELECT id, dem_id, title, status, "column", assigned_to, updated_at
         FROM tasks
         WHERE dem_id = $1
         ORDER BY updated_at DESC
         LIMIT 5`,
        [incident.dem_id]
      );
      relatedTasks = taskRes.rows;
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...incident,
        evidence: { last_events: lastEvents, related_tasks: relatedTasks },
      },
    });
  } catch (error) {
    console.error("Failed to fetch incident detail:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// ── PATCH /api/dashboard/incidents/[id] ──────────────────────────────────────
// Quick-action from modal: change status (investigating / resolved)

const patchSchema = z.object({
  status: z.enum(["open", "investigating", "mitigated", "closed"]),
});

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const q = await db.query(
      `UPDATE incidents
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, status, updated_at`,
      [parsed.data.status, id]
    );

    if (!q.rowCount || q.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: q.rows[0] });
  } catch (error) {
    console.error("Failed to patch incident:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
