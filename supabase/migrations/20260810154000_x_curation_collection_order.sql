alter table public.x_curation_items
  add column if not exists collected_at timestamptz,
  add column if not exists collected_order integer;

create index if not exists x_curation_items_collection_order_idx
  on public.x_curation_items (collected_at desc nulls last, collected_order asc nulls last, published_at desc nulls last);
