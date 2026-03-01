import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1) Fetch the incident itself
    const incidentRes = await db.query(
      `SELECT id, title, severity, status, owner, source, impact, next_action,
              fingerprint, details, created_at, updated_at, dem_id
       FROM incidents
       WHERE id = $1`,
      [id]
    );

    if (incidentRes.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "Incident not found" }, { status: 404 });
    }

    const incident = incidentRes.rows[0];

    // Parse details if it's a string (some drivers return jsonb as string)
    if (typeof incident.details === "string") {
      try {
        incident.details = JSON.parse(incident.details);
      } catch {
        incident.details = null;
      }
    }

    // 2) Contextual evidence: last agent events for owner/agent
    const agentId = incident.details?.agent_id ?? incident.owner ?? null;
    let lastEvents: unknown[] = [];
    if (agentId) {
      const evRes = await db.query(
        `SELECT id, source, event_type, dem_id, payload, created_at
         FROM agent_events
         WHERE dem_id LIKE $1
            OR payload::text ILIKE $2
         ORDER BY created_at DESC
         LIMIT 5`,
        [`%${agentId}%`, `%${agentId}%`]
      );
      lastEvents = evRes.rows;
    }

    // If dem_id present fetch by dem_id too
    if (incident.dem_id) {
      const demRes = await db.query(
        `SELECT id, source, event_type, dem_id, payload, created_at
         FROM agent_events
         WHERE dem_id = $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [incident.dem_id]
      );
      // Merge without duplication
      const existingIds = new Set(lastEvents.map((e) => (e as { id: string }).id));
      for (const row of demRes.rows) {
        if (!existingIds.has(row.id)) lastEvents.push(row);
      }
    }

    // 3) Related tasks impacted
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
        evidence: {
          last_events: lastEvents,
          related_tasks: relatedTasks,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch incident detail:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
