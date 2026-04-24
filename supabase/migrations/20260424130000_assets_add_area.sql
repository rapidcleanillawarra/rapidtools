-- Optional location / zone label for an asset.
alter table public.assets add column if not exists area text;
