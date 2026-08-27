-- Supabase 只保留每日动态；其余公开内容已经迁移为本地 SQLite 投影。

drop function if exists public.search_ask_documents(text, text, integer);
drop function if exists public.sync_ask_search_documents(text, jsonb, boolean);
drop function if exists public.delete_ask_search_documents(text, text[]);

drop table if exists public.ask_search_documents;

drop table if exists public.github_open_source_items;
drop table if exists public.github_starred_curation;
drop table if exists public.github_starred_analyses;
drop table if exists public.github_starred_sources;

drop table if exists public.x_curation_items;
drop table if exists public.x_sync_items;

drop table if exists public.project_public_snapshots;

drop extension if exists pgroonga;
