    -- Stores the last captured "previous" purchase and list prices per SKU (e.g. before a pricing update).
    create table if not exists public.product_price_adjustment (
      id uuid primary key default gen_random_uuid(),
      sku text not null,
      inventory_id text,
      purchase_price numeric(14,4) not null,
      list_price numeric(14,4) not null,
      notes text,
      created_at timestamptz not null default now(),
      created_by text,
      created_by_name text,
      constraint product_price_adjustment_sku_unique unique (sku)
    );

    create index if not exists product_price_adjustment_sku_idx on public.product_price_adjustment (sku);

    alter table public.product_price_adjustment enable row level security;

    create policy "product_price_adjustment_insert_anon"
      on public.product_price_adjustment for insert to anon
      with check (true);

    create policy "product_price_adjustment_update_anon"
      on public.product_price_adjustment for update to anon
      using (true) with check (true);

    create policy "product_price_adjustment_select_anon"
      on public.product_price_adjustment for select to anon
      using (true);

    create policy "product_price_adjustment_insert_authenticated"
      on public.product_price_adjustment for insert to authenticated
      with check (true);

    create policy "product_price_adjustment_update_authenticated"
      on public.product_price_adjustment for update to authenticated
      using (true) with check (true);

    create policy "product_price_adjustment_select_authenticated"
      on public.product_price_adjustment for select to authenticated
      using (true);

    grant select, insert, update on public.product_price_adjustment to anon, authenticated;
