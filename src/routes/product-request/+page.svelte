<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Select from 'svelte-select';

  interface SelectOption {
    value: string;
    label: string;
  }

  interface ProductRow {
    sku: string;
    productName: string;
    brand: SelectOption | null;
    supplier: SelectOption | null;
    purchasePrice: string;
    rrp: string;
    exists: boolean;
  }

  // API Endpoints
  const brandsUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/58215302c1c24203886ccf481adbaac5/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RFQ4OtbS6cyjB_JzaIsowmww4KBqPQgavWLg18znE5s';
  const suppliersUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/da5c5708146642768d63293d2bbb9668/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-n0W0PxlF1G83xHYHGoEOhv3XmHXWlesbRk5NcgNT9w';
  const skuCheckUrl = 'https://prod-03.australiasoutheast.logic.azure.com:443/workflows/151bc47e0ba4447b893d1c9fea9af46f/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=bRyr_oW-ud06XlU5VLhBqQ7tyU__jD3clEOGIEhax-Q';

  // State for brands and suppliers
  let brands: SelectOption[] = [];
  let suppliers: SelectOption[] = [];
  let loadingBrands = false;
  let loadingSuppliers = false;
  let brandError = '';
  let supplierError = '';

  // Product Request Form
  let rows: ProductRow[] = [createEmptyRow()];
  let isLoading = false;
  let notification = { show: false, message: '', type: 'info' };

  function createEmptyRow(): ProductRow {
    return {
      sku: '',
      productName: '',
      brand: null,
      supplier: null,
      purchasePrice: '',
      rrp: '',
      exists: false
    };
  }

  function addRow() {
    rows = [...rows, createEmptyRow()];
  }

  function removeRow(index: number) {
    rows = rows.filter((_, i) => i !== index);
  }

  function applyToAll(field: 'brand' | 'supplier', value: SelectOption | null) {
    rows = rows.map(row => ({
      ...row,
      [field]: value
    }));
  }

  // Function to fetch brands
  async function fetchBrands() {
    console.log('Starting fetchBrands...');
    loadingBrands = true;
    brandError = '';
    try {
      console.log('Making API call to fetch brands...');
      const response = await fetch(brandsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('API Response status:', response.status);
      const data = await response.json();
      console.log('API Response data:', data);

      if (data.status === 200 && data.message.Ack === "Success") {
        brands = data.message.Content.map((brand: { ContentID: string; ContentName: string }) => ({
          value: brand.ContentID,
          label: brand.ContentName
        }));
        console.log('Processed brands:', brands);
      } else {
        throw new Error('Failed to load brands: Invalid response format');
      }
    } catch (error) {
      console.error('Error in fetchBrands:', error);
      brandError = error instanceof Error ? error.message : 'Failed to load brands';
    } finally {
      loadingBrands = false;
      console.log('fetchBrands completed. Brands:', brands, 'Error:', brandError);
    }
  }

  // Function to fetch suppliers
  async function fetchSuppliers() {
    console.log('Starting fetchSuppliers...');
    loadingSuppliers = true;
    supplierError = '';
    try {
      console.log('Making API call to fetch suppliers...');
      const response = await fetch(suppliersUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      console.log('API Response status:', response.status);
      const data = await response.json();
      console.log('API Response data:', data);

      if (data.status === 200 && data.message.Ack === "Success") {
        suppliers = data.message.Supplier
          .filter((supplier: { SupplierID: string }) => supplier.SupplierID !== "0")
          .map((supplier: { SupplierID: string }) => ({
            value: supplier.SupplierID,
            label: supplier.SupplierID
          }))
          .sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
        console.log('Processed suppliers:', suppliers);
      } else {
        throw new Error('Failed to load suppliers: Invalid response format');
      }
    } catch (error) {
      console.error('Error in fetchSuppliers:', error);
      supplierError = error instanceof Error ? error.message : 'Failed to load suppliers';
    } finally {
      loadingSuppliers = false;
      console.log('fetchSuppliers completed. Suppliers:', suppliers, 'Error:', supplierError);
    }
  }

  async function handleProductRequestSubmit() {
    isLoading = true;
    try {
      // Validate rows
      let valid = true;
      const invalidRows = rows.filter(row => 
        !row.sku || 
        !row.productName || 
        !row.brand || 
        !row.supplier || 
        !row.purchasePrice
      );
      
      if (invalidRows.length > 0) {
        throw new Error('Please fill in all required fields');
      }

      // Check for duplicate SKUs within the form
      const skus = rows.map(row => row.sku);
      const duplicates = skus.filter((sku, index) => skus.indexOf(sku) !== index);
      if (duplicates.length > 0) {
        throw new Error('Duplicate SKUs found within the submitted requests. Please ensure each SKU is unique.');
      }

      // Check if SKUs already exist in the system
      const response = await fetch(skuCheckUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ SKU: skus })
      });

      const data = await response.json();
      console.log('SKU check response:', data);

      if (data.Ack === "Success") {
        const existingSKUs = new Set(data.Item?.map((item: any) => item.SKU) || []);
        const duplicateRows = rows.filter(row => existingSKUs.has(row.sku));
        
        if (duplicateRows.length > 0) {
          const duplicateSkus = duplicateRows.map(row => row.sku).join(', ');
          throw new Error(`The following SKUs already exist: ${duplicateSkus}`);
        }

        // If all validation passes, proceed with saving
        showNotification('Product request submitted successfully', 'success');
        
        // Clear form and add new row
        rows = [createEmptyRow()];
      } else {
        throw new Error('SKU check failed. Please try again later.');
      }
    } catch (error: any) {
      showNotification(error.message || 'An error occurred', 'error');
    } finally {
      isLoading = false;
    }
  }

  function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
    notification = { show: true, message, type };
    setTimeout(() => {
      notification = { ...notification, show: false };
    }, 3000);
  }

  onMount(() => {
    console.log('Component mounted, fetching brands and suppliers...');
    fetchBrands();
    fetchSuppliers();
  });
</script>

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto bg-white shadow p-6" transition:fade>
    <h2 class="text-2xl font-bold mb-6 text-gray-900">Product Request</h2>
    
    <!-- Product Request Form -->
    <div class="space-y-6">
      <div class="flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-sm py-4 z-50 border-b border-gray-200 shadow-sm">
        <button
          on:click={addRow}
          class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Add Row
        </button>
        <button
          on:click={handleProductRequestSubmit}
          class="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
          disabled={isLoading}
        >
          {isLoading ? 'Submitting...' : 'Submit'}
        </button>
      </div>

      <!-- Product Rows -->
      <div class="overflow-visible">
        <table class="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Brand
                <button
                  on:click={() => applyToAll('brand', rows[0]?.brand)}
                  class="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                >
                  Apply to All
                </button>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Supplier
                <button
                  on:click={() => applyToAll('supplier', rows[0]?.supplier)}
                  class="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                >
                  Apply to All
                </button>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Price</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RRP</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each rows as row, i}
              <tr class={row.exists ? 'bg-green-50' : ''}>
                <td class="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    bind:value={row.sku}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="SKU"
                  />
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    bind:value={row.productName}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Product Name"
                  />
                </td>
                <td class="px-6 py-4 whitespace-nowrap relative">
                  {#if loadingBrands}
                    <div class="animate-pulse bg-gray-200 h-9 rounded"></div>
                  {:else if brandError}
                    <div class="text-red-600 text-sm">{brandError}</div>
                  {:else}
                    <Select
                      items={brands}
                      bind:value={row.brand}
                      placeholder="Select Brand"
                      containerStyles="position: relative;"
                      listOffset={8}
                      isVirtualList={true}
                      listAutoWidth={true}
                      listPlacement="bottom"
                      portal="#select-portal"
                    />
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap relative">
                  {#if loadingSuppliers}
                    <div class="animate-pulse bg-gray-200 h-9 rounded"></div>
                  {:else if supplierError}
                    <div class="text-red-600 text-sm">{supplierError}</div>
                  {:else}
                    <Select
                      items={suppliers}
                      bind:value={row.supplier}
                      placeholder="Select Supplier"
                      containerStyles="position: relative;"
                      listOffset={8}
                      isVirtualList={true}
                      listAutoWidth={true}
                      listPlacement="bottom"
                      portal="#select-portal"
                    />
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    bind:value={row.purchasePrice}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Purchase Price"
                    step="0.01"
                  />
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    bind:value={row.rrp}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="RRP"
                    step="0.01"
                  />
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <button
                    on:click={() => removeRow(i)}
                    class="text-red-600 hover:text-red-900"
                    disabled={rows.length === 1}
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
  </div>

  <!-- Notification -->
  {#if notification.show}
    <div
      class="fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg"
      class:bg-green-500={notification.type === 'success'}
      class:bg-red-500={notification.type === 'error'}
      class:bg-blue-500={notification.type === 'info'}
      transition:fade
    >
      <p class="text-white">{notification.message}</p>
    </div>
  {/if}

  <!-- Loading Overlay -->
  {#if isLoading}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg shadow-xl">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
        <p class="mt-4 text-gray-700">Processing...</p>
      </div>
    </div>
  {/if}
</div>

<!-- Add portal container at the end of the body -->
<div id="select-portal" />

<style>
  :global(body) {
    background-color: #f3f4f6;
  }

  :global(.svelte-select) {
    --height: 38px;
    --border: 1px solid #d1d5db;
    --border-hover: 1px solid #3b82f6;
    --border-radius: 0.375rem;
    --background: white;
    --font-size: 0.875rem;
    --padding: 0 0.75rem;
    --placeholder-color: #9ca3af;
    width: 100%;
    min-width: 300px;
  }

  :global(.svelte-select .selectContainer) {
    border: var(--border);
    border-radius: var(--border-radius);
    height: var(--height);
    background: var(--background);
    min-height: var(--height);
    min-width: 300px;
    padding: 0;
  }

  :global(.svelte-select .selectContainer:hover) {
    border: var(--border-hover);
  }

  :global(.svelte-select .value-container) {
    padding: var(--padding);
    height: var(--height);
    line-height: var(--height);
    font-size: var(--font-size);
    display: flex;
    align-items: center;
  }

  :global(.svelte-select .selected-item) {
    display: flex;
    align-items: center;
    height: 100%;
    line-height: normal;
  }

  :global(.svelte-select input) {
    font-size: var(--font-size);
    padding: var(--padding);
    height: calc(var(--height) - 2px);
    display: flex;
    align-items: center;
  }

  :global(.svelte-select .placeholder) {
    color: var(--placeholder-color);
    font-size: var(--font-size);
  }

  :global(.svelte-select .items) {
    border: var(--border);
    border-radius: var(--border-radius);
    background: var(--background);
    margin-top: 4px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    position: fixed;
    z-index: 9999;
    width: auto;
    min-width: 300px;
    max-width: 400px;
    max-height: 300px;
    overflow-y: auto;
  }

  :global(.svelte-select .item) {
    font-size: var(--font-size);
    line-height: 1.25;
    padding: 0.5rem 0.75rem;
    white-space: normal;
    word-break: break-word;
  }

  :global(.svelte-select .item.hover) {
    background-color: #f3f4f6;
  }

  :global(.svelte-select .item.active) {
    background-color: #dbeafe;
    color: #1e40af;
  }

  :global(.svelte-select .clear-select) {
    padding: 0;
  }

  #select-portal {
    position: relative;
    z-index: 9999;
  }

  :global(.portal .items) {
    position: fixed !important;
  }
</style> 