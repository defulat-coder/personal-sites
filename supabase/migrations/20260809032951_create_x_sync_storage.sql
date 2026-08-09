create table if not exists public.x_sync_items (
  id text primary key,
  fetch_sources text[] not null default '{}',
  raw_payload jsonb not null,
  generated_payload jsonb,
  generated_at timestamptz,
  synced_at timestamptz not null default now()
);

alter table public.x_sync_items enable row level security;
revoke all on table public.x_sync_items from anon, authenticated;
grant all on table public.x_sync_items to service_role;

create table if not exists public.x_curation_items (
  id text primary key,
  content jsonb not null,
  published_at timestamptz,
  synced_at timestamptz not null default now()
);

alter table public.x_curation_items enable row level security;
grant select on table public.x_curation_items to anon, authenticated;
grant all on table public.x_curation_items to service_role;

drop policy if exists "公开策展可读取" on public.x_curation_items;

create policy "公开策展可读取"
  on public.x_curation_items
  for select
  to anon, authenticated
  using (true);

create index if not exists x_curation_items_published_at_idx
  on public.x_curation_items (published_at desc nulls last);
