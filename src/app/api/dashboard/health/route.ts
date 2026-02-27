import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const schema = z.object({
  service: z.string().min(2),
  status: z.enum(['healthy', 'degraded', 'down']),
  uptime_pct: z.number().min(0).max(100).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const q = await db.query(
    'insert into health_checks (service, status, uptime_pct, last_check) values ($1, $2, $3, now()) returning *',
    [parsed.data.service, parsed.data.status, parsed.data.uptime_pct ?? null],
  );

  return NextResponse.json({ ok: true, data: q.rows[0] });
}
