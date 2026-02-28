import { NextResponse } from 'next/server';
import { processAgentEvent } from '@/lib/agents/state-machine';
import { notifyAgentEvent } from '@/lib/agents/discord';
import { publishTaskUpdated } from '@/lib/agents/realtime';

export async function POST(request: Request) {
  const token = request.headers.get('x-mc-token');
  if (token !== process.env.MC_TOKEN && token !== process.env.MC_API_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // O processAgentEvent gerencia a transação
    const result = await processAgentEvent(body);

    if (result.duplicate) {
      return NextResponse.json({ ok: true, duplicated: true }, { status: 202 });
    }

    // Após o commit com sucesso, acionamos side-effects
    if (body.type !== 'heartbeat') {
      try {
        if (result.taskUpdate) {
          publishTaskUpdated({
            topic: 'task.updated',
            task_id: result.taskUpdate.id,
            command_id: body.command_id,
            agent_id: body.agent_id,
            status: result.taskUpdate.status,
            stage: result.taskUpdate.stage,
            updated_at: result.taskUpdate.updated_at
          }).catch(() => {});
        }
        await notifyAgentEvent(body);
      } catch (e) {
        console.error('Falha nos side effects (Discord/WebSocket). Evento principal processado com sucesso.', e);
      }
    }

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error: unknown) {
    console.error('Error processing event:', error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
