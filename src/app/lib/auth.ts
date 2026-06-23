import type { UserAccount } from "./types"
import { supabase } from "./supabase"
import { MOCK_USERS } from "./mockData"
import { roleForEmail } from "./roles"

// Login manual. Ordem: (1) valida e-mail/senha CONTRA O CRM via /api/crm/login
// (universal p/ todas as empresas do tenant Scope Hub); (2) Supabase Auth;
// (3) mock de demonstração.
export async function loginWithPassword(
  email: string,
  password: string,
): Promise<UserAccount | null> {
  const crmUser = await loginWithCrm(email, password)
  if (crmUser) return crmUser

  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) return null
    const meta = (data.user.user_metadata ?? {}) as Record<string, string>
    return {
      email: data.user.email ?? email,
      password: "",
      name: meta.name ?? email.split("@")[0],
      company: meta.company ?? "Scope Hub",
      role: roleForEmail(data.user.email ?? email),
    }
  }

  const u = MOCK_USERS.find((x) => x.email === email && x.password === password)
  return u ? { ...u, role: roleForEmail(u.email) } : null
}

// Chama a função serverless que valida as credenciais no CRM. A senha vai só
// para o nosso backend (que repassa ao CRM); nunca fica exposta a terceiros.
async function loginWithCrm(email: string, password: string): Promise<UserAccount | null> {
  try {
    const res = await fetch("/api/crm/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => null)
    if (!data?.valid || !data.user) return null
    const u = data.user
    return {
      email: u.email ?? email,
      password: "",
      name: u.name ?? email.split("@")[0],
      company: u.company ?? "Scope Hub",
      // o servidor já resolve via allowlist; reforçamos no front pela mesma regra
      role: roleForEmail(u.email ?? email),
    }
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  if (supabase) {
    try {
      await supabase.auth.signOut()
    } catch {
      /* ignore */
    }
  }
}
