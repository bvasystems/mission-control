import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireIngestToken } from "@/lib/apiAuth";

const CHANNEL_MAP: Record<string, string> = {
caio: process.env.DISCORD_CH_BACKLOG || "",
leticia: process.env.DISCORD_CH_DEPLOY_STATUS || "",
};

function makeDemId() {
const d = new Date();
const y = d.getUTCFullYear();
const m = String(d.getUTCMonth() + 1).padStart(2, "0");
const day = String(d.getUTCDate()).padStart(2, "0");
const rnd = Math.floor(Math.random() * 900 + 100);
return `DEM-${y}${m}${day}-${rnd}`;
}

export async function POST(req: NextRequest) {
const auth = requireIngestToken(req);
if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

const body = await req.json();
const taskId = body?.task_id as string | undefined;
if (!taskId) return NextResponse.json({ error: "task_id required" }, { status: 400 });

const q = await db.query(`select * from tasks where id = $1`, [taskId]);
const task = q.rows[0];
if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

const owner = (task.assigned_to || "").toLowerCase();
const channel = CHANNEL_MAP[owner];
if (!channel) return NextResponse.json({ error: `owner sem canal: ${owner}` }, { status: 400 });

const demId = task.dem_id || makeDemId();
const ackDeadline = new Date(Date.now() + 5 * 60 * 1000).toISOString();

await db.query(
`update tasks
set dem_id=$1, dispatch_status='pending', assigned_channel=$2, ack_deadline=$3, updated_at=now()
where id=$4`,
[demId, channel, ackDeadline, taskId]
);

return NextResponse.json({
ok: true,
data: { task_id: taskId, dem_id: demId, owner, channel, ack_deadline: ackDeadline },
});
}
