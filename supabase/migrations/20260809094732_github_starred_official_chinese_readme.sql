-- 保留仓库维护的中文 README，使其可直接作为中文阅读版而不经模型翻译。
alter table public.github_starred_sources
  add column if not exists reading_markdown text;
