<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Contact } from '$lib/types/workshop';

  export let contacts: Contact[] = [];
  export let error: string = '';

  let newContact: Contact = { name: '', number: '', email: '' };

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

<div>
  <div class="flex items-center justify-between bg-gray-100 px-4 py-3 rounded">
    <h2 class="font-medium text-gray-800">Optional Contacts</h2>
    <button type="button" class="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600" on:click={addOptionalContact}>Add</button>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 items-end">
    <div class="md:col-span-4">
      <label class="block text-sm font-medium text-gray-700 mb-1" for="opt-name">Name</label>
      <input id="opt-name" type="text" bind:value={newContact.name} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
    <div class="md:col-span-4">
      <label class="block text-sm font-medium text-gray-700 mb-1" for="opt-number">Number</label>
      <input
        id="opt-number"
        type="tel"
        bind:value={newContact.number}
        placeholder="Numbers, spaces, and + only"
        class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    <div class="md:col-span-4">
      <label class="block text-sm font-medium text-gray-700 mb-1" for="opt-email">Email</label>
      <input id="opt-email" type="email" bind:value={newContact.email} class="w-full bg-gray-100 rounded px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  </div>

  {#if error}
    <div class="mt-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
      {error}
    </div>
  {/if}

  {#if contacts.length > 0}
    <div class="mt-4">
      <div class="overflow-hidden border border-gray-200 rounded">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th class="px-4 py-3"></th>
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
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
