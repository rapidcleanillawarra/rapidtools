<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { currentUser } from '$lib/firebase';
  import { supabase } from '$lib/supabase';

  type Row = { sku: string; price: string };
  type RowError = { sku?: string; price?: string };
  type PriceListRecord = {
    id: string;
    filename: string;
    created_at?: string;
    updated_at?: string;
    sku_data?: Row[];
    price_list_data?: any[];
  };

  const createEmptyRow = (): Row => ({ sku: '', price: '' });
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

  type OrderLineResponse = { SKU?: string; UnitPrice?: string; Quantity?: string; OrderLineID?: string };
  const loadFromOrder = async () => {
    const id = orderId.trim();
    if (!id) {
      orderError = 'Enter an order ID';
      return;
    }
    orderError = '';
    loadingOrder = true;
    try {
      const payload = {
        Filter: {
          OrderID: [id],
          OutputSelector: ['OrderLine', 'OrderLine.SKU', 'OrderLine.UnitPrice']
        },
        action: 'GetOrder'
      };
      const response = await fetch(getOrderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data?.Ack !== 'Success' || !Array.isArray(data?.Order) || data.Order.length === 0) {
        orderError = data?.Ack === 'Success' ? 'Order not found' : 'Failed to load order. Please try again.';
        return;
      }
      const orderLines: OrderLineResponse[] = data.Order[0]?.OrderLine ?? [];
      if (!orderLines.length) {
        orderError = 'Order has no lines';
        return;
      }
      rows = orderLines.map((line) => ({
        sku: (line.SKU ?? '').toString().trim(),
        price: sanitizePrice((line.UnitPrice ?? '').toString())
      }));
    } catch (error) {
      console.error('Failed to load order', error);
      orderError = 'Unable to load order. Please try again.';
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

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto bg-white shadow p-6 space-y-6">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold text-gray-900">Price Lists</h1>
      <p class="text-sm text-gray-600">
        Paste SKUs and discounted prices. Prices sanitize commas and currency symbols, must be 0 or greater,
        and support up to two decimals.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2">
        <label for="order-id" class="text-sm font-medium text-gray-700 sr-only">Order ID</label>
        <input
          id="order-id"
          type="text"
          class="rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Order ID (e.g. 26-0012347)"
          bind:value={orderId}
          on:keydown={(e) => e.key === 'Enter' && loadFromOrder()}
        />
        <button
          class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          type="button"
          on:click={loadFromOrder}
          disabled={loadingOrder}
        >
          {loadingOrder ? 'Loading…' : 'Load from order'}
        </button>
      </div>
      <button
        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        type="button"
        on:click={() => addRows(1)}
      >
        Add row
      </button>
      <button
        class="rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        type="button"
        on:click={clearRows}
      >
        Clear all
      </button>
      <button
        class="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
        type="button"
        on:click={handleSubmit}
        disabled={submitting}
      >
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
    </div>
    {#if orderError}
      <p class="text-sm text-red-600">{orderError}</p>
    {/if}
    {#if skuCheckError}
      <p class="text-sm text-red-600">{skuCheckError}</p>
    {/if}

    <div class="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div class="overflow-auto rounded-lg border border-gray-200 shadow-sm">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-gray-700">#</th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700">SKU</th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700">Discounted Price</th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700">
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white">
            {#each rows as row, index}
              {@const isMissing = missingSkus.includes(row.sku.trim())}
              <tr
                class={`${rowErrors?.[index]?.sku || rowErrors?.[index]?.price ? 'bg-red-50/60' : ''} ${isMissing ? 'bg-amber-50' : ''}`}
              >
                <td class="whitespace-nowrap px-4 py-3 text-gray-700">{index + 1}</td>
                <td class="px-4 py-3">
                  <input
                    class={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      rowErrors?.[index]?.sku
                        ? 'border-red-400 bg-white'
                        : isMissing
                          ? 'border-amber-400 bg-white'
                          : 'border-gray-200 bg-gray-50'
                    }`}
                    name={`sku-${index}`}
                    placeholder="SKU"
                    value={row.sku}
                    on:paste={(event) => handleCellPaste(event, index, 'sku')}
                    on:input={(event) => updateSku(index, event.currentTarget.value)}
                  />
                  {#if rowErrors?.[index]?.sku}
                    <p class="mt-1 text-xs text-red-600">{rowErrors[index].sku}</p>
                  {:else if isMissing}
                    <p class="mt-1 text-xs text-amber-700">SKU not found in system</p>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <input
                    class={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      rowErrors?.[index]?.price ? 'border-red-400 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    inputmode="decimal"
                    name={`price-${index}`}
                    placeholder="0.00"
                    value={row.price}
                    on:paste={(event) => handleCellPaste(event, index, 'price')}
                    on:input={(event) => updatePrice(index, event.currentTarget.value)}
                  />
                  {#if rowErrors?.[index]?.price}
                    <p class="mt-1 text-xs text-red-600">{rowErrors[index].price}</p>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    class="text-sm font-semibold text-red-600 transition hover:text-red-700 focus:outline-none"
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

      <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div class="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-gray-800">Saved price lists</p>
            <p class="text-xs text-gray-500">Loaded from Supabase</p>
          </div>
          {#if loadingPriceLists}
            <span class="text-xs text-blue-600">Loading…</span>
          {:else}
            <span class="text-xs text-gray-500">{priceLists.length} items</span>
          {/if}
        </div>

        {#if priceListsError}
          <div class="px-4 py-3 text-sm text-red-600">{priceListsError}</div>
        {:else if loadingPriceLists}
          <div class="px-4 py-3 space-y-2">
            <div class="h-10 rounded bg-gray-100 animate-pulse"></div>
            <div class="h-10 rounded bg-gray-100 animate-pulse"></div>
          </div>
        {:else if priceLists.length === 0}
          <div class="px-4 py-4 text-sm text-gray-600">No saved price lists found.</div>
        {:else}
          <ul class="divide-y divide-gray-100">
            {#each priceLists as item}
              <li class="px-4 py-3 space-y-1">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-gray-900">{item.filename || 'Untitled'}</p>
                    <p class="text-xs text-gray-500">
                      Updated {formatDate(item.updated_at) || formatDate(item.created_at) || '—'}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <a
                      class="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                      href={`${base}/price-lists/build-price-list?id=${item.id}`}
                    >
                      Open
                    </a>
                    <button
                      class="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      type="button"
                      on:click={() => duplicatePriceList(item)}
                      disabled={!!duplicatingId || !!deletingId}
                    >
                      {duplicatingId === item.id ? 'Duplicating…' : 'Duplicate'}
                    </button>
                    <button
                      class="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      type="button"
                      on:click={() => requestDelete(item)}
                      disabled={!!deletingId || !!duplicatingId}
                    >
                      {deletingId === item.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
                <div class="text-xs text-gray-600 flex gap-3">
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
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold text-gray-900">Some SKUs were not found</h2>
        <p class="mt-2 text-sm text-gray-700">
          The following SKUs are not in the system. Please remove them from the table, then try saving again.
        </p>
        <ul class="mt-3 max-h-40 overflow-auto divide-y divide-gray-100 rounded border border-gray-200 bg-gray-50">
          {#each missingSkus as sku}
            <li class="px-3 py-2 text-sm text-gray-900">{sku}</li>
          {/each}
        </ul>
        <div class="mt-4 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            on:click={() => (showMissingModal = false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if confirmDeleteId}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold text-gray-900">Delete price list?</h2>
        <p class="mt-2 text-sm text-gray-700">
          Are you sure you want to delete <span class="font-semibold">{confirmDeleteName}</span>? This action
          cannot be undone.
        </p>
        <div class="mt-5 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            on:click={cancelDelete}
            disabled={!!deletingId}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
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

