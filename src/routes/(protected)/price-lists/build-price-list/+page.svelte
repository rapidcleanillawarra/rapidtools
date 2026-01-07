<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import { supabase } from '$lib/supabase';

  type Row = {
    sku: string;
    price: string;
    model?: string;
    rrp?: string;
    imageUrl?: string;
    hasDescription?: boolean;
  };
  type BuilderItem = Row & {
    id: string;
    kind: 'sku' | 'static';
    staticType?: 'page_break' | 'range' | 'category';
    value?: string;
    sourceIndex?: number;
  };
  type StaticItem = { id: string; label: string; type: 'page_break' | 'range' | 'category' };

  let filename = '';
  let rows: Row[] = [];
  let builderItems: BuilderItem[] = [];
  let draggingIndex: number | null = null;
  let builderListEl: HTMLUListElement | null = null;
  let latestPriceListId: string | number | null = null;
  let saving = false;
  let filenameError = '';
  let saveMessage = '';
  let priceListId: string | null = null;
  let newSku = '';
  let newPrice = '';
  let addSkuError = '';
  let addSkuSuccess = '';
  let checkingSku = false;
  let detailError = '';
  let includeRrpInPrint = false;
  const staticItems: StaticItem[] = [
    { id: 'page-break', label: 'Page Break', type: 'page_break' },
    { id: 'range', label: 'Range', type: 'range' },
    { id: 'category', label: 'Category', type: 'category' }
  ];
  const staticColorMap: Record<
    StaticItem['type'],
    { border: string; bg: string; hover: string; active: string; text: string; dot: string }
  > = {
    page_break: {
      border: 'border-gray-300',
      bg: 'bg-gray-50',
      hover: 'hover:bg-gray-100',
      active: 'active:bg-gray-200',
      text: 'text-gray-800',
      dot: 'bg-gray-500'
    },
    range: {
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      hover: 'hover:bg-blue-100',
      active: 'active:bg-blue-200',
      text: 'text-blue-700',
      dot: 'bg-blue-600'
    },
    category: {
      border: 'border-green-200',
      bg: 'bg-green-50',
      hover: 'hover:bg-green-100',
      active: 'active:bg-green-200',
      text: 'text-green-700',
      dot: 'bg-green-600'
    }
  };
  let loading = true;
  let errorMessage = '';
  const BUILDER_STORAGE_KEY = 'price-list-builder-state';
  const skuCheckUrl =
    'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';

  const getStaticStyle = (type: StaticItem['type']) => staticColorMap[type] ?? staticColorMap.page_break;

  const toBuilderItem = (row: Row, index: number): BuilderItem => ({
    id: `${row.sku || 'row'}-${index}-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
    ...row,
    kind: 'sku',
    sourceIndex: index
  });

  const loadLatestPriceList = async (id: string): Promise<boolean> => {
    loading = true;
    errorMessage = '';
    try {
      const { data, error } = await supabase
        .from('price_lists')
        .select('id, filename, sku_data, price_list_data')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      latestPriceListId = data?.id ?? null;
      filename = data?.filename ?? '';
      let skuData: any = data?.sku_data ?? [];
      if (typeof skuData === 'string') {
        try {
          skuData = JSON.parse(skuData);
        } catch (parseErr) {
          console.error('Failed to parse sku_data', parseErr);
          skuData = [];
        }
      }
      rows = Array.isArray(skuData)
        ? skuData.map((item: any) => ({
            sku: item?.sku?.toString() ?? '',
            price: item?.price?.toString() ?? '',
            model: item?.model,
            rrp: item?.rrp,
            imageUrl: item?.imageUrl,
            hasDescription: item?.hasDescription
          }))
        : [];

      let priceListData: any = data?.price_list_data ?? [];
      if (typeof priceListData === 'string') {
        try {
          priceListData = JSON.parse(priceListData);
        } catch (parseErr) {
          console.error('Failed to parse price_list_data', parseErr);
          priceListData = [];
        }
      }

      const serverBuilder = Array.isArray(priceListData)
        ? (priceListData as BuilderItem[]).map((item, idx) => ({
            id: item.id ?? `${item.sku || 'item'}-${idx}-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
            sku: item.sku ?? '',
            price: item.price ?? '',
            kind: item.kind ?? 'sku',
            staticType: item.staticType,
            value: item.value,
            sourceIndex: item.sourceIndex,
            rrp: item.rrp,
            model: item.model,
            imageUrl: item.imageUrl,
            hasDescription: item.hasDescription
          }))
        : [];
      builderItems = serverBuilder;
      syncRowsWithBuilder();
      const skusToEnrich = getAllSkus();
      if (skusToEnrich.length) {
        try {
          const detailMap = await fetchSkuDetails(skusToEnrich);
          mergeSkuDetails(detailMap);
          mergeBuilderDetails(detailMap);
        } catch (err) {
          console.error('Failed to load SKU details', err);
          detailError = 'Unable to load SKU details.';
        }
      }
      return serverBuilder.length > 0;
    } catch (err: any) {
      console.error('Failed to load price list', err);
      errorMessage = 'Unable to load price list. Please try again.';
      rows = [];
      builderItems = [];
      return false;
    } finally {
      loading = false;
    }
  };

  const handleDragStart = (event: DragEvent, row: Row, index: number) => {
    const item = toBuilderItem(row, index);
    event.dataTransfer?.setData('application/json', JSON.stringify(item));
    event.dataTransfer?.setData('text/plain', row.sku);
    event.dataTransfer && (event.dataTransfer.effectAllowed = 'copy');
  };

  const handleStaticDragStart = (event: DragEvent, item: StaticItem) => {
    event.dataTransfer?.setData('application/static-item', JSON.stringify(item));
    event.dataTransfer?.setData('text/plain', item.label);
    event.dataTransfer && (event.dataTransfer.effectAllowed = 'copy');
  };

  const handleBuilderDragStart = (event: DragEvent, index: number) => {
    draggingIndex = index;
    event.dataTransfer?.setData('builder-index', index.toString());
    event.dataTransfer?.setData('text/plain', builderItems[index]?.sku ?? '');
    event.dataTransfer && (event.dataTransfer.effectAllowed = 'move');
  };

  const getDropIndexFromPointer = (event: DragEvent) => {
    if (!builderListEl) return builderItems.length;
    const children = Array.from(builderListEl.children);
    const y = event.clientY;
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (y < rect.top + rect.height / 2) {
        return i;
      }
    }
    return builderItems.length;
  };

  const removeSourceRow = (item: BuilderItem) => {
    if (item.kind !== 'sku') return;
    const byIndex =
      typeof item.sourceIndex === 'number' && rows[item.sourceIndex]?.sku === item.sku
        ? item.sourceIndex
        : rows.findIndex((r) => r.sku === item.sku && r.price === item.price);
    if (byIndex >= 0) {
      rows = [...rows.slice(0, byIndex), ...rows.slice(byIndex + 1)];
    }
  };

  const syncRowsWithBuilder = () => {
    let nextRows = [...rows];
    builderItems = builderItems.map((item) => {
      if (item.kind !== 'sku') return item;
      const matchIndex = nextRows.findIndex((r) => r.sku === item.sku && r.price === item.price);
      if (matchIndex >= 0) {
        nextRows.splice(matchIndex, 1);
        return { ...item, sourceIndex: item.sourceIndex ?? matchIndex };
      }
      return item;
    });
    rows = nextRows;
  };

  const sanitizePrice = (raw: string) => raw.replace(/[^0-9.]/g, '');

  const getAllSkus = () => {
    const set = new Set<string>();
    rows.forEach((r) => r.sku && set.add(r.sku));
    builderItems.forEach((b) => {
      if (b.kind === 'sku' && b.sku) set.add(b.sku);
    });
    return Array.from(set).filter(Boolean);
  };

  const getMainImage = (images: any[] = []) => {
    if (!Array.isArray(images)) return '';
    const main = images.find((img) => img?.Name === 'Main' && img?.URL);
    if (main?.URL) return main.URL;
    const first = images.find((img) => img?.URL);
    return first?.URL ?? '';
  };

  const fetchSkuDetails = async (skus: string[]) => {
    if (!skus.length) return {};
    const payload = {
      Filter: {
        SKU: skus,
        OutputSelector: ['SKU', 'Model', 'Images', 'RRP', 'ShortDescription']
      },
      action: 'GetItem'
    };

    const response = await fetch(skuCheckUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    console.log('SKU detail response', data);
    if (data?.Ack !== 'Success') {
      throw new Error('SKU detail fetch failed');
    }
    const map: Record<string, { model?: string; rrp?: string; imageUrl?: string; hasDescription?: boolean }> = {};
    (data.Item ?? []).forEach((item: any) => {
      const sku = item?.SKU;
      if (!sku) return;
      map[sku] = {
        model: item?.Model ?? '',
        rrp: item?.RRP?.toString?.() ?? '',
        imageUrl: getMainImage(item?.Images),
        hasDescription: Boolean(item?.ShortDescription)
      };
    });
    return map;
  };

  const mergeSkuDetails = (details: Record<string, { model?: string; rrp?: string; imageUrl?: string; hasDescription?: boolean }>) => {
    if (!details || typeof details !== 'object') return;
    rows = rows.map((row) => {
      const detail = details[row.sku];
      if (!detail) return row;
      return {
        ...row,
        model: detail.model || row.model,
        rrp: detail.rrp || row.rrp,
        imageUrl: detail.imageUrl || row.imageUrl,
        hasDescription: detail.hasDescription ?? row.hasDescription
      };
    });
  };

  const mergeBuilderDetails = (details: Record<string, { model?: string; rrp?: string; imageUrl?: string; hasDescription?: boolean }>) => {
    if (!details || typeof details !== 'object') return;
    console.log('Builder SKU detail map', details);
    builderItems = builderItems.map((item) => {
      if (item.kind !== 'sku') return item;
      const detail = details[item.sku];
      if (!detail) return item;
      return {
        ...item,
        model: detail.model || item.model,
        rrp: detail.rrp || item.rrp,
        imageUrl: detail.imageUrl || item.imageUrl,
        hasDescription: detail.hasDescription ?? item.hasDescription
      };
    });
  };

  const getPriceHighlight = (row: { price?: string; rrp?: string }) => {
    const price = Number(row.price);
    const rrp = Number(row.rrp);
    if (!Number.isFinite(price) || !Number.isFinite(rrp)) return '';
    if (price < rrp) return 'bg-green-50 text-green-800 font-semibold';
    if (price > rrp) return 'bg-red-50 text-red-800 font-semibold';
    return '';
  };

  const checkSkuExists = async (sku: string) => {
    const payload = {
      Filter: {
        SKU: [sku],
        OutputSelector: ['SKU']
      },
      action: 'GetItem'
    };

    const response = await fetch(skuCheckUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`SKU check failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log('SKU exists check response', data);
    if (data?.Ack !== 'Success') {
      throw new Error('SKU check failed');
    }
    const existingSkus = new Set((data.Item ?? []).map((item: any) => item.SKU));
    return existingSkus.has(sku);
  };

  const addSkuRow = async () => {
    addSkuError = '';
    addSkuSuccess = '';
    const sku = newSku.trim();
    const price = sanitizePrice(newPrice.trim());

    if (!sku || !price) {
      addSkuError = 'SKU and price are required';
      return;
    }

    if (rows.some((row) => row.sku === sku)) {
      addSkuError = 'SKU already exists in the list';
      return;
    }

    checkingSku = true;
    try {
      const exists = await checkSkuExists(sku);
      if (!exists) {
        addSkuError = 'SKU not found in the system. Please request the product first.';
        return;
      }

      rows = [...rows, { sku, price }];
      try {
        const detailMap = await fetchSkuDetails([sku]);
        mergeSkuDetails(detailMap);
        mergeBuilderDetails(detailMap);
      } catch (err) {
        console.error('Failed to fetch SKU details', err);
        detailError = 'Unable to load extra details for the SKU.';
      }
      newSku = '';
      newPrice = '';
      addSkuSuccess = 'SKU added.';
      setTimeout(() => (addSkuSuccess = ''), 2000);
    } catch (err) {
      console.error('Failed to verify SKU', err);
      addSkuError = 'Unable to verify SKU. Please try again.';
    } finally {
      checkingSku = false;
    }
  };

  const insertBuilderItemFromEvent = (event: DragEvent, insertIndex?: number) => {
    const targetIndex = typeof insertIndex === 'number' ? insertIndex : builderItems.length;
    const data = event.dataTransfer?.getData('application/json');
    const staticData = event.dataTransfer?.getData('application/static-item');

    if (staticData) {
      try {
        const item = JSON.parse(staticData) as StaticItem;
        const nextItem: BuilderItem = {
          id: `${item.id}-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
          sku: item.label,
          price: '',
          kind: 'static',
          staticType: item.type,
          value: ''
        };
        builderItems = [
          ...builderItems.slice(0, targetIndex),
          nextItem,
          ...builderItems.slice(targetIndex)
        ];
        return true;
      } catch (err) {
        console.error('Failed to parse static item', err);
        return false;
      }
    }

    if (data) {
      try {
        const item = JSON.parse(data) as BuilderItem;
        const nextItem = {
          ...item,
          id: `${item.id}-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`
        };
        builderItems = [
          ...builderItems.slice(0, targetIndex),
          nextItem,
          ...builderItems.slice(targetIndex)
        ];
        removeSourceRow(item);
        return true;
      } catch (err) {
        console.error('Failed to parse dropped item', err);
        return false;
      }
    }

    return false;
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    insertBuilderItemFromEvent(event);
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer && (event.dataTransfer.dropEffect = 'copy');
  };

  const handleBuilderDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer && (event.dataTransfer.dropEffect = 'move');
  };

  const handleBuilderDrop = (event: DragEvent, targetIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    const sourceIndexStr = event.dataTransfer?.getData('builder-index');

    if (sourceIndexStr) {
      const sourceIndex = parseInt(sourceIndexStr, 10);
      if (!Number.isNaN(sourceIndex) && sourceIndex !== targetIndex) {
        const next = [...builderItems];
        const [moved] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, moved);
        builderItems = next;
      }
      draggingIndex = null;
      return;
    }

    // If not a reorder, treat as inserting new item at the drop position
    insertBuilderItemFromEvent(event, targetIndex);
  };

  const handleExternalDragOver = (event: DragEvent) => {
    // Allow dropping SKUs/static blocks from outside the builder
    event.preventDefault();
    event.dataTransfer && (event.dataTransfer.dropEffect = 'copy');
  };

  const handleExternalDrop = (event: DragEvent) => {
    // Ignore drops originating from builder reorder (handled by dndzone)
    if (event.dataTransfer?.getData('builder-index')) return;
    event.preventDefault();
    event.stopPropagation();
    const targetIndex = getDropIndexFromPointer(event);
    insertBuilderItemFromEvent(event, targetIndex);
  };

  const handleDnd = (event: CustomEvent<DndEvent>) => {
    // svelte-dnd-action manages reorder; keep builderItems in sync
    builderItems = event.detail.items as BuilderItem[];
    draggingIndex = null;
  };

  const removeBuilderItem = (index: number) => {
    const item = builderItems[index];
    builderItems = builderItems.filter((_, i) => i !== index);

    // Return SKU items to the source list so they can be reused
    if (item?.kind === 'sku') {
      const insertAt = typeof item.sourceIndex === 'number' ? item.sourceIndex : rows.length;
      const next = [...rows];
      next.splice(Math.min(insertAt, next.length), 0, { sku: item.sku, price: item.price });
      rows = next;
    }
  };

  const saveBuilderLocally = () => {
    if (typeof localStorage === 'undefined') {
      saveMessage = 'Save unavailable (no local storage).';
      return;
    }
    try {
      const payload = { filename, builderItems };
      localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(payload));
      saveMessage = 'Builder saved locally.';
      setTimeout(() => (saveMessage = ''), 2500);
    } catch (err) {
      console.error('Failed to save builder', err);
      saveMessage = 'Save failed.';
    }
  };

  const loadBuilderFromStorage = () => {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(BUILDER_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed?.builderItems && Array.isArray(parsed.builderItems)) {
        builderItems = parsed.builderItems;
        syncRowsWithBuilder();
      }
      if (parsed?.filename) {
        filename = parsed.filename;
      }
    } catch (err) {
      console.error('Failed to load saved builder', err);
    }
  };

  const printBuilder = (mode: 'thumb' | 'list' = 'thumb') => {
    if (typeof window !== 'undefined' && priceListId) {
      const rrpParam = includeRrpInPrint ? '&includeRrp=true' : '';
      window.open(`${base}/price-lists/print?id=${priceListId}&mode=${mode}${rrpParam}`, '_blank');
    }
  };

  const saveBuilderRemote = async () => {
    filenameError = '';
    if (!filename.trim()) {
      filenameError = 'Filename is required';
      saveMessage = '';
      return;
    }

    saving = true;
    saveMessage = '';

    const payload = {
      filename,
      price_list_data: builderItems,
      sku_data: rows
    };

    try {
      if (latestPriceListId) {
        const { error } = await supabase.from('price_lists').update(payload).eq('id', latestPriceListId);
        if (error) throw error;
      } else {
        const { error, data } = await supabase
          .from('price_lists')
          .insert({ ...payload, sku_data: rows })
          .select('id')
          .single();
        if (error) throw error;
        latestPriceListId = data?.id ?? latestPriceListId;
      }
      saveBuilderLocally();
      saveMessage = 'Saved to cloud.';
    } catch (err) {
      console.error('Failed to save builder to Supabase', err);
      saveMessage = 'Save failed. Please try again.';
    } finally {
      saving = false;
    }
  };

  onMount(() => {
    priceListId = $page.url.searchParams.get('id');
    if (!priceListId) {
      goto(`${base}/price-lists`);
      return;
    }

    loadLatestPriceList(priceListId).then((hasBuilder) => {
      if (hasBuilder) {
        syncRowsWithBuilder();
      }
    });
  });
</script>

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Build Price List</h1>
        <p class="text-sm text-gray-600">Review and finalize the latest saved price list.</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <a
          class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          href="{base}/price-lists"
        >
          ← Back
        </a>
      </div>
    </div>

    <div class="bg-white shadow p-5 rounded-lg space-y-4">
      <div class="space-y-2">
        <label class="text-sm font-semibold text-gray-800" for="filename">Filename</label>
        <input
          id="filename"
          class={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            filenameError ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500'
          }`}
          placeholder="Enter filename"
          bind:value={filename}
          aria-invalid={filenameError ? 'true' : 'false'}
          required
        />
        {#if filenameError}
          <p class="text-xs text-red-600">{filenameError}</p>
        {/if}
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="bg-white px-4 py-3 border border-gray-200 rounded-lg space-y-3">
          <div class="grid gap-3 sm:grid-cols-[2fr,1fr,auto] items-end">
            <div>
              <label class="text-xs font-semibold text-gray-700" for="new-sku">SKU</label>
              <input
                id="new-sku"
                class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter SKU"
                bind:value={newSku}
              />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-700" for="new-price">Discounted Price</label>
              <input
                id="new-price"
                class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                bind:value={newPrice}
                inputmode="decimal"
              />
            </div>
            <div class="flex sm:justify-end">
              <button
                type="button"
                class="w-full sm:w-auto inline-flex items-center justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                on:click={addSkuRow}
                disabled={checkingSku}
              >
                {checkingSku ? 'Checking…' : 'Add SKU'}
              </button>
            </div>
          </div>
          {#if addSkuError}
            <p class="text-xs text-red-600">{addSkuError}</p>
          {/if}
          {#if addSkuSuccess}
            <p class="text-xs text-green-700">{addSkuSuccess}</p>
          {/if}
          {#if detailError}
            <p class="text-xs text-orange-600">{detailError}</p>
          {/if}
        </div>

        <div class="bg-white px-4 py-3 border border-gray-200 rounded-lg space-y-3">
          <p class="text-sm font-semibold text-gray-800">Static blocks</p>
          <div class="flex flex-wrap gap-2">
            {#each staticItems as item}
              {@const styles = getStaticStyle(item.type)}
              <button
                class={`flex items-center gap-2 rounded-md border ${styles.border} ${styles.bg} px-3 py-2 text-xs font-semibold ${styles.text} shadow-sm transition ${styles.hover} ${styles.active}`}
                draggable="true"
                on:dragstart={(e) => handleStaticDragStart(e, item)}
              >
                <span class={`h-2.5 w-2.5 rounded-full ${styles.dot}`} aria-hidden="true"></span>
                {item.label}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-2 items-stretch lg:min-h-[70vh]">
        <div class="space-y-0 rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div class="bg-gray-50 px-4 py-3 flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-gray-800">SKU & Prices</p>
            </div>
            {#if loading}
              <span class="text-xs text-blue-600">Loading…</span>
            {:else if errorMessage}
              <span class="text-xs text-red-600">Error</span>
            {:else}
              <span class="text-xs text-gray-500">{rows.length} items</span>
            {/if}
          </div>

          <div class="max-h-[500px] overflow-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">#</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">SKU</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">Disc Price</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">RRP</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 bg-white">
                {#if loading}
                  <tr>
                    <td class="px-4 py-3 text-sm text-gray-600" colspan="4">Loading...</td>
                  </tr>
                {:else if errorMessage}
                  <tr>
                    <td class="px-4 py-3 text-sm text-red-600" colspan="4">{errorMessage}</td>
                  </tr>
                {:else if rows.length === 0}
                  <tr>
                    <td class="px-4 py-3 text-sm text-gray-600" colspan="4">No price list data found.</td>
                  </tr>
                {:else}
                  {#each rows as row, index}
                    {@const priceClass = getPriceHighlight(row)}
                    <tr
                      draggable="true"
                      on:dragstart={(e) => handleDragStart(e, row, index)}
                      class="hover:bg-gray-50"
                    >
                      <td class="px-4 py-3 text-gray-700">{index + 1}</td>
                      <td class="px-4 py-3 text-gray-800">
                        <div class="flex items-center gap-3">
                          <div class="h-12 w-12 overflow-hidden rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
                            {#if row.imageUrl}
                              <img src={row.imageUrl} alt={row.sku} class="h-full w-full object-cover" loading="lazy" />
                            {:else}
                              <span class="text-xs text-gray-500">No image</span>
                            {/if}
                          </div>
                          <div class="space-y-1">
                            <p class="font-semibold text-gray-900">{row.sku}</p>
                            {#if row.model}
                              <p class="text-xs text-gray-600">{row.model}</p>
                            {/if}
                            {#if row.hasDescription}
                              <span class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                                Has description
                              </span>
                            {/if}
                          </div>
                        </div>
                      </td>
                      <td class={`px-4 py-3 text-gray-800 ${priceClass}`}>{row.price}</td>
                      <td class="px-4 py-3 text-gray-800">{row.rrp ?? '—'}</td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
        </div>

        <div
          class="rounded-lg border border-dashed border-blue-300 bg-blue-50/40 p-4 text-sm text-gray-800 min-h-[300px] flex flex-col gap-3 h-full min-h-0 lg:h-[70vh] lg:max-h-[70vh] overflow-hidden"
          role="list"
          aria-label="Builder dropzone"
          on:dragover={handleDragOver}
          on:drop={handleDrop}
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="font-semibold text-gray-900">Builder</p>
              <p class="text-xs text-gray-600">Drag SKUs or static blocks to add here.</p>
            </div>
            <span class="text-xs text-gray-500">{builderItems.length} items</span>
          </div>
          <div class="flex-1 rounded-md border border-dashed border-gray-200 bg-white/70 p-3 overflow-auto min-h-0 max-h-full">
            {#if builderItems.length === 0}
              <p class="text-xs text-gray-500">Drop SKUs or static blocks here to build your list.</p>
            {:else}
              <ul
                class="space-y-2"
                bind:this={builderListEl}
                use:dndzone={{ items: builderItems, flipDurationMs: 150 }}
                on:consider={handleDnd}
                on:finalize={handleDnd}
                on:dragover={handleExternalDragOver}
                on:drop={handleExternalDrop}
              >
                {#each builderItems as item, idx (item.id)}
                  {@const staticStyle = getStaticStyle(item.staticType ?? 'page_break')}
                  <li
                    class={`flex items-start justify-between rounded-md border px-3 py-2 shadow-sm text-sm cursor-move gap-3 ${
                      item.kind === 'static'
                        ? `${staticStyle.bg} ${staticStyle.border}`
                        : 'bg-white border-gray-200'
                    }`}
                    draggable="true"
                    on:dragstart={(e) => handleBuilderDragStart(e, idx)}
                    on:dragover={handleBuilderDragOver}
                    on:drop={(e) => handleBuilderDrop(e, idx)}
                  >
                    <div class="flex-1 flex gap-3">
                      {#if item.kind === 'sku'}
                        <div class="h-12 w-12 overflow-hidden rounded border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                          {#if item.imageUrl}
                            <img src={item.imageUrl} alt={item.sku} class="h-full w-full object-cover" loading="lazy" />
                          {:else}
                            <span class="text-[10px] text-gray-500 text-center px-1">No image</span>
                          {/if}
                        </div>
                      {/if}
                      <div class="space-y-1 flex-1">
                        <div class="flex items-center gap-2">
                          {#if item.kind === 'static' && (item.staticType === 'range' || item.staticType === 'category')}
                            <p class="font-semibold text-gray-900 sr-only">{item.sku}</p>
                          {:else}
                            <p class="font-semibold text-gray-900">{item.sku}</p>
                          {/if}
                          {#if item.kind === 'static' && item.staticType === 'page_break'}
                            <span class="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-700">Page Break</span>
                          {:else if item.kind === 'sku' && item.hasDescription}
                            <span class="text-[11px] inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 border border-blue-200">
                              Has description
                            </span>
                          {/if}
                        </div>
                        {#if item.kind === 'sku' && item.model}
                          <p class="text-xs text-gray-700">{item.model}</p>
                        {/if}

                        {#if item.kind === 'static' && (item.staticType === 'range' || item.staticType === 'category')}
                          <input
                            class="w-full rounded-md border border-gray-300 px-3 py-2 text-xs shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={item.staticType === 'range' ? 'Enter range' : 'Enter category'}
                            bind:value={item.value}
                          />
                        {:else if item.kind === 'static' && item.staticType === 'page_break'}
                          <p class="text-xs text-gray-600">Page separator</p>
                        {:else}
                          <p class={`text-xs ${getPriceHighlight(item)}`}>Price: {item.price}</p>
                          {#if item.rrp}
                            <p class="text-[11px] text-gray-600">RRP: {item.rrp}</p>
                          {/if}
                        {/if}
                      </div>
                    </div>
                    <div class="flex items-center gap-3">
                      <span class="text-xs text-gray-400">#{idx + 1}</span>
                      <button
                        type="button"
                        class="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 active:bg-red-200"
                        aria-label={`Remove ${item.sku}`}
                        on:click|stopPropagation={() => removeBuilderItem(idx)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            id="include-rrp"
            bind:checked={includeRrpInPrint}
            class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
          />
          <label for="include-rrp" class="text-sm text-gray-700">Include RRP in print</label>
        </div>
        {#if saveMessage}
          <span class="text-xs text-gray-600">{saveMessage}</span>
        {/if}
        <button
          type="button"
          class={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            saving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
          }`}
          on:click={saveBuilderRemote}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          on:click={() => printBuilder('thumb')}
        >
          Print as Thumb
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          on:click={() => printBuilder('list')}
        >
          Print as List
        </button>
      </div>
    </div>
  </div>
</div>