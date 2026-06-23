-- ════════════════════════════════════════════════════════════════════════════
--  Ticket System for CRM — Supabase schema
--  Cole este arquivo inteiro no Supabase Dashboard → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Tabelas ────────────────────────────────────────────────────────────────

create table if not exists public.tickets (
  id           text primary key,
  title        text not null,
  description  text,
  category     text not null,
  type         text not null check (type in ('suporte','sugestao')),
  stage        text not null default 'Projeção'
               check (stage in ('Projeção','Em Progresso','Validação','Resolvido')),
  author       text not null,
  author_email text not null,
  company      text not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.comments (
  id          text primary key,
  ticket_id   text not null references public.tickets(id) on delete cascade,
  author      text not null,
  author_role text not null check (author_role in ('client','admin')),
  text        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.attachments (
  id         text primary key,
  ticket_id  text not null references public.tickets(id) on delete cascade,
  name       text not null,
  url        text not null,
  mime_type  text
);

-- Log de atividades do ticket. "Criado" e "respondido" são derivados das tabelas
-- tickets/comments (já são dados reais); aqui guardamos os eventos que não têm
-- outro lar — hoje, as MUDANÇAS DE ETAPA (quem moveu, de → para, quando).
create table if not exists public.ticket_activity (
  id          text primary key,
  ticket_id   text not null references public.tickets(id) on delete cascade,
  kind        text not null default 'stage_changed'
              check (kind in ('created','stage_changed','comment','reopened')),
  actor       text not null,
  from_stage  text,
  to_stage    text,
  detail      text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_comments_ticket on public.comments(ticket_id);
create index if not exists idx_attachments_ticket on public.attachments(ticket_id);
create index if not exists idx_tickets_email on public.tickets(author_email);
create index if not exists idx_activity_ticket on public.ticket_activity(ticket_id);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- MVP: o app é acessado atrás do CRM (token na URL) e usa a chave ANON.
-- Liberamos leitura/escrita para a role anon. A separação client/admin é feita
-- na aplicação. PRODUÇÃO: para isolamento real por empresa, mova as escritas
-- para Vercel Functions usando a service_role e troque estas policies por
-- regras baseadas no JWT/claim de empresa.

alter table public.tickets         enable row level security;
alter table public.comments        enable row level security;
alter table public.attachments     enable row level security;
alter table public.ticket_activity enable row level security;

drop policy if exists "anon read tickets"   on public.tickets;
drop policy if exists "anon write tickets"  on public.tickets;
drop policy if exists "anon update tickets" on public.tickets;
create policy "anon read tickets"   on public.tickets for select using (true);
create policy "anon write tickets"  on public.tickets for insert with check (true);
create policy "anon update tickets" on public.tickets for update using (true) with check (true);

drop policy if exists "anon read comments"  on public.comments;
drop policy if exists "anon write comments" on public.comments;
create policy "anon read comments"  on public.comments for select using (true);
create policy "anon write comments" on public.comments for insert with check (true);

drop policy if exists "anon read attachments"  on public.attachments;
drop policy if exists "anon write attachments" on public.attachments;
create policy "anon read attachments"  on public.attachments for select using (true);
create policy "anon write attachments" on public.attachments for insert with check (true);

drop policy if exists "anon read activity"  on public.ticket_activity;
drop policy if exists "anon write activity" on public.ticket_activity;
create policy "anon read activity"  on public.ticket_activity for select using (true);
create policy "anon write activity" on public.ticket_activity for insert with check (true);

-- ─── Storage para anexos (fase seguinte) ─────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;
