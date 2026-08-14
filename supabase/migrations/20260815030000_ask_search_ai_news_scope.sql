-- 公开问答全文索引接入每日动态：scope 取值从两类扩到三类。
-- 约束与两个写入端 RPC 的守卫名单同步放开；读取端 search_ask_documents 按 p_scope 过滤，无需变更。

alter table public.ask_search_documents
  drop constraint if exists ask_search_documents_source_scope_check;

alter table public.ask_search_documents
  add constraint ask_search_documents_source_scope_check
  check (source_scope in ('daily', 'open-source', 'ai-news'));

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
  if p_scope not in ('daily', 'open-source', 'ai-news') then
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
  if p_scope not in ('daily', 'open-source', 'ai-news') then
    raise exception 'Unsupported Q&A search scope: %', p_scope;
  end if;

  delete from public.ask_search_documents
  where source_scope = p_scope
    and source_id = any(coalesce(p_source_ids, array[]::text[]));
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
