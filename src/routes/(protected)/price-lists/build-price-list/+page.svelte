<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  type Row = { sku: string; price: string };
  type BuilderItem = Row & { id: string; kind: 'sku' | 'static'; staticType?: 'page_break' | 'range' | 'category'; value?: string };
  type StaticItem = { id: string; label: string; type: 'page_break' | 'range' | 'category' };

  let filename = '';
  let rows: Row[] = [];
  let builderItems: BuilderItem[] = [];
  let draggingIndex: number | null = null;
  const staticItems: StaticItem[] = [
    { id: 'page-break', label: 'Page Break', type: 'page_break' },
    { id: 'range', label: 'Range', type: 'range' },
    { id: 'category', label: 'Category', type: 'category' }
  ];
  let loading = true;
  let errorMessage = '';

  const toBuilderItem = (row: Row, index: number): BuilderItem => ({
    id: `${row.sku || 'row'}-${index}-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
    ...row,
    kind: 'sku'
  });

  const loadLatestPriceList = async () => {
    loading = true;
    errorMessage = '';
    try {
      const { data, error } = await supabase
        .from('price_lists')
        .select('id, filename, sku_data')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        throw error;
      }

      filename = data?.filename ?? '';
      rows = Array.isArray(data?.sku_data)
        ? data.sku_data.map((item: any) => ({
            sku: item?.sku?.toString() ?? '',
            price: item?.price?.toString() ?? ''
          }))
        : [];
      builderItems = [];
    } catch (err: any) {
      console.error('Failed to load price list', err);
      errorMessage = 'Unable to load price list. Please try again.';
      rows = [];
      builderItems = [];
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

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    const data = event.dataTransfer?.getData('application/json');
    const staticData = event.dataTransfer?.getData('application/static-item');

    if (staticData) {
      try {
        const item = JSON.parse(staticData) as StaticItem;
        builderItems = [
          ...builderItems,
          {
            id: `${item.id}-${builderItems.length}`,
            sku: item.label,
            price: '',
            kind: 'static',
            staticType: item.type,
            value: ''
          }
        ];
        return;
      } catch (err) {
        console.error('Failed to parse static item', err);
        return;
      }
    }

    if (data) {
      try {
        const item = JSON.parse(data) as BuilderItem;
        builderItems = [...builderItems, { ...item, id: `${item.id}-${builderItems.length}` }];
      } catch (err) {
        console.error('Failed to parse dropped item', err);
      }
    }
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

    // If not a reorder, treat as a normal drop to append
    handleDrop(event);
  };

  onMount(() => {
    loadLatestPriceList();
  });
</script>

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Build Price List</h1>
        <p class="text-sm text-gray-600">Review and finalize the latest saved price list.</p>
      </div>
      <a
        class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        href="{base}/price-lists"
      >
        ← Back to price lists
      </a>
    </div>

    <div class="bg-white shadow p-5 rounded-lg space-y-4">
      <div class="space-y-2">
        <label class="text-sm font-semibold text-gray-800" for="filename">Filename</label>
        <input
          id="filename"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter filename"
          bind:value={filename}
        />
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-0 rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div class="bg-gray-50 px-4 py-3 flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-gray-800">SKU & Prices</p>
              <p class="text-xs text-gray-500">Loaded from the latest saved price list.</p>
            </div>
            {#if loading}
              <span class="text-xs text-blue-600">Loading…</span>
            {:else if errorMessage}
              <span class="text-xs text-red-600">Error</span>
            {:else}
              <span class="text-xs text-gray-500">{rows.length} items</span>
            {/if}
          </div>

          <div class="bg-white px-4 py-3 border-b border-gray-200">
            <p class="text-sm font-semibold text-gray-800">Static blocks</p>
            <div class="mt-2 flex flex-wrap gap-2">
              {#each staticItems as item}
                <button
                  class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 active:bg-blue-200"
                  draggable="true"
                  on:dragstart={(e) => handleStaticDragStart(e, item)}
                >
                  {item.label}
                </button>
              {/each}
            </div>
          </div>

          <div class="max-h-[500px] overflow-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">#</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">SKU</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700">Discounted Price</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 bg-white">
                {#if loading}
                  <tr>
                    <td class="px-4 py-3 text-sm text-gray-600" colspan="3">Loading...</td>
                  </tr>
                {:else if errorMessage}
                  <tr>
                    <td class="px-4 py-3 text-sm text-red-600" colspan="3">{errorMessage}</td>
                  </tr>
                {:else if rows.length === 0}
                  <tr>
                    <td class="px-4 py-3 text-sm text-gray-600" colspan="3">No price list data found.</td>
                  </tr>
                {:else}
                  {#each rows as row, index}
                    <tr
                      draggable="true"
                      on:dragstart={(e) => handleDragStart(e, row, index)}
                      class="hover:bg-gray-50"
                    >
                      <td class="px-4 py-3 text-gray-700">{index + 1}</td>
                      <td class="px-4 py-3 text-gray-800">{row.sku}</td>
                      <td class="px-4 py-3 text-gray-800">{row.price}</td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
        </div>

        <div
          class="rounded-lg border border-dashed border-blue-300 bg-blue-50/40 p-4 text-sm text-gray-800 min-h-[300px] flex flex-col gap-3"
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
          <div class="flex-1 rounded-md border border-dashed border-gray-200 bg-white/70 p-3 overflow-auto">
            {#if builderItems.length === 0}
              <p class="text-xs text-gray-500">Drop SKUs or static blocks here to build your list.</p>
            {:else}
              <ul class="space-y-2">
                {#each builderItems as item, idx (item.id)}
                  <li
                    class="flex items-start justify-between rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm text-sm cursor-move gap-3"
                    draggable="true"
                    on:dragstart={(e) => handleBuilderDragStart(e, idx)}
                    on:dragover={handleBuilderDragOver}
                    on:drop={(e) => handleBuilderDrop(e, idx)}
                  >
                    <div class="flex-1 space-y-1">
                      <div class="flex items-center gap-2">
                        <p class="font-semibold text-gray-900">{item.sku}</p>
                        {#if item.kind === 'static' && item.staticType === 'page_break'}
                          <span class="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-700">Page Break</span>
                        {:else if item.kind === 'static' && item.staticType === 'range'}
                          <span class="text-xs rounded bg-blue-50 px-2 py-0.5 text-blue-700">Range</span>
                        {:else if item.kind === 'static' && item.staticType === 'category'}
                          <span class="text-xs rounded bg-green-50 px-2 py-0.5 text-green-700">Category</span>
                        {/if}
                      </div>

                      {#if item.kind === 'static' && (item.staticType === 'range' || item.staticType === 'category')}
                        <input
                          class="w-full rounded-md border border-gray-300 px-3 py-2 text-xs shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={item.staticType === 'range' ? 'Enter range' : 'Enter category'}
                          bind:value={item.value}
                        />
                      {:else if item.kind === 'static' && item.staticType === 'page_break'}
                        <p class="text-xs text-gray-600">Page separator</p>
                      {:else}
                        <p class="text-xs text-gray-600">Price: {item.price}</p>
                      {/if}
                    </div>
                    <span class="text-xs text-gray-400">#{idx + 1}</span>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>