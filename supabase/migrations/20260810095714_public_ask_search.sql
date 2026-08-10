-- The public Q&A search corpus contains only the two existing public projections.
-- It is intentionally not exposed to the browser: the route handler retrieves and
-- supplies citations to Pi on the server.
create extension if not exists pgroonga with schema extensions;

create table if not exists public.ask_search_documents (
  id text primary key,
  source_scope text not null check (source_scope in ('daily', 'open-source')),
  source_id text not null,
  title text not null,
  section text,
  source_url text not null,
  published_at timestamptz,
  content text not null,
  search_text text not null,
  updated_at timestamptz not null default now()
);

alter table public.ask_search_documents enable row level security;
revoke all on table public.ask_search_documents from public, anon, authenticated;
grant all on table public.ask_search_documents to service_role;

-- Keep the primary key in the index: PGroonga then provides a useful relevance
-- score through pgroonga_score(tableoid, ctid).
create index if not exists ask_search_documents_search_idx
  on public.ask_search_documents using pgroonga (id, search_text);

create index if not exists ask_search_documents_scope_published_idx
  on public.ask_search_documents (source_scope, published_at desc nulls last);

-- Publishers upsert only the records in their current batch. A full rebuild
-- deliberately opts into scope replacement, while a withdrawal is deleted by
-- its stable source id so an unrelated README cannot disappear.
create or replace function public.sync_ask_search_documents(
  p_scope text,
  p_documents jsonb,
  p_replace_scope boolean default false
)
returns integer
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  document_count integer;
begin
  if p_scope not in ('daily', 'open-source') then
    raise exception 'Unsupported Q&A search scope: %', p_scope;
  end if;

  if jsonb_typeof(p_documents) <> 'array' then
    raise exception 'Q&A search documents must be a JSON array';
  end if;

  with incoming as (
    select *
    from jsonb_to_recordset(p_documents) as document(
      id text,
      source_scope text,
      source_id text,
      title text,
      section text,
      source_url text,
      published_at timestamptz,
      content text,
      search_text text
    )
  )
  insert into public.ask_search_documents (
    id, source_scope, source_id, title, section, source_url, published_at, content, search_text, updated_at
  )
  select
    id, source_scope, source_id, title, section, source_url, published_at, content, search_text, now()
  from incoming
  where source_scope = p_scope
  on conflict (id) do update set
    source_scope = excluded.source_scope,
    source_id = excluded.source_id,
    title = excluded.title,
    section = excluded.section,
    source_url = excluded.source_url,
    published_at = excluded.published_at,
    content = excluded.content,
    search_text = excluded.search_text,
    updated_at = now();

  if p_replace_scope then
    delete from public.ask_search_documents as persisted
    where persisted.source_scope = p_scope
      and not exists (
        select 1
        from jsonb_to_recordset(p_documents) as document(id text, source_scope text)
        where document.source_scope = p_scope
          and document.id = persisted.id
      );
  end if;

  select count(*) into document_count
  from jsonb_to_recordset(p_documents) as document(source_scope text)
  where document.source_scope = p_scope;

  return document_count;
end;
$$;

create or replace function public.delete_ask_search_documents(
  p_scope text,
  p_source_ids text[]
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if p_scope not in ('daily', 'open-source') then
    raise exception 'Unsupported Q&A search scope: %', p_scope;
  end if;

  delete from public.ask_search_documents
  where source_scope = p_scope
    and source_id = any(coalesce(p_source_ids, array[]::text[]));
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.search_ask_documents(
  p_query text,
  p_scope text default null,
  p_limit integer default 8
)
returns table (
  id text,
  source_scope text,
  source_id text,
  title text,
  section text,
  source_url text,
  published_at timestamptz,
  content text,
  score double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    document.id,
    document.source_scope,
    document.source_id,
    document.title,
    document.section,
    document.source_url,
    document.published_at,
    document.content,
    pgroonga_score(document.tableoid, document.ctid) as score
  from public.ask_search_documents as document
  where length(trim(p_query)) > 0
    and (p_scope is null or document.source_scope = p_scope)
    and document.search_text &@ trim(p_query)
  order by pgroonga_score(document.tableoid, document.ctid) desc, document.published_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 8), 12));
$$;

revoke all on function public.sync_ask_search_documents(text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.delete_ask_search_documents(text, text[]) from public, anon, authenticated;
revoke all on function public.search_ask_documents(text, text, integer) from public, anon, authenticated;
grant execute on function public.sync_ask_search_documents(text, jsonb, boolean) to service_role;
grant execute on function public.delete_ask_search_documents(text, text[]) to service_role;
grant execute on function public.search_ask_documents(text, text, integer) to service_role;
