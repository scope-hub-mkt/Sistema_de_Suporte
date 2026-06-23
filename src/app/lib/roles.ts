import type { UserRole } from "./types"

// ─── Quem é admin do portal de suporte ─────────────────────────────────────────
// Regra de negócio: APENAS esta conta tem controle total — mover cards no Kanban,
// ver os logs/histórico e acessar os atendimentos de TODOS os tickets. Qualquer
// outro usuário validado pelo CRM é CLIENTE: cria e acompanha somente os próprios
// tickets. Relação 1→N (um admin dono, N clientes).
//
// Isto é decidido pelo e-mail, NÃO pelo `profile` do CRM (no CRM quase todo mundo
// é "admin" da própria empresa, o que não é o admin DESTE portal). O servidor
// (api/crm/login.ts) aplica a mesma regra de forma autoritativa; aqui no front é
// a mesma fonte da verdade para os demais caminhos (Supabase/mock/token).
const ADMIN_EMAILS = new Set<string>([
  "scopehubmarketing@gmail.com",
])

export function roleForEmail(email: string | null | undefined): UserRole {
  if (!email) return "client"
  return ADMIN_EMAILS.has(email.trim().toLowerCase()) ? "admin" : "client"
}
