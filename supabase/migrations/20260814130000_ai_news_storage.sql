-- 每日动态：上游 AI 资讯的私有原始备份 + 公开投影，参照 x_sync_items / x_curation_items 的双表模式。

create table if not exists public.ai_news_items (
  id text primary key,
  feeds text[] not null default '{}',
  raw_payload jsonb not null,
  published_at timestamptz,
  synced_at timestamptz not null default now()
);

alter table public.ai_news_items enable row level security;
revoke all on table public.ai_news_items from anon, authenticated;
grant all on table public.ai_news_items to service_role;

create table if not exists public.ai_news_public_items (
  id text primary key,
  content jsonb not null,
  selected boolean not null default false,
  published_at timestamptz,
  synced_at timestamptz not null default now()
);

alter table public.ai_news_public_items enable row level security;
grant select on table public.ai_news_public_items to anon, authenticated;
grant all on table public.ai_news_public_items to service_role;

drop policy if exists "每日动态可读取" on public.ai_news_public_items;

create policy "每日动态可读取"
  on public.ai_news_public_items
  for select
  to anon, authenticated
  using (true);

create index if not exists ai_news_public_items_published_at_idx
  on public.ai_news_public_items (published_at desc nulls last);

create index if not exists ai_news_public_items_selected_idx
  on public.ai_news_public_items (selected)
  where selected;
