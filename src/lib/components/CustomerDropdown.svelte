<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  import SkeletonLoader from './SkeletonLoader.svelte';
  import { fetchCustomers, type Customer, getCustomerDisplayName, getCustomerDetails } from '$lib/services/customers';

  const dispatch = createEventDispatcher();

  export let value: string = '';
  export let placeholder: string = 'Search customers...';
  export let id: string | undefined = undefined;

  let isOpen = false;
  let searchTerm = '';
  let customers: Customer[] = [];
  let filteredCustomers: Customer[] = [];
  let isLoading = false;
  let error: string | null = null;
  let selectedCustomer: Customer | null = null;

  // Debounce search
  let searchTimeout: number;

  $: if (searchTerm) {
    clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
      filterCustomers();
    }, 300);
  } else {
    filteredCustomers = customers.slice(0, 10); // Show first 10 when no search
  }

  function filterCustomers() {
    if (!searchTerm.trim()) {
      filteredCustomers = customers.slice(0, 10);
      return;
    }

    const term = searchTerm.toLowerCase();
    filteredCustomers = customers.filter(customer => {
      const displayName = getCustomerDisplayName(customer).toLowerCase();
      const email = customer.EmailAddress.toLowerCase();
      const company = customer.BillingAddress.BillCompany?.toLowerCase() || '';
      const phone = customer.BillingAddress.BillPhone || '';

      return displayName.includes(term) ||
             email.includes(term) ||
             company.includes(term) ||
             phone.includes(term);
    }).slice(0, 10); // Limit to 10 results
  }

  async function loadCustomers() {
    isLoading = true;
    error = null;

    try {
      customers = await fetchCustomers();
      filteredCustomers = customers.slice(0, 10);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load customers';
      console.error('Error loading customers:', err);
    } finally {
      isLoading = false;
    }
  }

  function selectCustomer(customer: Customer) {
    selectedCustomer = customer;
    value = getCustomerDisplayName(customer);
    searchTerm = '';
    isOpen = false;
    dispatch('select', { customer });
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchTerm = target.value;

    // If user types something that doesn't match selected customer, clear selection
    if (selectedCustomer && searchTerm !== getCustomerDisplayName(selectedCustomer)) {
      selectedCustomer = null;
      value = searchTerm;
      dispatch('clear');
    } else {
      value = searchTerm;
    }
  }

  function toggleDropdown() {
    if (!customers.length && !isLoading) {
      loadCustomers();
    }
    isOpen = !isOpen;
  }

  function handleFocus() {
    if (!customers.length && !isLoading) {
      loadCustomers();
    }
    isOpen = true;
  }

  function handleBlur() {
    // Delay closing to allow for clicks on dropdown items
    setTimeout(() => {
      isOpen = false;
    }, 200);
  }

  // Load customers on mount
  onMount(() => {
    loadCustomers();
  });
</script>

<div class="relative">
  <div class="relative">
    <input
      type="text"
      {id}
      {placeholder}
      bind:value={searchTerm}
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      class="w-full bg-gray-100 rounded px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
      autocomplete="off"
    />
    <button
      type="button"
      on:click={toggleDropdown}
      class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
      aria-label="Toggle customer dropdown"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </button>
  </div>

  {#if isOpen}
    <div class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
      {#if isLoading}
        <div class="p-4">
          <SkeletonLoader type="text" height="1.25rem" className="mb-2" />
          <SkeletonLoader type="text" height="1rem" width="80%" className="mb-2" />
          <SkeletonLoader type="text" height="1rem" width="60%" />
        </div>
      {:else if error}
        <div class="p-4 text-red-600 text-sm">
          {error}
          <button
            type="button"
            on:click={loadCustomers}
            class="ml-2 text-blue-600 hover:text-blue-800 underline"
          >
            Retry
          </button>
        </div>
      {:else if filteredCustomers.length === 0}
        <div class="p-4 text-gray-500 text-sm">
          {#if searchTerm}
            No customers found matching "{searchTerm}"
          {:else}
            No customers available
          {/if}
        </div>
      {:else}
        {#each filteredCustomers as customer}
          <button
            type="button"
            on:click={() => selectCustomer(customer)}
            class="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 focus:outline-none focus:bg-gray-50"
          >
            <div class="font-medium text-gray-900">
              {getCustomerDisplayName(customer)}
            </div>
            <div class="text-sm text-gray-500">
              {customer.EmailAddress}
            </div>
            {#if getCustomerDetails(customer)}
              <div class="text-xs text-gray-400 mt-1">
                {getCustomerDetails(customer)}
              </div>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Ensure dropdown appears above other elements */
  .relative {
    z-index: 1;
  }
</style>
