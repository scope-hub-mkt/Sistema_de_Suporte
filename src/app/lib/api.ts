import type { Ticket, TicketComment, TicketStage } from "./types"
import { supabase } from "./supabase"
import { INITIAL_TICKETS } from "./mockData"

// Camada de dados única. Se o Supabase estiver configurado, persiste de verdade;
// caso contrário, devolve dados mockados (modo demo) e as escritas são no-op.

export const dataLayer = {
  async loadTickets(): Promise<Ticket[]> {
    if (!supabase) return INITIAL_TICKETS.map((t) => ({ ...t }))

    const { data: tks, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false })
    if (error || !tks) {
      console.error("[api] loadTickets:", error)
      return []
    }

    const { data: cmts } = await supabase
      .from("comments")
      .select("*")
      .order("created_at", { ascending: true })

    return tks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      category: t.category,
      type: t.type,
      stage: t.stage,
      author: t.author,
      authorEmail: t.author_email,
      company: t.company,
      createdAt: new Date(t.created_at),
      attachments: [], // anexos persistidos via Storage ficam para a próxima fase
      comments: (cmts ?? [])
        .filter((c) => c.ticket_id === t.id)
        .map((c) => ({
          id: c.id,
          author: c.author,
          authorRole: c.author_role,
          text: c.text,
          createdAt: new Date(c.created_at),
        })),
    }))
  },

  async createTicket(t: Ticket): Promise<void> {
    if (!supabase) return
    const { error } = await supabase.from("tickets").insert({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      type: t.type,
      stage: t.stage,
      author: t.author,
      author_email: t.authorEmail,
      company: t.company,
      created_at: t.createdAt.toISOString(),
    })
    if (error) console.error("[api] createTicket:", error)
  },

  async addComment(ticketId: string, c: TicketComment): Promise<void> {
    if (!supabase) return
    const { error } = await supabase.from("comments").insert({
      id: c.id,
      ticket_id: ticketId,
      author: c.author,
      author_role: c.authorRole,
      text: c.text,
      created_at: c.createdAt.toISOString(),
    })
    if (error) console.error("[api] addComment:", error)
  },

  async updateStage(ticketId: string, stage: TicketStage): Promise<void> {
    if (!supabase) return
    const { error } = await supabase.from("tickets").update({ stage }).eq("id", ticketId)
    if (error) console.error("[api] updateStage:", error)
  },
}
