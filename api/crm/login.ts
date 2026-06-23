import type { VercelRequest, VercelResponse } from "@vercel/node"

// ─── Login real contra o CRM (e-mail + senha) ─────────────────────────────────
// O app do CRM (api.integrador-crm.com) autentica o usuário em POST /auth/login
// com header `tenant` (a instância white-label; "company" é a sub-conta dentro
// dela). Como todas as empresas do Scope Hub vivem no MESMO tenant, um tenant
// fixo serve todas — login universal, sem config por empresa.
//
// A senha trafega só servidor→CRM; NUNCA devolvemos token/api-key ao cliente,
// apenas a identidade autoritativa (nome/email/role/empresa) vinda do CRM.

const CRM_APP_API = process.env.CRM_APP_API_BASE || "https://api.integrador-crm.com"
const CRM_TENANT = process.env.CRM_TENANT || "scope-hub-marketing-ltda"

type Role = "admin" | "client"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ valid: false, error: "method-not-allowed" })
  }

  const body = (typeof req.body === "string" ? safeParse(req.body) : req.body) ?? {}
  const { email, password, tenant } = body as {
    email?: string
    password?: string
    tenant?: string
  }
  if (!email || !password) {
    return res.status(200).json({ valid: false, error: "missing-credentials" })
  }

  try {
    const r = await fetch(`${CRM_APP_API}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        tenant: tenant || CRM_TENANT,
        "ngrok-skip-browser-warning": "1",
        accept: "application/json",
      },
      body: JSON.stringify({ email, password }),
    })

    if (r.status < 200 || r.status >= 300) {
      // 401 = credencial inválida; 400 = tenant/payload; tratamos tudo como inválido.
      return res.status(200).json({ valid: false, crmStatus: r.status })
    }

    const data = (await r.json().catch(() => null)) as Record<string, any> | null
    const u = (data?.user ?? {}) as Record<string, any>
    const profile = (u.profile ?? "").toString().toLowerCase()
    const role: Role = profile === "admin" || profile === "super" || u.super === true ? "admin" : "client"
    const companyId = u.companyId ?? null
    const companyName =
      u.company?.name ?? (companyId != null ? `Empresa #${companyId}` : "Scope Hub")

    return res.status(200).json({
      valid: true,
      user: {
        id: u.id ?? null,
        name: u.name ?? email.split("@")[0],
        email: u.email ?? email,
        companyId,
        company: companyName,
        role,
      },
    })
  } catch (e) {
    console.error("[crm/login] CRM unreachable:", e)
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
