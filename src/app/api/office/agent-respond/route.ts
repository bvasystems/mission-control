import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const BRIDGE_URL = "https://bridge.axiushub.online";

// ── POST /api/office/agent-respond ────────────────────────────────────────────
// Chamado internamente após criar um dispatch. Envia comando para o agente
// via Bridge API (OpenClaw na VPS) e atualiza o dispatch no banco.

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-internal-token");
  if (token !== process.env.MC_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    dispatch_id: string;
    target_agent: string;
    command_text: string;
    action_type?: string;
  } | null = null;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.dispatch_id || !body?.target_agent || !body?.command_text) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { dispatch_id, target_agent, command_text, action_type } = body;

  const bridgeToken = process.env.BRIDGE_TOKEN;
  if (!bridgeToken) {
    console.error("agent-respond: BRIDGE_TOKEN not configured");
    return NextResponse.json({ error: "BRIDGE_TOKEN not configured" }, { status: 503 });
  }

  // Contexto adicional baseado no tipo de ação
  const actionContext: Record<string, string> = {
    ask_update: "[Pedido de atualização de status]",
    delegate_task: "[Tarefa delegada]",
    mark_blocked: "[Solicitação para marcar como bloqueado]",
    request_review: "[Pedido de revisão]",
    escalate: "[URGENTE — Escalada]",
    free_command: "",
    meeting_command: "[Mensagem na reunião de equipe]",
  };

  const prefix = action_type ? (actionContext[action_type] ?? "") : "";
  const fullCommand = prefix ? `${prefix} ${command_text}` : command_text;

  try {
    // Chamar Bridge API do OpenClaw
    const bridgeRes = await fetch(
      `${BRIDGE_URL}/agents/${encodeURIComponent(target_agent.toLowerCase())}/command`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bridge-token": bridgeToken,
        },
        body: JSON.stringify({
          command: fullCommand,
          actionType: action_type ?? "free_command",
          context: {
            source: "mission-control",
            requestedBy: "joao",
            dispatchId: dispatch_id,
          },
          timeoutSeconds: 180,
        }),
      }
    );

    if (!bridgeRes.ok) {
      const errText = await bridgeRes.text();
      throw new Error(`Bridge API ${bridgeRes.status}: ${errText}`);
    }

    const bridgeData = await bridgeRes.json();

    // Extrair texto da resposta da Bridge
    // Priorizar payloads[].text (texto limpo) sobre responsePreview (pode ser JSON)
    let responseText = "Mensagem recebida.";

    const payloads = bridgeData?.data?.response?.result?.payloads;
    if (Array.isArray(payloads) && payloads.length) {
      responseText = payloads
        .map((p: { text?: string }) => p.text)
        .filter(Boolean)
        .join("\n");
    } else if (bridgeData?.data?.responsePreview) {
      // Fallback: responsePreview pode ser texto ou JSON stringificado
      const preview = bridgeData.data.responsePreview;
      try {
        const parsed = JSON.parse(preview);
        // Se é JSON, tentar extrair payloads de dentro
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
        // Não é JSON, usar como texto direto
        responseText = preview;
      }
    }

    // Atualizar o dispatch com a resposta
    await db.query(
      `UPDATE office_dispatches
       SET response = $1,
           responded_at = NOW(),
           status = 'done',
           updated_at = NOW()
       WHERE id = $2`,
      [responseText, dispatch_id]
    );

    return NextResponse.json({ ok: true, response: responseText });
  } catch (error) {
    console.error("agent-respond error:", error);

    await db.query(
      `UPDATE office_dispatches
       SET response = $1,
           responded_at = NOW(),
           status = 'failed',
           updated_at = NOW()
       WHERE id = $2`,
      [
        `Erro ao contactar agente: ${error instanceof Error ? error.message : String(error)}`,
        dispatch_id,
      ]
    );

    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
