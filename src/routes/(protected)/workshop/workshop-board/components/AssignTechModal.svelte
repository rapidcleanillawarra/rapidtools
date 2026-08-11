<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { supabase } from '$lib/supabase';

  export let show: boolean = false;
  /** Optional label shown under the title (e.g. customer name) */
  export let workshopLabel: string = '';

  type UserOption = { email: string; full_name: string };

  let users: UserOption[] = [];
  let usersLoading = false;
  let searchQuery = '';
  let selectedEmail = '';

  const dispatch = createEventDispatcher<{
    cancel: void;
  }>();

  $: filteredUsers = (() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.trim().toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q)
    );
  })();

  async function fetchUsers() {
    try {
      usersLoading = true;
      const { data, error } = await supabase
        .from('users')
        .select('email, full_name')
        .order('full_name', { ascending: true });
      if (error) throw error;
      users = data ?? [];
    } catch (e) {
      console.error('Failed to fetch users:', e);
      users = [];
    } finally {
      usersLoading = false;
    }
  }

  function selectUser(user: UserOption) {
    selectedEmail = user.email;
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).getAttribute('data-backdrop') === 'true') {
      handleCancel();
    }
  }

  let prevShow = false;
  $: if (show && !prevShow) {
    searchQuery = '';
    selectedEmail = '';
    fetchUsers();
  }
  $: prevShow = show;
</script>

{#if show}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    data-backdrop="true"
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === 'Escape' && handleCancel()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="assign-tech-modal-title"
    tabindex="-1"
  >
    <div
      class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
    >
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 id="assign-tech-modal-title" class="text-lg font-semibold text-gray-900">
          Assign Tech
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          {#if workshopLabel}
            Assign a technician for <span class="font-medium text-gray-700">{workshopLabel}</span>.
          {:else}
            Select a technician from the list below.
          {/if}
        </p>
      </div>

      <div class="px-6 py-4 space-y-4 overflow-hidden flex flex-col min-h-0 flex-1">
        <div>
          <label for="assign-tech-search" class="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            id="assign-tech-search"
            type="text"
            bind:value={searchQuery}
            class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search by name or email..."
          />
        </div>

        <ul
          class="flex-1 min-h-0 max-h-80 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100"
          role="listbox"
          aria-label="Technicians"
        >
          {#if usersLoading}
            <li class="px-4 py-3 text-sm text-gray-500">Loading users...</li>
          {:else if filteredUsers.length === 0}
            <li class="px-4 py-3 text-sm text-gray-500">
              {searchQuery ? 'No users match your search.' : 'No users found.'}
            </li>
          {:else}
            {#each filteredUsers as user (user.email)}
              <li>
                <button
                  type="button"
                  class="w-full text-left px-4 py-3 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none {user.email === selectedEmail ? 'bg-blue-50 text-blue-800' : ''}"
                  role="option"
                  aria-selected={user.email === selectedEmail}
                  on:click={() => selectUser(user)}
                >
                  <span class="font-medium block">{user.full_name}</span>
                  <span class="text-gray-500 text-xs">{user.email}</span>
                </button>
              </li>
            {/each}
          {/if}
        </ul>
      </div>

      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
        <button
          type="button"
          class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          on:click={handleCancel}
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}
