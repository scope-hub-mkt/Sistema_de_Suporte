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
1. `api/crm/validate.ts` validates the **company api-key** (proven 200 with the real Effects key), NOT a user's email+password. Those are different things.
2. `loginWithPassword` (the manual login form) validates email/password against **Supabase Auth**, never the CRM. So the manual fallback only works for users provisioned in Supabase Auth.
3. The test account (`contato@effectscursos.com.br / Effects2025&`) cannot be validated "by the CRM" (no user-login endpoint). It authenticates via the **bypass** (caminho A): the CRM opens the app with `?company=effects&name=&email=&role=`, the company is validated, and the session is created with that identity.

**Decision made:** model (a) — **auto-login bypass via the CRM-issued URL** is the primary path (seamless, no login screen). Manual login (b) is a degraded fallback that only validates against Supabase Auth, so prefer always opening from inside the CRM. The CRM must inject the logged-in user's `name/email/role` into the link.

## Where tickets live (by design)

`api.ts` writes tickets to **Supabase**, NOT the CRM — on purpose. The CRM's own `/api/ticket` is a **WhatsApp/conversation inbox** (contact+channel+queue+messages), not a support-ticket store; pushing support items there would spam real conversations. The CRM `api-key` is used **only for the auth bridge**. Real 200s verified against Supabase (insert `201`, comment `201`, update `204`, read `200`).

## Live deployment

- **App (prod):** https://ticket-system-swart-two.vercel.app — Vercel project `ticket-system` (org `aikolopes-4274s-projects`), deployed via CLI (the private repo isn't git-connected to Vercel; redeploy with `vercel deploy --prod`).
- **Repo:** `scope-hub-mkt/Ticket-System` (private). `gh` is authed as `scope-hub-mkt`; push with `git push origin main`.
- **Supabase:** project `ovnryyojvsfuvwjfxvkr` (`https://ovnryyojvsfuvwjfxvkr.supabase.co`). Schema applied. Uses the new `sb_publishable_…` key as the anon key (works with supabase-js v2.45 — verified live).

## Environment variables (set in Vercel → Production)

| Var | Side | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend | Supabase project URL. Absent → demo mode. |
| `VITE_SUPABASE_ANON_KEY` | frontend | Supabase **publishable/anon** key (`sb_publishable_…`, public). |
| `SCOPE_API_KEY_EFFECTS` | server | Effects company key; resolved from `?company=effects`. |
| `SCOPE_API_KEY` | server | Single-tenant key (unused here). |
| `SCOPE_API_KEY_<COMPANY>` | server | Multi-tenant; slug → UPPER, non-alnum→`_`. |
| `SCOPE_API_BASE` | server | Optional. Default `https://api.scopehub.com.br/api`. |

`.env.local` exists locally (gitignored) with the Effects key for `vercel dev`. `.gitignore` excludes `.env*`, `node_modules`, `dist`, `.vercel`. Note: `VITE_*` are baked in at **build time** → change them in Vercel, then **redeploy**.

## Known issues / security debt (still open)

- **Privilege escalation:** bypass trusts `role`/`email`/`name` from the URL unverified → anyone with the link/key can set `role=admin`. Acceptable only because the link is opened from inside the CRM; tighten if exposed.
- **RLS wide open:** `schema.sql` grants `anon` select/insert/update on ALL rows (`using (true)`) → any client with the anon key reads/edits **every company's** tickets. For real multi-tenant isolation, route writes through a Vercel Function using `service_role` and scope by a per-company claim.
- **Secret-in-URL (only if using token mode):** `?token=<api-key>` leaks the company key into history/referer. Effects uses the server-side `SCOPE_API_KEY_EFFECTS` path instead (no secret in URL).
- **Attachments:** stored as in-browser `blob:` URLs; not persisted. Storage bucket exists in schema but isn't wired up.
- Build skips type-checking; run `npx tsc --noEmit` for type safety.

## What's done vs. remaining

Done: GitHub repo + push ✅ · Vercel prod deploy ✅ · live CRM auth bridge (200) ✅ · Supabase schema + real CRUD 200s ✅ · multi-tenant resolution (Effects configured) ✅.

Remaining (hardening, not blockers): harden RLS for true per-company isolation · provision Supabase Auth users if manual login is needed · wire attachment Storage uploads · onboard more companies (add `SCOPE_API_KEY_<COMPANY>` or use `?token=`) · ensure the CRM injects the bypass URL with the logged-in user's `name/email/role`.
