# Ticket System for CRM — Scope Hub

Portal de tickets (suporte + sugestões) para os usuários do CRM white-label da **Scope Hub**.
Frontend React + Vite + Tailwind, banco **Supabase**, e uma **Vercel Function** que faz a
ponte de autenticação com o CRM Scope.

## 🟢 Status — LIVE (2026-06-22)

| Item | Estado |
| --- | --- |
| App (produção) | **https://ticket-system-swart-two.vercel.app** |
| Repositório | `scope-hub-mkt/Ticket-System` (privado) |
| Auth bridge | ✅ `POST /api/crm/validate` → CRM `GET /contact` → **200** |
| Banco | ✅ Supabase `ovnryyojvsfuvwjfxvkr` — schema aplicado; CRUD real validado (insert `201`, comment `201`, update `204`) |
| Empresas | Multi-tenant. **Effects** já configurada (`SCOPE_API_KEY_EFFECTS`) |

## Como funciona a autenticação

O usuário **só acessa este app de dentro do CRM**, já autenticado lá. Dois caminhos, nesta ordem:

1. **Bypass automático (principal).** O CRM abre o app com os dados do usuário logado na URL:

   ```
   https://ticket-system-swart-two.vercel.app/?company=effects&name=Fulano&email=fulano@empresa.com&role=client
   ```

   O app chama `POST /api/crm/validate`, que pergunta ao CRM *"essa credencial é verdadeira?"*
   sondando `GET https://api.scopehub.com.br/api/contact` com o header `api-key` (resolvido
   **no servidor**, nunca exposto). Se o CRM responde **2xx**, a sessão é criada e o usuário cai
   **direto no painel — sem tela de login**. O token é removido da URL ao ser consumido.

2. **Login manual (fallback).** Sem token na URL, aparece a tela de login. ⚠️ O CRM **não possui
   endpoint de validação de e-mail/senha por usuário** (`POST /api/auth/login` → 404), então o
   login manual valida contra **Supabase Auth**, *não* contra o CRM. Para usar as mesmas
   credenciais do CRM aqui, os usuários precisariam ser provisionados no Supabase Auth.
   **Recomendado:** sempre abrir pelo bypass (caminho 1).

### Multi-tenant (compatibilidade com todas as empresas)

Cada empresa do white-label tem a **própria `api-key`**. A função resolve a chave nesta ordem:

1. `?company=<slug>` → env `SCOPE_API_KEY_<SLUG>` (servidor, **seguro**, sem segredo na URL).
2. env `SCOPE_API_KEY` (deploy single-tenant).
3. `?token=<api-key>` na URL (universal, funciona para qualquer empresa **sem** cadastro prévio,
   porém expõe a chave na URL — mitigado com remoção imediata da URL).

Para uma empresa nova: ou cadastre `SCOPE_API_KEY_<EMPRESA>` no Vercel (seguro), ou faça o CRM
injetar `?token=<chave-da-empresa>` no link (universal). Hoje a **Effects** está no modo seguro.

## Variáveis de ambiente

Veja [`.env.example`](.env.example). Já configuradas no Vercel (Production):

| Variável | Lado | Descrição |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend | URL do projeto Supabase (`https://ovnryyojvsfuvwjfxvkr.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Chave **publishable/anon** (`sb_publishable_…`, pública) |
| `SCOPE_API_KEY_EFFECTS` | Server | Chave da empresa Effects (multi-tenant, `?company=effects`) |
| `SCOPE_API_KEY` | Server | Chave única (deploy single-tenant) — não usado aqui |
| `SCOPE_API_BASE` | Server | Default `https://api.scopehub.com.br/api` |

> Segredos (chave da empresa, senha do banco, `service_role`) **nunca** vão para o frontend nem
> para o git — só como env var de servidor no Vercel. A `anon/publishable` é pública por design.

Sem `VITE_SUPABASE_*` o app roda em **modo demo** (dados mockados em memória).

## Banco (Supabase) — já provisionado

O schema em [`supabase/schema.sql`](supabase/schema.sql) **já foi aplicado** ao projeto
`ovnryyojvsfuvwjfxvkr` (tabelas `tickets`, `comments`, `attachments` + RLS + bucket `attachments`).
Para reaplicar/atualizar: SQL Editor do Supabase → cole o arquivo → Run.

> ⚠️ **Dívida de segurança (RLS):** as policies liberam `select/insert/update` para a role `anon`
> em todas as linhas (`using (true)`). Para isolamento real por empresa, mover as escritas para
> Vercel Functions com `service_role` e trocar as policies por regra baseada em claim de empresa.

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha as variáveis (vazio = modo demo)
npm run dev
```

## Deploy — já feito (CLI)

Já publicado. Para republicar após mudanças:

```bash
git push origin main                 # GitHub (scope-hub-mkt/Ticket-System)
vercel deploy --prod --yes           # Vercel (projeto ticket-system)
```

> `VITE_*` são embutidas no bundle em **build time** — após alterá-las no Vercel, **redeploy**.
> A função `api/crm/validate.ts` é publicada automaticamente em `/api/crm/validate`.

## Estrutura

```
api/crm/validate.ts      Vercel Function: valida a credencial da empresa contra o CRM Scope
src/app/lib/types.ts     Tipos de domínio
src/app/lib/supabase.ts  Cliente Supabase (null em modo demo)
src/app/lib/api.ts       Camada de dados (Supabase ou mock)
src/app/lib/auth.ts      Login manual (Supabase Auth / mock) — NÃO chama o CRM
src/app/lib/crmAuth.ts   Bypass de login via token do CRM na URL
src/app/lib/mockData.ts  Dados de demonstração
src/app/App.tsx          UI (login, dashboard, kanban, painel, modais)
supabase/schema.sql      Schema + RLS + bucket de anexos
```
