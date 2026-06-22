// ─── Domain types (shared by UI, data layer e auth bridge) ─────────────────────

export type UserRole = "client" | "admin"
export type TicketStage = "Projeção" | "Em Progresso" | "Validação" | "Resolvido"
export type TicketType = "suporte" | "sugestao"
export type TicketCategory =
  | "Relatórios"
  | "Conversas"
  | "CRM"
  | "DS Track"
  | "Recursos"
  | "Automações"
  | "Canais de Atendimento"
  | "Administração"

export interface UserAccount {
  email: string
  password: string
  name: string
  company: string
  role: UserRole
}

export interface TicketComment {
  id: string
  author: string
  authorRole: UserRole
  text: string
  createdAt: Date
}

export interface Attachment {
  id: string
  name: string
  url: string
  mimeType: string
}

export interface Ticket {
  id: string
  title: string
  description: string
  category: TicketCategory
  type: TicketType
  stage: TicketStage
  author: string
  authorEmail: string
  company: string
  createdAt: Date
  attachments: Attachment[]
  comments: TicketComment[]
}
