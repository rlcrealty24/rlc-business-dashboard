-- ═══ Phase 3: Content Library + Campaign Builder ═══════════════════════════
-- Run once in Supabase → SQL Editor. Safe to re-run.

create table if not exists content_assets (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  url         text,                       -- iCloud / Drive / Dropbox share link (files stay where they are)
  kind        text not null default 'photo',
  brand       text,                       -- personal | rlc | leasing
  market      text,                       -- Miami | Denver | other
  property    text,                       -- public apartment / property name (never the private building name)
  campaign_id uuid references content_campaigns(id) on delete set null,
  tags        text[] not null default '{}',
  notes       text,
  taken_on    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table content_campaigns add column if not exists config jsonb not null default '{}'::jsonb;

alter table content_assets enable row level security;
drop policy if exists "dashboard access" on content_assets;
create policy "dashboard access" on content_assets for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table content_assets;
exception when duplicate_object then null; end $$;
