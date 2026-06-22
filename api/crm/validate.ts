import type { VercelRequest, VercelResponse } from "@vercel/node"

// ─── "Ei CRM, essas credenciais são verdadeiras?" ──────────────────────────────
// A API do Scope autentica por uma chave de empresa no header `api-key`. Não há
// endpoint de validação dedicado, então validamos sondando um endpoint protegido
// (GET /contact): só consideramos a chave válida se o CRM responder 2xx. Qualquer
// outra resposta (401/403 = recusada; 404/5xx/etc = endpoint fora do ar/mudou) é
// tratada como inválida — allowlist, para não liberar acesso por engano.
//
// A chave NUNCA é devolvida ao cliente. Ordem de resolução da chave:
//   1. ?company=<slug>  ->  env SCOPE_API_KEY_<SLUG>   (multi-tenant, recomendado)
//   2. env SCOPE_API_KEY                                (single-tenant)
//   3. token recebido na URL                            (white-label MVP)

const SCOPE_API_BASE = process.env.SCOPE_API_BASE || "https://api.scopehub.com.br/api"

function resolveApiKey(company?: string, token?: string): { key?: string; source: string } {
  if (company) {
    const slug = company.toUpperCase().replace(/[^A-Z0-9]/g, "_")
    const envKey = process.env[`SCOPE_API_KEY_${slug}`]
    if (envKey) return { key: envKey, source: "env-company" }
  }
  if (process.env.SCOPE_API_KEY) return { key: process.env.SCOPE_API_KEY, source: "env" }
  if (token) return { key: token, source: "url-token" }
  return { source: "none" }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ valid: false, error: "method-not-allowed" })
  }

  const body = (typeof req.body === "string" ? safeParse(req.body) : req.body) ?? {}
  const { token, company } = body as { token?: string; company?: string }

  const { key, source } = resolveApiKey(company, token)
  if (!key) {
    return res.status(400).json({ valid: false, error: "no-crm-credential" })
  }

  try {
    const r = await fetch(`${SCOPE_API_BASE}/contact`, {
      method: "GET",
      headers: { "api-key": key },
    })
    // Allowlist: só 2xx significa autenticação aceita. 401/403 = recusada;
    // 404/5xx/429/etc = não confiável => inválida (não liberar por engano).
    const valid = r.status >= 200 && r.status < 300
    return res.status(200).json({ valid, crmStatus: r.status, company: company ?? null, source })
  } catch (e) {
    console.error("[validate] CRM unreachable:", e)
    return res.status(502).json({ valid: false, error: "crm-unreachable" })
  }
}

function safeParse(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
