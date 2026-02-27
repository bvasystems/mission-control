import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const schema = z.object({
  content: z.string().min(5),
  category: z.enum(['decision', 'lesson', 'insight']),
  source: z.enum(['main', 'heartbeat', 'cron']).default('main'),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const q = await db.query(
    'insert into memory_events (content, category, source) values ($1, $2, $3) returning *',
    [parsed.data.content, parsed.data.category, parsed.data.source],
  );

  return NextResponse.json({ ok: true, data: q.rows[0] });
}
