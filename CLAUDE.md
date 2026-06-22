# CLAUDE.md — Ticket System for CRM (Scope Hub)

Guidance for the next AI/dev picking up this project. Read this first.

## TL;DR — current state (QA round 2, 2026-06-22)

- Frontend builds clean (`npm run build` → exit 0). UI is complete.
- **Auth bridge verified LIVE.** With the company key set server-side as `SCOPE_API_KEY_EFFECTS`, `api/crm/validate.ts` probes `GET https://api.scopehub.com.br/api/contact` and the **real Effects key returns HTTP 200** (no key → 401). The "Ei CRM, essa credencial é verdadeira?" requirement works — at **company** level (the CRM has no per-user password endpoint; see gotcha).
- **Ticket storage decision:** the CRM's own `/api/ticket` is a **WhatsApp/conversation inbox** (contact+channel+queue+messages), NOT a support-ticket store. Support tickets therefore persist in **Supabase**, not the CRM. The CRM key is for auth only.
- **Deploy:** GitHub (`scope-hub-mkt`) and Vercel CLIs are authenticated on the dev machine. Stage 1 = deploy auth-working build to Vercel (`SCOPE_API_KEY_EFFECTS` only). Stage 2 = add `VITE_SUPABASE_*` + run `schema.sql` for real ticket persistence.
- Without `VITE_SUPABASE_*` the app still runs (demo mode, tickets in-memory); the **live CRM auth works regardless** of Supabase.

## What this app is

Internal ticket portal (support + suggestions) for the Scope Hub white-label CRM. Logged-in CRM users open this app to create/track tickets on a Kanban board. Two roles: `client` (sees own tickets) and `admin` (sees all + can change ticket stage).

Stack: React 18 + TypeScript + Vite 6 + Tailwind 4 (frontend) · Supabase (data) · Vercel Functions (the CRM-auth bridge).

## Run / build

```bash
npm install
npm run dev      # vite dev server
npm run build    # vite build → dist/   (this is all Vercel runs; NOTE: no tsc, type errors do NOT fail the build)
```

There is no test suite and no lint script. `build` script = `vite build` only.

## Architecture / where things are

```
api/crm/validate.ts      Vercel Function: "Hey CRM, is this api-key real?" — probes GET {SCOPE_API_BASE}/contact with header api-key; 2xx=valid, anything else=invalid (allowlist). NEVER returns the key to the client.
src/main.tsx             React entry
src/app/App.tsx          ALL UI in one file (~846 lines): LoginScreen, CreateTicketModal, TicketDetailModal, KanbanBoard, PanelView, App. State is local useState; no global store.
src/app/lib/types.ts     Domain types (UserAccount, Ticket, TicketComment, Attachment, enums)
src/app/lib/supabase.ts  Supabase client — is `null` when VITE_SUPABASE_* env is absent (that null is the "demo mode" switch)
src/app/lib/api.ts        Data layer. If supabase==null → returns mock + writes are NO-OP. Else → real Supabase reads/writes.
src/app/lib/auth.ts       Manual login (loginWithPassword): Supabase Auth if configured, else MOCK_USERS. *** Does NOT call the CRM. ***
src/app/lib/crmAuth.ts    Login bypass via ?token=<api-key>&company=&name=&email=&role= in URL → POST /api/crm/validate → creates sessionStorage session, strips token from URL.
src/app/lib/mockData.ts   Demo users + seed tickets (used only in demo mode)
supabase/schema.sql       Tables (tickets/comments/attachments) + RLS + attachments bucket
vercel.json               framework=vite, SPA rewrites (everything except /api → index.html)
.env.example              Env var reference
```

`vite.config.ts`: `@` aliases `src/`, plus a `figma:asset/` resolver and a custom Tailwind plugin — leave both plugins in place.

## Auth model gotcha (READ THIS — it's the main misunderstanding)

The task asked: "the user logs in with CRM credentials and the CRM confirms they're real." **The Scope CRM does not support that.** Verified live:

- The CRM API (`https://api.scopehub.com.br/api`) authenticates with a **company-level `api-key` header**, not per-user email/password.
- `GET /api/contact` → 401 with no/invalid key (this is what `validate.ts` relies on — correct).
- `POST /api/auth/login` → **404**. There is no user-credential login endpoint to validate an email/password against.

Consequences:
1. `api/crm/validate.ts` validates an **api-key**, NOT a user's email+password. Those are different things.
2. `loginWithPassword` (the manual login form) validates email/password against **Supabase Auth**, never the CRM. So provisioning users must happen in Supabase.
3. The provided test account (`contato@effectscursos.com.br / Effects2025&`) cannot be validated "by the CRM" with the current API — and in demo mode it isn't in `MOCK_USERS`, so login just fails.

**Decide the real model before building more:** (a) bypass via CRM-issued URL token (requires the CRM itself be configured to open this app with the token — out of this repo), or (b) provision users in Supabase Auth and accept login validates there.

## Tickets never reach the CRM

`api.ts` writes tickets to **Supabase**, not the CRM. There is no integration that POSTs tickets to the Scope CRM. "Create ticket → 200 from CRM" does not exist. In demo mode (default) writes are no-ops, so there's no 200 at all.

## Environment variables

| Var | Side | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend | Supabase project URL. Absent → demo mode. |
| `VITE_SUPABASE_ANON_KEY` | frontend | Supabase anon (public) key. |
| `SCOPE_API_KEY` | server | Single-tenant CRM company key. |
| `SCOPE_API_KEY_<COMPANY>` | server | Multi-tenant; resolved from `?company=<slug>` (slug → UPPER, non-alnum→`_`). |
| `SCOPE_API_BASE` | server | Optional. Default `https://api.scopehub.com.br/api`. |

No `.env.local` exists yet — only `.env.example`. `.gitignore` excludes `.env*` and `node_modules`/`dist`/`.vercel`.

## Known issues / security debt

- **Secret in URL:** default bypass passes the company `api-key` as `?token=` → leaks a company-wide secret into history/referer/logs. Prefer server-side `SCOPE_API_KEY[_<company>]` + only `?company=` in the URL.
- **Privilege escalation:** bypass trusts `role`/`email`/`name` from the URL unverified → anyone with the key can set `role=admin`.
- **RLS wide open:** `schema.sql` grants `anon` select/insert/update on ALL rows (`using (true)`) → any client with the anon key reads/edits every company's tickets. Must be tightened (per-company JWT claim) before production.
- **Attachments:** stored as in-browser `blob:` URLs (`URL.createObjectURL`); not persisted. Storage bucket exists in schema but isn't wired up.
- Build skips type-checking; run `npx tsc --noEmit` manually if you want type safety.

## Path to "live and ready" (ordered)

1. Decide the real auth model (see gotcha above).
2. Provision Supabase: run `schema.sql`, **harden RLS**, set `VITE_SUPABASE_*`.
3. Set `SCOPE_API_KEY` server-side (not in URL); verify a real key returns 2xx on `/contact`.
4. Create + `git push` the repo `scope-hub-mkt/Ticket-System` (currently 404).
5. Import into Vercel, set env vars, then test the 200s end-to-end with the real account.

Do NOT deploy to the Scope Hub Vercel/Supabase production accounts without explicit confirmation and access.
