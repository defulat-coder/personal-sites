-- Anonymous Q&A transcripts remain JSONL files, but Vercel Functions only have
-- ephemeral writable storage. The server restores and persists these files with
-- the service-role key; no browser role receives a Storage policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ask-sessions', 'ask-sessions', false, 5242880, array['application/x-ndjson'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
