import type { UserAccount } from "./types"
import { supabase } from "./supabase"
import { MOCK_USERS } from "./mockData"

// Login manual (fallback quando o usuário NÃO veio com token do CRM).
// Usa Supabase Auth quando configurado; senão cai no mock de demonstração.
export async function loginWithPassword(
  email: string,
  password: string,
): Promise<UserAccount | null> {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) return null
    const meta = (data.user.user_metadata ?? {}) as Record<string, string>
    return {
      email: data.user.email ?? email,
      password: "",
      name: meta.name ?? email.split("@")[0],
      company: meta.company ?? "Scope Hub",
      role: meta.role === "admin" ? "admin" : "client",
    }
  }

  const u = MOCK_USERS.find((x) => x.email === email && x.password === password)
  return u ?? null
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
