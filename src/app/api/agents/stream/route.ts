import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateMcToken } from "@/lib/apiAuth";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 55; // limite Vercel

export async function GET(req: NextRequest) {
  // Validate auth
  const hasToken = validateMcToken(req).ok;
  let hasSession = false;
  if (!hasToken) {
    const session = await auth();
    hasSession = !!session?.user;
  }

  if (!hasToken && !hasSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  
  let isClosed = false;
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          isClosed = true;
        }
      };

      const url = new URL(req.url);
      let sinceStr = url.searchParams.get("since") || new Date(Date.now() - 5 * 60000).toISOString();
      let lastActivityAt = new Date(sinceStr);
      let lastTaskAt = new Date(sinceStr);

      const startTime = Date.now();
      const MAX_TIME = 50 * 1000; // 50 seconds to be safe in serverless timeout 55s limit

      try {
        while (!isClosed) {
          if (Date.now() - startTime >= MAX_TIME) {
            isClosed = true;
            controller.close();
            break;
          }

          const client = await db.connect();
          try {
            // 1. Agents Status
            const agentsQuery = await client.query(
              `
              SELECT
                a.id,
                a.name,
                a.level,
                a.status,
                a.last_seen,
                a.messages_24h,
                a.errors_24h,
                a.updated_at,
                s.reliability_score,
                s.reliability_meta,
                s.model_tokens_used as tokens
              FROM agents_status a
              LEFT JOIN LATERAL (
                SELECT reliability_score, reliability_meta, model_tokens_used
                FROM agent_stats st
                WHERE 
                  st.agent_id = a.id OR
                  st.agent_id = lower(a.name) OR
                  (lower(a.name) = 'main' AND st.agent_id IN ('main', 'jota', 'faisca', 'faísca')) OR
                  (lower(a.name) = 'leticia' AND st.agent_id IN ('leticia', 'letícia'))
                ORDER BY st.date DESC
                LIMIT 1
              ) s ON true
              ORDER BY
                CASE a.status
                  WHEN 'down' THEN 0
                  WHEN 'degraded' THEN 1
                  WHEN 'active' THEN 2
                  WHEN 'idle' THEN 3
                END,
                a.name ASC
              `
            );
            sendEvent("agent_update", agentsQuery.rows);

            // 2. Activity (Agent Events)
            // Handling both actual schema (which might use source/channel_id as seen in POST) and requested schema from prompt:
            // "agent_events -> id, agent_id, event_type, payload, created_at"
            // We use standard 'SELECT *' and adapt to the requested fields in the UI hook.
            const activityQuery = await client.query(
              `
              SELECT *
              FROM agent_events
              WHERE created_at > $1
              ORDER BY created_at ASC
              LIMIT 10
              `,
              [lastActivityAt]
            );
            
            if (activityQuery.rows.length > 0) {
              sendEvent("activity", activityQuery.rows);
              lastActivityAt = new Date(activityQuery.rows[activityQuery.rows.length - 1].created_at);
            }

            // 3. Task Updates
            const tasksQuery = await client.query(
              `
              SELECT id, title, status, "column" as stage, assigned_to, created_at, updated_at
              FROM tasks
              WHERE updated_at > $1
              ORDER BY updated_at ASC
              `,
              [lastTaskAt]
            );

            if (tasksQuery.rows.length > 0) {
              sendEvent("task_update", tasksQuery.rows);
              lastTaskAt = new Date(tasksQuery.rows[tasksQuery.rows.length - 1].updated_at);
            }
          } finally {
            client.release();
          }

          // Wait 3 seconds
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error) {
        if (!isClosed) {
          console.error("Agent Stream Error:", error);
          controller.error(error);
          isClosed = true;
        }
      }
    },
    cancel() {
      isClosed = true;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no" // Useful for nginx proxies if any
    },
  });
}
