import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guardApiRoute } from "@/lib/apiAuth";

// GET /api/dashboard/weekly-report
export async function GET(req: NextRequest) {
  try {
    const authError = await guardApiRoute(req);
    if (authError) return authError;

    // Filtra tasks criadas ou que operam nos últimos 7 dias.
    // Pra MVP do relatório: 
    // 1. Criadas nos ultimos 7 dias
    // 2. Concluídas nos ultimos 7 dias (onde "done_at" ou status='Done' e updated_at >= 7 dias atrás)
    // 3. Bloqueios pendentes
    // 4. Tasks gerais

    // Throughput: Tarefas movidas pra Done nos últimos 7 dias.
    // Criadas: Tarefas com created_at nos últimos 7 dias.

    const createdQuery = await db.query(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      AND dem_id IS NOT NULL AND status IN ('Backlog', 'Assigned', 'In Progress', 'Review', 'Approved', 'Done', 'Blocked')
    `);

    const doneQuery = await db.query(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE status = 'Done' 
      AND updated_at >= NOW() - INTERVAL '7 days'
      AND dem_id IS NOT NULL AND status IN ('Backlog', 'Assigned', 'In Progress', 'Review', 'Approved', 'Done', 'Blocked')
    `);

    // Quantas estão ativamente no board (abertas) vs quantas travadas (blocked)
    const boardQuery = await db.query(`
      SELECT status, COUNT(*) as count FROM tasks
      WHERE dem_id IS NOT NULL 
      AND status IN ('Backlog', 'Assigned', 'In Progress', 'Review', 'Approved', 'Blocked')
      GROUP BY status
    `);

    let openTasks = 0;
    let blockedTasks = 0;

    for (const row of boardQuery.rows) {
      if (row.status === 'Blocked') {
        blockedTasks += parseInt(row.count, 10);
      } else {
        openTasks += parseInt(row.count, 10);
      }
    }

    const totalActive = openTasks + blockedTasks;
    const blockedPercent = totalActive > 0 ? Math.round((blockedTasks / totalActive) * 100) : 0;

    // "Principais gargalos" -> As 5 tarefas que estão "Blocked" e/ou overdue / na coluna In Progress muito tempo.
    // Por simplicidade, pego as 5 tarefas 'Blocked' mais antigas
    const bottlenecksQuery = await db.query(`
      SELECT dem_id, title, owner, type FROM tasks
      WHERE status = 'Blocked' AND dem_id IS NOT NULL
      ORDER BY updated_at ASC LIMIT 5
    `);

    const payload = {
      created7d: parseInt(createdQuery.rows[0].count, 10),
      done7d: parseInt(doneQuery.rows[0].count, 10),
      throughput: parseInt(doneQuery.rows[0].count, 10),
      blockedPercent,
      bottlenecks: bottlenecksQuery.rows
    };

    return NextResponse.json({ ok: true, data: payload });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
