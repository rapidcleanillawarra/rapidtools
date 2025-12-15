<script lang="ts">
  export let loading: boolean;
  export let productsLength: number;
  export let paginatedProducts: any[];
  export let originalMap: Map<string, any>;

  export let selectedRows: Set<string>;
  export let selectAll: boolean;

  export let onSelectAll: (checked: boolean) => void;
  export let onToggleRowSelected: (sku: string, checked: boolean) => void;
  export let onApplyMarkupToAll: () => void;
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
      baselineBySku.set(sku, {
        purchase_price: baseline?.purchase_price,
        markup: baseline?.markup,
        rrp: baseline?.rrp
      });
      changed = true;
    }
    if (changed) baselineBySku = new Map(baselineBySku);
  }

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
    return Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, '');
  }

  function formatMarkupInputValue(value: unknown): string {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    if (!Number.isFinite(n) || n <= 0) return '';
    const out = n < 4 ? Math.max(0, (n - 1) * 100) : n;
    return Number.isInteger(out) ? String(out) : out.toFixed(2).replace(/\.?0+$/, '');
  }

  function toNumber(value: unknown): number | null {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    return Number.isFinite(n) ? n : null;
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
    return { txt: formatSigned(delta, formatNumberCompact), cls: deltaClass(delta) };
  }
</script>

<!-- Products Table -->
<div class="overflow-x-auto">
  {#if loading}
    <div class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
    </div>
  {:else if productsLength === 0}
    <div class="text-center py-8 text-gray-500">No products found</div>
  {:else}
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <input
              type="checkbox"
              checked={selectAll}
              on:change={(e) => {
                const target = e.target as HTMLInputElement | null;
                if (target) onSelectAll(target.checked);
              }}
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </th>
          <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IMG</th>
          <th
            class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            on:click={() => onSortClick('sku')}
          >
            SKU {getSortIcon('sku')}
          </th>
          <th
            class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            on:click={() => onSortClick('product_name')}
          >
            Product Name {getSortIcon('product_name')}
          </th>
          <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Price Info
          </th>
          <th
            class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            on:click={() => onSortClick('purchase_price')}
          >
            Purchase Price {getSortIcon('purchase_price')}
          </th>
          <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Markup
            <button class="ml-1 text-blue-600 hover:text-blue-800 text-xs" on:click={onApplyMarkupToAll}
              >Apply All</button
            >
          </th>
          <th
            class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            on:click={() => onSortClick('rrp')}
          >
            List Price {getSortIcon('rrp')}
          </th>
          <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Remove PriceGroups
          </th>
          <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Tax Free
          </th>
          <th
            class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
            on:click={() => onSortClick('updated')}
          >
            Status {getSortIcon('updated')}
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {#each paginatedProducts as product (product.sku)}
          {@const mainImage = getMainImage(product)}
          {@const original = baselineBySku.get(product.sku) ?? originalMap.get(product.sku) ?? product}
          <tr class={product.updated ? 'bg-green-50' : ''} data-is-updated={product.updated ? 'true' : 'false'}>
            <td class="px-2 py-1 whitespace-nowrap">
              <input
                type="checkbox"
                checked={selectedRows.has(product.sku)}
                on:change={(event) => {
                  const target = event.target as HTMLInputElement;
                  onToggleRowSelected(product.sku, target.checked);
                }}
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </td>
            <td class="px-2 py-1 text-xs">
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
            </td>
            <td class="px-2 py-1 text-xs break-words">
              <a
                href={`https://www.rapidsupplies.com.au/_cpanel/products/view?id=${product.inventory_id}`}
                target="_blank"
                class="text-blue-600 hover:underline"
              >
                {product.sku}
              </a>
            </td>
            <td class="px-2 py-1 text-xs break-words">{product.product_name}</td>
            <td class="px-2 py-1 text-xs">
              <table class="w-full text-[11px] text-gray-800 font-semibold">
                <tbody>
                  <tr>
                    <td class="pr-2 text-gray-600">Purchase</td>
                    <td>${original?.purchase_price}</td>
                  </tr>
                  <tr>
                    <td class="pr-2 text-gray-600">Markup</td>
                    <td>{formatMarkupDisplay(original?.markup)}</td>
                  </tr>
                  <tr>
                    <td class="pr-2 text-gray-600">List</td>
                    <td>${original?.rrp}</td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td class="px-2 py-1 text-xs">
              <input
                type="number"
                value={product.purchase_price}
                on:input={(e) =>
                  onUpdateProductPricingBySku(product.sku, { purchase_price: onNumberInput(e) }, 'markup')}
                class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-7 px-1"
                step="0.01"
              />
              {#if true}
                {@const ppDelta = moneyDeltaAlways(product.purchase_price, original?.purchase_price)}
                <div class={`field_number_changes mt-0.5 text-[10px] ${ppDelta.cls}`}>{ppDelta.txt || '$0'}</div>
              {/if}
            </td>
            <td class="px-2 py-1 text-xs">
              <input
                type="number"
                value={formatMarkupInputValue(product.markup)}
                on:input={(e) => {
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
                class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-7 px-1"
              />
              {#if true}
                {@const mupDelta = markupDeltaAlways(product.markup, original?.markup)}
                <div class={`field_number_changes mt-0.5 text-[10px] ${mupDelta.cls}`}>{mupDelta.txt || '0'}</div>
              {/if}
            </td>
            <td class="px-2 py-1 text-xs">
              <input
                type="number"
                value={product.rrp}
                on:input={(e) => onUpdateProductPricingBySku(product.sku, { rrp: onNumberInput(e) }, 'price')}
                class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-7 px-1"
                step="0.01"
              />
              {#if true}
                {@const rrpDelta = moneyDeltaAlways(product.rrp, original?.rrp)}
                <div class={`field_number_changes mt-0.5 text-[10px] ${rrpDelta.cls}`}>{rrpDelta.txt || '$0'}</div>
              {/if}
            </td>
            <td class="px-2 py-1 text-xs text-center">
              <input
                type="checkbox"
                checked={product.remove_pricegroups}
                on:change={(e) => {
                  const target = e.target as HTMLInputElement;
                  onUpdateProductBySku(product.sku, { remove_pricegroups: target.checked });
                }}
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </td>
            <td class="px-2 py-1 text-xs">
              <input
                type="checkbox"
                checked={product.tax_free}
                on:change={(e) => {
                  const target = e.target as HTMLInputElement;
                  onUpdateProductBySku(product.sku, { tax_free: target.checked });
                }}
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </td>
            <td class="px-2 py-1 text-xs flex gap-2">
              {#each getPriceComparisonStatus(product) as status}
                <span
                  class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${
                    status === 'PP>CP' ? 'bg-purple-900' : 'bg-red-900'
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
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
