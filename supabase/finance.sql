-- ─── Finance (private) ──────────────────────────────────────────────────────
-- No login: every request must carry the finance key header (x-finance-key).
-- Only its SHA-256 hash is stored. Without the key these tables return nothing.

create extension if not exists pgcrypto with schema extensions;

create table if not exists fin_device_keys (key_hash text primary key, label text, created_at timestamptz default now());
alter table fin_device_keys enable row level security;   -- no policies: unreadable from the API

create or replace function fin_device_ok() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from fin_device_keys
    where key_hash = encode(extensions.digest(coalesce(current_setting('request.headers', true)::json ->> 'x-finance-key', ''), 'sha256'), 'hex')
  )
$$;

create table if not exists fin_accounts (
  id text primary key, name text not null, institution text, type text,       -- checking | savings | credit_card
  last4 text, scope text default 'personal',                                  -- personal | business
  excluded boolean default false, sort int default 0, notes text,
  created_at timestamptz default now()
);

create table if not exists fin_statements (
  id text primary key, account_id text references fin_accounts(id) on delete cascade,
  period_start date, period_end date, opening_balance numeric, closing_balance numeric,
  computed_closing numeric, status text default 'pending',                    -- reconciled | off | pending
  file_name text, imported_at timestamptz default now()
);

create table if not exists fin_transactions (
  id text primary key,                                                        -- stable hash of account+date+amount+description+n
  account_id text references fin_accounts(id) on delete cascade,
  date date not null, amount numeric not null,                                -- + money in, − money out
  description text, merchant text,
  kind text default 'expense',                                                -- income | expense | transfer | refund
  category text, scope text,                                                  -- personal | business
  status text default 'ok',                                                   -- ok | review
  review_reason text, transfer_id text, recurring_key text,
  statement_id text, source text, bank_category text, notes text,
  balance_after numeric,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists fin_tx_date on fin_transactions (date);
create index if not exists fin_tx_account on fin_transactions (account_id, date);

create table if not exists fin_rules (id text primary key, match text not null, category text, scope text, kind text, created_at timestamptz default now());
create table if not exists fin_budgets (id text primary key, category text not null, scope text, monthly numeric not null, created_at timestamptz default now());
create table if not exists fin_goals (id text primary key, name text not null, target numeric not null, account_id text, target_date date, start_amount numeric default 0, created_at timestamptz default now());
create table if not exists fin_meta (key text primary key, value jsonb, updated_at timestamptz default now());

do $$ declare t text; begin
  foreach t in array array['fin_accounts','fin_statements','fin_transactions','fin_rules','fin_budgets','fin_goals','fin_meta'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "finance key" on %I', t);
    execute format('create policy "finance key" on %I for all using (fin_device_ok()) with check (fin_device_ok())', t);
  end loop;
end $$;

insert into fin_device_keys (key_hash, label)
values ('a7208da68548e3aaf8e225c1271e10c7bbb3feaf910e127d5033062e83e88b8e', 'Royanna')
on conflict do nothing;

-- 2026-10-16: commission accounting (splits = [{part, amount, agent, deal_ref}])
alter table fin_transactions add column if not exists splits jsonb;
alter table fin_transactions add column if not exists counterparty text;
alter table fin_transactions add column if not exists deal_ref text;
