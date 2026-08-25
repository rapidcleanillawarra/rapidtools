<script lang="ts">
  import CustomerDropdown from '$lib/components/CustomerDropdown.svelte';
  import ContactsManager from '$lib/components/ContactsManager.svelte';
  import type { Contact } from '$lib/types/workshop';
  import type { Customer } from '$lib/services/customers';
  import { getCustomerDisplayName } from '$lib/services/customers';

  export let isUserInfoExpanded: boolean;
  export let userInfoSummaryItems: Array<{ label: string; value: string }>;
  export let currentJobStatus: any;

  export let customerName: string;
  export let selectedCustomer: Customer | null;
  export let contactEmail: string;
  export let contactNumber: string;

  export let optionalContacts: Contact[];
  export let contactError: string;
  export let contactsManager: any;

  export let workshopStatus: any;

  export let handleCustomerSelect: (event: any) => void;
  export let handleCustomerClear: () => void;
  export let handleContactsUpdated: (event: any) => void;
  export let handleContactError: (event: any) => void;
</script>

<!-- User Information -->
<div>
  <div
    class="flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer bg-[#181b20] border border-[#262a30] hover:bg-[#1f2329] hover:border-[#333842] transition-colors"
    on:click={() => isUserInfoExpanded = !isUserInfoExpanded}
    role="button"
    tabindex="0"
    aria-label={isUserInfoExpanded ? 'Collapse section' : 'Expand section'}
    on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isUserInfoExpanded = !isUserInfoExpanded; } }}
  >
    <h2 class="font-semibold text-white">User Information</h2>
    <div class="text-gray-400">
      <svg class="w-5 h-5 transform transition-transform {isUserInfoExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </div>
  </div>

  {#if !isUserInfoExpanded}
    <!-- Collapsed Summary View -->
    <div class="mt-3 p-4 bg-[#181b20] border border-[#262a30] rounded-xl shadow-sm">
      {#if userInfoSummaryItems.length > 0}
        <div class="space-y-2">
          {#each userInfoSummaryItems as item}
            <div class="flex items-center justify-between bg-[#141619] px-3.5 py-2.5 rounded-lg border border-[#262a30]">
              <span class="text-xs font-semibold text-lime-400 uppercase tracking-wide">{item.label}:</span>
              <span class="text-sm font-medium text-gray-200 truncate max-w-48">{item.value}</span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-sm text-gray-500 italic text-center py-4">No user information entered yet</div>
      {/if}
      <div class="mt-3 flex justify-center">
        <button
          type="button"
          on:click={() => isUserInfoExpanded = true}
          class="btn-secondary inline-flex items-center gap-2 text-sm px-3.5 py-1.5"
        >
          <svg class="w-4 h-4 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <label class="block text-sm font-medium text-gray-300 mb-1.5" for="customer-name">
          Customer Name (Maropost) <span class="text-red-400">*</span>
        </label>
        <div class="{!customerName.trim() ? 'border border-red-500/40 rounded-lg' : ''}">
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
          <div class="mt-3 p-4 bg-[#181b20] border border-[#262a30] rounded-xl shadow-sm">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Selected Customer:</div>
                <div class="font-bold text-white text-lg">
                  {selectedCustomer ? `${selectedCustomer.BillingAddress.BillFirstName || ''} ${selectedCustomer.BillingAddress.BillLastName || ''}`.trim() || getCustomerDisplayName(selectedCustomer) : customerName}
                </div>
                {#if selectedCustomer}
                  {#if selectedCustomer.BillingAddress.BillCompany}
                    <div class="text-sm text-lime-400 mt-1 font-medium">
                      {selectedCustomer.BillingAddress.BillCompany}
                    </div>
                  {/if}
                  <div class="text-sm text-gray-300 mt-1">
                    {selectedCustomer.EmailAddress}
                  </div>
                  {#if selectedCustomer.BillingAddress.BillPhone}
                    <div class="text-sm text-gray-300 mt-1">
                      📞 {selectedCustomer.BillingAddress.BillPhone}
                    </div>
                  {/if}
                  {#if selectedCustomer.BillingAddress.BillCity}
                    <div class="text-sm text-gray-300 mt-1">
                      📍 {selectedCustomer.BillingAddress.BillCity}
                    </div>
                  {/if}
                  <div class="text-xs mt-2.5">
                    <a href="https://www.rapidsupplies.com.au/_cpanel/customer/view?id={selectedCustomer.Username}" target="_blank" class="text-lime-400 hover:text-lime-300 underline font-medium transition-colors">
                      Open this customer in Maropost →
                    </a>
                  </div>
                {:else}
                  <div class="text-xs text-gray-400 mt-1">
                    Manual entry - not linked to Maropost customer
                  </div>
                {/if}
              </div>
              <button
                type="button"
                on:click={handleCustomerClear}
                class="text-gray-400 hover:text-red-400 ml-2 p-1 transition-colors"
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
          <label class="block text-sm font-medium text-gray-300 mb-1.5" for="contact-email">Contact Email</label>
          <input id="contact-email" type="email" bind:value={contactEmail} placeholder="Enter contact email" class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-4 py-3 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors {!currentJobStatus.canEditUserInfo ? 'cursor-not-allowed opacity-50' : ''}" disabled={!currentJobStatus.canEditUserInfo} />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1.5" for="contact-number">Contact Number</label>
          <input id="contact-number" type="tel" bind:value={contactNumber} placeholder="Enter contact number" class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-4 py-3 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors {!currentJobStatus.canEditUserInfo ? 'cursor-not-allowed opacity-50' : ''}" disabled={!currentJobStatus.canEditUserInfo} />
        </div>
      </div>

      <!-- Optional Contacts -->
      <fieldset class="md:col-span-2 mt-6 border-0 p-0 m-0 min-w-0">
        <legend class="block text-sm font-medium text-gray-300 mb-3 w-full">
          Contacts
          {#if workshopStatus === 'new' || workshopStatus === null}
            <span class="text-red-400">*</span>
          {/if}
        </legend>
        <ContactsManager
          bind:this={contactsManager}
          bind:contacts={optionalContacts}
          bind:error={contactError}
          workshopStatus={workshopStatus}
          on:contactsUpdated={handleContactsUpdated}
          on:error={handleContactError}
        />
      </fieldset>
    </div>
  {/if}
</div>
