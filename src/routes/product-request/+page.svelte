<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Select from 'svelte-select';

  // API Endpoints
  const ORDER_DETAILS_API = "https://prod-29.australiasoutheast.logic.azure.com:443/workflows/0282bb0f980c4c6596ceba7d465d1269/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=FRC97yHJR3C2eV4mxLDx4Ud95WQZbihro6I6Rr58JGA";
  const CUSTOMER_INFO_API = "https://prod-25.australiasoutheast.logic.azure.com:443/workflows/4f1fcf1326d54948b153273c442e8cf8/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RAYNMIVXwsCfoqzZAQavfd01Ch07_pASYP6XGOqHd5U";
  const COST_PRICE_API = "https://prod-62.australiasoutheast.logic.azure.com:443/workflows/e66b00b9cb084f5a8b7f4954526fecaa/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=CLVwwY4ZmM6CX_O-IPzgIND6QCk_C6tAaSaOwbxq6n0";
  const GROUP_MAPPING_API = "https://prod-60.australiasoutheast.logic.azure.com:443/workflows/c38543a949594553b4ad99cab7dd8c00/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=411u61erX0g_vm0mpwRrWKWuzPlcio6FJlgLJEdADUo";
  const SAVE_TO_MAROPOST_API = "https://prod-53.australiasoutheast.logic.azure.com:443/workflows/105609f052e04dc8ab8b972bf1613942/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=TBHCbQPF_kEUBNkl-nFBDNEkooeZWc8gRINpD8PL4BE";

  // Product Request Form
  let rows = [createEmptyRow()];
  let isLoading = false;
  let notification = { show: false, message: '', type: 'info' };

  function createEmptyRow() {
    return {
      sku: '',
      productName: '',
      brand: '',
      supplier: '',
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

  function applyToAll(field: 'brand' | 'supplier', value: string) {
    rows = rows.map(row => ({
      ...row,
      [field]: value
    }));
  }

  async function handleProductRequestSubmit() {
    isLoading = true;
    try {
      // Validate rows
      const invalidRows = rows.filter(row => !row.sku || !row.productName || !row.brand || !row.supplier || !row.purchasePrice);
      if (invalidRows.length > 0) {
        throw new Error('Please fill in all required fields');
      }

      // Process each row
      for (const row of rows) {
        // Check if product exists
        const response = await fetch(COST_PRICE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sku: row.sku })
        });

        if (!response.ok) {
          throw new Error(`Failed to check SKU: ${row.sku}`);
        }

        const data = await response.json();
        row.exists = data.exists || false;
      }

      showNotification('Product request submitted successfully', 'success');
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
    // Initialize any necessary setup
  });
</script>

<div class="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
  <div class="max-w-7xl mx-auto bg-white shadow p-6" transition:fade>
    <h2 class="text-2xl font-bold mb-6 text-gray-900">Product Request</h2>
    
    <!-- Product Request Form -->
    <div class="space-y-6">
      <div class="flex justify-between items-center sticky top-0 bg-white py-4 z-10">
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
      <div class="overflow-x-auto">
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
                <td class="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    bind:value={row.brand}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Brand"
                  />
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    bind:value={row.supplier}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Supplier"
                  />
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

<style>
  /* Add any additional component-specific styles here */
  :global(body) {
    background-color: #f3f4f6;
  }
</style> 