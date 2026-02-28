import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifyAgentEvent } from '@/lib/agents/discord';

export async function POST(request: Request) {
  const token = request.headers.get('x-mc-token');
  if (token !== process.env.MC_TOKEN && token !== process.env.MC_API_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await db.connect();
  let offline_marked = 0;
  let timed_out_tasks = 0;
  let checked_agents = 0;
  const drift_fixed = 0;

  try {
    await client.query('BEGIN');

    console.log('[Reconcile] Checking offline agents...');
    const offlineAgents = await client.query(
      `UPDATE agents_status 
       SET status = 'down', updated_at = NOW() 
       WHERE last_heartbeat_at < NOW() - INTERVAL '3 minutes' 
       AND status = 'active'
       RETURNING id, EXTRACT(EPOCH FROM (NOW() - last_heartbeat_at))/60 AS minutes`
    );
    offline_marked = offlineAgents.rowCount ?? 0;

    for (const row of offlineAgents.rows) {
      await notifyAgentEvent({ type: 'offline', agent_id: row.id, task_id: 'N/A' });
      
      await client.query(
        `INSERT INTO incidents (title, severity, status, owner, source, impact, next_action, created_at, updated_at)
         VALUES ($1, 'high', 'open', 'system', 'reconciliation', $2, 'Investigar agente', NOW(), NOW())`,
        [`Agent ${row.id} offline`, `Heartbeat lost.`]
      );
    }
    
    checked_agents = (await client.query('SELECT count(*) FROM agents_status')).rows[0].count;

    const noAckTasks = await client.query(
      `UPDATE tasks
       SET status = 'timeout', stage = 'blocked', updated_at = NOW(), error_code = 'ACK_TIMEOUT', error_message = 'Sem ACK > 2 min'
       WHERE status = 'queued' AND created_at < NOW() - INTERVAL '2 minutes'
       RETURNING id, assigned_to`
    );
    timed_out_tasks += noAckTasks.rowCount ?? 0;

    for (const row of noAckTasks.rows) {
      await notifyAgentEvent({ type: 'timeout', agent_id: row.assigned_to, task_id: row.id });
    }

    const runningTimeoutTasks = await client.query(
      `UPDATE tasks
       SET status = 'timeout', stage = 'blocked', updated_at = NOW(), error_code = 'RUNNING_TIMEOUT', error_message = 'Sem heartbeat da execução > 15 min'
       WHERE status = 'running' AND updated_at < NOW() - INTERVAL '15 minutes'
       RETURNING id, assigned_to`
    );
    timed_out_tasks += runningTimeoutTasks.rowCount ?? 0;

    for (const row of runningTimeoutTasks.rows) {
       await notifyAgentEvent({ type: 'timeout', agent_id: row.assigned_to, task_id: row.id });
    }

    await client.query(
      `INSERT INTO health_checks (service, status, last_check, uptime_pct) 
       VALUES ('agents_reconciliation', 'healthy', NOW(), 100)`
    );

    await client.query('COMMIT');

    return NextResponse.json({
      ok: true,
      checked_agents: parseInt(`${checked_agents}`),
      offline_marked,
      timed_out_tasks,
      drift_fixed,
    });
    
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    console.error('Reconciliation error:', error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
