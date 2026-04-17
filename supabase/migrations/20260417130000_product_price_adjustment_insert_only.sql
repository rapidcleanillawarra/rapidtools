-- Allow multiple history rows per SKU (insert-only snapshots; no upsert by sku).
alter table public.product_price_adjustment
  drop constraint if exists product_price_adjustment_sku_unique;

-- Latest row per SKU for reads (e.g. Last Price column).
create or replace view public.latest_product_price_adjustment as
select distinct on (p.sku)
  p.id,
  p.sku,
  p.inventory_id,
  p.purchase_price,
  p.list_price,
  p.notes,
  p.created_at,
  p.created_by,
  p.created_by_name
from public.product_price_adjustment p
order by p.sku, p.created_at desc;

grant select on public.latest_product_price_adjustment to anon, authenticated;
