import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BRIDGE_URL = "https://bridge.axiushub.online";

// Remove accents and lowercase for Bridge API agent IDs
function normalizeName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ── Validation ────────────────────────────────────────────────────────────────

const createSchema = z.object({
  targetAgent: z.string().min(1),
  commandText: z.string().min(1),
  actionType: z.string().optional(),
  projectKey: z.string().optional(),
  taskId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["queued", "sent", "acknowledged", "blocked", "done", "failed"]).optional(),
  response: z.string().optional(),
});

// ── Bridge call helper ────────────────────────────────────────────────────────

async function callBridgeAndUpdate(
  dispatchId: string,
  targetAgent: string,
  commandText: string,
  actionType?: string
) {
  const bridgeToken = process.env.BRIDGE_TOKEN;
  if (!bridgeToken) {
    console.error("dispatch/after: BRIDGE_TOKEN not configured");
    await db.query(
      `UPDATE office_dispatches
       SET response = 'BRIDGE_TOKEN não configurado', status = 'failed',
           responded_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [dispatchId]
    );
    return;
  }

  const actionContext: Record<string, string> = {
    ask_update: "[Pedido de atualização de status]",
    delegate_task: "[Tarefa delegada]",
    mark_blocked: "[Solicitação para marcar como bloqueado]",
    request_review: "[Pedido de revisão]",
    escalate: "[URGENTE — Escalada]",
    free_command: "",
    meeting_command: "[Mensagem na reunião de equipe]",
  };

  const prefix = actionType ? (actionContext[actionType] ?? "") : "";
  const fullCommand = prefix ? `${prefix} ${commandText}` : commandText;

  try {
    const bridgeRes = await fetch(
      `${BRIDGE_URL}/agents/${encodeURIComponent(normalizeName(targetAgent))}/command`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bridge-token": bridgeToken,
        },
        body: JSON.stringify({
          command: fullCommand,
          actionType: actionType ?? "free_command",
          context: {
            source: "mission-control",
            requestedBy: "joao",
            dispatchId,
          },
          timeoutSeconds: 55,
        }),
      }
    );

    if (!bridgeRes.ok) {
      const errText = await bridgeRes.text();
      throw new Error(`Bridge API ${bridgeRes.status}: ${errText}`);
    }

    const bridgeData = await bridgeRes.json();

    // Extrair texto limpo da resposta
    let responseText = "Mensagem recebida.";

    const payloads = bridgeData?.data?.response?.result?.payloads;
    if (Array.isArray(payloads) && payloads.length) {
      responseText = payloads
        .map((p: { text?: string }) => p.text)
        .filter(Boolean)
        .join("\n");
    } else if (bridgeData?.data?.responsePreview) {
      const preview = bridgeData.data.responsePreview;
      try {
        const parsed = JSON.parse(preview);
        const innerPayloads = parsed?.result?.payloads;
        if (Array.isArray(innerPayloads) && innerPayloads.length) {
          responseText = innerPayloads
            .map((p: { text?: string }) => p.text)
            .filter(Boolean)
            .join("\n");
        } else {
          responseText = preview;
        }
      } catch {
        responseText = preview;
      }
    }

    await db.query(
      `UPDATE office_dispatches
       SET response = $1, responded_at = NOW(), status = 'done', updated_at = NOW()
       WHERE id = $2`,
      [responseText, dispatchId]
    );
  } catch (error) {
    console.error("dispatch/after bridge error:", error);
    await db.query(
      `UPDATE office_dispatches
       SET response = $1, responded_at = NOW(), status = 'failed', updated_at = NOW()
       WHERE id = $2`,
      [
        `Erro ao contactar agente: ${error instanceof Error ? error.message : String(error)}`,
        dispatchId,
      ]
    );
  }
}

// ── GET /api/office/dispatch ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  try {
    // Timeout stale dispatches: queued/sent > 5min → failed
    await db.query(`
      UPDATE office_dispatches
      SET status = 'failed',
          response = 'Timeout — sem resposta do agente',
          responded_at = NOW(),
          updated_at = NOW()
      WHERE status IN ('queued', 'sent')
        AND created_at < NOW() - INTERVAL '5 minutes'
    `);

    // Auto-progress: queued > 3s → sent (delivery confirmation)
    await db.query(`
      UPDATE office_dispatches SET status = 'sent', updated_at = NOW()
      WHERE status = 'queued' AND created_at < NOW() - INTERVAL '3 seconds'
    `);

    const excludeAction = searchParams.get("exclude_action");

    const q = agent
      ? excludeAction
        ? await db.query(
            `SELECT * FROM office_dispatches
             WHERE target_agent = $1 AND (action_type IS NULL OR action_type != $3)
             ORDER BY created_at DESC
             LIMIT $2`,
            [agent, limit, excludeAction]
          )
        : await db.query(
            `SELECT * FROM office_dispatches
             WHERE target_agent = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [agent, limit]
          )
      : await db.query(
          `SELECT * FROM office_dispatches
           ORDER BY created_at DESC
           LIMIT $1`,
          [limit]
        );

    return NextResponse.json({ ok: true, data: q.rows });
  } catch (error) {
    console.error("Failed to fetch dispatches:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// ── POST /api/office/dispatch ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bodyObj = body as Record<string, unknown>;

  // ── Branch: update existing dispatch ──────────────────────────────────────
  if (bodyObj?.id) {
    const parsed = updateSchema.safeParse(bodyObj);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { id, status, response } = parsed.data;

    try {
      const sets: string[] = ["updated_at = NOW()"];
      const vals: unknown[] = [];
      let idx = 1;

      if (status) {
        sets.push(`status = $${idx++}`);
        vals.push(status);
      }
      if (response) {
        sets.push(`response = $${idx++}`);
        vals.push(response);
        sets.push(`responded_at = NOW()`);
        if (!status) {
          sets.push(`status = CASE WHEN status NOT IN ('done', 'failed') THEN 'done' ELSE status END`);
        }
      }

      vals.push(id);

      const q = await db.query(
        `UPDATE office_dispatches
         SET ${sets.join(", ")}
         WHERE id = $${idx}
         RETURNING *`,
        vals
      );

      if (!q.rowCount) {
        return NextResponse.json({ error: "Dispatch not found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true, data: q.rows[0] });
    } catch (error) {
      console.error("Failed to update dispatch:", error);
      return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
  }

  // ── Branch: create new dispatch ───────────────────────────────────────────
  const parsed = createSchema.safeParse(bodyObj);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  try {
    const q = await db.query(
      `INSERT INTO office_dispatches
         (target_agent, command_text, action_type, project_key, task_id, status, metadata, issued_by)
       VALUES ($1, $2, $3, $4, $5, 'queued', $6::jsonb, 'joao')
       RETURNING *`,
      [
        d.targetAgent,
        d.commandText,
        d.actionType ?? null,
        d.projectKey ?? null,
        d.taskId ?? null,
        JSON.stringify(d.metadata ?? {}),
      ]
    );

    const dispatch = q.rows[0];

    // ── Chamar Bridge API via after() — roda após enviar resposta ao browser ──
    if (d.targetAgent.toLowerCase() !== "joao") {
      after(async () => {
        await callBridgeAndUpdate(
          dispatch.id,
          d.targetAgent,
          d.commandText,
          d.actionType
        );
      });
    }

    return NextResponse.json({ ok: true, data: dispatch }, { status: 201 });
  } catch (error) {
    console.error("Failed to create dispatch:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
