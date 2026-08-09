alter table public.github_open_source_items
  add column if not exists display_rank integer;

create index if not exists github_open_source_items_display_rank_idx
  on public.github_open_source_items (display_rank nulls last, published_at desc);
