import type { Ticket, TicketStage } from "./types"

// ─── Histórico de atividades do ticket ─────────────────────────────────────────
// Registra eventos que NÃO ficam guardados no objeto do ticket — hoje só as
// mudanças de etapa. "Criado" e "respondido" são derivados do próprio ticket
// (createdAt + comments). Persistido em localStorage por ticket, então sobrevive
// ao reload tanto em modo demo quanto com Supabase (a tabela de tickets não
// guarda esse log). Chave: ticket_activity_<id>.

export interface StageChange {
  at: string // ISO date
  actor: string
  from: TicketStage
  to: TicketStage
}

const KEY = (ticketId: string) => `ticket_activity_${ticketId}`

export function getStageChanges(ticketId: string): StageChange[] {
  try {
    const raw = localStorage.getItem(KEY(ticketId))
    return raw ? (JSON.parse(raw) as StageChange[]) : []
  } catch {
    return []
  }
}

export function logStageChange(ticketId: string, change: StageChange): void {
  try {
    const arr = getStageChanges(ticketId)
    arr.push(change)
    localStorage.setItem(KEY(ticketId), JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

// ─── Timeline unificada (criado · respondido · etapa alterada) ─────────────────

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

  // 3) mudanças de etapa registradas
  getStageChanges(ticket.id).forEach((s, i) =>
    events.push({
      id: `stage-${ticket.id}-${i}`,
      kind: "stage",
      at: new Date(s.at),
      actor: s.actor,
      from: s.from,
      to: s.to,
    }),
  )

  return events.sort((a, b) => a.at.getTime() - b.at.getTime())
}
