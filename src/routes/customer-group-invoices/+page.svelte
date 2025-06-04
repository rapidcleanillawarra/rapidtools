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
    invoiceError,
    dateError,
    customerGroupError,
    statusError,
    selectedRows,
    selectAll,
    handleSelectAll,
    currentPage,
    itemsPerPage,
    sortField,
    sortDirection,
    getPaginatedInvoices,
    getTotalPages,
    selectedCustomerGroup,
    dateFrom,
    dateTo,
    selectedStatus,
    applyFilters,
    applyFiltersViaAPI,
    validateFilters,
    customerGroups,
    fetchCustomerGroups
  } from './stores';
  import type { CustomerGroupInvoice } from './types';

  export let data: { invoices: CustomerGroupInvoice[] };

  // Status options
  const statusOptions = [
    { value: 'paid', label: 'Paid' },
    { value: 'unpaid', label: 'Unpaid' }
  ];

  // Add logging for when data changes
  $: {
    console.log('Data changed:', {
      hasData: !!data,
      invoicesLength: data?.invoices?.length || 0
    });
  }

  // Initialize invoices and customer groups only on mount
  onMount(async () => {
    console.log('Component mounted, initializing data');
    if (data?.invoices && Array.isArray(data.invoices)) {
      console.log('Setting initial invoices:', data.invoices.length);
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
    console.log('Invoices or sort changed:', {
      totalInvoices: $invoices.length,
      currentPage: $currentPage,
      itemsPerPage: $itemsPerPage,
      sortField: $sortField,
      sortDirection: $sortDirection
    });
    
    // Recalculate pagination and sorting
    paginatedInvoices = getPaginatedInvoices($invoices);
    totalPages = getTotalPages($invoices.length);
    
    // Update current page items info
    currentPageItems = {
      start: ($currentPage - 1) * $itemsPerPage + 1,
      end: Math.min($currentPage * $itemsPerPage, $invoices.length),
      total: $invoices.length
    };
  }

  // Function to handle filter application
  async function handleApplyFilter() {
    try {
      await applyFiltersViaAPI();
      toastSuccess('Filters applied successfully');
    } catch (error) {
      console.error('Error applying filters:', error);
      toastError(error instanceof Error ? error.message : 'Failed to apply filters');
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

  // Function to get sort icon
  function getSortIcon(field: string): string {
    if ($sortField !== field) return '↕️';
    return $sortDirection === 'asc' ? '↑' : '↓';
  }

  // Function to handle sorting
  function handleSortClick(field: string) {
    if ($sortField === field) {
      sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      sortField.set(field);
      sortDirection.set('asc');
    }
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
  function handleCustomerGroupSelect(detail: { value: string }) {
    selectedCustomerGroup.set(detail.value);
    validateFilters();
  }

  // Handle status selection
  function handleStatusSelect(detail: { value: string }) {
    selectedStatus.set(detail.value as 'paid' | 'unpaid');
    validateFilters();
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
          on:clear={() => {
            selectedStatus.set(null);
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
    <div class="mb-6 flex justify-end">
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

    <!-- Invoices Table -->
    <div class="overflow-x-auto">
      {#if $loading}
        <div class="flex justify-center items-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
        </div>
      {:else if $invoices.length === 0}
        <div class="text-center py-8 text-gray-500">
          No invoices found
        </div>
      {:else}
        <table class="min-w-full divide-y divide-gray-200 table-fixed">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[40px]">
                <input
                  type="checkbox"
                  bind:checked={$selectAll}
                  on:change={(e) => {
                    const target = e.target as HTMLInputElement | null;
                    if (target) {
                      handleSelectAll(target.checked);
                    }
                  }}
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('invoiceNumber')}
              >
                Invoice # {getSortIcon('invoiceNumber')}
              </th>
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('dateIssued')}
              >
                Date Issued {getSortIcon('dateIssued')}
              </th>
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('dueDate')}
              >
                Due Date {getSortIcon('dueDate')}
              </th>
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('totalAmount')}
              >
                Total Invoice {getSortIcon('totalAmount')}
              </th>
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('username')}
              >
                Username {getSortIcon('username')}
              </th>
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('company')}
              >
                Company {getSortIcon('company')}
              </th>
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('status')}
              >
                Status {getSortIcon('status')}
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each paginatedInvoices as invoice (invoice.invoiceNumber)}
              <tr class={invoice.updated ? 'bg-green-50' : ''}>
                <td class="px-2 py-1 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={$selectedRows.has(invoice.invoiceNumber)}
                    on:change={(event) => {
                      const target = event.target as HTMLInputElement;
                      if (target.checked) {
                        $selectedRows = new Set([...$selectedRows, invoice.invoiceNumber]);
                      } else {
                        $selectedRows.delete(invoice.invoiceNumber);
                        $selectedRows = $selectedRows;
                      }
                    }}
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td class="px-2 py-1 text-sm">{invoice.invoiceNumber}</td>
                <td class="px-2 py-1 text-sm">
                  {new Date(invoice.dateIssued).toLocaleDateString()}
                </td>
                <td class="px-2 py-1 text-sm">
                  {new Date(invoice.dueDate).toLocaleDateString()}
                </td>
                <td class="px-2 py-1 text-sm">
                  {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(invoice.totalAmount)}
                </td>
                <td class="px-2 py-1 text-sm">{invoice.username}</td>
                <td class="px-2 py-1 text-sm">{invoice.company}</td>
                <td class="px-2 py-1 text-sm">
                  <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 
                      invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'}`}
                  >
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </span>
                  {#if invoice.updated}
                    <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
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
</style> 