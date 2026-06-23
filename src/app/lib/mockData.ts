import type { UserAccount, Ticket } from "./types"

// Usado apenas como fallback de demonstração quando o Supabase NÃO está
// configurado (sem VITE_SUPABASE_URL). Em produção os dados vêm do Supabase.

// Papéis aqui são só rótulos do demo — em runtime o role é sempre resolvido por
// roleForEmail (allowlist), então só scopehubmarketing@gmail.com vira admin.
export const MOCK_USERS: UserAccount[] = [
  { email: "joao@empresa.com", password: "123456", name: "João Silva", company: "Empresa ABC", role: "client" },
  { email: "maria@techcorp.com", password: "123456", name: "Maria Santos", company: "TechCorp", role: "client" },
  { email: "scopehubmarketing@gmail.com", password: "admin123", name: "Scope Hub", company: "Scope Hub", role: "admin" },
]

export const INITIAL_TICKETS: Ticket[] = [
  {
    id: "T001",
    title: "Relatório de vendas não carrega dados do mês atual",
    description: "Ao tentar gerar o relatório mensal, a tela fica em loading indefinidamente e não retorna dados do período corrente. O problema ocorre apenas no mês de junho.",
    category: "Relatórios", type: "suporte", stage: "Em Progresso",
    author: "João Silva", authorEmail: "joao@empresa.com", company: "Empresa ABC",
    createdAt: new Date("2026-06-18T09:30:00"), attachments: [],
    comments: [
      { id: "C001", author: "Admin Suporte", authorRole: "admin", text: "Identificamos a causa raiz. A query de agregação do período possui um índice corrompido. Correção prevista para amanhã.", createdAt: new Date("2026-06-18T14:00:00") },
      { id: "C002", author: "João Silva", authorRole: "client", text: "Obrigado! Aguardando a correção.", createdAt: new Date("2026-06-18T14:22:00") },
    ],
    activity: [],
  },
  {
    id: "T002",
    title: "Adicionar filtro por data nas automações",
    description: "Seria muito útil poder filtrar as automações por data de criação ou última execução. Hoje precisamos rolar toda a lista para encontrar automações antigas.",
    category: "Automações", type: "sugestao", stage: "Projeção",
    author: "João Silva", authorEmail: "joao@empresa.com", company: "Empresa ABC",
    createdAt: new Date("2026-06-20T11:00:00"), attachments: [], comments: [], activity: [],
  },
  {
    id: "T003",
    title: "Erro 500 ao importar contatos via CSV com +500 linhas",
    description: "Upload de arquivo CSV com mais de 500 registros retorna erro 500 no servidor sem mensagem de detalhe. Arquivos menores funcionam normalmente.",
    category: "CRM", type: "suporte", stage: "Validação",
    author: "Maria Santos", authorEmail: "maria@techcorp.com", company: "TechCorp",
    createdAt: new Date("2026-06-15T08:00:00"), attachments: [],
    comments: [
      { id: "C003", author: "Admin Suporte", authorRole: "admin", text: "Correção aplicada no ambiente de produção. Por favor valide com um arquivo de teste e nos informe se o problema persiste.", createdAt: new Date("2026-06-20T16:00:00") },
    ],
    activity: [],
  },
  {
    id: "T004",
    title: "Novo canal de WhatsApp não aparece no DS Track",
    description: "Após conectar um novo número de WhatsApp, a visualização do DS Track não lista o canal na lista de canais ativos mesmo após atualizar a página.",
    category: "DS Track", type: "suporte", stage: "Resolvido",
    author: "Maria Santos", authorEmail: "maria@techcorp.com", company: "TechCorp",
    createdAt: new Date("2026-06-10T13:00:00"), attachments: [],
    comments: [
      { id: "C004", author: "Admin Suporte", authorRole: "admin", text: "Resolvido! O problema era de sincronização de cache. Canal já aparece corretamente.", createdAt: new Date("2026-06-12T10:00:00") },
    ],
    activity: [],
  },
  {
    id: "T005",
    title: "Painel de administração sem permissão para subadmins",
    description: "Usuários com perfil subadmin não conseguem acessar o painel de administração mesmo tendo as permissões corretas configuradas.",
    category: "Administração", type: "suporte", stage: "Projeção",
    author: "João Silva", authorEmail: "joao@empresa.com", company: "Empresa ABC",
    createdAt: new Date("2026-06-21T16:45:00"), attachments: [], comments: [], activity: [],
  },
]
