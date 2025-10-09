<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ContactsManager from '$lib/components/ContactsManager.svelte';
  import type { Contact } from '$lib/types/workshop';
  import type { JobStatusResult } from '../workshop-status.service';

  export let currentJobStatus: JobStatusResult;
  export let optionalContacts: Contact[] = [];
  export let contactError = '';
  export let isExpanded = false;

  let contactsManager: any = null;

  const dispatch = createEventDispatcher();

  function handleContactsUpdated(event: CustomEvent) {
    optionalContacts = event.detail.contacts;
    dispatch('contactsUpdated', { contacts: optionalContacts });
  }

  function handleContactError(event: CustomEvent) {
    contactError = event.detail.message;
    dispatch('contactError', { message: contactError });
  }

  function toggleExpanded() {
    if (currentJobStatus.canEditContacts) {
      isExpanded = !isExpanded;
    }
  }

  // Only show this section if there are contacts or if it's a quotable job
  $: shouldShowSection = optionalContacts.length > 0 || currentJobStatus.canEditContacts;
</script>

{#if shouldShowSection}
  <div
    class="flex items-center justify-between px-4 py-3 rounded cursor-pointer hover:bg-gray-700 transition-colors {!currentJobStatus.canEditContacts ? 'cursor-not-allowed opacity-75' : ''}"
    style="background-color: rgb(30, 30, 30);"
    on:click={toggleExpanded}
    role="button"
    tabindex="0"
    aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
    on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (currentJobStatus.canEditContacts) toggleExpanded(); } }}
  >
    <h2 class="font-medium text-white">Optional Contacts</h2>
    {#if currentJobStatus.canEditContacts}
      <div class="text-white">
        <svg class="w-5 h-5 transform transition-transform {isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>
    {/if}
  </div>

  {#if !isExpanded}
    <!-- Collapsed Summary View -->
    <div class="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg shadow-sm">
      {#if optionalContactsSummaryItems.length > 0}
        <div class="space-y-2">
          {#each optionalContactsSummaryItems as item}
            <div class="flex items-center justify-between bg-white px-3 py-2 rounded-md border border-purple-100 shadow-sm">
              <span class="text-xs font-semibold text-purple-700 uppercase tracking-wide">{item.label}:</span>
              <span class="text-sm font-bold text-gray-900 truncate max-w-48">{item.value}</span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-sm text-gray-500 italic text-center py-4">No optional contacts added yet</div>
      {/if}
      {#if currentJobStatus.canEditContacts}
        <div class="mt-3 flex justify-center">
          <button
            type="button"
            on:click={() => isExpanded = true}
            class="inline-flex items-center gap-2 text-purple-600 hover:text-purple-800 text-sm font-semibold bg-white px-3 py-1.5 rounded-md border border-purple-200 hover:border-purple-300 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
            Edit Details
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Expanded Form View -->
    <div class="mt-4">
      <ContactsManager
        bind:this={contactsManager}
        bind:contacts={optionalContacts}
        bind:error={contactError}
        workshopStatus={null}  // We'll pass the actual status from parent
        on:contactsUpdated={handleContactsUpdated}
        on:error={handleContactError}
      />
    </div>
  {/if}
{/if}

<script lang="ts">
  // Summary items for collapsed view
  $: optionalContactsSummaryItems = (() => {
    const items: Array<{
      label: string;
      value: string;
      phone: string;
      email: string;
      priority: number;
    }> = [];
    optionalContacts.forEach((contact, index) => {
      if (contact.name.trim()) items.push({
        label: `Contact ${index + 1}`,
        value: contact.name,
        phone: contact.number,
        email: contact.email,
        priority: index + 1
      });
    });
    return items.sort((a, b) => a.priority - b.priority);
  })();
</script>
