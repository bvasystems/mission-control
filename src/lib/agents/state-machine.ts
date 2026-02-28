import { db } from '../db';
import { AgentEventPayload } from '@/lib/agents/types';

export async function processAgentEvent(payload: AgentEventPayload) {
  const { event_id, agent_id, task_id, command_id, type, status, stage, message, meta } = payload;
  
  const client = await db.connect();
  
  let taskUpdate: { id: string; status: string; stage: string; updated_at: string } | null = null;

  try {
    await client.query('BEGIN');

    // INSERT EVENT (Idempotency by event_id)
    try {
      await client.query(
        `INSERT INTO agent_events (event_id, agent_id, task_id, command_id, event_type, status, stage, message, meta_json, occurred_at, source, message_id, dem_id, channel_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'system', $10, $11, 'chn_system')`,
        [event_id, agent_id, task_id || null, command_id, type, status, stage, message, meta ? JSON.stringify(meta) : null, 'msg_' + event_id, 'dem_' + (task_id || event_id)]
      );
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === '23505' || err.code === '23502') { 
        // Unique violation or not null violation that we might fallback
        if (err.code === '23505') {
            await client.query('ROLLBACK');
            return { ok: true, duplicate: true }; 
        } else {
            // fallback generic insert without rigid constraints in case DB differs slightly
            // Ignoring for now but ensuring rollback occurs and re-throws
            throw e;
        }
      } else {
          try {
             // Fallback for previous db state
             await client.query(
                `INSERT INTO agent_events (event_id, agent_id, task_id, command_id, event_type, status, stage, message, payload, occurred_at, source, message_id, dem_id, channel_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'system', $10, $11, 'chn_system')`,
                [event_id, agent_id, task_id || null, command_id, type, status, stage, message, meta ? JSON.stringify(meta) : '{}', 'msg_' + event_id, 'dem_' + (task_id || event_id)]
              );
          } catch(errFallback: unknown) {
            const fbErr = errFallback as { code?: string };
            if (fbErr.code === '23505') {
                await client.query('ROLLBACK');
                return { ok: true, duplicate: true }; 
            }
            throw errFallback;
          }
      }
    }

    if (type !== 'heartbeat') {
      const { rows } = await client.query('SELECT status, stage FROM tasks WHERE command_id = $1 FOR UPDATE', [command_id]);
      if (rows.length === 0) {
        throw new Error(`Task with command_id ${command_id} not found`);
      }
      const currentTask = rows[0];

      const newStatus = status || currentTask.status;
      const newStage = stage || currentTask.stage;

      const updateTaskParams = [newStatus, newStage, command_id];
      let queryStr = `UPDATE tasks SET status = $1, stage = $2, updated_at = NOW()`;
      
      if (type === 'ack') {
        queryStr += `, ack_at = COALESCE(ack_at, NOW())`;
      } else if (type === 'done') {
        queryStr += `, done_at = NOW()`;
      } else if (type === 'failed') {
        queryStr += `, error_message = $4, error_code = 'AGENT_FAIL'`;
        updateTaskParams.push(message || 'Failed');
      }

      queryStr += ` WHERE command_id = $3 RETURNING id, status, stage, updated_at`;

      const taskRes = await client.query(queryStr, updateTaskParams);
      taskUpdate = taskRes.rows[0];
    }

    // Upsert em agents_status 
    await client.query(
      `INSERT INTO agents_status (id, name, level, status, last_seen_at, last_heartbeat_at, current_command_id, updated_at) 
       VALUES ($1, $2, 'L1', 'active', NOW(), NOW(), $3, NOW())
       ON CONFLICT (id) DO UPDATE SET 
         status = 'active',
         last_seen_at = NOW(),
         last_heartbeat_at = CASE WHEN $4 = 'heartbeat' THEN NOW() ELSE agents_status.last_heartbeat_at END,
         current_command_id = EXCLUDED.current_command_id,
         updated_at = NOW()`,
      [agent_id, agent_id, type !== 'heartbeat' ? command_id : null, type]
    );

    // Compatibilidade com o schema existente! (o anterior tinha `last_seen`)
    await client.query(
        `UPDATE agents_status SET last_seen = NOW() WHERE id = $1`, [agent_id]
    ).catch(() => {});

    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return { ok: true, duplicate: false, taskUpdate };
}
