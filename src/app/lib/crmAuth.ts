import type { UserAccount, UserRole } from "./types"

// ─── Bypass de login via token do CRM ──────────────────────────────────────────
// Quando o usuário clica em "criar ticket" já logado no CRM, o CRM abre este app
// com o token na URL (?token=...&company=...&name=...&email=...&role=...).
// Validamos o token chamando a função serverless /api/crm/validate, que pergunta
// ao CRM "essas credenciais são verdadeiras?". Se sim, criamos a sessão local.

const SESSION_KEY = "crm_session"

export function getStoredSession(): UserAccount | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as UserAccount) : null
  } catch {
    return null
  }
}

export function storeSession(u: UserAccount): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(u))
  } catch {
    /* ignore */
  }
}

export function clearCrmSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

// Um merge field que o CRM não resolveu chega literal, ex.: "{{user.name}}".
// Tratamos valor vazio ou contendo "{{"/"}}" como ausente → usa o fallback.
function clean(v: string | null): string | undefined {
  if (!v) return undefined
  const t = v.trim()
  if (!t || t.includes("{{") || t.includes("}}")) return undefined
  return t
}

function readParams() {
  const url = new URL(window.location.href)
  const q = url.searchParams
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""))
  const get = (k: string) => clean(q.get(k)) ?? clean(hash.get(k))
  return {
    token: get("token") ?? get("key") ?? get("apikey"),
    company: get("company") ?? get("empresa"),
    name: get("name") ?? get("nome"),
    email: get("email"),
    role: get("role") as UserRole | undefined,
  }
}

// Remove o token da barra de endereços assim que consumido (evita vazar em
// histórico/compartilhamento/logs).
function stripUrl() {
  const url = new URL(window.location.href)
  ;["token", "key", "apikey", "role"].forEach((k) => url.searchParams.delete(k))
  url.hash = ""
  const search = url.searchParams.toString()
  window.history.replaceState({}, document.title, url.pathname + (search ? `?${search}` : ""))
}

export async function resolveCrmSession(): Promise<UserAccount | null> {
  // 1) sessão já estabelecida nesta aba
  const existing = getStoredSession()
  if (existing) return existing

  // 2) token vindo do CRM na URL
  const p = readParams()
  if (!p.token && !p.company) return null

  try {
    const res = await fetch("/api/crm/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: p.token, company: p.company }),
    })
    const data = await res.json()
    if (!data?.valid) {
      stripUrl()
      return null
    }

    const user: UserAccount = {
      email: p.email ?? "crm-user@scopehub.com.br",
      password: "",
      name: p.name ?? "Usuário CRM",
      company: p.company ?? data.company ?? "Scope Hub",
      role: p.role === "admin" ? "admin" : "client",
    }
    storeSession(user)
    stripUrl()
    return user
  } catch (e) {
    console.error("[crmAuth] validate failed:", e)
    stripUrl()
    return null
  }
}
