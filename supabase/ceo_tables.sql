-- CEO Command Center tables for the personal dashboard's Supabase project.
-- Run once in the SQL Editor. Safe to re-run.
--
-- RLC portal data (appointments, showings, deal deadlines, brokerage events)
-- is NOT copied here — the dashboard reads it live from the portal.

create table if not exists ceo_blocks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text not null default 'business',
  kind         text not null default 'block',        -- block | date
  date_type    text,                                 -- birthday | marketing | event | deadline | campaign
  start_date   date not null,
  until_date   date,
  all_day      boolean not null default false,
  start_time   time,
  end_time     time,
  recurrence   jsonb not null default '{"freq":"none"}'::jsonb,
  description  text,
  checklist    jsonb not null default '[]'::jsonb,
  rotation     text[],
  reminders    int[] not null default '{10}',        -- minutes before (10080 = 1 week)
  location     text,
  meeting_url  text,
  link         text,
  unconfirmed  boolean not null default false,
  protected    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists ceo_occurrences (
  id         uuid primary key default gen_random_uuid(),
  block_id   uuid not null references ceo_blocks(id) on delete cascade,
  occ_date   date not null,
  checked    text[] not null default '{}',
  status     text not null default 'open',          -- open | done | skipped
  new_date   date,
  new_start  time,
  new_end    time,
  note       text,
  updated_at timestamptz not null default now(),
  unique (block_id, occ_date)
);

create table if not exists ceo_tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  notes          text,
  priority       text,                               -- high | medium | low
  status         text not null default 'inbox',      -- inbox | next | done
  category       text,
  due_date       date,
  scheduled_date date,
  scheduled_time time,
  duration_min   int not null default 30,
  focus_date     date,                               -- pinned to that day's Top 3
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);

-- Same access model as dashboard_data (this dashboard has no login)
alter table ceo_blocks      enable row level security;
alter table ceo_occurrences enable row level security;
alter table ceo_tasks       enable row level security;

drop policy if exists "dashboard access" on ceo_blocks;
create policy "dashboard access" on ceo_blocks for all using (true) with check (true);
drop policy if exists "dashboard access" on ceo_occurrences;
create policy "dashboard access" on ceo_occurrences for all using (true) with check (true);
drop policy if exists "dashboard access" on ceo_tasks;
create policy "dashboard access" on ceo_tasks for all using (true) with check (true);

-- Live updates across devices
do $$ begin
  alter publication supabase_realtime add table ceo_blocks, ceo_occurrences, ceo_tasks;
exception when duplicate_object then null; end $$;
