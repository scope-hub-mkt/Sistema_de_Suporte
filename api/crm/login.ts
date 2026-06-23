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

// Quem é ADMIN (controle total: mover cards, ver logs, ver os atendimentos de
// TODOS os tickets). Por regra de negócio é UMA conta só; todo o resto que o CRM
// validar é CLIENTE — cria e acompanha apenas os próprios tickets (relação 1→N).
// Ignoramos de propósito o `profile` do CRM aqui: lá quase todo mundo é "admin"
// da sua própria empresa, o que NÃO é o admin deste portal de suporte.
// Configurável por env ADMIN_EMAILS (lista separada por vírgula) sem tocar no código.
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "scopehubmarketing@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
)

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
    // Papel decidido pela allowlist (NÃO pelo profile do CRM): só o admin do
    // portal tem controle total; todos os demais são clientes.
    const resolvedEmail = (u.email ?? email).toString().trim().toLowerCase()
    const role: Role = ADMIN_EMAILS.has(resolvedEmail) ? "admin" : "client"
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
