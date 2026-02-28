import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  const token = request.headers.get('x-mc-token');
  if (token !== process.env.MC_TOKEN && token !== process.env.MC_API_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, agent_id, payload, stage } = body;

    if (!title || !agent_id) {
      return NextResponse.json({ error: 'Missing required fields: title, agent_id' }, { status: 400 });
    }

    const command_id = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const { rows } = await db.query(
      `INSERT INTO tasks (title, assigned_to, status, stage, command_id, payload_json, created_at, updated_at)
       VALUES ($1, $2, 'queued', $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      [title, agent_id, stage || 'todo', command_id, payload ? JSON.stringify(payload) : null]
    );

    const task_id = rows[0].id;

    console.log(`[Task Created & Delegated] Task: ${task_id}, CMD: ${command_id}, Agent: ${agent_id}`);

    return NextResponse.json({
      ok: true,
      task_id,
      command_id
    }, { status: 202 });

  } catch (error: unknown) {
    console.error('Error creating task:', error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
