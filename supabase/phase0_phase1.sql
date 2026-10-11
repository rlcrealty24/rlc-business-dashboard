-- ═══ Social Media HQ tables + keep-alive + reminders-skill access ═══════════════
-- Run once in Supabase → SQL Editor. Safe to re-run.

-- ── Social Media HQ tables ──────────────────────────────────────────────────
create table if not exists content_campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  brand         text not null default 'leasing',         -- personal | rlc | leasing
  type          text,                                    -- apartments | listing | recruiting | announcement | seasonal | other
  status        text not null default 'proposed',        -- proposed | active | paused | done
  start_date    date,
  duration_days int,
  goal          text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists content_items (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  brand                text not null default 'personal',  -- personal | rlc | leasing
  platforms            text[] not null default '{instagram}',
  stage                text not null default 'idea',      -- idea → planned → gathering → ready_to_film → filmed → editing → review → approved → scheduled → published → reviewed
  format               text,                              -- talking_reel | lifestyle_reel | apartment_tour | carousel | transaction_story | recap_carousel | announcement | photo | story
  pillar               text,
  objective            text,
  priority             text not null default 'medium',
  publish_date         date,
  publish_time         time,
  campaign_id          uuid references content_campaigns(id) on delete set null,
  agent_name           text,
  agent_ref            text,                              -- portal profile id (read-only link)
  collab_with          text[],
  hook text, script text, caption text, cta text, hashtags text, on_screen_text text,
  shot_list text, edit_notes text, cover_concept text, notes text,
  steps                jsonb not null default '[]'::jsonb, -- production steps with dates + checklist items
  versions             jsonb not null default '{}'::jsonb, -- per platform: caption, status, url, published_at, metrics
  assets               jsonb not null default '[]'::jsonb, -- links (iCloud / Drive / etc.)
  approval             text not null default 'draft',     -- draft | needs_review | approved
  permission_confirmed boolean not null default false,
  is_backlog           boolean not null default false,
  timeliness           text,                              -- timely | evergreen | expiring
  lead_potential       text,                              -- low | medium | high
  effort               text,                              -- light | medium | heavy
  audience             text,
  source               text,                              -- idea | seed | backlog | campaign | duplicate
  source_ref           text,                              -- e.g. portal deal id(s)
  metrics              jsonb not null default '{}'::jsonb,
  archived             boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists content_items_publish_idx on content_items (publish_date);

-- ── Access: same open model as the rest of the dashboard (no login, by choice) ──
alter table content_items     enable row level security;
alter table content_campaigns enable row level security;
drop policy if exists "dashboard access" on content_items;
create policy "dashboard access" on content_items for all using (true) with check (true);
drop policy if exists "dashboard access" on content_campaigns;
create policy "dashboard access" on content_campaigns for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table content_items, content_campaigns;
exception when duplicate_object then null; end $$;

-- ── Keep-alive (daily ping from Vercel so the free tier doesn't pause) ──────
create or replace function keepalive() returns int language sql security definer set search_path = public
as $$ select 1 $$;
grant execute on function keepalive() to anon;

-- ── "Remind me" skill access from any Claude Code project (key stays on your Mac) ──
create table if not exists ceo_api_tokens (token_hash text primary key, label text, created_at timestamptz default now());
alter table ceo_api_tokens enable row level security;   -- no policies: unreadable from the API
insert into ceo_api_tokens (token_hash, label) values ('f44006c5c692cf1eb9f3c53b825433c199f974d606b1766af5cb22615f554495', 'claude-code reminders skill')
  on conflict do nothing;

create or replace function ceo_skill(p_token text, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not exists (select 1 from ceo_api_tokens where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')) then
    raise exception 'not authorized';
  end if;
  if p_action = 'add_task' then
    insert into ceo_tasks select * from jsonb_populate_record(null::ceo_tasks,
      jsonb_build_object('id', gen_random_uuid(), 'status', 'inbox', 'duration_min', 30, 'created_at', now()) || p_payload)
      returning to_jsonb(ceo_tasks.*) into v;
  elsif p_action = 'add_date' then
    insert into ceo_blocks select * from jsonb_populate_record(null::ceo_blocks,
      jsonb_build_object('id', gen_random_uuid(), 'category', 'dates', 'kind', 'date', 'all_day', true,
        'recurrence', '{"freq":"none"}'::jsonb, 'checklist', '[]'::jsonb, 'reminders', '[10080]'::jsonb,
        'unconfirmed', false, 'protected', false, 'created_at', now(), 'updated_at', now()) || p_payload)
      returning to_jsonb(ceo_blocks.*) into v;
  elsif p_action = 'list_tasks' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb) into v
      from (select title, status, priority, due_date, scheduled_date, focus_date, created_at from ceo_tasks
            where coalesce((p_payload->>'all')::boolean, false) or status <> 'done'
            order by created_at desc limit 40) t;
  else
    raise exception 'unknown action %', p_action;
  end if;
  return v;
end $$;
grant execute on function ceo_skill(text, text, jsonb) to anon;
