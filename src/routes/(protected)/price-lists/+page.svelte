<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { currentUser } from '$lib/firebase';
  import { supabase } from '$lib/supabase';

  type Row = { sku: string; percentDiscount: string; productDiscount: string; price: string };
  type RowError = { sku?: string; price?: string };
  type PriceListRecord = {
    id: string;
    filename: string;
    created_at?: string;
    updated_at?: string;
    sku_data?: Row[];
    price_list_data?: any[];
  };

  const createEmptyRow = (): Row => ({ sku: '', percentDiscount: '', productDiscount: '', price: '' });
  const createEmptyRows = (count = 5): Row[] => Array.from({ length: count }, createEmptyRow);

  const STORAGE_KEY = 'price-lists-rows';
  const skuCheckUrl =
    'https://prod-03.australiasoutheast.logic.azure.com:443/workflows/151bc47e0ba4447b893d1c9fea9af46f/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=bRyr_oW-ud06XlU5VLhBqQ7tyU__jD3clEOGIEhax-Q';
  const getOrderUrl =
    'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';

  let rows: Row[] = createEmptyRows();
  let mounted = false;
  let submitting = false;
  let priceLists: PriceListRecord[] = [];
  let loadingPriceLists = false;
  let priceListsError = '';
  let missingSkus: string[] = [];
  let showMissingModal = false;
  let skuCheckError = '';
  let deletingId: string | null = null;
  let confirmDeleteId: string | null = null;
  let confirmDeleteName = '';
  let duplicatingId: string | null = null;
  let orderId = '';
  let loadingOrder = false;
  let orderError = '';

  const sanitizePrice = (raw: string): string => {
    const numericOnly = raw.replace(/[^0-9.]/g, '');
    const [intPart = '', decimalPart = ''] = numericOnly.split('.');
    const trimmedDecimal = decimalPart.slice(0, 2);
    const safeInt = intPart.replace(/^0+(?=\d)/, '') || (trimmedDecimal ? '0' : '');
    return trimmedDecimal ? `${safeInt}.${trimmedDecimal}` : safeInt;
  };

  /** Discounted price = unit price minus total product discount (2 dp). */
  const discountedPriceAfterProductDiscount = (unitPriceRaw: string, productDiscountRaw: string): string => {
    const parseAmount = (raw: string): number => {
      const n = Number(String(raw).replace(/[^0-9.]/g, ''));
      return Number.isFinite(n) ? n : NaN;
    };
    const unit = parseAmount(unitPriceRaw);
    if (!Number.isFinite(unit)) return '';
    const discParsed = parseAmount(String(productDiscountRaw));
    const disc = Number.isFinite(discParsed) ? discParsed : 0;
    const cents = Math.round((unit - disc) * 100);
    return sanitizePrice((cents / 100).toFixed(2));
  };

  const validateRow = (row: Row): RowError => {
    const errors: RowError = {};

    if (!row.sku.trim()) {
      errors.sku = 'SKU is required';
    }

    const priceText = row.price.trim();
    if (!priceText) {
      errors.price = 'Price is required';
    } else {
      const numeric = Number(priceText);
      if (!Number.isFinite(numeric) || numeric < 0) {
        errors.price = 'Price cannot be negative';
      } else if (!/^\d+(\.\d{1,2})?$/.test(priceText)) {
        errors.price = 'Max 2 decimal places';
      }
    }

    return errors;
  };

  $: rowErrors = rows.map(validateRow);
  $: if (mounted && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch (error) {
      console.error('Failed to persist price list rows', error);
    }
  }
  const updateSku = (index: number, value: string) => {
    rows = rows.map((row, i) => (i === index ? { ...row, sku: value } : row));
  };

  const updatePrice = (index: number, value: string) => {
    const cleaned = sanitizePrice(value);
    rows = rows.map((row, i) => (i === index ? { ...row, price: cleaned } : row));
  };

  const ensureRowCapacity = (targetLength: number) => {
    if (rows.length >= targetLength) return;
    rows = [...rows, ...createEmptyRows(targetLength - rows.length)];
  };

  const loadRowsFromStorage = () => {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed.map((row: Partial<Row>) => ({
        sku: (row?.sku ?? '').toString(),
        percentDiscount: sanitizePrice((row?.percentDiscount ?? '').toString()),
        productDiscount: sanitizePrice((row?.productDiscount ?? '').toString()),
        price: sanitizePrice((row?.price ?? '').toString())
      }));
      rows = normalized.length ? normalized : createEmptyRows();
    } catch (error) {
      console.error('Failed to load price list rows', error);
    }
  };

  const getClipboardText = async (event: ClipboardEvent): Promise<string> => {
    let text = event.clipboardData?.getData('text') ?? '';
    if (!text && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        text = await navigator.clipboard.readText();
      } catch (error) {
        console.error('Clipboard read failed', error);
      }
    }
    return text;
  };

  const handleCellPaste = async (event: ClipboardEvent, index: number, field: 'sku' | 'price') => {
    event.preventDefault();
    event.stopPropagation();

    const text = await getClipboardText(event);
    if (!text) return;

    const rowsData = text
      .split(/\r?\n/)
      .map((line) => line.split(/\t|,/).map((cell) => cell.trim()))
      .filter((line) => line.some((cell) => cell.length > 0));

    if (!rowsData.length) return;

    // Single cell paste goes to the targeted field only
    if (rowsData.length === 1 && rowsData[0].length === 1) {
      const value = rowsData[0][0];
      if (field === 'sku') {
        rows = rows.map((row, i) => (i === index ? { ...row, sku: value } : row));
      } else {
        rows = rows.map((row, i) => (i === index ? { ...row, price: sanitizePrice(value) } : row));
      }
      return;
    }

    // Multi-row paste; extend table if needed
    ensureRowCapacity(index + rowsData.length);
    let nextRows = [...rows];

    rowsData.forEach((cells, offset) => {
      const targetIndex = index + offset;
      const [skuValue = '', priceValue = ''] = cells;

      if (cells.length >= 2) {
        // Two-column paste fills both fields
        nextRows[targetIndex] = {
          ...nextRows[targetIndex],
          sku: skuValue,
          price: sanitizePrice(priceValue)
        };
      } else if (field === 'sku') {
        nextRows[targetIndex] = { ...nextRows[targetIndex], sku: skuValue };
      } else {
        nextRows[targetIndex] = { ...nextRows[targetIndex], price: sanitizePrice(skuValue) };
      }
    });

    rows = nextRows;
  };

  const addRows = (count = 1) => {
    rows = [...rows, ...createEmptyRows(count)];
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    rows = next.length ? next : createEmptyRows(1);
  };

  const clearRows = () => {
    rows = createEmptyRows();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  type OrderLineResponse = {
    SKU?: string;
    UnitPrice?: string;
    Quantity?: string;
    OrderLineID?: string;
    ProductDiscount?: string;
    PercentDiscount?: string;
  };
  const loadFromOrder = async () => {
    const orderIds = [...new Set(
      orderId
        .split(/[\s,;]+/)
        .map((id) => id.trim())
        .filter(Boolean)
    )];
    if (!orderIds.length) {
      orderError = 'Enter one or more order IDs';
      return;
    }
    orderError = '';
    loadingOrder = true;
    try {
      const payload = {
        Filter: {
          OrderID: orderIds,
          OutputSelector: [
            'OrderLine',
            'OrderLine.SKU',
            'OrderLine.UnitPrice',
            'OrderLine.ProductDiscount',
            'OrderLine.PercentDiscount'
          ]
        },
        action: 'GetOrder'
      };
      const response = await fetch(getOrderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      console.log('Load from order response', data);
      if (data?.Ack !== 'Success' || !Array.isArray(data?.Order) || data.Order.length === 0) {
        orderError = data?.Ack === 'Success' ? 'Order(s) not found' : 'Failed to load order(s). Please try again.';
        return;
      }
      const orderLines: OrderLineResponse[] = (data.Order ?? []).flatMap((order: { OrderLine?: OrderLineResponse | OrderLineResponse[] }) => {
        const lines = order?.OrderLine;
        if (!lines) return [];
        return Array.isArray(lines) ? lines : [lines];
      });
      if (!orderLines.length) {
        orderError = 'Order(s) have no lines';
        return;
      }
      rows = orderLines.map((line) => ({
        sku: (line.SKU ?? '').toString().trim(),
        percentDiscount: sanitizePrice((line.PercentDiscount ?? '').toString()),
        productDiscount: sanitizePrice((line.ProductDiscount ?? '').toString()),
        price: discountedPriceAfterProductDiscount(
          (line.UnitPrice ?? '').toString(),
          (line.ProductDiscount ?? '').toString()
        )
      }));
    } catch (error) {
      console.error('Failed to load order', error);
      orderError = 'Unable to load order(s). Please try again.';
    } finally {
      loadingOrder = false;
    }
  };

  const checkMissingSkus = async (skus: string[]): Promise<string[]> => {
    if (!skus.length) return [];
    const response = await fetch(skuCheckUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ SKU: skus })
    });

    const data = await response.json();
    if (data?.Ack !== 'Success') {
      throw new Error('SKU check failed');
    }

    const existingSet = new Set((data.Item ?? []).map((item: any) => item.SKU));
    return skus.filter((sku) => !existingSet.has(sku));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    skuCheckError = '';
    missingSkus = [];
    showMissingModal = false;

    const validRows = rows
      .map((row) => ({ row, errors: validateRow(row) }))
      .filter(({ errors }) => !errors.sku && !errors.price)
      .map(({ row }) => row);

    if (!validRows.length) {
      console.warn('No valid rows to submit');
      return;
    }

    const user = get(currentUser);
    const actor = user?.email || user?.uid || 'unknown';
    const timestamp = new Date().toISOString();

    submitting = true;
    try {
      const missing = await checkMissingSkus(validRows.map((row) => row.sku));
      if (missing.length) {
        missingSkus = missing;
        showMissingModal = true;
        return;
      }

      const payload = {
        sku_data: validRows,
        price_list_data: null,
        created_by: actor,
        updated_by: actor,
        created_at: timestamp,
        updated_at: timestamp
      };

      const { error } = await supabase.from('price_lists').insert(payload);
      if (error) {
        console.error('Failed to save price list', error);
        return;
      }

      goto(`${base}/price-lists/build-price-list`);
    } catch (error) {
      console.error('Unexpected error saving price list', error);
      skuCheckError = 'SKU validation failed. Please try again.';
    } finally {
      submitting = false;
    }
  };

  const loadPriceLists = async () => {
    loadingPriceLists = true;
    priceListsError = '';
    try {
      const { data, error } = await supabase
        .from('price_lists')
        .select('id, filename, created_at, updated_at, sku_data, price_list_data')
        .order('created_at', { ascending: false });
      if (error) throw error;
      priceLists = Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to load price lists', error);
      priceListsError = 'Unable to load price lists.';
    } finally {
      loadingPriceLists = false;
    }
  };

  const requestDelete = (item: PriceListRecord) => {
    confirmDeleteId = item.id;
    confirmDeleteName = item.filename || 'Untitled';
  };

  const cancelDelete = () => {
    confirmDeleteId = null;
    confirmDeleteName = '';
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    deletingId = confirmDeleteId;
    priceListsError = '';
    try {
      const { error } = await supabase.from('price_lists').delete().eq('id', confirmDeleteId);
      if (error) throw error;
      priceLists = priceLists.filter((item) => item.id !== confirmDeleteId);
    } catch (error) {
      console.error('Failed to delete price list', error);
      priceListsError = 'Unable to delete price list. Please try again.';
    } finally {
      deletingId = null;
      cancelDelete();
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString();
  };

  const duplicatePriceList = async (item: PriceListRecord) => {
    if (!item.id || duplicatingId) return;
    duplicatingId = item.id;
    priceListsError = '';
    try {
      const user = get(currentUser);
      const actor = user?.email || user?.uid || 'unknown';
      const timestamp = new Date().toISOString();
      
      // Create a new filename with "Copy" suffix
      const originalFilename = item.filename || 'Untitled';
      const newFilename = `${originalFilename} - Copy`;
      
      const payload = {
        filename: newFilename,
        sku_data: item.sku_data || [],
        price_list_data: item.price_list_data || null,
        created_by: actor,
        updated_by: actor,
        created_at: timestamp,
        updated_at: timestamp
      };

      const { error } = await supabase.from('price_lists').insert(payload);
      if (error) throw error;
      
      // Reload the price lists to show the new duplicate
      await loadPriceLists();
    } catch (error) {
      console.error('Failed to duplicate price list', error);
      priceListsError = 'Unable to duplicate price list. Please try again.';
    } finally {
      duplicatingId = null;
    }
  };

  onMount(() => {
    mounted = true;
    loadRowsFromStorage();
    loadPriceLists();
  });
</script>

<svelte:head>
  <title>Price Lists - RapidTools</title>
</svelte:head>

<div class="min-h-screen py-6 px-2 sm:px-4 lg:px-6">
  <div class="w-full bg-[#141619] border border-[#262a30] shadow-xl rounded-2xl p-4 sm:p-6 lg:p-8 space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Price Lists</h1>
        <p class="mt-1 text-sm text-gray-400">
          Paste SKUs and discounted prices. Prices sanitize commas and currency symbols, must be 0 or greater,
          and support up to two decimals.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <label for="order-id" class="form-label sr-only">Order IDs</label>
          <input
            id="order-id"
            type="text"
            class="bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
            placeholder="Order IDs (e.g. 26-0012347, 26-0012348)"
            bind:value={orderId}
            on:keydown={(e) => e.key === 'Enter' && loadFromOrder()}
          />
          <button
            class="btn-secondary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            type="button"
            on:click={loadFromOrder}
            disabled={loadingOrder}
          >
            {loadingOrder ? 'Loading…' : 'Load from order(s)'}
          </button>
        </div>
        <button class="btn-secondary text-sm" type="button" on:click={() => addRows(1)}>Add row</button>
        <button class="btn-secondary text-sm" type="button" on:click={clearRows}>Clear all</button>
        <button
          class="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          type="button"
          on:click={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
    {#if orderError}
      <p class="text-sm text-red-400">{orderError}</p>
    {/if}
    {#if skuCheckError}
      <p class="text-sm text-red-400">{skuCheckError}</p>
    {/if}

    <div class="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div class="rounded-2xl border border-[#262a30] bg-[#141619] shadow-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-full divide-y divide-[#262a30] text-sm text-gray-200">
            <thead class="bg-[#181b20] text-xs font-semibold uppercase tracking-wider text-gray-400">
              <tr>
                <th class="px-4 py-3 text-left">#</th>
                <th class="px-4 py-3 text-left">SKU</th>
                <th class="px-4 py-3 text-left">Discount %</th>
                <th class="px-4 py-3 text-left">Total Discounted</th>
                <th class="px-4 py-3 text-left">Discounted Price</th>
                <th class="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#262a30] bg-[#141619]">
              {#each rows as row, index}
                {@const isMissing = missingSkus.includes(row.sku.trim())}
                <tr
                  class={`even:bg-[#181b20]/50 hover:bg-[#1f2329]/60 transition-colors ${
                    rowErrors?.[index]?.sku || rowErrors?.[index]?.price ? 'bg-red-950/20' : ''
                  } ${isMissing ? 'bg-amber-950/20' : ''}`}
                >
                  <td class="whitespace-nowrap px-4 py-3.5 text-gray-300">{index + 1}</td>
                  <td class="px-4 py-3.5">
                    <input
                      class={`w-full rounded-lg border px-3 py-2 text-sm text-gray-200 placeholder-gray-600 transition-colors focus:border-lime-500 focus:ring-1 focus:ring-lime-500 ${
                        rowErrors?.[index]?.sku
                          ? 'border-red-500/50 bg-red-950/20'
                          : isMissing
                            ? 'border-amber-500/50 bg-amber-950/20'
                            : 'border-[#262a30] bg-[#0e1012]'
                      }`}
                      name={`sku-${index}`}
                      placeholder="SKU"
                      value={row.sku}
                      on:paste={(event) => handleCellPaste(event, index, 'sku')}
                      on:input={(event) => updateSku(index, event.currentTarget.value)}
                    />
                    {#if rowErrors?.[index]?.sku}
                      <p class="mt-1 text-xs text-red-400">{rowErrors[index].sku}</p>
                    {:else if isMissing}
                      <p class="mt-1 text-xs text-amber-400">SKU not found in system</p>
                    {/if}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3.5 text-gray-400 tabular-nums">
                    {row.percentDiscount.trim() ? `${row.percentDiscount}%` : '—'}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3.5 text-gray-400 tabular-nums">
                    {row.productDiscount.trim() ? row.productDiscount : '—'}
                  </td>
                  <td class="px-4 py-3.5">
                    <input
                      class={`w-full rounded-lg border px-3 py-2 text-sm text-gray-200 placeholder-gray-600 transition-colors focus:border-lime-500 focus:ring-1 focus:ring-lime-500 ${
                        rowErrors?.[index]?.price
                          ? 'border-red-500/50 bg-red-950/20'
                          : 'border-[#262a30] bg-[#0e1012]'
                      }`}
                      inputmode="decimal"
                      name={`price-${index}`}
                      placeholder="0.00"
                      value={row.price}
                      on:paste={(event) => handleCellPaste(event, index, 'price')}
                      on:input={(event) => updatePrice(index, event.currentTarget.value)}
                    />
                    {#if rowErrors?.[index]?.price}
                      <p class="mt-1 text-xs text-red-400">{rowErrors[index].price}</p>
                    {/if}
                  </td>
                  <td class="px-4 py-3.5 text-right">
                    <button
                      class="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-30 transition"
                      type="button"
                      on:click={() => removeRow(index)}
                      aria-label={`Remove row ${index + 1}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-2xl border border-[#262a30] bg-[#141619] shadow-xl overflow-hidden">
        <div class="border-b border-[#262a30] bg-[#181b20] px-4 py-3 flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-white">Saved price lists</p>
            <p class="text-xs text-gray-500">Loaded from Supabase</p>
          </div>
          {#if loadingPriceLists}
            <span class="text-xs text-lime-400">Loading…</span>
          {:else}
            <span class="text-xs text-gray-500">{priceLists.length} items</span>
          {/if}
        </div>

        {#if priceListsError}
          <div class="px-4 py-3 text-sm text-red-400">{priceListsError}</div>
        {:else if loadingPriceLists}
          <div class="px-4 py-3 space-y-2">
            <div class="h-10 rounded bg-[#1f2329] animate-pulse"></div>
            <div class="h-10 rounded bg-[#1f2329] animate-pulse"></div>
          </div>
        {:else if priceLists.length === 0}
          <div class="px-4 py-4 text-sm text-gray-400">No saved price lists found.</div>
        {:else}
          <ul class="divide-y divide-[#262a30]">
            {#each priceLists as item}
              <li class="px-4 py-3 space-y-1 hover:bg-[#1f2329]/60 transition-colors">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-white">{item.filename || 'Untitled'}</p>
                    <p class="text-xs text-gray-500">
                      Updated {formatDate(item.updated_at) || formatDate(item.created_at) || '—'}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <a
                      class="btn-secondary text-xs px-2.5 py-1"
                      href={`${base}/price-lists/build-price-list?id=${item.id}`}
                    >
                      Open
                    </a>
                    <button
                      class="btn-secondary text-xs px-2.5 py-1 disabled:opacity-60 disabled:cursor-not-allowed"
                      type="button"
                      on:click={() => duplicatePriceList(item)}
                      disabled={!!duplicatingId || !!deletingId}
                    >
                      {duplicatingId === item.id ? 'Duplicating…' : 'Duplicate'}
                    </button>
                    <button
                      class="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-950/20 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-30 transition"
                      type="button"
                      on:click={() => requestDelete(item)}
                      disabled={!!deletingId || !!duplicatingId}
                    >
                      {deletingId === item.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
                <div class="text-xs text-gray-500 flex gap-3">
                  <span>SKUs: {Array.isArray(item.sku_data) ? item.sku_data.length : 0}</span>
                  <span>Builder items: {Array.isArray(item.price_list_data) ? item.price_list_data.length : 0}</span>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>

  {#if showMissingModal}
    <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-[#141619] border border-[#262a30] p-6 rounded-2xl shadow-2xl max-w-md w-full text-gray-200">
        <h3 class="text-lg font-bold text-white mb-2">Some SKUs were not found</h3>
        <p class="text-sm text-gray-300 mb-4 leading-relaxed">
          The following SKUs are not in the system. Please remove them from the table, then try saving again.
        </p>
        <ul class="max-h-40 overflow-auto divide-y divide-[#262a30] rounded-lg border border-[#262a30] bg-[#0e1012]">
          {#each missingSkus as sku}
            <li class="px-3 py-2 text-sm text-gray-200">{sku}</li>
          {/each}
        </ul>
        <div class="mt-6 flex justify-end space-x-3">
          <button type="button" class="btn-secondary text-sm" on:click={() => (showMissingModal = false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if confirmDeleteId}
    <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-[#141619] border border-[#262a30] p-6 rounded-2xl shadow-2xl max-w-md w-full text-gray-200">
        <h3 class="text-lg font-bold text-white mb-2">Delete price list?</h3>
        <p class="text-sm text-gray-300 mb-6 leading-relaxed">
          Are you sure you want to delete <span class="font-semibold text-white">{confirmDeleteName}</span>? This
          action cannot be undone.
        </p>
        <div class="flex justify-end space-x-3">
          <button
            type="button"
            class="btn-secondary text-sm"
            on:click={cancelDelete}
            disabled={!!deletingId}
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-1.5 text-sm font-semibold text-red-400 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-30 transition"
            on:click={confirmDelete}
            disabled={!!deletingId}
          >
            {deletingId ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

