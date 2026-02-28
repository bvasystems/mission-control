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

// Processamento principal (transacional)
const result = await processAgentEvent(body);

if (result.duplicate) {
console.info('[events] duplicate event ignored', {
event_id: body?.event_id,
agent_id: body?.agent_id,
type: body?.type,
});
return NextResponse.json({ ok: true, duplicated: true }, { status: 202 });
}

// Side-effects pós-commit
if (body.type !== 'heartbeat') {
try {
console.info('[events] before side-effects', {
event_id: body?.event_id,
type: body?.type,
agent_id: body?.agent_id,
command_id: body?.command_id,
});

if (result.taskUpdate) {
await publishTaskUpdated({
topic: 'task.updated',
task_id: result.taskUpdate.id,
command_id: body.command_id,
agent_id: body.agent_id,
status: result.taskUpdate.status,
stage: result.taskUpdate.stage,
updated_at: result.taskUpdate.updated_at,
});
console.info('[events] publishTaskUpdated ok', {
task_id: result.taskUpdate.id,
status: result.taskUpdate.status,
stage: result.taskUpdate.stage,
});
} else {
console.info('[events] no taskUpdate returned');
}

console.info('[events] before notifyAgentEvent', {
agent_id: body?.agent_id,
type: body?.type,
});

await notifyAgentEvent(body);

console.info('[events] after notifyAgentEvent', {
agent_id: body?.agent_id,
type: body?.type,
});
} catch (e: unknown) {
const message = e instanceof Error ? e.message : 'unknown_side_effect_error';
console.error('[events] side-effects failed', {
message,
event_id: body?.event_id,
agent_id: body?.agent_id,
type: body?.type,
});
}
}

return NextResponse.json({ ok: true }, { status: 202 });
} catch (error: unknown) {
const message = error instanceof Error ? error.message : 'unknown_error';
console.error('[events] processing failed', { message });
return NextResponse.json({ error: message }, { status: 500 });
}
}
