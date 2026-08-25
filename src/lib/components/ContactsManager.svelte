<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Contact } from '$lib/types/workshop';

  export let contacts: Contact[] = [];
  export let error: string = '';
  export let workshopStatus: string | null = null;

  let newContact: Contact = { name: '', number: '', email: '' };

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
  <!-- Existing Contacts List -->
  {#if contacts.length > 0}
    <div class="overflow-hidden border border-[#262a30] rounded-xl bg-[#141619]">
      <table class="min-w-full divide-y divide-[#262a30]">
        <thead class="bg-[#181b20]">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Number</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-[#141619] divide-y divide-[#262a30]">
          {#each contacts as contact, i}
            <tr class="even:bg-[#181b20]/50 hover:bg-[#1f2329]/60 transition-colors">
              <td class="px-4 py-3 text-sm text-gray-200 font-medium">{contact.name}</td>
              <td class="px-4 py-3 text-sm text-gray-300">{contact.number || '—'}</td>
              <td class="px-4 py-3 text-sm text-gray-300">{contact.email || '—'}</td>
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-950/20 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-colors"
                  on:click={() => removeOptionalContact(i)}
                >
                  Remove
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Add New Contact Form -->
  {#if workshopStatus !== 'pickup'}
    <div class="bg-[#181b20] p-4 rounded-xl border border-[#262a30]">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1" for="new-contact-name">Name</label>
          <input
            id="new-contact-name"
            type="text"
            bind:value={newContact.name}
            placeholder="Enter name"
            class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1" for="new-contact-phone">Phone Number</label>
          <input
            id="new-contact-phone"
            type="tel"
            bind:value={newContact.number}
            placeholder="Numbers, spaces, and + only"
            class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1" for="new-contact-email">Email</label>
          <input
            id="new-contact-email"
            type="email"
            bind:value={newContact.email}
            placeholder="Enter email"
            class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
          />
        </div>
        <div>
          <button
            type="button"
            class="btn-primary w-full py-2 text-sm justify-center"
            on:click={addOptionalContact}
          >
            Add Contact
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if error}
    <div class="p-3 bg-red-950/30 border border-red-500/30 text-red-300 rounded-lg text-sm">
      {error}
    </div>
  {/if}
</div>
