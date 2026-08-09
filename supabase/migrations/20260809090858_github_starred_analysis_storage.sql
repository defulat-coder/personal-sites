-- GitHub Star 原始资料、中文阅读版与站点公开投影。
-- public schema 属于 Data API 暴露面；私有表只允许 service_role 访问，绝不配置读取策略。

create table if not exists public.github_starred_sources (
  repo_node_id text primary key,
  full_name text not null unique,
  repository_url text not null,
  starred_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  source_kind text not null check (source_kind in ('readme', 'repository')),
  source_markdown text not null,
  reading_markdown text,
  source_structure jsonb,
  source_sha256 text not null,
  source_truncated boolean not null default false,
  source_fetched_at timestamptz not null,
  synced_at timestamptz not null default now()
);

alter table public.github_starred_sources enable row level security;
revoke all on table public.github_starred_sources from anon, authenticated;
grant all on table public.github_starred_sources to service_role;

create table if not exists public.github_starred_analyses (
  repo_node_id text primary key references public.github_starred_sources(repo_node_id) on delete cascade,
  source_sha256 text not null,
  language text not null check (language = 'zh-CN'),
  content_markdown text not null,
  model_provider text not null,
  model_name text not null,
  parser_version text not null,
  analysis_metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null,
  synced_at timestamptz not null default now()
);

alter table public.github_starred_analyses enable row level security;
revoke all on table public.github_starred_analyses from anon, authenticated;
grant all on table public.github_starred_analyses to service_role;

-- 编辑层和同步层分离：同步任务绝不能覆盖 visibility、标签和个人判断。
create table if not exists public.github_starred_curation (
  repo_node_id text primary key references public.github_starred_sources(repo_node_id) on delete cascade,
  visibility text not null default 'draft' check (visibility in ('draft', 'published', 'archived')),
  category text,
  dimensions text[] not null default '{}',
  type text,
  status text,
  personal_note text,
  judgement text,
  next_step text,
  scenarios jsonb not null default '[]'::jsonb,
  caveats jsonb not null default '[]'::jsonb,
  workflow jsonb not null default '[]'::jsonb,
  display_rank integer,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.github_starred_curation enable row level security;
revoke all on table public.github_starred_curation from anon, authenticated;
grant all on table public.github_starred_curation to service_role;

-- 网站只读取这一张公开投影表。它只承载 visibility = published 的记录。
create table if not exists public.github_open_source_items (
  repo_node_id text primary key references public.github_starred_sources(repo_node_id) on delete cascade,
  slug text not null unique,
  content jsonb not null,
  published_at timestamptz not null,
  synced_at timestamptz not null default now()
);

alter table public.github_open_source_items enable row level security;
grant select on table public.github_open_source_items to anon, authenticated;
grant all on table public.github_open_source_items to service_role;

drop policy if exists "公开开源关注可读取" on public.github_open_source_items;

create policy "公开开源关注可读取"
  on public.github_open_source_items
  for select
  to anon, authenticated
  using (true);

create index if not exists github_starred_sources_full_name_idx
  on public.github_starred_sources (full_name);

create index if not exists github_starred_curation_visibility_rank_idx
  on public.github_starred_curation (visibility, display_rank nulls last);

create index if not exists github_open_source_items_published_at_idx
  on public.github_open_source_items (published_at desc);
