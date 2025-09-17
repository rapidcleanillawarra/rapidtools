<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Contact } from '$lib/types/workshop';

  export let contacts: Contact[] = [];
  export let error: string = '';

  let newContact: Contact = { name: '', number: '', email: '' };
  let isExpanded: boolean = true;

  // Expose whether there are incomplete contact fields
  export const hasIncompleteContact = () => {
    return newContact.name.trim() || newContact.number.trim() || newContact.email.trim();
  };

  // Method to clear incomplete contact fields
  export const clearIncompleteContact = () => {
    newContact = { name: '', number: '', email: '' };
  };

  const dispatch = createEventDispatcher<{
    contactsUpdated: { contacts: Contact[] };
    error: { message: string };
  }>();

  function addOptionalContact() {
    // Trim all inputs
    const trimmedName = newContact.name.trim();
    const trimmedNumber = newContact.number.trim();
    const trimmedEmail = newContact.email.trim();

    // Clear previous error
    error = '';
    dispatch('error', { message: '' });

    // Validate: require name and at least one contact method
    if (!trimmedName) {
      error = 'Name is required';
      dispatch('error', { message: error });
      return;
    }

    if (!trimmedNumber && !trimmedEmail) {
      error = 'At least one contact method (number or email) is required';
      dispatch('error', { message: error });
      return;
    }

    // Validate phone number format if provided
    if (trimmedNumber) {
      // Allow only digits, spaces, dashes, parentheses, and plus sign
      const phoneRegex = /^[0-9\s\-\(\)\+]+$/;
      if (!phoneRegex.test(trimmedNumber)) {
        error = 'Phone number should contain only digits, spaces, dashes, parentheses, and plus sign';
        dispatch('error', { message: error });
        return;
      }
    }

    // Validate email format if provided
    if (trimmedEmail && !trimmedEmail.includes('@')) {
      error = 'Please enter a valid email address';
      dispatch('error', { message: error });
      return;
    }

    // Check for duplicate contacts
    const isDuplicate = contacts.some(contact =>
      contact.name.toLowerCase() === trimmedName.toLowerCase() &&
      (contact.number === trimmedNumber || contact.email.toLowerCase() === trimmedEmail.toLowerCase())
    );

    if (isDuplicate) {
      error = 'This contact already exists';
      dispatch('error', { message: error });
      return;
    }

    // Add the contact
    contacts = [...contacts, {
      name: trimmedName,
      number: trimmedNumber,
      email: trimmedEmail
    }];

    console.log('Optional contacts after adding:', contacts);
    dispatch('contactsUpdated', { contacts });

    // Reset form
    newContact = { name: '', number: '', email: '' };
  }

  function removeOptionalContact(index: number) {
    contacts = contacts.filter((_, i) => i !== index);
    console.log('Optional contacts after removal:', contacts);
    dispatch('contactsUpdated', { contacts });
  }
</script>

<div class="space-y-4">
  <!-- Optional Contacts Title -->
  <div
    class="flex items-center justify-between bg-gray-100 px-4 py-3 rounded cursor-pointer hover:bg-gray-200 transition-colors"
    on:click={() => isExpanded = !isExpanded}
    role="button"
    tabindex="0"
    aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
    on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isExpanded = !isExpanded; } }}
  >
    <h2 class="font-medium text-gray-800">
      Optional Contacts
      {#if contacts.length > 0}
        <span class="text-sm text-gray-600 ml-2">({contacts.length} added)</span>
      {/if}
    </h2>
    <div class="text-gray-600">
      <svg class="w-5 h-5 transform transition-transform {isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </div>
  </div>

  {#if !isExpanded}
    <!-- Collapsed Summary View -->
    <div class="mt-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg shadow-sm overflow-hidden">
      {#if contacts.length > 0}
        <div class="overflow-hidden">
          <table class="min-w-full divide-y divide-purple-200">
            <thead class="bg-purple-100">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-purple-700 uppercase tracking-wider">Name</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-purple-700 uppercase tracking-wider">Number</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-purple-700 uppercase tracking-wider">Email</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-purple-100">
              {#each contacts as contact, i}
                <tr>
                  <td class="px-3 py-2 text-sm font-medium text-gray-900">{contact.name}</td>
                  <td class="px-3 py-2 text-sm text-gray-600">{contact.number || '-'}</td>
                  <td class="px-3 py-2 text-sm text-gray-600 truncate max-w-40">{contact.email || '-'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="p-3 bg-purple-50 border-t border-purple-200">
          <div class="flex justify-center">
            <button
              type="button"
              on:click={() => isExpanded = true}
              class="inline-flex items-center gap-2 text-purple-600 hover:text-purple-800 text-sm font-semibold bg-white px-3 py-1.5 rounded-md border border-purple-200 hover:border-purple-300 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
              Edit Contacts
            </button>
          </div>
        </div>
      {:else}
        <div class="p-6">
          <div class="text-sm text-gray-500 italic text-center">No contacts added yet</div>
          <div class="mt-3 flex justify-center">
            <button
              type="button"
              on:click={() => isExpanded = true}
              class="inline-flex items-center gap-2 text-purple-600 hover:text-purple-800 text-sm font-semibold bg-white px-3 py-1.5 rounded-md border border-purple-200 hover:border-purple-300 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              Add Contacts
            </button>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Contacts Table -->
    <div class="overflow-hidden border border-gray-200 rounded">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Actions</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {#each contacts as contact, i}
          <tr>
            <td class="px-4 py-3 text-sm text-gray-900">{contact.name}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{contact.number}</td>
            <td class="px-4 py-3 text-sm text-gray-900">{contact.email}</td>
            <td class="px-4 py-3 text-right">
              <button type="button" class="text-red-600 hover:text-red-800 text-sm" on:click={() => removeOptionalContact(i)}>Remove</button>
            </td>
          </tr>
        {/each}

        <!-- Add New Contact Row -->
        <tr class="bg-gray-50">
          <td class="px-4 py-3">
            <input
              type="text"
              bind:value={newContact.name}
              placeholder="Enter name"
              class="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </td>
          <td class="px-4 py-3">
            <input
              type="tel"
              bind:value={newContact.number}
              placeholder="Numbers, spaces, and + only"
              class="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </td>
          <td class="px-4 py-3">
            <input
              type="email"
              bind:value={newContact.email}
              placeholder="Enter email"
              class="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </td>
          <td class="px-4 py-3 text-right">
            <button
              type="button"
              class="px-3 py-2 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600 transition-colors"
              on:click={addOptionalContact}
            >
              Add
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

    {#if error}
      <div class="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
        {error}
      </div>
    {/if}
  {/if}

</div>
