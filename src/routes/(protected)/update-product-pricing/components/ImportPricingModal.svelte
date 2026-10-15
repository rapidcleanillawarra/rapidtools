<script lang="ts">
  import { 
    products, 
    batchApplyPricingUpdates, 
    handleFilterSubmit, 
    skuFilter, 
    productNameFilter, 
    brandFilter, 
    supplierFilter 
  } from '../stores';
  import { 
    cleanNumericValue
  } from '../utils/importParser';
  import type { BatchPricingUpdateItem } from '../stores';
  import { toastSuccess, toastError } from '$lib/utils/toast';

  export let open: boolean = false;
  export let onClose: () => void;

  interface GridRow {
    id: string;
    sku: string;
    price: string;
    gpp: string;
    listPrice: string;
  }

  function createEmptyRow(): GridRow {
    return {
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sku: '',
      price: '',
      gpp: '',
      listPrice: ''
    };
  }

  // Pre-fill initial 5 rows matching the user screenshot
  let rows: GridRow[] = [
    { id: '1', sku: 'ABC-101', price: '15.50', gpp: '35', listPrice: '24.95' },
    { id: '2', sku: 'ABC-102', price: '32.00', gpp: '35', listPrice: '49.00' },
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow()
  ];

  let isSearching = false;

  function addRow() {
    rows = [...rows, createEmptyRow()];
  }

  function removeRow(index: number) {
    if (rows.length <= 1) {
      rows = [createEmptyRow()];
      return;
    }
    rows = rows.filter((_, i) => i !== index);
  }

  function recalculateRow(index: number, changedField: 'price' | 'gpp' | 'listPrice') {
    const row = rows[index];
    const purchasePrice = cleanNumericValue(row.price);

    if (purchasePrice === null || purchasePrice <= 0) {
      return;
    }

    if (changedField === 'gpp') {
      const gppVal = cleanNumericValue(row.gpp);
      if (gppVal !== null && gppVal < 100) {
        const remaining = 1 - gppVal / 100;
        if (remaining > 0) {
          const calculatedList = purchasePrice / remaining;
          row.listPrice = calculatedList.toFixed(2);
        }
      }
    } else if (changedField === 'listPrice') {
      const listVal = cleanNumericValue(row.listPrice);
      if (listVal !== null && listVal > 0) {
        const calculatedGpp = ((listVal - purchasePrice) / listVal) * 100;
        row.gpp = Math.round(calculatedGpp).toString();
      }
    } else if (changedField === 'price') {
      const gppVal = cleanNumericValue(row.gpp);
      const listVal = cleanNumericValue(row.listPrice);
      if (gppVal !== null && gppVal < 100) {
        const remaining = 1 - gppVal / 100;
        if (remaining > 0) {
          row.listPrice = (purchasePrice / remaining).toFixed(2);
        }
      } else if (listVal !== null && listVal > 0) {
        const calculatedGpp = ((listVal - purchasePrice) / listVal) * 100;
        row.gpp = Math.round(calculatedGpp).toString();
      }
    }

    rows = [...rows];
  }

  // Handle multi-cell paste (e.g. from Excel or Sheets) into the grid starting at rowIndex, colKey
  function handleCellPaste(e: ClipboardEvent, startRowIndex: number, startColKey: keyof GridRow) {
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;

    // Check if pasted content is multi-cell or multi-row tabular data
    if (!text.includes('\t') && !text.includes('\n')) {
      return;
    }

    e.preventDefault();
    const colOrder: (keyof GridRow)[] = ['sku', 'price', 'gpp', 'listPrice'];
    const startColIdx = colOrder.indexOf(startColKey);

    const pastedRows = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.split('\t').map(c => c.trim()));

    if (pastedRows.length === 0) return;

    const nextRows = [...rows];

    pastedRows.forEach((pRow, rOffset) => {
      const targetRowIdx = startRowIndex + rOffset;
      while (nextRows.length <= targetRowIdx) {
        nextRows.push(createEmptyRow());
      }

      pRow.forEach((cellVal, cOffset) => {
        const targetColIdx = startColIdx + cOffset;
        if (targetColIdx < colOrder.length) {
          const colKey = colOrder[targetColIdx];
          nextRows[targetRowIdx][colKey] = cellVal;
        }
      });

      // If price & gpp were pasted without listPrice, calculate listPrice
      const p = cleanNumericValue(nextRows[targetRowIdx].price);
      const g = cleanNumericValue(nextRows[targetRowIdx].gpp);
      const lp = cleanNumericValue(nextRows[targetRowIdx].listPrice);
      if (p !== null && p > 0) {
        if (lp === null && g !== null && g < 100) {
          nextRows[targetRowIdx].listPrice = (p / (1 - g / 100)).toFixed(2);
        } else if (g === null && lp !== null && lp > 0) {
          nextRows[targetRowIdx].gpp = Math.round(((lp - p) / lp) * 100).toString();
        }
      }
    });

    rows = nextRows;
  }

  async function handleProcessInput() {
    const populatedRows = rows.filter(
      r => r.sku.trim() || r.price.trim() || r.gpp.trim() || r.listPrice.trim()
    );

    if (populatedRows.length === 0) {
      toastError('Please enter at least one row with SKU and pricing data.');
      return;
    }

    const skusToSearch = populatedRows
      .map(r => r.sku.trim())
      .filter(Boolean);

    if (skusToSearch.length === 0) {
      toastError('Please enter at least one valid SKU.');
      return;
    }

    isSearching = true;

    try {
      // 1. Update the sidebar SKU filter store so the UI reflects the filtered SKUs
      skuFilter.set(skusToSearch.join('\n'));
      productNameFilter.set('');
      brandFilter.set(null);
      supplierFilter.set(null);

      // 2. Fetch products for these SKUs directly from the API
      const result = await handleFilterSubmit({
        skuFilter: skusToSearch.join('\n'),
        productNameFilter: '',
        brandFilter: null,
        supplierFilter: null
      });

      if (!result.success) {
        toastError(result.message || 'Failed to search products.');
        return;
      }

      // 3. Prepare pricing patches for each SKU entered in the modal
      const updates: BatchPricingUpdateItem[] = [];
      for (const row of populatedRows) {
        const sku = row.sku.trim();
        if (!sku) continue;

        const p = cleanNumericValue(row.price);
        const g = cleanNumericValue(row.gpp);
        const lp = cleanNumericValue(row.listPrice);

        // Determine source: prefer rrp if supplied, else gpp, else purchase_price
        let source: 'purchase_price' | 'rrp' | 'markup' | 'gpp' = 'purchase_price';
        if (lp != null) {
          source = 'rrp';
        } else if (g != null) {
          source = 'gpp';
        } else if (p != null) {
          source = 'purchase_price';
        }

        const patch: BatchPricingUpdateItem['patch'] = {};
        if (p != null) patch.purchase_price = p;
        if (lp != null) patch.rrp = lp;
        if (g != null) patch.gpp = g;

        if (Object.keys(patch).length > 0) {
          updates.push({
            sku,
            patch,
            source
          });
        }
      }

      // 4. Populate the new prices into the loaded table rows (without saving to backend)
      if (updates.length > 0) {
        const updateResult = batchApplyPricingUpdates(updates);
        if (updateResult.updatedCount > 0) {
          toastSuccess(`Loaded and populated ${updateResult.updatedCount} products into the table.`);
        } else {
          toastSuccess(`Found matching products in table.`);
        }
      } else {
        toastSuccess('Products loaded into table.');
      }

      // 5. Close modal
      onClose();
    } catch (err: unknown) {
      const error = err as Error;
      toastError(error.message || 'Failed to search products.');
    } finally {
      isSearching = false;
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
    <div class="relative flex flex-col w-full max-w-[850px] max-h-[92vh] bg-[#111317] border border-[#23272e] rounded-2xl shadow-2xl overflow-hidden text-gray-200">
      
      <!-- Modal Header -->
      <div class="flex items-start justify-between px-6 pt-6 pb-4">
        <div>
          <h2 class="text-lg font-bold text-white tracking-tight">Import Pricing from Excel / CSV</h2>
          <p class="text-xs text-gray-400 mt-1">Paste spreadsheet data or enter pricing row by row</p>
        </div>
        <button 
          type="button" 
          class="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1a1d24]"
          on:click={onClose}
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="px-6 pb-6 overflow-y-auto flex-1 space-y-4">
        <div>
          <h3 class="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-3">Pricing Data</h3>
            
            <!-- Column Titles -->
            <div class="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 mb-2 px-1 text-xs font-semibold text-gray-300">
              <div>SKU</div>
              <div>Price</div>
              <div>GPP</div>
              <div>List Price</div>
              <div class="w-6"></div>
            </div>

            <!-- Interactive Row Inputs with Multi-Cell Paste support -->
            <div class="space-y-2.5">
              {#each rows as row, index (row.id)}
                <div class="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-center">
                  <div>
                    <input
                      type="text"
                      bind:value={row.sku}
                      placeholder="SKU"
                      on:paste={(e) => handleCellPaste(e, index, 'sku')}
                      class="w-full bg-[#181a1f] border border-[#2b303a] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-colors"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      bind:value={row.price}
                      placeholder="0.00"
                      on:input={() => recalculateRow(index, 'price')}
                      on:paste={(e) => handleCellPaste(e, index, 'price')}
                      class="w-full bg-[#181a1f] border border-[#2b303a] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-colors"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      bind:value={row.gpp}
                      placeholder="0"
                      on:input={() => recalculateRow(index, 'gpp')}
                      on:paste={(e) => handleCellPaste(e, index, 'gpp')}
                      class="w-full bg-[#181a1f] border border-[#2b303a] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-colors"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      bind:value={row.listPrice}
                      placeholder="0.00"
                      on:input={() => recalculateRow(index, 'listPrice')}
                      on:paste={(e) => handleCellPaste(e, index, 'listPrice')}
                      class="w-full bg-[#181a1f] border border-[#2b303a] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-colors"
                    />
                  </div>
                  <div>
                    {#if rows.length > 1}
                      <button
                        type="button"
                        class="text-gray-500 hover:text-red-400 p-1 transition-colors"
                        title="Remove row"
                        on:click={() => removeRow(index)}
                      >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    {:else}
                      <div class="w-6"></div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>

            <!-- Add Row Button -->
            <div class="mt-4">
              <button
                type="button"
                on:click={addRow}
                class="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-400 hover:text-lime-300 transition-colors py-1 px-1"
              >
                <span class="text-sm leading-none font-bold">+</span>
                <span>Add row</span>
              </button>
            </div>
          </div>
      </div>

      <!-- Modal Footer -->
      <div class="flex items-center justify-end border-t border-[#1e2229] px-6 py-4 bg-[#14161b] gap-3">
        <button 
          type="button" 
          class="px-5 py-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-[#1a1d24] hover:bg-[#222630] border border-[#2b303a] transition-colors"
          disabled={isSearching}
          on:click={onClose}
        >
          Cancel
        </button>

        <button 
          type="button" 
          class="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-[#bef264] hover:bg-[#a3e635] shadow-sm transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSearching}
          on:click={handleProcessInput}
        >
          {#if isSearching}
            <div class="animate-spin rounded-full h-3.5 w-3.5 border-2 border-black border-t-transparent"></div>
            <span>Searching...</span>
          {:else}
            <span>Parse & Preview &rarr;</span>
          {/if}
        </button>
      </div>

    </div>
  </div>
{/if}
