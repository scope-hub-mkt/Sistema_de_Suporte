# Ticket System for CRM — Scope Hub

Portal de tickets (suporte + sugestões) integrado ao CRM white-label da **Scope Hub**.
Frontend React + Vite + Tailwind, backend **Supabase** (dados) e **Vercel Functions**
(ponte de autenticação com o CRM).

## Como funciona a autenticação

Dois caminhos, nesta ordem:

1. **Bypass via token do CRM (principal).** Quando o usuário, já logado no CRM, clica
   em "criar ticket", o CRM abre este app com o token na URL:

   ```
   https://<app>.vercel.app/?token=<API_KEY_DA_EMPRESA>&company=<slug>&name=Fulano&email=fulano@empresa.com&role=client
   ```

   O app envia esse token para `POST /api/crm/validate`, que pergunta ao CRM
   *"essas credenciais são verdadeiras?"* sondando `GET https://api.scopehub.com.br/api/contact`
   com o header `api-key`. Se o CRM **não** responder `401/403`, a credencial é válida,
   a sessão é criada e o token é removido da URL. Login: ignorado (bypass).

2. **Login manual (fallback).** Sem token na URL, mostra a tela de login. As credenciais
   são verificadas via **Supabase Auth** (mesmas credenciais do CRM Scope, se provisionadas lá).

> ⚠️ **Segurança:** passar a `api-key` da empresa na URL é a opção mais simples (MVP white-label),
> porém a chave é um segredo. O recomendado é configurá-la **server-side** como variável de
> ambiente (`SCOPE_API_KEY` ou `SCOPE_API_KEY_<EMPRESA>`) e passar na URL apenas um `?company=<slug>`
> + dados do usuário. A função `/api/crm/validate` já suporta essa ordem de resolução e **nunca**
> devolve a chave ao cliente.

## Variáveis de ambiente

Veja [`.env.example`](.env.example). No Vercel (Project → Settings → Environment Variables):

| Variável | Onde | Descrição |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Chave **anon** (pública) do Supabase |
| `SCOPE_API_KEY` | Server | Chave da empresa (deploy single-tenant) |
| `SCOPE_API_KEY_<EMPRESA>` | Server | Chave por empresa (multi-tenant, `?company=`) |
| `SCOPE_API_BASE` | Server | Opcional. Default `https://api.scopehub.com.br/api` |

Sem `VITE_SUPABASE_*` o app roda em **modo demo** (dados mockados em memória).

## Setup do banco (Supabase)

1. Crie um projeto na org **Scope Company** do Supabase.
2. SQL Editor → cole e rode [`supabase/schema.sql`](supabase/schema.sql).
3. Settings → API → copie **Project URL** e **anon key** para as env vars do Vercel.

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha as variáveis (opcional p/ modo demo)
npm run dev
```

## Deploy

1. **GitHub:** push para `scope-hub-mkt/Ticket-System`.
2. **Vercel:** Dashboard → New Project → Import `scope-hub-mkt/Ticket-System`
   (framework detectado: Vite). Adicione as env vars acima → Deploy.
3. A função `api/crm/validate.ts` é publicada automaticamente em `/api/crm/validate`.

## Estrutura

```
api/crm/validate.ts      Vercel Function: valida credencial contra o CRM Scope
src/app/lib/types.ts     Tipos de domínio
src/app/lib/supabase.ts  Cliente Supabase (null em modo demo)
src/app/lib/api.ts       Camada de dados (Supabase ou mock)
src/app/lib/auth.ts      Login manual (Supabase Auth / mock)
src/app/lib/crmAuth.ts   Bypass de login via token do CRM
src/app/lib/mockData.ts  Dados de demonstração
src/app/App.tsx          UI (login, dashboard, kanban, painel, modais)
supabase/schema.sql      Schema + RLS + bucket de anexos
```
