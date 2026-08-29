-- 每日动态：用 Supabase Cron 可靠触发 Vercel 同步接口，并统一持久化 ETag、租约与健康状态。

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table public.ai_news_sync_state (
  id text primary key check (id = 'default'),
  etags jsonb not null default '{}'::jsonb check (jsonb_typeof(etags) = 'object'),
  cron_secret_hash text not null check (length(cron_secret_hash) = 64),
  lease_until timestamptz,
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_error text,
  last_stats jsonb not null default '{}'::jsonb check (jsonb_typeof(last_stats) = 'object')
);

alter table public.ai_news_sync_state enable row level security;
revoke all on table public.ai_news_sync_state from public, anon, authenticated;
grant select, update on table public.ai_news_sync_state to service_role;

do $$
declare
  sync_secret text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  perform vault.create_secret(
    sync_secret,
    'ai_news_cron_secret',
    'Dedicated bearer token for the AI news Supabase Cron trigger'
  );
  perform vault.create_secret(
    'https://default-coder.lovemyrmb.cn/api/cron/ai-news',
    'ai_news_cron_url',
    'Production AI news Cron endpoint'
  );
  insert into public.ai_news_sync_state (id, cron_secret_hash)
  values ('default', encode(extensions.digest(sync_secret, 'sha256'), 'hex'));
end
$$;

select cron.schedule(
  'ai-news-incremental',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'ai_news_cron_url'
        limit 1
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'ai_news_cron_secret'
          limit 1
        )
      ),
      body := '{"backfill":false}'::jsonb,
      timeout_milliseconds := 55000
    ) as request_id;
  $job$
);
