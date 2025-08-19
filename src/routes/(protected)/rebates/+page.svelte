<script lang="ts">
  import { fade } from 'svelte/transition';
  
  // Date filter state
  let startDate = '';
  let endDate = '';
  let isLoading = false;
  let apiData: any = null;
  let error = '';
  
  // API endpoint
  const API_ENDPOINT = 'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';
  
  // Function to handle date filtering
  async function handleDateFilter() {
    if (!startDate || !endDate) {
      error = 'Please select both start and end dates';
      return;
    }
    
    isLoading = true;
    error = '';
    apiData = null;
    
    try {
      // Format dates for API
      const dateFrom = `${startDate} 00:00:00`;
      const dateTo = `${endDate} 23:59:59`;
      
      const payload = {
        "Filter": {
          "OrderStatus": ["Dispatched"],
          "DateInvoicedFrom": dateFrom,
          "DateInvoicedTo": dateTo,
          "OutputSelector": ["OrderLine"]
        },
        "action": "GetOrder"
      };
      
      console.log('API Request payload:', payload);
      
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      if (data.Ack === 'Success') {
        apiData = data;
      } else {
        throw new Error('API returned error response');
      }
    } catch (err) {
      console.error('Error calling API:', err);
      error = err instanceof Error ? err.message : 'Failed to fetch data';
    } finally {
      isLoading = false;
    }
  }
  
  // Function to handle submit
  function handleSubmit() {
    handleDateFilter();
  }
  
  // Function to clear date filters
  function clearDateFilters() {
    startDate = '';
    endDate = '';
    apiData = null;
    error = '';
  }
</script>

<div class="container mx-auto px-4 py-8" in:fade>
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200">
      <h1 class="text-xl font-semibold">Rebates</h1>
      <p class="text-gray-600">Manage and track rebate programs.</p>
    </div>

    <!-- Date Range Filters -->
    <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <label for="start-date" class="text-sm font-medium text-gray-700 whitespace-nowrap">Start Date:</label>
          <input
            id="start-date"
            type="date"
            bind:value={startDate}
            class="border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
          />
        </div>
        <div class="flex items-center gap-2">
          <label for="end-date" class="text-sm font-medium text-gray-700 whitespace-nowrap">End Date:</label>
          <input
            id="end-date"
            type="date"
            bind:value={endDate}
            class="border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
          />
        </div>
        <button
          type="button"
          on:click={handleSubmit}
          disabled={isLoading || !startDate || !endDate}
          class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          {#if isLoading}
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-1"></div>
            Loading...
          {:else}
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            Filter
          {/if}
        </button>
        <button
          type="button"
          on:click={clearDateFilters}
          class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
          Clear
        </button>
        {#if startDate || endDate}
          <div class="text-sm text-gray-500">
            {#if startDate && endDate}
              Showing data from {startDate} to {endDate}
            {:else if startDate}
              Showing data from {startDate} onwards
            {:else if endDate}
              Showing data up to {endDate}
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <div class="p-6">
      {#if error}
        <div class="mb-4 p-4 rounded-lg bg-red-100 text-red-700">
          <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Error: {error}
          </div>
        </div>
      {/if}
      
      {#if apiData}
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-medium text-gray-900">Orders Data</h3>
            <span class="text-sm text-gray-500">Retrieved: {apiData.CurrentTime}</span>
          </div>
          
          {#if apiData.Order && apiData.Order.length > 0}
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Lines</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each apiData.Order as order}
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.OrderID}
                      </td>
                      <td class="px-6 py-4">
                        {#if order.OrderLine && order.OrderLine.length > 0}
                          <div class="space-y-1">
                            {#each order.OrderLine as line}
                              <div class="text-sm text-gray-600">
                                <span class="font-medium">SKU:</span> {line.SKU} | 
                                <span class="font-medium">Qty:</span> {line.Quantity} | 
                                <span class="font-medium">ID:</span> {line.OrderLineID}
                              </div>
                            {/each}
                          </div>
                        {:else}
                          <span class="text-sm text-gray-400">No order lines</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            
            <div class="mt-4 text-sm text-gray-600">
              Total Orders: {apiData.Order.length}
            </div>
          {:else}
            <div class="text-center py-8">
              <p class="text-gray-500">No orders found for the selected date range.</p>
            </div>
          {/if}
        </div>
      {:else if !isLoading && !error}
        <div class="text-center py-12">
          <p class="text-gray-500">Select a date range and click "Filter" to view rebates data.</p>
        </div>
      {/if}
    </div>
  </div>
</div>
