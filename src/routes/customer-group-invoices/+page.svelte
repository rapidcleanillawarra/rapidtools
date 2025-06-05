<!-- Customer Group Invoices Management -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { SvelteToast } from '@zerodevx/svelte-toast';
  import { toastSuccess, toastError } from '$lib/utils/toast';
  import Select from 'svelte-select';
  import {
    invoices,
    originalInvoices,
    filteredInvoices,
    loading,
    filterLoading,
    currentLoadingStep,
    invoiceError,
    dateError,
    customerGroupError,
    statusError,
    currentPage,
    itemsPerPage,
    sortField,
    sortDirection,
    selectedCustomerGroup,
    dateFrom,
    dateTo,
    selectedStatus,
    applyFilters,
    applyFiltersViaAPI,
    validateFilters,
    customerGroups,
    fetchCustomerGroups,
    searchFilters
  } from './stores';
  import type { CustomerGroupInvoice } from './types';
  import { handlePrint } from './utils/print';
  import { 
    getSortIcon, 
    handleSort, 
    getPaginatedInvoices, 
    getTotalPages, 
    getCurrentPageItems 
  } from './utils/table';

  export let data: { invoices: CustomerGroupInvoice[] };

  // Status options
  const statusOptions = [
    { value: 'Unpaid', label: 'Unpaid' },
    { value: 'PartiallyPaid', label: 'Partial Paid' },
    { value: 'FullyPaid', label: 'Fully Paid' }
  ];

  // Initialize invoices and customer groups only on mount
  onMount(async () => {
    if (data?.invoices && Array.isArray(data.invoices)) {
      $originalInvoices = [...data.invoices];
      $invoices = [...data.invoices];
      $filteredInvoices = [...data.invoices];
    }
    
    // Fetch customer groups from Firestore
    try {
      await fetchCustomerGroups();
    } catch (error) {
      console.error('Failed to fetch customer groups:', error);
      toastError('Failed to load customer groups');
    }
  });

  // Declare reactive variables
  let paginatedInvoices: CustomerGroupInvoice[] = [];
  let totalPages = 0;
  let currentPageItems = {
    start: 0,
    end: 0,
    total: 0
  };

  // Add reactive statements for pagination and sorting
  $: {
    if ($invoices && $invoices.length > 0) {
      paginatedInvoices = getPaginatedInvoices($invoices, $currentPage, $itemsPerPage);
      totalPages = getTotalPages($invoices.length, $itemsPerPage);
      
      // Update current page items info
      currentPageItems = getCurrentPageItems($currentPage, $itemsPerPage, $invoices.length);
    } else {
      paginatedInvoices = [];
      totalPages = 0;
      currentPageItems = {
        start: 0,
        end: 0,
        total: 0
      };
    }
  }

  // Add reactive variables for print data
  let printData = {
    customerGroupLabel: 'All Groups',
    dateFrom: null as Date | null,
    dateTo: null as Date | null
  };

  // Update print data when stores change
  $: {
    printData.customerGroupLabel = $selectedCustomerGroup 
      ? $customerGroups.find(group => group.value === $selectedCustomerGroup)?.label || 'All Groups'
      : 'All Groups';
    
    if ($dateFrom && $dateTo) {
      printData.dateFrom = new Date($dateFrom);
      printData.dateTo = new Date($dateTo);
    }
  }

  // Function to handle filter application
  async function handleApplyFilter() {
    try {
      // Validate filters before proceeding
      if (!$selectedCustomerGroup || $selectedStatus.length === 0) {
        toastError('Please select a customer group and at least one status');
        return;
      }

      filterLoading.set(true);
      currentLoadingStep.set('Fetching customer group data...');
      
      // Prepare payload for Get Customer API
      const customerPayload = {
        Filter: {
          UserGroup: [parseInt($selectedCustomerGroup || '0')],
          OutputSelector: [
            "Username",
            "EmailAddress",
            "UserGroup"
          ]
        },
        action: "GetCustomer"
      };

      console.log('Get Customer API Payload:', customerPayload);
      
      // First API call - Get Customer Group
      const customerResponse = await fetch('https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerPayload)
      });

      const customer_group_customers = await customerResponse.json();
      console.log('Customer Group Customers:', customer_group_customers);

      // Check if we have any customers in the response
      if (!customer_group_customers.Customer || customer_group_customers.Customer.length === 0) {
        toastError('No users found in the selected customer group');
        filterLoading.set(false);
        currentLoadingStep.set('');
        return;
      }

      // Create a map of username to UserGroup for company lookup
      const customerGroupMap = new Map(
        customer_group_customers.Customer.map((customer: { Username: string; UserGroup: string }) => [
          customer.Username,
          customer.UserGroup
        ])
      );

      // Extract usernames from the customer group response
      const usernames = customer_group_customers.Customer.map((customer: { Username: string }) => customer.Username);
      console.log('Extracted Usernames:', usernames);

      // Update loading message for status condition
      currentLoadingStep.set('Applying status filter: Pending, PartialPaid, FullyPaid...');

      // Update loading message for second API call
      currentLoadingStep.set('Fetching orders data...');

      // Prepare payload for Get Orders API
      const ordersPayload = {
        Filter: {
          OrderStatus: "Dispatched",
          Username: usernames,
          PaymentStatus: ["Pending", "PartialPaid", "FullyPaid"],
          OutputSelector: [
            "ID",
            "Username",
            "UserGroup",
            "DatePaymentDue",
            "OrderPayment",
            "GrandTotal",
            "DatePlaced"
          ]
        },
        action: "GetOrder"
      };

      console.log('Get Orders API Payload:', ordersPayload);

      // Second API call - Get Orders
      const ordersResponse = await fetch('https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ordersPayload)
      });

      const orders_data = await ordersResponse.json();
      console.log('Get Orders API Response:', orders_data);

      // Update loading message for mapping process
      currentLoadingStep.set('Processing and mapping invoice data...');

      // Calculate payment status for each order
      const mappedInvoices = orders_data.Order.map((order: any) => {
        // Calculate total payments
        const totalPayments = order.OrderPayment?.reduce((sum: number, payment: any) => 
          sum + (parseFloat(payment.Amount) || 0), 0) || 0;
        
        const grandTotal = parseFloat(order.GrandTotal) || 0;
        
        // Round both values to 2 decimal places to avoid floating-point precision issues
        const roundedTotalPayments = Math.round(totalPayments * 100) / 100;
        const roundedGrandTotal = Math.round(grandTotal * 100) / 100;
        const balance = roundedGrandTotal - roundedTotalPayments;

        // Check for zero invoice with no payments
        const hasNoPayments = !order.OrderPayment || order.OrderPayment.length === 0;
        const isZeroInvoice = roundedGrandTotal === 0 && roundedTotalPayments === 0 && hasNoPayments;
        
        // Determine payment status
        let status = 'Unpaid';
        let statusColor = 'bg-red-100 text-red-800';
        
        if (roundedTotalPayments > 0) {
          if (roundedTotalPayments >= roundedGrandTotal) {
            status = 'Fully Paid';
            statusColor = 'bg-green-100 text-green-800';
          } else {
            status = 'Partially Paid';
            statusColor = 'bg-yellow-100 text-yellow-800';
          }
        }

        return {
          invoiceNumber: order.ID,
          dateIssued: order.DatePlaced,
          dueDate: order.DatePaymentDue,
          totalAmount: roundedGrandTotal,
          amountPaid: roundedTotalPayments,
          balance: balance,
          username: order.Username,
          company: customerGroupMap.get(order.Username) || order.UserGroup,
          status,
          statusColor,
          customerGroupName: order.UserGroup,
          isZeroInvoice
        };
      })
      .filter((invoice: CustomerGroupInvoice) => {
        // First apply status filter
        if ($selectedStatus && $selectedStatus.length > 0) {
          const matchesStatus = $selectedStatus.some(selected => {
            const statusValue = selected.value;
            // Map the status values to match the invoice status format
            const statusMap: { [key: string]: string } = {
              'Unpaid': 'Unpaid',
              'PartiallyPaid': 'Partially Paid',
              'FullyPaid': 'Fully Paid'
            };
            const mappedStatus = statusMap[statusValue];
            return invoice.status === mappedStatus;
          });
          if (!matchesStatus) return false;
        }

        // Then apply date filter if both dates are selected
        if ($dateFrom && $dateTo) {
          const dueDate = new Date(invoice.dueDate);
          const fromDate = new Date($dateFrom);
          fromDate.setHours(0, 0, 0, 0); // Start of day
          const toDate = new Date($dateTo);
          toDate.setHours(23, 59, 59, 999); // End of day

          // Check if due date is within range
          if (dueDate < fromDate || dueDate > toDate) {
            return false;
          }
        }

        return true;
      });

      // Update all necessary stores
      $invoices = mappedInvoices;
      $originalInvoices = mappedInvoices;
      $filteredInvoices = mappedInvoices;
      $currentPage = 1; // Reset to first page

      // Calculate pagination
      paginatedInvoices = getPaginatedInvoices($invoices, $currentPage, $itemsPerPage);
      totalPages = getTotalPages($invoices.length, $itemsPerPage);

      // Apply local filters after getting the response
      applyFilters();
      toastSuccess('Filters applied successfully');
    } catch (error) {
      console.error('Error applying filters:', error);
      toastError(error instanceof Error ? error.message : 'Failed to apply filters');
    } finally {
      filterLoading.set(false);
      currentLoadingStep.set('');
    }
  }

  // Function to handle page change
  function handlePageChange(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages) {
      currentPage.set(newPage);
      // Scroll to top of table
      document.querySelector('.overflow-x-auto')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Function to handle items per page change
  function handleItemsPerPageChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = parseInt(select.value);
    if (!isNaN(value)) {
      itemsPerPage.set(value);
      currentPage.set(1); // Reset to first page
    }
  }

  // Function to handle sorting
  function handleSortClick(field: keyof CustomerGroupInvoice) {
    const { sortedInvoices, newSortField, newSortDirection } = handleSort(
      $invoices,
      field,
      $sortField,
      $sortDirection
    );
    
    sortField.set(newSortField);
    sortDirection.set(newSortDirection);
    $invoices = sortedInvoices;
  }

  // Handle date input changes with proper type checking and validation
  function handleDateChange(event: Event, setter: (date: Date | null) => void) {
    const input = event.target as HTMLInputElement;
    const newDate = input.value ? new Date(input.value) : null;
    setter(newDate);
    
    // Validate dates whenever either date changes
    validateFilters();
  }

  // Handle customer group selection
  function handleCustomerGroupSelect(event: CustomEvent) {
    const value = event.detail?.value;
    selectedCustomerGroup.set(value);
    validateFilters();
  }

  // Handle status selection
  function handleStatusSelect(event: CustomEvent) {
    const detail = event.detail;
    
    // Get the current selected values
    let currentValues = [...$selectedStatus];
    
    // If we have a new value, add it to the array
    if (detail?.value) {
      const newValue = {
        value: detail.value,
        label: detail.label
      };
      
      // Check if the value is already selected
      const exists = currentValues.some(v => v.value === newValue.value);
      
      if (!exists) {
        currentValues.push(newValue);
      }
    }
    
    selectedStatus.set(currentValues);
    validateFilters();
  }

  // Add search function
  function handleSearch(event: Event, field: string) {
    const input = event.target as HTMLInputElement;
    searchFilters.update(filters => ({
      ...filters,
      [field]: input.value.toLowerCase()
    }));
    
    // Apply search filters
    $invoices = $originalInvoices.filter(invoice => {
      return Object.entries($searchFilters).every(([key, value]) => {
        if (!value) return true; // Skip empty search fields
        
        const invoiceValue = String(invoice[key as keyof CustomerGroupInvoice]).toLowerCase();
        return invoiceValue.includes(value);
      });
    });
    
    // Reset to first page when searching
    currentPage.set(1);
  }
</script>

<SvelteToast options={{ 
  duration: 4000,
  pausable: true,
  reversed: false,
  intro: { y: -200 }
}} />

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto bg-white shadow p-6" transition:fade>
    <h2 class="text-2xl font-bold mb-6 text-gray-900">Customer Group Invoices</h2>

    <!-- Filter Section -->
    <div class="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Customer Group</label>
        <Select
          items={$customerGroups}
          placeholder="Select customer group"
          clearable={true}
          on:clear={() => {
            selectedCustomerGroup.set(null);
            validateFilters();
          }}
          on:select={handleCustomerGroupSelect}
        />
        {#if $customerGroupError}
          <p class="mt-1 text-sm text-red-600">{$customerGroupError}</p>
        {/if}
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Date From</label>
        <input
          type="date"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          on:change={(e) => handleDateChange(e, dateFrom.set)}
        />
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Date To</label>
        <input
          type="date"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          on:change={(e) => handleDateChange(e, dateTo.set)}
        />
      </div>
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <Select
          items={statusOptions}
          placeholder="Select status"
          clearable={true}
          multiple={true}
          value={$selectedStatus}
          on:clear={() => {
            console.log('Status filter cleared');
            console.log('Previous selected status:', $selectedStatus);
            selectedStatus.set([]);
            console.log('New selected status:', $selectedStatus);
            validateFilters();
          }}
          on:select={handleStatusSelect}
        />
        {#if $statusError}
          <p class="mt-1 text-sm text-red-600">{$statusError}</p>
        {/if}
      </div>
    </div>

    <!-- Date Error Message -->
    {#if $dateError}
      <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
        <p class="text-sm text-red-600">{$dateError}</p>
      </div>
    {/if}

    <!-- Apply Filter Button -->
    <div class="mb-6 flex justify-end gap-4">
      <button
        class="bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px]"
        on:click={() => handlePrint($invoices, printData)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Print Table
      </button>
      <button
        class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px]"
        on:click={handleApplyFilter}
        disabled={$filterLoading || !!$dateError || !!$customerGroupError || !!$statusError}
      >
        {#if $filterLoading}
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
          Applying...
        {:else}
          Apply Filter
        {/if}
      </button>
    </div>

    <!-- Add this before the Invoices Table section -->
    {#if $filterLoading}
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
          <div class="flex items-center justify-center mb-4">
            <div class="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
          </div>
          <p class="text-center text-gray-700 font-medium">{$currentLoadingStep}</p>
          <p class="text-center text-sm text-gray-500 mt-2">This may take a few moments</p>
        </div>
      </div>
    {/if}

    <!-- Invoices Table -->
    <div class="overflow-x-auto">
      {#if $loading}
        <div class="flex justify-center items-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
        </div>
      {:else}
        <table class="min-w-full divide-y divide-gray-200 table-fixed">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('invoiceNumber')}>
                    Invoice # {getSortIcon('invoiceNumber', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'invoiceNumber')}
                  />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('dateIssued')}>
                    Date Issued {getSortIcon('dateIssued', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'dateIssued')}
                  />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('dueDate')}>
                    Due Date {getSortIcon('dueDate', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'dueDate')}
                  />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('totalAmount')}>
                    Total Invoice {getSortIcon('totalAmount', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'totalAmount')}
                  />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('amountPaid')}>
                    Payments {getSortIcon('amountPaid', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'amountPaid')}
                  />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('balance')}>
                    Balance AUD {getSortIcon('balance', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'balance')}
                  />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('username')}>
                    Username {getSortIcon('username', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'username')}
                  />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('company')}>
                    Company {getSortIcon('company', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'company')}
                  />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('status')}>
                    Status {getSortIcon('status', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'status')}
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#if !$invoices || $invoices.length === 0}
              <tr>
                <td colspan="9" class="px-2 py-4 text-center text-gray-500">
                  No results found
                </td>
              </tr>
            {:else}
              {#each paginatedInvoices as invoice (invoice.invoiceNumber)}
                <tr class={invoice.updated ? 'bg-green-50' : ''}>
                  <td class="px-2 py-1 text-sm">{invoice.invoiceNumber}</td>
                  <td class="px-2 py-1 text-sm">
                    {new Date(invoice.dateIssued).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </td>
                  <td class="px-2 py-1 text-sm">
                    {new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </td>
                  <td class="px-2 py-1 text-sm">
                    <span class={invoice.isZeroInvoice ? 'text-red-600 font-semibold' : ''}>
                      {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(invoice.totalAmount)}
                    </span>
                  </td>
                  <td class="px-2 py-1 text-sm">
                    {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(invoice.amountPaid)}
                  </td>
                  <td class="px-2 py-1 text-sm">
                    {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(invoice.balance)}
                  </td>
                  <td class="px-2 py-1 text-sm">{invoice.username}</td>
                  <td class="px-2 py-1 text-sm">{invoice.company}</td>
                  <td class="px-2 py-1 text-sm">
                    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${invoice.statusColor}`}>
                      {invoice.status}
                    </span>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      {/if}
    </div>

    <!-- Pagination -->
    <div class="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div class="flex items-center">
        <span class="mr-2 text-sm text-gray-700">Items per page:</span>
        <select
          class="rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          on:change={handleItemsPerPageChange}
          value={$itemsPerPage}
        >
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>
      
      <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p class="text-sm text-gray-700">
            Showing <span class="font-medium">{currentPageItems.start}</span> to{' '}
            <span class="font-medium">{currentPageItems.end}</span> of{' '}
            <span class="font-medium">{currentPageItems.total}</span> results
          </p>
        </div>
        <div>
          <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={() => handlePageChange($currentPage - 1)}
              disabled={$currentPage === 1}
            >
              <span class="sr-only">Previous</span>
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
              </svg>
            </button>
            
            <button
              class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={() => handlePageChange($currentPage + 1)}
              disabled={$currentPage === totalPages}
            >
              <span class="sr-only">Next</span>
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  @media print {
    /* Hide elements that shouldn't be printed */
    button, 
    .filter-section,
    .pagination-section {
      display: none !important;
    }

    /* Ensure table is fully visible */
    .overflow-x-auto {
      overflow: visible !important;
    }

    /* Adjust table styles for printing */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }

    th, td {
      border: 1px solid #ddd !important;
      padding: 8px !important;
    }

    /* Ensure text is black for better printing */
    * {
      color: black !important;
    }
  }
</style> 