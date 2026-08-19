-- 项目档案公开投影：一项目一行，保证同一项目的能力、实验、决策与实践原子发布。
-- 原始 Codex/Git/文档证据和待审草稿只保存在本机，不进入 Supabase。

create table if not exists public.project_public_snapshots (
  project_id text primary key,
  slug text not null unique,
  title text not null,
  summary text not null,
  status text not null,
  period text not null,
  display_order integer not null default 100,
  source_observed_at timestamptz,
  published_at timestamptz not null,
  revision text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  synced_at timestamptz not null default now()
);

alter table public.project_public_snapshots enable row level security;
revoke all on table public.project_public_snapshots from anon, authenticated;
grant select on table public.project_public_snapshots to anon, authenticated;
grant select, insert, update, delete on table public.project_public_snapshots to service_role;

drop policy if exists "公开项目快照可读取" on public.project_public_snapshots;

create policy "公开项目快照可读取"
  on public.project_public_snapshots
  for select
  to anon, authenticated
  using (true);

create index if not exists project_public_snapshots_order_idx
  on public.project_public_snapshots (display_order, published_at desc);
