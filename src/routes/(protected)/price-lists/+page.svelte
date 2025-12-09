<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  type Row = { sku: string; price: string };
  type RowError = { sku?: string; price?: string };

  const createEmptyRow = (): Row => ({ sku: '', price: '' });
  const createEmptyRows = (count = 5): Row[] => Array.from({ length: count }, createEmptyRow);

  const STORAGE_KEY = 'price-lists-rows';

  let rows: Row[] = createEmptyRows();
  let mounted = false;

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
      if (!Number.isFinite(numeric) || numeric <= 0) {
        errors.price = 'Price must be greater than 0';
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

  const handleSubmit = () => {
    const validRows = rows
      .map((row) => ({ row, errors: validateRow(row) }))
      .filter(({ errors }) => !errors.sku && !errors.price)
      .map(({ row }) => row);

    // Replace with API call when available
    console.log('Submitting rows:', validRows);
    goto(`${base}/price-lists/build-price-list`);
  };

  onMount(() => {
    mounted = true;
    loadRowsFromStorage();
  });
</script>

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto bg-white shadow p-6 space-y-6">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold text-gray-900">Price Lists</h1>
      <p class="text-sm text-gray-600">
        Paste SKUs and discounted prices. Prices sanitize commas and currency symbols, must be greater than
        zero, and support up to two decimals.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
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
        class="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        type="button"
        on:click={handleSubmit}
      >
        Submit
      </button>
    </div>

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
              <tr class={rowErrors?.[index]?.sku || rowErrors?.[index]?.price ? 'bg-red-50/60' : ''}>
                <td class="whitespace-nowrap px-4 py-3 text-gray-700">{index + 1}</td>
                <td class="px-4 py-3">
                  <input
                    class={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      rowErrors?.[index]?.sku ? 'border-red-400 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                    name={`sku-${index}`}
                    placeholder="SKU"
                    value={row.sku}
                    on:paste={(event) => handleCellPaste(event, index, 'sku')}
                    on:input={(event) => updateSku(index, event.currentTarget.value)}
                  />
                  {#if rowErrors?.[index]?.sku}
                    <p class="mt-1 text-xs text-red-600">{rowErrors[index].sku}</p>
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

      <div></div>
    </div>
  </div>
</div>

