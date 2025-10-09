<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import CustomerDropdown from '$lib/components/CustomerDropdown.svelte';
  import type { Customer } from '$lib/services/customers';
  import type { JobStatusResult } from '../workshop-status.service';

  export let currentJobStatus: JobStatusResult;
  export let customerName = '';
  export let contactEmail = '';
  export let contactNumber = '';
  export let selectedCustomer: Customer | null = null;
  export let isExpanded = true;

  const dispatch = createEventDispatcher();

  function handleCustomerSelect(event: CustomEvent) {
    const { customer } = event.detail;
    selectedCustomer = customer;
    customerName = customer.BillingAddress.BillFirstName + ' ' + customer.BillingAddress.BillLastName;
    contactEmail = customer.EmailAddress;
    contactNumber = customer.BillingAddress.BillPhone || '';

    dispatch('customerSelect', { customer, customerName, contactEmail, contactNumber });
  }

  function handleCustomerClear() {
    selectedCustomer = null;
    customerName = '';
    contactEmail = '';
    contactNumber = '';

    dispatch('customerClear');
  }

  function toggleExpanded() {
    isExpanded = !isExpanded;
  }
</script>

<div
  class="flex items-center justify-between px-4 py-3 rounded cursor-pointer hover:bg-gray-700 transition-colors"
  style="background-color: rgb(30, 30, 30);"
  on:click={toggleExpanded}
  role="button"
  tabindex="0"
  aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
  on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(); } }}
>
  <h2 class="font-medium text-white">User Information</h2>
  <div class="text-white">
    <svg class="w-5 h-5 transform transition-transform {isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
    </svg>
  </div>
</div>

{#if !isExpanded}
  <!-- Collapsed Summary View -->
  <div class="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg shadow-sm">
    {#if userInfoSummaryItems.length > 0}
      <div class="space-y-2">
        {#each userInfoSummaryItems as item}
          <div class="flex items-center justify-between bg-white px-3 py-2 rounded-md border border-green-100 shadow-sm">
            <span class="text-xs font-semibold text-green-700 uppercase tracking-wide">{item.label}:</span>
            <span class="text-sm font-bold text-gray-900 truncate max-w-48">{item.value}</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="text-sm text-gray-500 italic text-center py-4">No user information entered yet</div>
    {/if}
    <div class="mt-3 flex justify-center">
      <button
        type="button"
        on:click={() => isExpanded = true}
        class="inline-flex items-center gap-2 text-green-600 hover:text-green-800 text-sm font-semibold bg-white px-3 py-1.5 rounded-md border border-green-200 hover:border-green-300 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
        </svg>
        {!currentJobStatus.canEditUserInfo ? 'View Details' : 'Edit Details'}
      </button>
    </div>
  </div>
{:else}
  <!-- Expanded Form View -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
    <div class="md:col-span-2">
      <label class="block text-sm font-medium text-gray-700 mb-1" for="customer-name">
        Customer Name (Maropost) <span class="text-red-500">*</span>
      </label>
      <div class="{!customerName.trim() ? 'border border-red-300 rounded' : ''}">
        <CustomerDropdown
          id="customer-name"
          bind:value={customerName}
          placeholder="Search customers..."
          on:select={handleCustomerSelect}
          on:clear={handleCustomerClear}
        />
      </div>

      <!-- Customer Display (either selected customer or manual entry) -->
      {#if selectedCustomer || customerName.trim()}
        <div class="mt-3 p-3 {selectedCustomer ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} border rounded-md">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="text-sm font-medium text-gray-700 mb-2">Selected Customer:</div>
              <div class="font-medium {selectedCustomer ? 'text-blue-900' : 'text-gray-900'} text-lg">
                {selectedCustomer ? `${selectedCustomer.BillingAddress.BillFirstName || ''} ${selectedCustomer.BillingAddress.BillLastName || ''}`.trim() || getCustomerDisplayName(selectedCustomer) : customerName}
              </div>
              {#if selectedCustomer}
                {#if selectedCustomer.BillingAddress.BillCompany}
                  <div class="text-sm text-blue-700 mt-1 font-medium">
                    {selectedCustomer.BillingAddress.BillCompany}
                  </div>
                {/if}
                <div class="text-sm text-blue-600 mt-1">
                  {selectedCustomer.EmailAddress}
                </div>
                {#if selectedCustomer.BillingAddress.BillPhone}
                  <div class="text-sm text-blue-600">
                    📞 {selectedCustomer.BillingAddress.BillPhone}
                  </div>
                {/if}
                {#if selectedCustomer.BillingAddress.BillCity}
                  <div class="text-sm text-blue-600">
                    📍 {selectedCustomer.BillingAddress.BillCity}
                  </div>
                {/if}
                <div class="text-xs text-blue-600 mt-2 font-medium">
                  ✓ Linked to Maropost customer
                </div>
              {:else}
                <div class="text-xs text-gray-500 mt-1">
                  Manual entry - not linked to Maropost customer
                </div>
              {/if}
            </div>
            <button
              type="button"
              on:click={handleCustomerClear}
              class="{selectedCustomer ? 'text-blue-500 hover:text-blue-700' : 'text-gray-500 hover:text-gray-700'} ml-2"
              aria-label="Clear customer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Contact Email and Number Side by Side -->
    <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="contact-email">Contact Email</label>
        <input id="contact-email" type="email" bind:value={contactEmail} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!currentJobStatus.canEditUserInfo ? 'cursor-not-allowed opacity-50' : ''}" disabled={!currentJobStatus.canEditUserInfo} />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="contact-number">Contact Number</label>
        <input id="contact-number" type="tel" bind:value={contactNumber} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {!currentJobStatus.canEditUserInfo ? 'cursor-not-allowed opacity-50' : ''}" disabled={!currentJobStatus.canEditUserInfo} />
      </div>
    </div>
  </div>
{/if}

<script lang="ts">
  import { getCustomerDisplayName } from '$lib/services/customers';

  // Summary items for collapsed view
  $: userInfoSummaryItems = (() => {
    const items = [];
    if (customerName.trim()) items.push({ label: 'Customer', value: customerName, priority: 1 });
    if (contactEmail.trim()) items.push({ label: 'Email', value: contactEmail, priority: 2 });
    if (contactNumber.trim()) items.push({ label: 'Phone', value: contactNumber, priority: 3 });
    return items.sort((a, b) => a.priority - b.priority);
  })();
</script>
