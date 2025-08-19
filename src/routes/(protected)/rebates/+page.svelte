<script lang="ts">
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabase';
  
  // Date filter state - default to beginning of month and today
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let startDate = firstOfMonth.toISOString().split('T')[0];
  let endDate = today.toISOString().split('T')[0];
  let isLoading = false;
  let apiData: any = null;
  let error = '';
  let rebatesData: any = {};
  let rebateStats = { totalSKUs: 0, skusWithRebates: 0 };
  let grandTotalRebate = 0;
  let ordersWithRebates: string[] = [];
  
  // Company filter state
  let selectedCompany = '';
  const companyOptions = [
    { value: '', label: 'All Companies' },
    { value: 'diversey', label: 'Diversey' },
    { value: 'cleanplus', label: 'CleanPlus' }
  ];
  
  // API endpoint
  const API_ENDPOINT = 'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';
  
  // Function to check SKUs against rebates table
  async function checkRebates(orderData: any) {
    try {
      // Extract all unique SKUs from order lines
      const allSKUs = new Set<string>();
      orderData.Order?.forEach((order: any) => {
        order.OrderLine?.forEach((line: any) => {
          if (line.SKU) {
            allSKUs.add(line.SKU);
          }
        });
      });

      const skuList = Array.from(allSKUs);
      
      if (skuList.length === 0) {
        rebatesData = {};
        rebateStats = { totalSKUs: 0, skusWithRebates: 0 };
        grandTotalRebate = 0;
        ordersWithRebates = [];
        return;
      }

      // Query Supabase for rebates matching these SKUs
      const { data: rebates, error: rebateError } = await supabase
        .from('rebates')
        .select('sku, rebate, company')
        .in('sku', skuList);

      if (rebateError) {
        console.error('Error fetching rebates:', rebateError);
        ordersWithRebates = [];
        return;
      }

      // Create a lookup map for quick access
      const rebateLookup: any = {};
      rebates?.forEach((rebate) => {
        rebateLookup[rebate.sku] = rebate;
      });

      rebatesData = rebateLookup;
      rebateStats = {
        totalSKUs: skuList.length,
        skusWithRebates: rebates?.length || 0
      };

      // Calculate grand total rebate and collect orders with rebates
      let totalRebateAmount = 0;
      const orderNumbersWithRebates = new Set<string>();
      
      orderData.Order?.forEach((order: any) => {
        let orderHasRebates = false;
        order.OrderLine?.forEach((line: any) => {
          if (rebateLookup[line.SKU]) {
            const unitRebate = parseFloat(rebateLookup[line.SKU].rebate);
            const quantity = parseInt(line.Quantity);
            totalRebateAmount += unitRebate * quantity;
            orderHasRebates = true;
          }
        });
        
        if (orderHasRebates && order.OrderID) {
          orderNumbersWithRebates.add(order.OrderID);
        }
      });
      
      grandTotalRebate = totalRebateAmount;
      ordersWithRebates = Array.from(orderNumbersWithRebates);

      console.log(`Rebate check: ${rebates?.length || 0}/${skuList.length} SKUs have rebates. Total rebate value: $${totalRebateAmount.toFixed(2)}. Orders with rebates: ${ordersWithRebates.length}`);
      
    } catch (err) {
      console.error('Error checking rebates:', err);
      ordersWithRebates = [];
    }
  }
  
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
        // Check rebates for all SKUs in the order data
        await checkRebates(data);
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
  
  // Function to generate and open orders URL
  function openOrdersWithRebates() {
    if (ordersWithRebates.length === 0) {
      return;
    }
    
    const baseUrl = 'https://www.rapidsupplies.com.au/_cpanel/sales-orders';
    const orderNumbers = ordersWithRebates.join(',');
    const url = `${baseUrl}?order_number=in%3A${encodeURIComponent(orderNumbers)}`;
    
    window.open(url, '_blank');
  }
  
  // Function to clear all filters
  function clearAllFilters() {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startDate = firstOfMonth.toISOString().split('T')[0];
    endDate = today.toISOString().split('T')[0];
    selectedCompany = '';
    apiData = null;
    error = '';
    rebatesData = {};
    rebateStats = { totalSKUs: 0, skusWithRebates: 0 };
    grandTotalRebate = 0;
    ordersWithRebates = [];
  }
</script>

<div class="container mx-auto px-4 py-8" in:fade>
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200">
      <h1 class="text-xl font-semibold">Rebates</h1>
      <p class="text-gray-600">Manage and track rebate programs.</p>
    </div>

    <!-- Date Range & Company Filters -->
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
        <div class="flex items-center gap-2">
          <label for="company-select" class="text-sm font-medium text-gray-700 whitespace-nowrap">Company:</label>
          <select
            id="company-select"
            bind:value={selectedCompany}
            class="border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
          >
            {#each companyOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
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
          on:click={clearAllFilters}
          class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
          Reset
        </button>
        {#if startDate || endDate || selectedCompany}
          <div class="text-sm text-gray-500">
            {#if startDate && endDate}
              Showing data from {startDate} to {endDate}
            {:else if startDate}
              Showing data from {startDate} onwards
            {:else if endDate}
              Showing data up to {endDate}
            {/if}
            {#if selectedCompany}
              {#if startDate || endDate} • {/if}Company: {companyOptions.find(c => c.value === selectedCompany)?.label}
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
          
          <!-- Rebate Statistics -->
          {#if rebateStats.totalSKUs > 0}
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-sm font-medium text-blue-900">Rebate Analysis</h4>
                  <div class="flex items-center space-x-4 text-sm mt-1">
                    <span class="text-blue-700">
                      <span class="font-semibold">{rebateStats.skusWithRebates}</span> of <span class="font-semibold">{rebateStats.totalSKUs}</span> SKUs have rebates
                    </span>
                    <span class="text-blue-600">
                      ({((rebateStats.skusWithRebates / rebateStats.totalSKUs) * 100).toFixed(1)}% coverage)
                    </span>
                  </div>
                </div>
                {#if grandTotalRebate > 0}
                  <div class="text-right">
                    <div class="text-xs text-blue-600">Potential Value</div>
                    <div class="text-lg font-bold text-blue-800">${grandTotalRebate.toFixed(2)}</div>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
          
          {#if apiData.Order && apiData.Order.length > 0}
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Rebate</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Rebate</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each apiData.Order as order}
                    {#if order.OrderLine && order.OrderLine.length > 0}
                      {#each order.OrderLine as line}
                        {#if rebatesData[line.SKU]}
                          <tr>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {order.OrderID}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div class="flex items-center">
                                <span class="font-medium">{line.SKU}</span>
                                <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Rebate
                                </span>
                              </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {line.Quantity}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-green-700 font-medium">
                              ${rebatesData[line.SKU].rebate}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-green-700 font-semibold">
                              ${(parseFloat(rebatesData[line.SKU].rebate) * parseInt(line.Quantity)).toFixed(2)}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div class="flex items-center">
                                <span>{rebatesData[line.SKU].company}</span>
                                {#if selectedCompany && selectedCompany !== rebatesData[line.SKU].company}
                                  <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                    Different Company
                                  </span>
                                {/if}
                              </div>
                            </td>
                          </tr>
                        {/if}
                      {/each}
                    {/if}
                  {/each}
                </tbody>
              </table>
            </div>
            
            {#if rebateStats.skusWithRebates === 0}
              <div class="text-center py-8">
                <p class="text-gray-500">No SKUs with rebates found in the selected date range.</p>
              </div>
            {:else}
              <!-- Grand Total Section -->
              <div class="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <div class="flex items-center justify-between">
                  <div class="text-sm text-gray-600">
                    Showing {rebateStats.skusWithRebates} SKUs with rebates from {apiData.Order.length} total orders
                    {#if ordersWithRebates.length > 0}
                      <div class="mt-2">
                        <button
                          type="button"
                          on:click={openOrdersWithRebates}
                          class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                          </svg>
                          View {ordersWithRebates.length} Orders in Control Panel
                        </button>
                      </div>
                    {/if}
                  </div>
                  <div class="text-right">
                    <div class="text-sm text-green-600 font-medium">Total Rebate Value</div>
                    <div class="text-xl font-bold text-green-800">${grandTotalRebate.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            {/if}
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
