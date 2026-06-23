import type { VercelRequest, VercelResponse } from "@vercel/node"

// ─── "Ei CRM, esse usuário/empresa é verdadeiro?" ──────────────────────────────
// Dois caminhos de validação, do mais forte para o fallback:
//
// A) PER-USER (recomendado) — o CRM (app em api.integrador-crm.com) autentica o
//    usuário com um JWT Bearer + header `tenant`. Quando o usuário logado clica no
//    widget, o CRM injeta esse token na URL (?token=<jwt>). Aqui decodificamos o
//    JWT (id/companyId/profile) e CONFIRMAMOS que ele está vivo chamando um
//    endpoint protegido do CRM (GET /users/{id}) com o próprio token. Só 2xx vale.
//    A identidade (email/nome/role) vem do CRM — não da URL — então não dá pra
//    forjar role=admin.
//
// B) PER-COMPANY (fallback) — a API gateway (api.scopehub.com.br) autentica por
//    `api-key` de empresa. Sondamos GET /contact; 2xx = empresa válida. Usado
//    quando não há token de usuário (mantém o app funcional).
//
// Nenhum segredo é devolvido ao cliente.

const SCOPE_API_BASE = process.env.SCOPE_API_BASE || "https://api.scopehub.com.br/api"
const CRM_APP_API = process.env.CRM_APP_API_BASE || "https://api.integrador-crm.com"
const CRM_TENANT = process.env.CRM_TENANT || "scope-hub-marketing-ltda"

// ─── Link ÚNICO para todas as empresas ────────────────────────────────────────
// O CRM não expõe token de usuário no widget — só `email` e `id`. Como o domínio
// do e-mail já identifica a empresa, derivamos a empresa daí em vez de chumbar
// `company=` na URL. Assim o MESMO link serve qualquer empresa: o onboarding é só
// adicionar uma linha aqui + a env `SCOPE_API_KEY_<SLUG>` (uma vez por empresa).
const DOMAIN_TO_COMPANY: Record<string, string> = {
  "effectscursos.com.br": "effects",
}

function companyFromEmail(email?: string): string | undefined {
  if (!email) return undefined
  const at = email.lastIndexOf("@")
  if (at < 0) return undefined
  const domain = email.slice(at + 1).toLowerCase().trim()
  return DOMAIN_TO_COMPANY[domain]
}

type Role = "admin" | "client"

interface JwtClaims {
  id?: number
  companyId?: number
  profile?: string
  username?: string
  exp?: number
}

// Decodifica o payload de um JWT (base64url) sem verificar assinatura — a
// verificação real de validade é feita chamando o CRM com o token.
function decodeJwt(token: string): JwtClaims | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    return JSON.parse(json) as JwtClaims
  } catch {
    return null
  }
}

function resolveApiKey(company?: string): { key?: string; source: string } {
  if (company) {
    const slug = company.toUpperCase().replace(/[^A-Z0-9]/g, "_")
    const envKey = process.env[`SCOPE_API_KEY_${slug}`]
    if (envKey) return { key: envKey, source: "env-company" }
  }
  if (process.env.SCOPE_API_KEY) return { key: process.env.SCOPE_API_KEY, source: "env" }
  return { source: "none" }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ valid: false, error: "method-not-allowed" })
  }

  const body = (typeof req.body === "string" ? safeParse(req.body) : req.body) ?? {}
  const { token, tenant, company, email } = body as {
    token?: string
    tenant?: string
    company?: string
    email?: string
  }

  // ── Caminho A: JWT de usuário do CRM ─────────────────────────────────────────
  // Se falhar (token ausente/inválido/expirado), NÃO retornamos erro na hora —
  // caímos para o Caminho B (empresa) quando houver chave, pra um link único e
  // robusto funcionar nos dois cenários.
  const claims = token ? decodeJwt(token) : null
  if (token && claims?.id) {
    const ten = tenant || CRM_TENANT
    try {
      const r = await fetch(`${CRM_APP_API}/users/${claims.id}`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
          tenant: ten,
          "ngrok-skip-browser-warning": "1",
          accept: "application/json",
        },
      })
      if (r.status >= 200 && r.status < 300) {
        const u = (await r.json().catch(() => null)) as Record<string, any> | null
        const profile = (u?.profile ?? claims.profile ?? "").toString().toLowerCase()
        const role: Role = profile === "admin" || profile === "super" ? "admin" : "client"
        const companyId = u?.companyId ?? claims.companyId ?? null
        const companyName = u?.company?.name ?? (companyId != null ? `Empresa #${companyId}` : "Scope Hub")
        return res.status(200).json({
          valid: true,
          crmStatus: r.status,
          source: "crm-user-jwt",
          user: {
            id: u?.id ?? claims.id,
            name: u?.name ?? claims.username ?? "Usuário CRM",
            email: u?.email ?? null,
            companyId,
            company: companyName,
            role,
          },
        })
      }
      // token recusado/expirado → tenta o fallback de empresa abaixo
      console.warn("[validate] user-jwt rejected:", r.status)
    } catch (e) {
      console.error("[validate] CRM (user-jwt) unreachable:", e)
      // segue para o fallback
    }
  }

  // ── Caminho B: api-key de empresa (fallback) ─────────────────────────────────
  // Empresa explícita na URL (legado) tem prioridade; senão deriva do e-mail.
  const resolvedCompany = company || companyFromEmail(email)
  const { key, source } = resolveApiKey(resolvedCompany)
  if (!key) {
    return res.status(200).json({ valid: false, error: "no-crm-credential", company: resolvedCompany ?? null })
  }
  try {
    const r = await fetch(`${SCOPE_API_BASE}/contact`, {
      method: "GET",
      headers: { "api-key": key },
    })
    const valid = r.status >= 200 && r.status < 300
    return res.status(200).json({ valid, crmStatus: r.status, company: resolvedCompany ?? null, source })
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
