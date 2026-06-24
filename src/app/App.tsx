import { useState, useRef, useEffect } from "react"
import {
  Bug, Lightbulb, LogOut, LayoutDashboard, X, Send,
  Clock, ChevronDown, MessageSquare, Lock, BarChart2,
  ArrowRight, Upload, Film, Image as ImageIcon, Tag, User,
  History, PlusCircle, GripVertical,
} from "lucide-react"

import type {
  UserAccount, TicketStage, TicketType, TicketCategory,
  Ticket, TicketComment, TicketActivity, Attachment,
} from "./lib/types"
import { resolveCrmSession, clearCrmSession, getCrmPrefillEmail, storeSession } from "./lib/crmAuth"
import { loginWithPassword, logout } from "./lib/auth"
import { dataLayer } from "./lib/api"
import { buildTimeline, type TimelineEvent } from "./lib/activityLog"

// ─── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES: TicketCategory[] = [
  "Relatórios", "Conversas", "CRM", "DS Track",
  "Recursos", "Automações", "Canais de Atendimento", "Administração",
]

const STAGES: TicketStage[] = ["Projeção", "Em Progresso", "Validação", "Resolvido"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d)
}

function fmtShort(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d)
}

function uid() { return Math.random().toString(36).substr(2, 9).toUpperCase() }

const stageStyle: Record<TicketStage, { badge: string; bar: string; text: string; panel: string; count: string }> = {
  "Projeção":    { badge: "text-blue-700 bg-blue-500/10 border border-blue-500/20",    bar: "bg-blue-500",    text: "text-blue-600",    panel: "bg-blue-50/70 border-blue-200/70",       count: "bg-blue-500/15 text-blue-700" },
  "Em Progresso":{ badge: "text-amber-700 bg-amber-500/12 border border-amber-500/25",  bar: "bg-amber-500",   text: "text-amber-600",   panel: "bg-amber-50/70 border-amber-200/70",     count: "bg-amber-500/15 text-amber-700" },
  "Validação":   { badge: "text-violet-700 bg-violet-500/10 border border-violet-500/20",bar: "bg-violet-500",  text: "text-violet-600",  panel: "bg-violet-50/70 border-violet-200/70",   count: "bg-violet-500/15 text-violet-700" },
  "Resolvido":   { badge: "text-emerald-700 bg-emerald-500/10 border border-emerald-500/20",bar: "bg-emerald-500",text: "text-emerald-600", panel: "bg-emerald-50/70 border-emerald-200/70", count: "bg-emerald-500/15 text-emerald-700" },
}

const catStyle: Record<TicketCategory, string> = {
  "Relatórios":          "text-cyan-700 bg-cyan-500/10",
  "Conversas":           "text-pink-700 bg-pink-500/10",
  "CRM":                 "text-indigo-700 bg-indigo-500/10",
  "DS Track":            "text-orange-700 bg-orange-500/10",
  "Recursos":            "text-teal-700 bg-teal-500/10",
  "Automações":          "text-purple-700 bg-purple-500/10",
  "Canais de Atendimento": "text-rose-700 bg-rose-500/10",
  "Administração":       "text-slate-700 bg-slate-500/12",
}

// ─── LoginScreen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin, initialEmail = "" }: { onLogin: (u: UserAccount) => void; initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const user = await loginWithPassword(email, password)
      if (user) {
        onLogin(user)
      } else {
        setError("E-mail ou senha inválidos. Tente novamente.")
        setLoading(false)
      }
    } catch {
      setError("Falha ao conectar. Tente novamente em instantes.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 border border-primary/20 mb-4">
            <BarChart2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">CRM Scope Hub</h1>
          <p className="text-muted-foreground text-sm mt-1.5">Sistema de Suporte ao Usuário</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus={!!initialEmail}
                placeholder="••••••••"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-sm"
                required
              />
            </div>

            {error && (
              <p className="text-red-600 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 mt-1"
            >
              {loading ? "Verificando..." : "Entrar no Portal"}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4 leading-relaxed">
            Use as mesmas credenciais do seu sistema CRM Scope
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── CreateTicketModal ────────────────────────────────────────────────────────

function CreateTicketModal({ type, author, onClose, onCreate }: {
  type: TicketType
  author: UserAccount
  onClose: () => void
  onCreate: (t: Ticket) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<TicketCategory>("CRM")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const isSuport = type === "suporte"

  function handleFiles(files: FileList | null) {
    if (!files) return
    const next: Attachment[] = Array.from(files).map(f => ({
      id: uid(), name: f.name, url: URL.createObjectURL(f), mimeType: f.type,
    }))
    setAttachments(p => [...p, ...next])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const ticket: Ticket = {
      id: "T" + uid().slice(0, 5),
      title: title.trim(),
      description: description.trim(),
      category, type,
      stage: "Projeção",
      author: author.name,
      authorEmail: author.email,
      company: author.company,
      createdAt: new Date(),
      attachments,
      comments: [],
      activity: [],
    }
    onCreate(ticket)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl shadow-black/10 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isSuport ? "bg-red-500/10" : "bg-primary/10"}`}>
              {isSuport ? <Bug className="w-5 h-5 text-red-600" /> : <Lightbulb className="w-5 h-5 text-primary" />}
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">
                {isSuport ? "Abrir Ticket de Suporte" : "Enviar Sugestão de Melhoria"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isSuport ? "Relate bugs, falhas e erros técnicos" : "Compartilhe ideias e melhorias"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Author info strip */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground bg-accent/50 rounded-xl px-3.5 py-2.5 border border-border">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-medium text-foreground">{author.name}</span>
                <span>·</span>
                <span>{author.company}</span>
              </span>
              <span className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                {fmtDate(new Date())}
              </span>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Título *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={isSuport ? "Ex: Botão salvar não funciona na tela de CRM" : "Ex: Adicionar exportação em PDF nos relatórios"}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-all text-sm"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                <Tag className="w-3 h-3 inline mr-1 mb-0.5" />Categoria
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as TicketCategory)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm appearance-none cursor-pointer"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Descrição detalhada</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={isSuport
                  ? "Descreva o problema com detalhes: quando ocorre, passos para reproduzir, mensagem de erro..."
                  : "Descreva sua sugestão em detalhes: contexto, benefícios esperados, como deveria funcionar..."}
                rows={4}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm resize-none"
              />
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                Anexos (imagens e vídeos)
              </label>
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-xl py-3 px-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors group"
              >
                <Upload className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Clique para anexar arquivos
              </button>
              {attachments.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2.5 text-xs bg-accent/40 rounded-lg px-3 py-2 border border-border">
                      {att.mimeType.startsWith("image") ? <ImageIcon className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" /> : <Film className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />}
                      <span className="flex-1 truncate text-foreground">{att.name}</span>
                      <button type="button" onClick={() => setAttachments(p => p.filter(a => a.id !== att.id))} className="text-muted-foreground hover:text-red-600 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 border border-border rounded-xl py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                Cancelar
              </button>
              <button type="submit" className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98] ${isSuport ? "bg-red-500 hover:bg-red-600 text-white" : "bg-primary hover:bg-primary/90 text-primary-foreground"}`}>
                Abrir Ticket
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── TicketTimeline ───────────────────────────────────────────────────────────
// Histórico de atividades do ticket, isolado e cronológico: criação, respostas
// e mudanças de etapa — com data/hora de cada evento.

function TicketTimeline({ ticket }: { ticket: Ticket }) {
  const events: TimelineEvent[] = buildTimeline(ticket)

  function renderEvent(ev: TimelineEvent) {
    if (ev.kind === "created") {
      return (
        <>
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground leading-snug">
              Ticket criado por <span className="font-medium">{ev.actor}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(ev.at)}</p>
          </div>
        </>
      )
    }
    if (ev.kind === "stage") {
      return (
        <>
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <ArrowRight className="w-3.5 h-3.5 text-violet-600" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground leading-snug flex items-center gap-1.5 flex-wrap">
              <span className="font-medium">{ev.actor}</span> moveu de
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${stageStyle[ev.from!].badge}`}>{ev.from}</span>
              para
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${stageStyle[ev.to!].badge}`}>{ev.to}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(ev.at)}</p>
          </div>
        </>
      )
    }
    // comment / resposta
    return (
      <>
        <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${ev.isAdmin ? "bg-primary/15 border border-primary/25" : "bg-secondary border border-border"}`}>
          <MessageSquare className={`w-3.5 h-3.5 ${ev.isAdmin ? "text-primary" : "text-muted-foreground"}`} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-snug">
            <span className="font-medium">{ev.actor}</span>{ev.isAdmin ? " (Suporte)" : ""} respondeu
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{ev.text}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(ev.at)}</p>
        </div>
      </>
    )
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" />
        Histórico de atividades ({events.length})
      </h3>
      <ol className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-border">
        {events.map(ev => (
          <li key={ev.id} className="relative flex gap-3 items-start">
            {renderEvent(ev)}
          </li>
        ))}
      </ol>
    </div>
  )
}

// ─── TicketDetailModal ────────────────────────────────────────────────────────

function TicketDetailModal({ ticket, currentUser, onClose, onUpdate }: {
  ticket: Ticket
  currentUser: UserAccount
  onClose: () => void
  onUpdate: (t: Ticket) => void
}) {
  const [comment, setComment] = useState("")
  const [stageOpen, setStageOpen] = useState(false)
  const isAdmin = currentUser.role === "admin"

  function addComment() {
    if (!comment.trim()) return
    const c: TicketComment = {
      id: uid(),
      author: currentUser.name,
      authorRole: currentUser.role,
      text: comment.trim(),
      createdAt: new Date(),
    }
    onUpdate({ ...ticket, comments: [...ticket.comments, c] })
    setComment("")
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/10 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-border flex-shrink-0">
          <div className={`p-2.5 rounded-xl flex-shrink-0 ${ticket.type === "suporte" ? "bg-red-500/10" : "bg-primary/10"}`}>
            {ticket.type === "suporte" ? <Bug className="w-4 h-4 text-red-600" /> : <Lightbulb className="w-4 h-4 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono text-muted-foreground">#{ticket.id}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${stageStyle[ticket.stage].badge}`}>{ticket.stage}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${catStyle[ticket.category]}`}>{ticket.category}</span>
            </div>
            <h2 className="font-semibold text-foreground leading-snug">{ticket.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Left: content */}
            <div className="md:col-span-2 p-5 space-y-5">
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Descrição</h3>
                <div className="bg-background/60 rounded-xl p-4 border border-border text-sm text-foreground leading-relaxed">
                  {ticket.description || <span className="italic text-muted-foreground">Sem descrição fornecida.</span>}
                </div>
              </div>

              {ticket.attachments.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Anexos</h3>
                  <div className="space-y-1.5">
                    {ticket.attachments.map(att => (
                      <a key={att.id} href={att.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2.5 text-xs bg-background/60 border border-border rounded-lg px-3 py-2 hover:border-primary/40 transition-colors">
                        {att.mimeType.startsWith("image") ? <ImageIcon className="w-3.5 h-3.5 text-cyan-600" /> : <Film className="w-3.5 h-3.5 text-purple-600" />}
                        <span className="truncate text-foreground">{att.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Comentários ({ticket.comments.length})
                </h3>
                <div className="space-y-3 mb-4">
                  {ticket.comments.length === 0 && (
                    <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum comentário ainda.</p>
                  )}
                  {ticket.comments.map(c => {
                    const isMe = c.author === currentUser.name
                    return (
                      <div key={c.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                        <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${c.authorRole === "admin" ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"}`}>
                          {c.author[0].toUpperCase()}
                        </div>
                        <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} flex-1`}>
                          <div className={`rounded-2xl px-3.5 py-2.5 text-sm max-w-[90%] leading-relaxed ${c.authorRole === "admin" ? "bg-primary/12 border border-primary/25 text-foreground" : "bg-secondary text-secondary-foreground"}`}>
                            {c.text}
                          </div>
                          <span className="text-xs text-muted-foreground mt-1 px-1">
                            {c.author}{c.authorRole === "admin" ? " · Suporte" : ""} · {fmtDate(c.createdAt)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && addComment()}
                    placeholder="Escreva um comentário..."
                    className="flex-1 bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                  <button
                    onClick={addComment}
                    className="bg-primary text-primary-foreground rounded-xl px-3.5 hover:bg-primary/90 transition-colors flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Histórico de atividades — logs visíveis só para o admin do portal */}
              {isAdmin && <TicketTimeline ticket={ticket} />}
            </div>

            {/* Right: sidebar metadata */}
            <div className="p-5 space-y-5">
              {/* Stage */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Etapa</h3>
                {isAdmin ? (
                  <div className="relative">
                    <button
                      onClick={() => setStageOpen(!stageOpen)}
                      className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${stageStyle[ticket.stage].badge}`}
                    >
                      <span>{ticket.stage}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${stageOpen ? "rotate-180" : ""}`} />
                    </button>
                    {stageOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-xl overflow-hidden z-20">
                        {STAGES.map(s => (
                          <button
                            key={s}
                            onClick={() => { onUpdate({ ...ticket, stage: s }); setStageOpen(false) }}
                            className={`w-full text-left px-3.5 py-2.5 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${s === ticket.stage ? "text-primary font-medium" : "text-foreground"}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${stageStyle[s].bar}`} />
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${stageStyle[ticket.stage].badge}`}>{ticket.stage}</span>
                    <Lock className="w-3 h-3 text-muted-foreground" title="Apenas administradores podem alterar a etapa" />
                  </div>
                )}
              </div>

              {[
                { label: "Autor", value: ticket.author, icon: <User className="w-3.5 h-3.5" /> },
                { label: "Empresa", value: ticket.company, icon: null },
                { label: "Categoria", value: ticket.category, icon: <Tag className="w-3.5 h-3.5" /> },
                { label: "Criado em", value: fmtDate(ticket.createdAt), icon: <Clock className="w-3.5 h-3.5" /> },
                { label: "Tipo", value: ticket.type === "suporte" ? "Suporte Técnico" : "Sugestão / Melhoria", icon: null },
              ].map(({ label, value, icon }) => (
                <div key={label}>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{label}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-foreground">
                    {icon && <span className="text-muted-foreground flex-shrink-0">{icon}</span>}
                    <span className="leading-snug">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── KanbanBoard ──────────────────────────────────────────────────────────────

function KanbanBoard({ tickets, currentUser, onTicketClick, onStageChange }: {
  tickets: Ticket[]
  currentUser: UserAccount
  onTicketClick: (t: Ticket) => void
  onStageChange: (t: Ticket, stage: TicketStage) => void
}) {
  // Só admin pode mover tickets entre etapas (mesma regra do seletor de etapa).
  const canDrag = currentUser.role === "admin"
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<TicketStage | null>(null)

  const visible = canDrag
    ? tickets
    : tickets.filter(t => t.authorEmail === currentUser.email)

  function handleDrop(stage: TicketStage) {
    if (dragId) {
      const t = tickets.find(x => x.id === dragId)
      if (t && t.stage !== stage) onStageChange(t, stage)
    }
    setDragId(null)
    setOverStage(null)
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {STAGES.map(stage => {
        const cols = visible.filter(t => t.stage === stage)
        const isOver = overStage === stage
        return (
          <div
            key={stage}
            onDragOver={canDrag ? (e) => { e.preventDefault(); if (overStage !== stage) setOverStage(stage) } : undefined}
            onDragLeave={canDrag ? (e) => {
              // só limpa se o ponteiro realmente saiu da coluna (e não entrou num filho)
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(s => (s === stage ? null : s))
            } : undefined}
            onDrop={canDrag ? () => handleDrop(stage) : undefined}
            className={`flex flex-col rounded-2xl border p-3 transition-all duration-200 ${stageStyle[stage].panel} ${isOver ? "ring-2 ring-primary/40 ring-inset shadow-md" : "shadow-sm"}`}
          >
            <div className="flex items-center gap-2.5 mb-3 px-1 pt-0.5">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${stageStyle[stage].bar}`} />
              <span className="text-sm font-semibold text-foreground">{stage}</span>
              <span className={`ml-auto text-xs font-mono rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 ${stageStyle[stage].count}`}>
                {cols.length}
              </span>
            </div>
            <div className="space-y-2.5 flex-1 min-h-[64px]">
              {cols.map(t => (
                <div
                  key={t.id}
                  draggable={canDrag}
                  onDragStart={canDrag ? (e) => { setDragId(t.id); e.dataTransfer.effectAllowed = "move" } : undefined}
                  onDragEnd={canDrag ? () => { setDragId(null); setOverStage(null) } : undefined}
                  onClick={() => onTicketClick(t)}
                  className={`w-full text-left bg-card border border-border rounded-xl p-3.5 shadow-sm hover:border-primary/40 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-200 group ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${dragId === t.id ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start gap-2 mb-2.5">
                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${t.type === "suporte" ? "bg-red-500/10" : "bg-primary/10"}`}>
                      {t.type === "suporte" ? <Bug className="w-3 h-3 text-red-600" /> : <Lightbulb className="w-3 h-3 text-primary" />}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full leading-tight ${catStyle[t.category]}`}>{t.category}</span>
                    {canDrag && (
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 ml-auto flex-shrink-0 group-hover:text-muted-foreground transition-colors" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-2.5">
                    {t.title}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />{fmtShort(t.createdAt)}
                    </span>
                    {t.comments.length > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />{t.comments.length}
                      </span>
                    )}
                    {currentUser.role === "admin" && (
                      <span className="ml-auto text-xs truncate max-w-[70px]">{t.company}</span>
                    )}
                  </div>
                </div>
              ))}
              {cols.length === 0 && (
                <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${isOver ? "border-primary/40 bg-primary/5" : "border-foreground/10"}`}>
                  <p className="text-xs text-muted-foreground">{isOver ? "Solte aqui" : "Nenhum ticket"}</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── PanelView ────────────────────────────────────────────────────────────────

function PanelView({ tickets, currentUser, onTicketClick }: {
  tickets: Ticket[]
  currentUser: UserAccount
  onTicketClick: (t: Ticket) => void
}) {
  const [filter, setFilter] = useState<TicketStage | "Todos">("Todos")
  const [typeFilter, setTypeFilter] = useState<TicketType | "Todos">("Todos")

  const pool = currentUser.role === "admin" ? tickets : tickets.filter(t => t.authorEmail === currentUser.email)

  const stats = {
    abertos: pool.filter(t => t.stage === "Projeção" || t.stage === "Em Progresso").length,
    validacao: pool.filter(t => t.stage === "Validação").length,
    resolvidos: pool.filter(t => t.stage === "Resolvido").length,
    total: pool.length,
  }

  const displayed = pool
    .filter(t => filter === "Todos" || t.stage === filter)
    .filter(t => typeFilter === "Todos" || t.type === typeFilter)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return (
    <main className="max-w-4xl mx-auto px-5 py-8">
      <h1 className="text-xl font-bold text-foreground mb-6">Painel de Tickets</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Total", count: stats.total, cls: "text-foreground", bg: "bg-secondary border-border" },
          { label: "Abertos", count: stats.abertos, cls: "text-amber-600", bg: "bg-amber-500/8 border-amber-500/20" },
          { label: "Em Validação", count: stats.validacao, cls: "text-violet-600", bg: "bg-violet-500/8 border-violet-500/20" },
          { label: "Resolvidos", count: stats.resolvidos, cls: "text-emerald-600", bg: "bg-emerald-500/8 border-emerald-500/20" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
            <div className={`text-3xl font-bold ${s.cls}`}>{s.count}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-2">
        {(["Todos", ...STAGES] as (TicketStage | "Todos")[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground border border-border"}`}>
            {f}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {(["Todos", "suporte", "sugestao"] as const).map(f => (
          <button key={f} onClick={() => setTypeFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${typeFilter === f ? "bg-card border-primary/60 text-foreground border" : "text-muted-foreground hover:text-foreground"}`}>
            {f === "Todos" ? "Todos os tipos" : f === "suporte" ? "🐛 Suporte" : "💡 Sugestões"}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {displayed.map(t => (
          <button key={t.id} onClick={() => onTicketClick(t)}
            className="w-full text-left bg-card border border-border rounded-xl px-4 py-3.5 hover:border-primary/40 transition-all group flex items-center gap-4">
            <div className={`p-2 rounded-xl flex-shrink-0 ${t.type === "suporte" ? "bg-red-500/10" : "bg-primary/10"}`}>
              {t.type === "suporte" ? <Bug className="w-4 h-4 text-red-600" /> : <Lightbulb className="w-4 h-4 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-mono text-muted-foreground">#{t.id}</span>
                {currentUser.role === "admin" && <span className="text-xs text-muted-foreground">· {t.company}</span>}
              </div>
              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{t.title}</p>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <span className={`text-xs px-2.5 py-1 rounded-full ${stageStyle[t.stage].badge}`}>{t.stage}</span>
              <span className="text-xs text-muted-foreground hidden sm:block whitespace-nowrap">{fmtShort(t.createdAt)}</span>
            </div>
          </button>
        ))}
        {displayed.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum ticket encontrado para os filtros selecionados.</p>
          </div>
        )}
      </div>
    </main>
  )
}

// ─── BootScreen ─────────────────────────────────────────────────────────────────

function BootScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center animate-pulse">
          <BarChart2 className="w-6 h-6 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">Conectando ao Scope...</p>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [view, setView] = useState<"dashboard" | "panel">("dashboard")
  const [createType, setCreateType] = useState<TicketType | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [booting, setBooting] = useState(true)
  const [prefillEmail, setPrefillEmail] = useState("")

  // Bootstrap: auto-login via token do CRM (se houver) e carrega os tickets.
  // Sem token, guarda o e-mail do widget para pré-preencher o login (híbrido).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sess = await resolveCrmSession()
      const tks = await dataLayer.loadTickets()
      if (cancelled) return
      if (sess) setCurrentUser(sess)
      else setPrefillEmail(getCrmPrefillEmail() ?? "")
      setTickets(tks)
      setBooting(false)
    })()
    return () => { cancelled = true }
  }, [])

  if (booting) return <BootScreen />

  if (!currentUser) {
    // Persiste a sessão no login manual também (antes só o bypass do CRM salvava),
    // para que recarregar a página NÃO deslogue o usuário.
    return (
      <LoginScreen
        onLogin={u => { storeSession(u); setCurrentUser(u) }}
        initialEmail={prefillEmail}
      />
    )
  }

  function handleCreate(ticket: Ticket) {
    setTickets(p => [ticket, ...p])
    void dataLayer.createTicket(ticket)
    setCreateType(null)
    setSelectedTicket(ticket)
  }

  function handleUpdate(updated: Ticket) {
    const prev = tickets.find(t => t.id === updated.id)
    setTickets(p => p.map(t => t.id === updated.id ? updated : t))
    // Só reflete no modal se ele já estiver aberto neste ticket — assim arrastar
    // um card no Kanban NÃO abre o modal de detalhe sem querer.
    setSelectedTicket(cur => (cur && cur.id === updated.id ? updated : cur))
    if (!prev) return
    if (prev.stage !== updated.stage) {
      const act: TicketActivity = {
        id: uid(),
        kind: "stage_changed",
        actor: currentUser!.name,
        fromStage: prev.stage,
        toStage: updated.stage,
        createdAt: new Date(),
      }
      // reflete já no estado local (otimista) e persiste de verdade na tabela
      const withAct: Ticket = { ...updated, activity: [...updated.activity, act] }
      setTickets(p => p.map(t => t.id === withAct.id ? withAct : t))
      setSelectedTicket(cur => (cur && cur.id === withAct.id ? withAct : cur))
      void dataLayer.updateStage(updated.id, updated.stage)
      void dataLayer.addActivity(updated.id, act)
    }
    if (updated.comments.length > prev.comments.length) {
      const newComment = updated.comments[updated.comments.length - 1]
      void dataLayer.addComment(updated.id, newComment)
    }
  }

  async function handleLogout() {
    clearCrmSession()
    await logout()
    setCurrentUser(null)
    setView("dashboard")
  }

  const visibleCount = currentUser.role === "admin"
    ? tickets.length
    : tickets.filter(t => t.authorEmail === currentUser.email).length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <BarChart2 className="w-4 h-4 text-primary" />
            </div>
            <div className="leading-tight">
              <span className="block font-bold text-foreground tracking-tight text-sm">CRM Scope Hub</span>
              <span className="block text-[11px] text-muted-foreground">Sistema de Suporte ao Usuário</span>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-foreground leading-tight flex items-center justify-end gap-1.5">
                {currentUser.name}
                {currentUser.role === "admin" && (
                  <span className="text-[10px] bg-primary/15 text-primary border border-primary/25 px-1.5 py-0.5 rounded-full font-medium">Admin</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{currentUser.company}</p>
            </div>
            <button
              onClick={() => setView(v => v === "panel" ? "dashboard" : "panel")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${view === "panel" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-secondary border border-border text-foreground hover:border-primary/40"}`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Painel</span>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {view === "panel" ? (
        <PanelView
          tickets={tickets}
          currentUser={currentUser}
          onTicketClick={t => setSelectedTicket(t)}
        />
      ) : (
        <main className="max-w-7xl mx-auto px-5 py-8">
          {/* Action buttons */}
          <div className="mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">Criar novo ticket</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
              <button
                onClick={() => setCreateType("suporte")}
                className="group flex items-center gap-4 bg-card border border-border hover:border-red-500/40 rounded-2xl p-5 text-left transition-all hover:shadow-lg hover:shadow-red-500/10 hover:-translate-y-0.5 duration-200"
              >
                <div className="p-3.5 rounded-2xl bg-red-500/10 flex-shrink-0 group-hover:bg-red-500/18 transition-colors">
                  <Bug className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-foreground mb-0.5">Suporte Técnico</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">Abrir ticket referente a bugs, falhas, erros e problemas técnicos</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-red-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </button>
              <button
                onClick={() => setCreateType("sugestao")}
                className="group flex items-center gap-4 bg-card border border-border hover:border-primary/40 rounded-2xl p-5 text-left transition-all hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 duration-200"
              >
                <div className="p-3.5 rounded-2xl bg-primary/10 flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Lightbulb className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-foreground mb-0.5">Sugestões e Melhorias</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">Abrir ticket referente a otimizações, melhorias e sugestões de features</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
              </button>
            </div>
          </div>

          {/* Kanban section */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-foreground">Quadro Kanban</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentUser.role === "admin" ? "Todos os tickets do sistema" : "Acompanhe o progresso dos seus tickets em tempo real"}
              </p>
            </div>
            <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">
              {visibleCount} ticket{visibleCount !== 1 ? "s" : ""}
            </span>
          </div>

          <KanbanBoard
            tickets={tickets}
            currentUser={currentUser}
            onTicketClick={t => setSelectedTicket(t)}
            onStageChange={(t, stage) => handleUpdate({ ...t, stage })}
          />
        </main>
      )}

      {createType && (
        <CreateTicketModal
          type={createType}
          author={currentUser}
          onClose={() => setCreateType(null)}
          onCreate={handleCreate}
        />
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          currentUser={currentUser}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
