<script lang="ts">
  export let loading: boolean;
  export let productsLength: number;
  export let paginatedProducts: any[];
  export let originalMap: Map<string, any>;

  export let selectedRows: Set<string>;
  export let selectAll: boolean;
  export let searchSku: string;
  export let searchProductName: string;

  export let onSelectAll: (checked: boolean) => void;
  export let onToggleRowSelected: (sku: string, checked: boolean) => void;
  export let onSearchSkuChange: (value: string) => void;
  export let onSearchProductNameChange: (value: string) => void;
  export let onClearSearch: () => void;
  export let onUpdateProductBySku: (sku: string, patch: Record<string, unknown>) => void;
  export let onUpdateProductPricingBySku: (
    sku: string,
    patch: Record<string, unknown>,
    source?: 'markup' | 'price'
  ) => void;
  export let onSortClick: (field: string) => void;

  export let getSortIcon: (field: string) => string;
  export let getMainImage: (product: any) => string | null;
  export let getPriceComparisonStatus: (product: any) => string[];
  export let onNumberInput: (e: Event) => number;
  export let onOpenPhotoViewer: (product: any) => void;

  let baselineBySku = new Map<string, { purchase_price: unknown; markup: unknown; rrp: unknown }>();
  $: {
    let changed = false;
    for (const product of paginatedProducts ?? []) {
      const sku = product?.sku;
      if (!sku || baselineBySku.has(sku)) continue;
      const baseline = originalMap.get(sku) ?? product;
      const baselinePurchasePrice = toNumber(baseline?.purchase_price, 0);
      const baselineRrp = toNumber(baseline?.rrp, 0);
      const baselineMarkup = baselinePurchasePrice > 0 ? round2(baselineRrp / baselinePurchasePrice) : 0;
      baselineBySku.set(sku, {
        purchase_price: baseline?.purchase_price,
        markup: baselineMarkup,
        rrp: baseline?.rrp
      });
      changed = true;
    }
    if (changed) baselineBySku = new Map(baselineBySku);
  }

  // Column resizing functionality
  let isResizing = false;
  let resizeIndex = -1;
  let startX = 0;
  let startWidth = 0;

  // Column definitions with initial widths
  let columnDefs = [
    { key: 'select', label: '', minWidth: 50, width: 50 },
    { key: 'img', label: 'IMG', minWidth: 60, width: 60 },
    { key: 'sku', label: 'SKU', minWidth: 100, width: 120 },
    { key: 'product_name', label: 'Product Name', minWidth: 150, width: 200 },
    { key: 'price_info', label: 'Price Info', minWidth: 80, width: 100 },
    { key: 'purchase_price', label: 'Purchase Price', minWidth: 100, width: 120 },
    { key: 'markup', label: 'Markup', minWidth: 100, width: 120 },
    { key: 'rrp', label: 'List Price', minWidth: 100, width: 120 },
    { key: 'difference', label: 'Difference', minWidth: 80, width: 100 },
    { key: 'remove_pricegroups', label: 'Remove PriceGroups', minWidth: 120, width: 140 },
    { key: 'tax_free', label: 'Tax Free', minWidth: 80, width: 100 },
    { key: 'status', label: 'Status', minWidth: 100, width: 120 }
  ];

  // Load column widths from localStorage
  function loadColumnWidths() {
    try {
      const saved = localStorage.getItem('products-table-column-widths');
      if (saved) {
        const widths = JSON.parse(saved);
        columnDefs.forEach(col => {
          if (widths[col.key]) {
            col.width = Math.max(col.minWidth, widths[col.key]);
          }
        });
      }
    } catch (e) {
      console.warn('Failed to load column widths:', e);
    }
  }

  // Save column widths to localStorage
  function saveColumnWidths() {
    try {
      const widths = {};
      columnDefs.forEach(col => {
        widths[col.key] = col.width;
      });
      localStorage.setItem('products-table-column-widths', JSON.stringify(widths));
    } catch (e) {
      console.warn('Failed to save column widths:', e);
    }
  }


  function startResize(e: MouseEvent, index: number) {
    isResizing = true;
    resizeIndex = index;
    startX = e.clientX;
    startWidth = columnDefs[index].width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isResizing || resizeIndex === -1) return;

    const deltaX = e.clientX - startX;
    const newWidth = Math.max(columnDefs[resizeIndex].minWidth, startWidth + deltaX);
    columnDefs[resizeIndex].width = newWidth;
    // Trigger reactivity by reassigning the array
    columnDefs = [...columnDefs];
  }

  function stopResize() {
    if (isResizing) {
      saveColumnWidths();
      isResizing = false;
      resizeIndex = -1;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }

  // Global mouse event listeners
  import { onMount, onDestroy } from 'svelte';

  onMount(() => {
    loadColumnWidths();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResize);
  });

  onDestroy(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', stopResize);
  });

  function formatMarkupDisplay(value: unknown): string {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    if (!Number.isFinite(n)) return '';
    if (n <= 0) return '';
    if (n < 4) {
      const pct = Math.max(0, (n - 1) * 100);
      const txt =
        Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, '');
      return `${txt}%`;
    }
    // For values >= 4, convert to percentage representation
    const pct = Math.max(0, (n - 1) * 100);
    const txt = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, '');
    return `${txt}%`;
  }

  function formatMarkupInputValue(value: unknown): string {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    if (!Number.isFinite(n)) return '';
    const out = n < 4 ? (n - 1) * 100 : n;
    return Number.isInteger(out) ? String(out) : out.toFixed(2).replace(/\.?0+$/, '');
  }

  function toNumber(value: unknown): number | null {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    return Number.isFinite(n) ? n : null;
  }

  function round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  function deltaClass(delta: number): string {
    if (delta > 0) return 'text-green-700';
    if (delta < 0) return 'text-red-700';
    return 'text-gray-400';
  }

  function formatSigned(delta: number, formatter: (n: number) => string, prefix = ''): string {
    const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
    return `${sign}${prefix}${formatter(Math.abs(delta))}`;
  }

  function formatMoney(n: number): string {
    return n.toFixed(2).replace(/\.?0+$/, '');
  }

  function moneyDelta(current: unknown, original: unknown): { txt: string; cls: string } | null {
    const cur = toNumber(current);
    const orig = toNumber(original);
    if (cur === null || orig === null) return null;
    const delta = cur - orig;
    if (delta === 0) return null;
    return { txt: formatSigned(delta, formatMoney, '$'), cls: deltaClass(delta) };
  }

  function moneyDeltaAlways(current: unknown, original: unknown): { txt: string; cls: string } {
    const cur = toNumber(current) ?? 0;
    const orig = toNumber(original) ?? 0;
    const delta = cur - orig;
    return { txt: formatSigned(delta, formatMoney, '$'), cls: deltaClass(delta) };
  }

  function formatNumberCompact(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
  }

  function computeMarkupDisplayValue(markup: unknown, percentMode: boolean): number | null {
    const n = toNumber(markup);
    if (n === null) return null;
    if (percentMode) return Math.max(0, (n - 1) * 100);
    return n;
  }

  function markupDelta(productMarkup: unknown, originalMarkup: unknown): { txt: string; cls: string } | null {
    const currentMarkup = toNumber(productMarkup);
    if (currentMarkup === null) return null;
    const percentMode = currentMarkup > 0 && currentMarkup < 4;

    const cur = computeMarkupDisplayValue(productMarkup, percentMode);
    const orig = computeMarkupDisplayValue(originalMarkup, percentMode);
    if (cur === null || orig === null) return null;

    const delta = cur - orig;
    if (delta === 0) return null;
    return { txt: formatSigned(delta, formatNumberCompact), cls: deltaClass(delta) };
  }

  function markupDeltaAlways(productMarkup: unknown, originalMarkup: unknown): { txt: string; cls: string } {
    const currentMarkup = toNumber(productMarkup) ?? 0;
    const percentMode = currentMarkup > 0 && currentMarkup < 4;

    const cur = computeMarkupDisplayValue(productMarkup, percentMode) ?? 0;
    const orig = computeMarkupDisplayValue(originalMarkup, percentMode) ?? 0;

    const delta = cur - orig;
    return { txt: formatSigned(delta, formatNumberCompact) + '%', cls: deltaClass(delta) };
  }
</script>

<!-- Products Table -->
<div class="overflow-x-auto">
  {#if loading}
    <div class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
    </div>
  {:else}
    <table class="min-w-full divide-y divide-gray-200" style="table-layout: fixed;">
      <thead class="bg-gray-50">
        <tr>
          {#each columnDefs as col, i}
            <th
              class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative select-none"
              style="width: {col.width}px; min-width: {col.minWidth}px;"
            >
              {#if col.key === 'select'}
                <input
                  type="checkbox"
                  checked={selectAll}
                  on:change={(e) => {
                    const target = e.target as HTMLInputElement | null;
                    if (target) onSelectAll(target.checked);
                  }}
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              {:else if col.key === 'img'}
                {col.label}
              {:else if col.key === 'sku'}
                <div
                  class="cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded"
                  on:click={() => onSortClick('sku')}
                >
                  {col.label} {getSortIcon('sku')}
                </div>
              {:else if col.key === 'product_name'}
                <div
                  class="cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded"
                  on:click={() => onSortClick('product_name')}
                >
                  {col.label} {getSortIcon('product_name')}
                </div>
              {:else if col.key === 'price_info'}
                {col.label}
              {:else if col.key === 'purchase_price'}
                <div
                  class="cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded"
                  on:click={() => onSortClick('purchase_price')}
                >
                  {col.label} {getSortIcon('purchase_price')}
                </div>
              {:else if col.key === 'markup'}
                {col.label}
              {:else if col.key === 'rrp'}
                <div
                  class="cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded"
                  on:click={() => onSortClick('rrp')}
                >
                  {col.label} {getSortIcon('rrp')}
                </div>
              {:else if col.key === 'difference'}
                {col.label}
              {:else if col.key === 'remove_pricegroups'}
                {col.label}
              {:else if col.key === 'tax_free'}
                {col.label}
              {:else if col.key === 'status'}
                <div
                  class="cursor-pointer hover:bg-gray-100 -mx-2 px-2 py-1 rounded"
                  on:click={() => onSortClick('updated')}
                >
                  {col.label} {getSortIcon('updated')}
                </div>
              {/if}

              <!-- Resize handle -->
              {#if i < columnDefs.length - 1}
                <div
                  class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300 bg-gray-300 opacity-0 hover:opacity-100 transition-opacity"
                  on:mousedown={(e) => startResize(e, i)}
                  style="user-select: none;"
                ></div>
              {/if}
            </th>
          {/each}
        </tr>
        <tr class="bg-gray-50 border-t border-gray-200">
          {#each columnDefs as col, i}
            <th class="px-2 py-1 relative" style="width: {col.width}px; min-width: {col.minWidth}px;">
              {#if col.key === 'sku'}
                <input
                  type="text"
                  bind:value={searchSku}
                  on:input={(e) => onSearchSkuChange(e.target.value)}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-7 px-2"
                  placeholder="Search SKU"
                />
              {:else if col.key === 'product_name'}
                <input
                  type="text"
                  bind:value={searchProductName}
                  on:input={(e) => onSearchProductNameChange(e.target.value)}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-7 px-2"
                  placeholder="Search Product Name"
                />
              {:else if col.key === 'price_info'}
                {#if searchSku.trim() || searchProductName.trim()}
                  <button
                    type="button"
                    class="text-xs text-blue-600 hover:text-blue-800"
                    on:click={onClearSearch}
                  >
                    Clear search
                  </button>
                {/if}
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {#if productsLength === 0}
          <tr>
            <td colspan="12" class="px-2 py-8 text-center text-gray-500">
              No products found
            </td>
          </tr>
        {:else}
          {#each paginatedProducts as product (product.sku)}
            {@const mainImage = getMainImage(product)}
            {@const original = baselineBySku.get(product.sku) ?? originalMap.get(product.sku) ?? product}
            {@const currentDiff = (toNumber(product.rrp) ?? 0) - (toNumber(product.purchase_price) ?? 0)}
            {@const originalDiff = (toNumber(original?.rrp) ?? 0) - (toNumber(original?.purchase_price) ?? 0)}
            {@const diffDelta = currentDiff - originalDiff}
            <tr class={product.updated ? 'bg-green-50' : ''} data-is-updated={product.updated ? 'true' : 'false'}>
              {#each columnDefs as col, i}
                <td
                  class="px-2 py-1 text-xs break-words"
                  style="width: {col.width}px; min-width: {col.minWidth}px;"
                >
                  {#if col.key === 'select'}
                    <input
                      type="checkbox"
                      checked={selectedRows.has(product.sku)}
                      on:change={(event) => {
                        const target = event.target as HTMLInputElement;
                        onToggleRowSelected(product.sku, target.checked);
                      }}
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  {:else if col.key === 'img'}
                    {#if mainImage}
                      <button
                        type="button"
                        class="flex items-center"
                        on:click={() => onOpenPhotoViewer(product)}
                        aria-label={`Open photo viewer for ${product.product_name || product.sku}`}
                      >
                        <img
                          src={mainImage}
                          alt={`Main image for ${product.product_name || product.sku}`}
                          class="h-12 w-12 object-contain border rounded bg-gray-50 hover:ring-2 hover:ring-blue-500"
                          loading="lazy"
                        />
                      </button>
                    {:else}
                      <span class="text-[10px] text-gray-400">No image</span>
                    {/if}
                  {:else if col.key === 'sku'}
                    <a
                      href={`https://www.rapidsupplies.com.au/_cpanel/products/view?id=${product.inventory_id}`}
                      target="_blank"
                      class="text-blue-600 hover:underline"
                    >
                      {product.sku}
                    </a>
                  {:else if col.key === 'product_name'}
                    {product.product_name}
                  {:else if col.key === 'price_info'}
                    <table class="w-full text-[11px] text-left">
                      <tbody>
                        <tr>
                          <td class="pr-2 text-gray-600 font-medium">Purchase</td>
                          <td class="font-semibold">${original?.purchase_price}</td>
                        </tr>
                        <tr>
                          <td class="pr-2 text-gray-600 font-medium">Markup</td>
                          <td class="font-semibold {toNumber(original?.markup) >= 0 ? 'text-green-700' : 'text-red-700'}">{formatMarkupDisplay(original?.markup)}</td>
                        </tr>
                        <tr>
                          <td class="pr-2 text-gray-600 font-medium">List</td>
                          <td class="font-semibold">${original?.rrp}</td>
                        </tr>
                        <tr>
                          <td class="pr-2 text-gray-600 font-medium">Difference</td>
                          <td class="font-semibold {deltaClass((toNumber(original?.rrp) ?? 0) - (toNumber(original?.purchase_price) ?? 0))}">${formatMoney((toNumber(original?.rrp) ?? 0) - (toNumber(original?.purchase_price) ?? 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  {:else if col.key === 'purchase_price'}
                    <input
                      type="number"
                      value={product.purchase_price}
                      on:blur={(e) =>
                        onUpdateProductPricingBySku(product.sku, { purchase_price: onNumberInput(e) }, 'markup')}
                      class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-7 px-1 no-spinner"
                      step="0.01"
                    />
                    {#if true}
                      {@const ppDelta = moneyDeltaAlways(product.purchase_price, original?.purchase_price)}
                      <div class={`field_number_changes mt-0.5 text-[10px] ${ppDelta.cls}`}>{ppDelta.txt || '$0'}</div>
                    {/if}
                  {:else if col.key === 'markup'}
                    <input
                      type="number"
                      value={formatMarkupInputValue(product.markup)}
                      on:blur={(e) => {
                        const target = e.target as HTMLInputElement | null;
                        if (!target) return;
                        if (!target.value) return;

                        const current =
                          typeof product.markup === 'number'
                            ? product.markup
                            : parseFloat(String(product.markup ?? ''));
                        const percentMode = Number.isFinite(current) && current > 0 && current < 4;

                        const n = parseFloat(target.value);
                        if (!Number.isFinite(n)) return;
                        const next = percentMode ? 1 + Math.max(0, n) / 100 : n;
                        onUpdateProductPricingBySku(product.sku, { markup: next }, 'markup');
                      }}
                      class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-7 px-1 no-spinner"
                    />
                    {#if true}
                      {@const mupDelta = markupDeltaAlways(product.markup, original?.markup)}
                      <div class={`field_number_changes mt-0.5 text-[10px] ${mupDelta.cls}`}>{mupDelta.txt || '0'}</div>
                    {/if}
                  {:else if col.key === 'rrp'}
                    <input
                      type="number"
                      value={product.rrp}
                      on:blur={(e) => onUpdateProductPricingBySku(product.sku, { rrp: onNumberInput(e) }, 'price')}
                      class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-7 px-1 no-spinner"
                      step="0.01"
                    />
                    {#if true}
                      {@const rrpDelta = moneyDeltaAlways(product.rrp, original?.rrp)}
                      <div class={`field_number_changes mt-0.5 text-[10px] ${rrpDelta.cls}`}>{rrpDelta.txt || '$0'}</div>
                    {/if}
                  {:else if col.key === 'difference'}
                    <span class={diffDelta !== 0 ? deltaClass(diffDelta) : ''}>
                      ${formatMoney(currentDiff)}
                    </span>
                  {:else if col.key === 'remove_pricegroups'}
                    <input
                      type="checkbox"
                      checked={product.remove_pricegroups}
                      on:change={(e) => {
                        const target = e.target as HTMLInputElement;
                        onUpdateProductBySku(product.sku, { remove_pricegroups: target.checked });
                      }}
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  {:else if col.key === 'tax_free'}
                    <input
                      type="checkbox"
                      checked={product.tax_free}
                      on:change={(e) => {
                        const target = e.target as HTMLInputElement;
                        onUpdateProductBySku(product.sku, { tax_free: target.checked });
                      }}
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  {:else if col.key === 'status'}
                    <div class="flex gap-2">
                      {#each getPriceComparisonStatus(product) as status}
                        <span
                          class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${
                            status === 'PP>RRP' ? 'bg-red-900' : 'bg-purple-900'
                          }`}
                        >
                          {status}
                        </span>
                      {/each}
                      {#if product.updated}
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                        >
                          Updated
                        </span>
                      {/if}
                    </div>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  {/if}
</div>
