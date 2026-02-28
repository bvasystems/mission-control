import { NextResponse } from 'next/server';
import { processAgentEvent } from '@/lib/agents/state-machine';

export async function POST(request: Request) {
  const token = request.headers.get('x-mc-token');
  if (token !== process.env.MC_TOKEN && token !== process.env.MC_API_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { agent_id } = body;

    if (!agent_id) {
      return NextResponse.json({ error: 'Missing agent_id' }, { status: 400 });
    }

    await processAgentEvent({
      event_id: `hb_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
      agent_id,
      task_id: '',
      command_id: '',
      type: 'heartbeat',
      status: 'queued',
      stage: undefined
    });

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error: unknown) {
    console.error('Error processing heartbeat:', error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
