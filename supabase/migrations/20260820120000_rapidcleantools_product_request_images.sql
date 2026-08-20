-- Track product-request images stored in the public `rapidtools` bucket
-- under the `product_requests/` folder.
create table if not exists public.rapidcleantools_product_request_images (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  sku text not null,
  image_name text not null,
  url text not null,
  storage_path text not null,
  file_name text,
  content_type text,
  byte_size bigint,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists rapidcleantools_product_request_images_storage_path_key
  on public.rapidcleantools_product_request_images (storage_path);

create index if not exists rapidcleantools_product_request_images_sku_idx
  on public.rapidcleantools_product_request_images (sku);

create index if not exists rapidcleantools_product_request_images_request_id_idx
  on public.rapidcleantools_product_request_images (request_id);

alter table public.rapidcleantools_product_request_images enable row level security;

drop policy if exists "Allow all access to rapidcleantools_product_request_images"
  on public.rapidcleantools_product_request_images;

create policy "Allow all access to rapidcleantools_product_request_images"
  on public.rapidcleantools_product_request_images
  for all
  to public
  using (true)
  with check (true);

grant select, insert, update, delete on public.rapidcleantools_product_request_images to anon, authenticated;
