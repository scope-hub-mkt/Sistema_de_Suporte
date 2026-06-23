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
    token: get("token") ?? get("key") ?? get("apikey") ?? get("jwt"),
    tenant: get("tenant"),
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
  ;["token", "key", "apikey", "jwt", "tenant", "role"].forEach((k) => url.searchParams.delete(k))
  url.hash = ""
  const search = url.searchParams.toString()
  window.history.replaceState({}, document.title, url.pathname + (search ? `?${search}` : ""))
}

// E-mail vindo do widget do CRM (?email={{user.email}}), para pré-preencher o
// formulário de login. Retorna undefined se o merge field não foi resolvido.
export function getCrmPrefillEmail(): string | undefined {
  return readParams().email
}

export async function resolveCrmSession(): Promise<UserAccount | null> {
  // 1) sessão já estabelecida nesta aba
  const existing = getStoredSession()
  if (existing) return existing

  // 2) token/empresa vindo do CRM na URL
  const p = readParams()
  // Auto-login (sessão sem digitar nada) só acontece com um TOKEN de usuário —
  // validação per-user real, não falsificável. O CRM atual não expõe esse token
  // no widget, então sem token NÃO criamos sessão aqui: o e-mail da URL é usado
  // apenas para PRÉ-PREENCHER o login (modo híbrido — ver getCrmPrefillEmail).
  if (!p.token) return null

  try {
    const res = await fetch("/api/crm/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: p.token, tenant: p.tenant, company: p.company, email: p.email }),
    })
    const data = await res.json()
    if (!data?.valid) {
      stripUrl()
      return null
    }

    // Caminho A (per-user): a identidade vem do CRM (data.user), não da URL —
    // assim não dá pra forjar email/role. Caminho B (empresa): usa os merge
    // fields da URL como fallback.
    const u = data.user
    const user: UserAccount = u
      ? {
          email: u.email ?? p.email ?? "crm-user@scopehub.com.br",
          password: "",
          name: u.name ?? p.name ?? "Usuário CRM",
          company: u.company ?? p.company ?? "Scope Hub",
          role: u.role === "admin" ? "admin" : "client",
        }
      : {
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
