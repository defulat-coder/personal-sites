-- 公开问答：跨 Vercel 实例共享的原子 IP 限流，只保存 HMAC 摘要。

create table public.ask_rate_limits (
  ip_hash text primary key check (length(ip_hash) = 64),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0)
);

create index ask_rate_limits_window_started_at_idx
  on public.ask_rate_limits (window_started_at);

alter table public.ask_rate_limits enable row level security;
revoke all on table public.ask_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.ask_rate_limits to service_role;

create or replace function public.check_ask_rate_limit(
  p_ip_hash text,
  p_now timestamptz default now(),
  p_maximum_requests integer default 50,
  p_window_seconds integer default 600
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_count integer;
  current_window timestamptz;
begin
  if length(p_ip_hash) <> 64 or p_maximum_requests <= 0 or p_window_seconds <= 0 then
    raise exception 'invalid rate limit arguments';
  end if;

  insert into public.ask_rate_limits (ip_hash, window_started_at, request_count)
  values (p_ip_hash, p_now, 1)
  on conflict (ip_hash) do update
  set
    request_count = case
      when public.ask_rate_limits.window_started_at <= p_now - make_interval(secs => p_window_seconds) then 1
      else public.ask_rate_limits.request_count + 1
    end,
    window_started_at = case
      when public.ask_rate_limits.window_started_at <= p_now - make_interval(secs => p_window_seconds) then p_now
      else public.ask_rate_limits.window_started_at
    end
  returning request_count, window_started_at
  into current_count, current_window;

  allowed := current_count <= p_maximum_requests;
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from current_window + make_interval(secs => p_window_seconds) - p_now))::integer
    )
  end;
  return next;
end;
$$;

revoke all on function public.check_ask_rate_limit(text, timestamptz, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_ask_rate_limit(text, timestamptz, integer, integer)
  to service_role;

select cron.schedule(
  'ask-rate-limit-cleanup',
  '43 3 * * *',
  $$delete from public.ask_rate_limits where window_started_at < now() - interval '1 day'$$
);
