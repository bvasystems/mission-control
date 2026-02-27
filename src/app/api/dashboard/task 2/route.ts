import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
const q = await db.query("select * from tasks order by created_at desc limit 200");
return NextResponse.json({ ok: true, data: q.rows });
}
