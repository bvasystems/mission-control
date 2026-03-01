import { NextRequest, NextResponse } from "next/server";

type TokenResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * requireIngestToken — usado por endpoints de WRITE que sempre exigem x-mc-token.
 * Retorna { ok: true } ou { ok: false, status, error } para que o handler
 * possa retornar NextResponse.json({ error }, { status }) imediatamente.
 */
export function requireIngestToken(req: NextRequest): TokenResult {
  return validateToken(req);
}

/**
 * validateMcToken — valida x-mc-token sem lançar erro.
 * Retorna { ok: true } se token válido, { ok: false } caso contrário.
 * Útil para endpoints de READ (GET) que também devem aceitar automação.
 */
export function validateMcToken(req: NextRequest): TokenResult {
  return validateToken(req);
}

/**
 * guardApiRoute — helper para endpoints que devem aceitar APENAS x-mc-token
 * (sem sessão de browser). Retorna NextResponse de erro pronto ou null se ok.
 */
export function guardApiRoute(req: NextRequest): NextResponse | null {
  const result = validateToken(req);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }
  return null;
}

// ── Internal ──────────────────────────────────────────────────────────────────

function validateToken(req: NextRequest): TokenResult {
  const expected = process.env.MC_API_TOKEN ?? process.env.MC_TOKEN;

  if (!expected) {
    return { ok: false, status: 500, error: "MC_API_TOKEN not configured on server" };
  }

  const provided = req.headers.get("x-mc-token");

  if (!provided) {
    return { ok: false, status: 401, error: "Missing x-mc-token header" };
  }

  if (provided !== expected) {
    return { ok: false, status: 403, error: "Invalid x-mc-token" };
  }

  return { ok: true };
}
