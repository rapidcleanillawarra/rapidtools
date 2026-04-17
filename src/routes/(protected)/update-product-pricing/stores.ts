import { writable, get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { currentUser } from '$lib/firebase';
import type { SelectOption, MultiSelectOption } from './types';

// API Endpoints
export const brandsUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/58215302c1c24203886ccf481adbaac5/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RFQ4OtbS6cyjB_JzaIsowmww4KBqPQgavWLg18znE5s';
export const suppliersUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/da5c5708146642768d63293d2bbb9668/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-n0W0PxlF1G83xHYHGoEOhv3XmHXWlesbRk5NcgNT9w';
export const categoriesUrl = 'https://prod-47.australiasoutheast.logic.azure.com:443/workflows/0d67bc8f1bb64e78a2495f13a7498081/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fJJzmNyuARuwEcNCoMuWwMS9kmWZQABw9kJXsUj9Wk8';
export const updatePricingUrl = 'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';
export const filterProductsUrl = 'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';
export const priceGroupsUrl = 'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';

// State stores
export const products = writable<any[]>([]);
export const originalProducts = writable<any[]>([]);
export const filteredProducts = writable<any[]>([]);
export const brands = writable<SelectOption[]>([]);
export const suppliers = writable<SelectOption[]>([]);
export const categories = writable<SelectOption[]>([]);
export const priceGroups = writable<any[]>([]);
export const loading = writable(false);
export const loadingBrands = writable(false);
export const loadingSuppliers = writable(false);
export const loadingCategories = writable(false);
export const loadingPriceGroups = writable(false);
export const brandError = writable('');
export const supplierError = writable('');
export const categoryError = writable('');
export const priceGroupError = writable('');
export const selectedRows = writable(new Set<string>());
export const selectAll = writable(false);
export const submitLoading = writable(false);

/** Latest row per SKU from `latest_product_price_adjustment` view (for Last Price column). */
export const lastPriceAdjustmentBySku = writable<
  Map<string, { purchase_price: number; list_price: number }>
>(new Map());

// Filter state
export const skuFilter = writable('');
export const productNameFilter = writable('');
export const brandFilter = writable<SelectOption | null>(null);
export const supplierFilter = writable<SelectOption | null>(null);

// Pagination and sorting stores
export const currentPage = writable(1);
export const itemsPerPage = writable(10);
export const sortField = writable<string | null>(null);
export const sortDirection = writable<'asc' | 'desc'>('asc');

interface Product {
  sku: string;
  product_name: string;
  brand: string;
  primary_supplier: string;
  category: string[];
  category_name: string[];
  original_category: string[];
  purchase_price: number;
  markup: number;
  rrp: number;
  client_mup: number;
  retail_mup: number;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const n = parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

function round2(n: number): number {
  return Number.isFinite(n) ? parseFloat(n.toFixed(2)) : 0;
}

/** Match API / UI SKU strings even when casing differs (e.g. response SKU vs stored sku). */
export function normalizeSkuKey(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

const LAST_PRICE_BATCH = 500;

/**
 * Loads latest `product_price_adjustment` snapshot per SKU (via view) for the current `products` list.
 */
export async function fetchLastPriceAdjustmentsForCurrentProducts(): Promise<void> {
  const skus = get(products)
    .map((p) => String(p?.sku ?? '').trim())
    .filter((s) => s.length > 0);
  if (skus.length === 0) {
    lastPriceAdjustmentBySku.set(new Map());
    return;
  }

  const next = new Map<string, { purchase_price: number; list_price: number }>();

  for (let i = 0; i < skus.length; i += LAST_PRICE_BATCH) {
    const chunk = skus.slice(i, i + LAST_PRICE_BATCH);
    const { data, error } = await supabase
      .from('latest_product_price_adjustment')
      .select('sku, purchase_price, list_price')
      .in('sku', chunk);

    if (error) {
      console.error('[product_price_adjustment] fetch failed', error);
      continue;
    }

    for (const row of data ?? []) {
      const sku = String((row as { sku?: string }).sku ?? '').trim();
      if (!sku) continue;
      const pp = round2(toNumber((row as { purchase_price?: unknown }).purchase_price));
      const lp = round2(toNumber((row as { list_price?: unknown }).list_price));
      next.set(normalizeSkuKey(sku), { purchase_price: pp, list_price: lp });
    }
  }

  lastPriceAdjustmentBySku.set(next);
}

function computePricing(product: any, source: 'markup' | 'price' = 'markup') {
  const purchasePrice = toNumber(product.purchase_price, 0);
  let markup = toNumber(product.markup ?? product.client_mup ?? product.retail_mup, 0);
  let rrp = toNumber(product.rrp, 0);

  if (source === 'markup') {
    if (purchasePrice && markup) {
      rrp = round2(purchasePrice * markup);
    }
  } else {
    if (purchasePrice && rrp) {
      markup = round2(rrp / purchasePrice);
    }
    if (purchasePrice && markup) {
      rrp = round2(purchasePrice * markup);
    }
  }

  // Keep legacy fields in sync for downstream payload generation
  return {
    ...product,
    purchase_price: purchasePrice,
    markup: round2(markup),
    client_mup: round2(markup),
    retail_mup: round2(markup),
    rrp: round2(rrp)
  };
}

function updateProductBySkuInternal(list: any[], sku: string, updater: (p: any) => any): any[] {
  const idx = list.findIndex(p => p?.sku === sku);
  if (idx === -1) return list;
  const next = updater(list[idx]);
  if (next === list[idx]) return list;
  const copy = list.slice();
  copy[idx] = next;
  return copy;
}

export function updateProductBySku(sku: string, patch: Record<string, unknown>) {
  products.update(list =>
    updateProductBySkuInternal(list, sku, p => ({ ...p, ...patch }))
  );
}

export function updateProductPricingBySku(
  sku: string,
  patch: Record<string, unknown>,
  source: 'markup' | 'price' = 'markup'
) {
  products.update(list =>
    updateProductBySkuInternal(list, sku, p => computePricing({ ...p, ...patch }, source))
  );
}

// Back-compat: keep signature used by the page, but update immutably.
export function calculatePrices(product: any, source: 'markup' | 'price' = 'markup') {
  if (!product?.sku) return;
  updateProductPricingBySku(product.sku, {
    purchase_price: product.purchase_price,
    markup: product.markup,
    rrp: product.rrp
  }, source);
}

// Function to apply markup to all rows
export function applyMarkupToAll() {
  products.update(prods => {
    if (prods.length === 0) return prods;
    const first = prods[0];
    const markupVal = toNumber(first.markup ?? first.client_mup ?? first.retail_mup, 0);

    return prods.map((prod, idx) => {
      if (idx === 0) return computePricing(prod, 'markup');
      return computePricing({ ...prod, markup: markupVal }, 'markup');
    });
  });
}

export function toggleRowSelected(sku: string, checked: boolean) {
  selectedRows.update(set => {
    const next = new Set(set);
    if (checked) next.add(sku);
    else next.delete(sku);
    const total = get(products).length;
    selectAll.set(total > 0 && next.size === total);
    return next;
  });
}

export function clearSelection() {
  selectedRows.set(new Set<string>());
  selectAll.set(false);
}

// Function to fetch brands
export async function fetchBrands() {
  loadingBrands.set(true);
  brandError.set('');
  try {
    const response = await fetch(brandsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();

    if (data.status === 200 && data.message?.Ack === "Success" && Array.isArray(data.message.Content)) {
      brands.set(
        data.message.Content
          .filter((brand: { ContentID: string; ContentName: string }) => brand.ContentName)
          .map((brand: { ContentID: string; ContentName: string }) => ({
            value: brand.ContentName,
            label: brand.ContentName
          }))
          .sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label))
      );
    } else {
      throw new Error('Failed to load brands: Invalid response format');
    }
  } catch (err: unknown) {
    const error = err as Error;
    brandError.set(error.message || 'Failed to load brands');
    brands.set([]);
  } finally {
    loadingBrands.set(false);
  }
}

// Function to fetch suppliers
export async function fetchSuppliers() {
  loadingSuppliers.set(true);
  supplierError.set('');
  try {
    const response = await fetch(suppliersUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    const data = await response.json();

    if (data.status === 200 && data.message.Ack === "Success") {
      suppliers.set(
        data.message.Supplier
          .filter((supplier: { SupplierID: string }) => supplier.SupplierID !== "0")
          .map((supplier: { SupplierID: string }) => ({
            value: supplier.SupplierID,
            label: supplier.SupplierID
          }))
          .sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label))
      );
    } else {
      throw new Error('Failed to load suppliers: Invalid response format');
    }
  } catch (err: unknown) {
    const error = err as Error;
    supplierError.set(error.message || 'Failed to load suppliers');
  } finally {
    loadingSuppliers.set(false);
  }
}

function extractCategories(raw: any): { ids: string[]; names: string[] } {
  if (!raw) return { ids: [], names: [] };

  // Shape 1: ["123","456"]
  if (Array.isArray(raw) && raw.every(v => typeof v === 'string')) {
    const ids = (raw as string[]).filter(Boolean);
    return { ids, names: [] };
  }

  // Shape 2 (Vend-ish): [{ Category: { CategoryID, CategoryName } }]
  if (Array.isArray(raw)) {
    const ids: string[] = [];
    const names: string[] = [];
    raw.forEach(entry => {
      const c = entry?.Category ?? entry;
      const id = c?.CategoryID ?? c?.CategoryId ?? c?.id;
      const name = c?.CategoryName ?? c?.Category ?? c?.name;
      if (id) ids.push(String(id));
      if (name) names.push(String(name));
    });
    return { ids: ids.filter(Boolean), names: names.filter(Boolean) };
  }

  return { ids: [], names: [] };
}

function transformApiItemToProduct(item: any) {
  const { ids: categoryIds, names: categoryNames } = extractCategories(item?.Categories);
  const purchasePrice = toNumber(item?.DefaultPurchasePrice, 0);
  const listPrice = toNumber(item?.RRP, 0);
  const markup = purchasePrice > 0 ? round2(listPrice / purchasePrice) : 0;

  return {
    sku: item?.SKU || '',
    inventory_id: item?.InventoryID || '',
    product_name: item?.Model || '',
    brand: item?.Brand || '',
    primary_supplier: item?.PrimarySupplier || '',
    // keep raw price group payload for downstream extraction
    PriceGroups: item?.PriceGroups ?? [],
    Images: item?.Images ?? [],
    category: categoryIds,
    category_name: categoryNames,
    original_category: [...categoryIds],
    purchase_price: purchasePrice,
    markup,
    client_mup: markup,
    retail_mup: markup,
    rrp: listPrice,
    tax_free: item?.TaxFreeItem === 'True' || item?.TaxFreeItem === true,
    tax_inclusive:
      item?.TaxInclusive === true ||
      item?.TaxInclusive === 'True' ||
      item?.TaxInclusive === 'true',
    remove_pricegroups: false
  };
}

// Fetch all products (unfiltered)
export async function fetchAllProducts() {
  loading.set(true);
  try {
    const requestBody = {
      Filter: {
        SKU: "",
        IsActive: true,
        Page: 0,
        Limit: 100,
        OutputSelector: [
          "SKU",
          "Model",
          "Brand",
          "PrimarySupplier",
          "RRP",
          "DefaultPurchasePrice",
          "PriceGroups",
          "Misc02",
          "Misc09",
          "InventoryID",
          "TaxFreeItem",
          "TaxInclusive",
          "Images"
        ]
      },
      action: "GetItem"
    };

    const response = await fetch(filterProductsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load products: ${response.status} ${response.statusText}. Error: ${errorText}`);
    }

    // Some endpoints occasionally return non-JSON content-type; parse defensively.
    const text = await response.text();
    const data = JSON.parse(text);

    if (data?.Ack !== "Success" || !data?.Item) {
      products.set([]);
      originalProducts.set([]);
      filteredProducts.set([]);
      return { success: false, message: 'Failed to load products: Invalid response format' };
    }

    const items = Array.isArray(data.Item) ? data.Item : [data.Item];
    const prods = items.map(transformApiItemToProduct);

    originalProducts.set(prods);
    products.set(prods);
    filteredProducts.set(prods);
    currentPage.set(1);

    await fetchLastPriceAdjustmentsForCurrentProducts();

    return { success: true, message: 'Products loaded' };
  } catch (err: unknown) {
    const error = err as Error;
    products.set([]);
    originalProducts.set([]);
    filteredProducts.set([]);
    return { success: false, message: error.message || 'Failed to load products' };
  } finally {
    loading.set(false);
  }
}

// Function to fetch categories
export async function fetchCategories() {
  loadingCategories.set(true);
  categoryError.set('');
  try {
    const response = await fetch(categoriesUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const data = await response.json();

    if (data.status === 200 && data.message?.Ack === "Success" && Array.isArray(data.message.Category)) {
      categories.set(
        data.message.Category
          .map((category: { CategoryID: string; CategoryName: string }) => ({
            value: category.CategoryID,
            label: category.CategoryName
          }))
          .sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label))
      );
    } else {
      throw new Error('Failed to load categories: Invalid response format');
    }
  } catch (err: unknown) {
    const error = err as Error;
    categoryError.set(error.message || 'Failed to load categories');
  } finally {
    loadingCategories.set(false);
  }
}

// Fetch all price groups using provided payload/endpoint
export async function fetchPriceGroups() {
  loadingPriceGroups.set(true);
  priceGroupError.set('');
  try {
    const payload = {
      Filter: {
        SKU: "customer_groups",
        OutputSelector: ["PriceGroups"]
      },
      action: "GetItem"
    };

    const response = await fetch(priceGroupsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();

    // Log the full response for debugging to ensure parsing matches API shape
    console.log('Price groups API raw response:', data);

    // Gather groups from multiple possible shapes
    const items = Array.isArray(data.Item) ? data.Item : data.Item ? [data.Item] : [];

    // Handle both array and object shapes for PriceGroups on each item
    const extractPriceGroupsFromItem = (item: any) => {
      if (!item?.PriceGroups) return [];
      const pg = item.PriceGroups;
      if (Array.isArray(pg)) {
        return pg.flatMap((entry: any) => {
          if (!entry) return [];
          if (Array.isArray(entry.PriceGroup)) return entry.PriceGroup;
          if (entry.PriceGroup) return [entry.PriceGroup];
          return [];
        });
      }
      if (Array.isArray(pg.PriceGroup)) return pg.PriceGroup;
      if (pg.PriceGroup) return [pg.PriceGroup];
      return [];
    };

    const groupsFromItems = items.flatMap((item: any) => extractPriceGroupsFromItem(item));

    const messageGroups = data?.message?.PriceGroups?.PriceGroup || data?.message?.PriceGroup || [];
    const topLevelGroups = data?.PriceGroups?.PriceGroup || data?.PriceGroup || [];

    // Normalize to a single flat array
    const groups = [
      ...groupsFromItems,
      ...(Array.isArray(messageGroups) ? messageGroups : [messageGroups].filter(Boolean)),
      ...(Array.isArray(topLevelGroups) ? topLevelGroups : [topLevelGroups].filter(Boolean))
    ].filter(Boolean);

    // Simplified list of identifiers for debugging/inspection
    const groupIdentifiers = groups.map((g: any) => ({
      groupId: g?.GroupID ?? g?.Group ?? '',
      groupName: g?.Group ?? ''
    }));

    priceGroups.set(groups);
    console.log('Price group identifiers:', groupIdentifiers);
    return { success: true, data: groups };
  } catch (err: unknown) {
    const error = err as Error;
    priceGroupError.set(error.message || 'Failed to load price groups');
    priceGroups.set([]);
    return { success: false, message: error.message || 'Failed to load price groups' };
  } finally {
    loadingPriceGroups.set(false);
  }
}

// Function to handle select all checkbox
export function handleSelectAll(checked: boolean) {
  selectAll.set(checked);
  if (checked) {
    const allSkus = new Set<string>(get(products).map(p => p.sku));
    selectedRows.set(allSkus);
  } else {
    selectedRows.set(new Set<string>());
  }
}

function findOriginalProductBySku(snapshot: any[], sku: string): any | null {
  const exact = snapshot.find((p) => p?.sku === sku);
  if (exact) return exact;
  const key = normalizeSkuKey(sku);
  return snapshot.find((p) => normalizeSkuKey(p?.sku) === key) ?? null;
}

/**
 * When filters load products that were not in the initial page (e.g. SKU not in first 100 rows),
 * merge them into originalProducts so "previous price" snapshots exist on save.
 */
function mergeProductsIntoOriginalProducts(incoming: any[]) {
  if (incoming.length === 0) return;
  originalProducts.update((orig) => {
    const byKey = new Map(orig.map((p) => [normalizeSkuKey(p.sku), p]));
    for (const p of incoming) {
      byKey.set(normalizeSkuKey(p.sku), { ...p });
    }
    return Array.from(byKey.values());
  });
}

/** `created_by` / `created_by_name` from `public.users` (email + full_name), with Firebase fallbacks. */
async function fetchCreatedByForPriceAdjustment(): Promise<{
  created_by: string | null;
  created_by_name: string | null;
}> {
  const user = get(currentUser);
  const fbEmail = user?.email?.trim() || null;
  const fbDisplay = user?.displayName?.trim() || null;

  if (!fbEmail) {
    return { created_by: null, created_by_name: fbDisplay };
  }

  const { data, error } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('email', fbEmail)
    .maybeSingle();

  if (error) {
    console.warn('[product_price_adjustment] users lookup failed', error);
    return { created_by: fbEmail, created_by_name: fbDisplay };
  }

  const row = data as { email?: string | null; full_name?: string | null } | null;
  if (!row) {
    return { created_by: fbEmail, created_by_name: fbDisplay };
  }

  const email =
    row.email != null && String(row.email).trim() !== ''
      ? String(row.email).trim()
      : fbEmail;
  const name =
    row.full_name != null && String(row.full_name).trim() !== ''
      ? String(row.full_name).trim()
      : fbDisplay;

  return { created_by: email, created_by_name: name };
}

/** Persists previous purchase + list prices (from the snapshot before this save) to Supabase. */
async function savePreviousPriceSnapshotsToSupabase(
  updatedSkus: Set<string>,
  originalSnapshot: any[]
): Promise<void> {
  console.log('[product_price_adjustment] savePreviousPriceSnapshotsToSupabase called', {
    updatedSkuCount: updatedSkus.size,
    updatedSkus: Array.from(updatedSkus),
    originalSnapshotLength: originalSnapshot.length,
  });

  const { created_by: email, created_by_name: name } =
    await fetchCreatedByForPriceAdjustment();

  const rows = Array.from(updatedSkus)
    .map((sku) => {
      const orig = findOriginalProductBySku(originalSnapshot, sku);
      if (!orig) return null;
      const inv = orig.inventory_id;
      // Use canonical sku from snapshot so DB matches app rows
      const canonicalSku = String(orig.sku ?? sku);
      return {
        sku: canonicalSku,
        inventory_id:
          inv != null && String(inv).trim() !== '' ? String(inv) : null,
        purchase_price: round2(toNumber(orig.purchase_price)),
        list_price: round2(toNumber(orig.rrp)),
        notes: null as string | null,
        created_by: email,
        created_by_name: name,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  const missingOriginals = Array.from(updatedSkus).filter(
    (sku) => !findOriginalProductBySku(originalSnapshot, sku)
  );
  if (missingOriginals.length > 0) {
    console.warn(
      '[product_price_adjustment] SKUs in API response but not in originalSnapshot (rows skipped):',
      missingOriginals
    );
  }

  if (rows.length === 0) {
    console.warn(
      '[product_price_adjustment] No rows to insert — check originalSnapshot vs updated SKUs.'
    );
    return;
  }

  console.log('[product_price_adjustment] insert payload', { rowCount: rows.length, rows });

  try {
    const { data, error } = await supabase.from('product_price_adjustment').insert(rows).select();

    if (error) {
      console.error('[product_price_adjustment] insert failed', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        error,
      });
      return;
    }

    console.log('[product_price_adjustment] insert OK', {
      returnedRows: data?.length ?? 0,
      data,
    });
  } catch (e) {
    console.error('[product_price_adjustment] insert threw', e);
  }
}

/** After a successful save, align originals with current rows so the next save records the correct baseline. */
function syncOriginalProductsForSkus(updatedSkus: Set<string>) {
  const currentByNorm = new Map(
    get(products).map((p) => [normalizeSkuKey(p.sku), p])
  );
  const updatedNorm = new Set(Array.from(updatedSkus).map(normalizeSkuKey));
  originalProducts.update((origList) =>
    origList.map((p) => {
      const key = normalizeSkuKey(p.sku);
      if (updatedNorm.has(key) && currentByNorm.has(key)) {
        return { ...currentByNorm.get(key)! };
      }
      return p;
    })
  );
}

// Function to handle submit checked rows
export async function handleSubmitChecked() {
  submitLoading.set(true);
  const originalSnapshotAtSubmit = get(originalProducts);
  try {
    const currentSelectedRows = get(selectedRows);
    const currentProducts = get(products);
    const selectedProducts = currentProducts.filter(prod => currentSelectedRows.has(prod.sku));

    if (selectedProducts.length === 0) {
      submitLoading.set(false);
      return { success: false, message: 'No products selected' };
    }

    // Verify and update category information before constructing the payload
    const verifyAndUpdateCategoryInfo = (products: any[]) => {
      return products.map(prod => {
        // Ensure category arrays are properly initialized
        if (!prod.category) {
          prod.category = [];
        }
        if (!prod.category_name) {
          prod.category_name = [];
        }
        if (!prod.original_category) {
          prod.original_category = prod.category ? [...prod.category] : [];
        }
        
        // Verify categories are properly formatted
        if (prod.category && !Array.isArray(prod.category)) {
          prod.category = [prod.category];
        }
        
        if (prod.original_category && !Array.isArray(prod.original_category)) {
          prod.original_category = [prod.original_category];
        }
        
        // Filter out any invalid category values (null, undefined, empty strings)
        if (Array.isArray(prod.category)) {
          prod.category = prod.category.filter((catId: string | null | undefined) => catId);
        }
        
        return prod;
      });
    };
    
    // Apply the verification and update to selected products
    const verifiedProducts = verifyAndUpdateCategoryInfo(selectedProducts);

  // Ensure price groups data is available (always fetch fresh when deletion requested)
  let priceGroupsSnapshot = get(priceGroups);
  const requiresPriceGroupDeletion = verifiedProducts.some(prod => prod.remove_pricegroups);
  if (requiresPriceGroupDeletion) {
    const result = await fetchPriceGroups();
    // Prefer freshly returned data if available
    if (result?.success && Array.isArray(result.data)) {
      priceGroupsSnapshot = result.data;
    } else {
      priceGroupsSnapshot = get(priceGroups);
    }
  }

    const payload = {
    "Item": verifiedProducts.map(prod => {
      // Helper to normalize price group identifiers from API data
      const extractPriceGroupIds = (raw: any): string[] => {
        if (!raw) return [];

        // If the raw object already looks like a price group entry, prefer the ID
        const maybeId = raw.GroupID ?? raw.Group ?? raw.group;
        if (maybeId) return [maybeId];

        // If the raw object has a nested PriceGroup property
        if (raw.PriceGroup) {
          return extractPriceGroupIds(raw.PriceGroup);
        }

        // If the raw value is an array, flatten all entries
        if (Array.isArray(raw)) {
          return raw.flatMap((entry: any) => extractPriceGroupIds(entry));
        }

        return [];
      };

        // Create the base product object
        const markupValue = parseFloat(
          (prod.markup ?? prod.client_mup ?? prod.retail_mup ?? 0).toString()
        );
        const productObject: any = {
          "SKU": prod.sku,
          "Brand": prod.brand,
          "PrimarySupplier": prod.primary_supplier,
          "DefaultPurchasePrice": prod.purchase_price.toString(),
          "RRP": prod.rrp.toString(),
          "Misc02": markupValue.toString(),  // client MUP (markup)
          "Misc09": markupValue.toString(),  // retail MUP (markup)
          "TaxFreeItem": prod.tax_free || false,
          "TaxInclusive": !!prod.tax_inclusive
        };

        // Handle price groups, optionally deleting all except 1 and 2 when flagged
        const allPriceGroups = priceGroupsSnapshot || [];

        // Collect all non-1/2 group IDs from snapshot AND the product itself
        const productGroupIds = extractPriceGroupIds(
          (prod as any).PriceGroups ?? (prod as any).priceGroups ?? (prod as any).price_groups
        );

        const extractedGroups = [
          ...extractPriceGroupIds(allPriceGroups),
          ...productGroupIds
        ].filter((groupId: string | undefined) => groupId && groupId !== "1" && groupId !== "2");

        // Fallback list when API returns nothing and product has none
        const fallbackGroups = ["3", "4", "5", "6", "7", "8", "9", "10"];

        // Deduplicate while preserving order
        const uniqueGroups = Array.from(new Set(extractedGroups.length > 0 ? extractedGroups : fallbackGroups));

        // Build delete entries for every non-1/2 group
        const groupsToDelete = uniqueGroups.map((groupId: string) => ({ "Group": groupId, "Delete": true }));

        productObject.PriceGroups = {
          "PriceGroup": [
            {
              "Group": "1",
              "Price": prod.rrp.toString()
            },
            {
              "Group": "2",
              // Use list price (rrp) for group 2 per request
              "Price": prod.rrp.toString()
            },
            ...(prod.remove_pricegroups ? groupsToDelete : [])
          ]
        };
        
        // Handle category changes with deletion for removed categories
        if (prod.category || prod.original_category) {
          const categoryPayload: Array<{ CategoryID: string; Delete?: boolean }> = [];
          
          // Add current categories (without Delete flag)
          if (prod.category && Array.isArray(prod.category)) {
            prod.category.forEach((catId: string) => {
              if (catId) {
                categoryPayload.push({ CategoryID: catId });
              }
            });
          }
          
          // Add categories to delete (with Delete flag set to true)
          if (prod.original_category && Array.isArray(prod.original_category)) {
            prod.original_category.forEach((catId: string) => {
              // Only include for deletion if it's in original but not in current categories
              if (catId && (!prod.category || !prod.category.includes(catId))) {
                categoryPayload.push({ CategoryID: catId, Delete: true });
              }
            });
          }
          
          // Only add Categories if we have category entries
          if (categoryPayload.length > 0) {
            productObject.Categories = {
              "Category": categoryPayload
            };
          }
        }
        
        return productObject;
      }),
      "action": "UpdateItem"
    };

    // Temporary log to inspect the outgoing payload for submit checked
    console.log('Submitting checked products payload:', payload);

    // Send to API
    const response = await fetch(updatePricingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();

    // Check if data.Item exists and has SKUs
    if (data.Item && data.Ack === "Success") {
      // Get array of successfully updated SKUs
      const updatedSkus = new Set<string>(
        (Array.isArray(data.Item) ? data.Item : [data.Item])
          .map((item: any) => item.SKU as string | undefined)
          .filter((sku: string | undefined): sku is string => typeof sku === 'string' && sku.length > 0)
      );

      await savePreviousPriceSnapshotsToSupabase(updatedSkus, originalSnapshotAtSubmit);

      const updatedNorm = new Set(Array.from(updatedSkus).map(normalizeSkuKey));
      // Simply mark products as updated if their SKU is in the response
      products.update((prods) =>
        prods.map((prod) =>
          updatedNorm.has(normalizeSkuKey(prod.sku)) ? { ...prod, updated: true } : prod
        )
      );

      syncOriginalProductsForSkus(updatedSkus);

      await fetchLastPriceAdjustmentsForCurrentProducts();

      // Reset loading state
      submitLoading.set(false);
      // Don't clear the selectedRows after successful submission so users can see what was updated
      return { success: true, message: 'Products updated successfully' };
    }
    
    // If we get here, the response didn't contain the expected data
    submitLoading.set(false);
    throw new Error('Failed to update products: Invalid response format');
  } catch (err: unknown) {
    const error = err as Error;
    submitLoading.set(false);
    return { success: false, message: error.message || 'Failed to update products' };
  }
}

// Function to handle filter submit
export async function handleFilterSubmit(filters: {
  skuFilter: string;
  productNameFilter: string;
  brandFilter: SelectOption | null;
  supplierFilter: SelectOption | null;
}) {
  loading.set(true);
  try {
    // Process SKU filter to get an array of SKUs
    const skuList = filters.skuFilter
      .split('\n')
      .map(sku => sku.trim())
      .filter(sku => sku.length > 0);

    // Create filter payload
    const payload: any = {};

    // Add SKU filter
    if (skuList.length > 0) {
      payload.sku = skuList;
    }

    // Add product name filter
    if (filters.productNameFilter) {
      payload.productName = filters.productNameFilter;
    }

    // Add brand filter
    if (filters.brandFilter) {
      payload.brand = filters.brandFilter.value;
    }

    // Add supplier filter
    if (filters.supplierFilter) {
      payload.supplier = filters.supplierFilter.value;
    }

    // If no filters are applied, restore the original product list
    if (Object.keys(payload).length === 0) {
      const original = get(originalProducts);
      products.set([...original]);
      filteredProducts.set([...original]);
      loading.set(false);
      await fetchLastPriceAdjustmentsForCurrentProducts();
      return { success: true, message: 'All products loaded' };
    }

    // Prepare the request payload
    const payloadForAPI = {
      Filter: {
        SKU: payload.sku || '',
        Name: payload.productName || '',
        Brand: payload.brand || '',
        IsActive: true,
        Page: 0,
        Limit: 100,
        OutputSelector: [
          "SKU",
          "Model",
          "Brand",
          "PrimarySupplier",
          "RRP",
          "DefaultPurchasePrice",
          "PriceGroups",
          "Misc02",
          "Misc09",
          "InventoryID",
          "TaxFreeItem",
          "TaxInclusive",
          "Images"
        ]
      },
      "action": "GetItem"
    };

    // Make API call with filter payload
    const response = await fetch(filterProductsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadForAPI)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();

    // Process the filtered products
    if (data.Item && data.Ack === "Success") {
      const filteredItems = Array.isArray(data.Item) ? data.Item : [data.Item];
      const filteredProds = filteredItems.map(transformApiItemToProduct);

      products.set(filteredProds);
      filteredProducts.set(filteredProds);
      mergeProductsIntoOriginalProducts(filteredProds);
      currentPage.set(1);
      loading.set(false);
      await fetchLastPriceAdjustmentsForCurrentProducts();
      return { success: true, message: 'Products filtered successfully' };
    }

    loading.set(false);
    throw new Error('Failed to filter products: Invalid response format');
  } catch (err: unknown) {
    const error = err as Error;
    loading.set(false);
    return { success: false, message: error.message || 'Failed to filter products' };
  }
}

/** Gross profit % on list: (list − purchase) / list × 100. Null when list ≤ 0 or values invalid. */
function grossProfitPercentFromProduct(p: any): number | null {
  const rrp =
    typeof p?.rrp === 'number' ? p.rrp : parseFloat(String(p?.rrp ?? ''));
  const pp =
    typeof p?.purchase_price === 'number'
      ? p.purchase_price
      : parseFloat(String(p?.purchase_price ?? ''));
  if (!Number.isFinite(rrp) || !Number.isFinite(pp) || rrp <= 0) return null;
  return ((rrp - pp) / rrp) * 100;
}

// Get paginated and sorted products
export function getPaginatedProducts(
  allProducts: any[],
  page?: number,
  perPage?: number,
  sortFieldOverride?: string,
  sortDirectionOverride?: 'asc' | 'desc'
): any[] {
  let sorted = [...allProducts];
  
  // Apply sorting if a sort field is selected
  const currentSortField = sortFieldOverride ?? get(sortField);
  const currentSortDirection = sortDirectionOverride ?? get(sortDirection);
  
  if (currentSortField === 'gpp') {
    sorted.sort((a, b) => {
      const aG = grossProfitPercentFromProduct(a);
      const bG = grossProfitPercentFromProduct(b);
      if (aG === null && bG === null) return 0;
      if (aG === null) return 1;
      if (bG === null) return -1;
      return currentSortDirection === 'asc' ? aG - bG : bG - aG;
    });
  } else if (currentSortField) {
    sorted.sort((a, b) => {
      let aValue = a[currentSortField];
      let bValue = b[currentSortField];
      
      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      
      // Handle boolean values (for 'updated' field)
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return currentSortDirection === 'asc' 
          ? (aValue === bValue ? 0 : aValue ? -1 : 1)
          : (aValue === bValue ? 0 : aValue ? 1 : -1);
      }
      
      // Handle numeric values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return currentSortDirection === 'asc' 
          ? aValue - bValue 
          : bValue - aValue;
      }
      
      // Convert to strings for string comparison
      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();
      
      return currentSortDirection === 'asc' 
        ? aString.localeCompare(bString)
        : bString.localeCompare(aString);
    });
  }
  
  // Get pagination values
  const perPageValue = perPage ?? get(itemsPerPage);
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPageValue));
  const pageValue = Math.max(1, Math.min(page ?? get(currentPage), totalPages));
  
  // Calculate slice indices
  const start = (pageValue - 1) * perPageValue;
  const end = Math.min(start + perPageValue, sorted.length);
  
  // Return the paginated slice
  return sorted.slice(start, end);
}

// Get total number of pages
export function getTotalPages(totalItems: number, perPage?: number): number {
  const perPageValue = perPage ?? get(itemsPerPage);
  const pages = Math.max(1, Math.ceil(totalItems / perPageValue));
  return pages;
}

// Reset pagination
export function resetPagination() {
  currentPage.set(1);
}

// Handle sort change
export function handleSort(field: string) {
  sortField.update(currentField => {
    if (currentField === field) {
      // If clicking the same field, toggle direction
      sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
      return field;
    }
    // If clicking a new field, set to asc
    sortDirection.set('asc');
    return field;
  });
} 
