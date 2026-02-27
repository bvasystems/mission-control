import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const createSchema = z.object({
  title: z.string().min(3),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  due_date: z.string().datetime().optional(),
  assigned_to: z.string().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'done', 'blocked']),
});

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body?.id && body?.status) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const q = await db.query(
      'update tasks set status = $1 where id = $2 returning *',
      [parsed.data.status, parsed.data.id],
    );

    return NextResponse.json({ ok: true, data: q.rows[0] ?? null });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const q = await db.query(
    'insert into tasks (title, priority, due_date, assigned_to) values ($1, $2, $3, $4) returning *',
    [parsed.data.title, parsed.data.priority, parsed.data.due_date ?? null, parsed.data.assigned_to ?? null],
  );

  return NextResponse.json({ ok: true, data: q.rows[0] });
}
