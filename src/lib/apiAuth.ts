import { NextRequest } from "next/server";

export function requireIngestToken(req: NextRequest): { ok: true } | { ok: false; status: number; error: string } {
const expected = process.env.MC_API_TOKEN;
if (!expected) return { ok: false, status: 500, error: "MC_API_TOKEN not configured" };

const provided = req.headers.get("x-mc-token");
if (!provided) return { ok: false, status: 401, error: "Missing x-mc-token" };
if (provided !== expected) return { ok: false, status: 403, error: "Invalid x-mc-token" };

return { ok: true };
}
