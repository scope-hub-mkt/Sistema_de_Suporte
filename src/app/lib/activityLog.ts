import type { Ticket, TicketStage } from "./types"

// ─── Timeline de atividades do ticket ──────────────────────────────────────────
// Monta o histórico cronológico a partir de DADOS REAIS do banco:
//   • "created"  → derivado da tabela tickets (createdAt + author)
//   • "comment"  → tabela comments (cada resposta)
//   • "stage"    → tabela ticket_activity (mudanças de etapa persistidas)
// Nenhum dado é fabricado: o que aparece aqui existe no Supabase.

export type TimelineKind = "created" | "comment" | "stage"

export interface TimelineEvent {
  id: string
  kind: TimelineKind
  at: Date
  actor: string
  text?: string // texto do comentário
  from?: TicketStage
  to?: TicketStage
  isAdmin?: boolean
}

export function buildTimeline(ticket: Ticket): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // 1) criação
  events.push({
    id: `created-${ticket.id}`,
    kind: "created",
    at: ticket.createdAt,
    actor: ticket.author,
  })

  // 2) respostas (comentários)
  ticket.comments.forEach((c) =>
    events.push({
      id: `comment-${c.id}`,
      kind: "comment",
      at: c.createdAt,
      actor: c.author,
      text: c.text,
      isAdmin: c.authorRole === "admin",
    }),
  )

  // 3) mudanças de etapa (tabela ticket_activity)
  ticket.activity
    .filter((a) => a.kind === "stage_changed")
    .forEach((a) =>
      events.push({
        id: `stage-${a.id}`,
        kind: "stage",
        at: a.createdAt,
        actor: a.actor,
        from: a.fromStage,
        to: a.toStage,
      }),
    )

  return events.sort((a, b) => a.at.getTime() - b.at.getTime())
}
