<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { supabase } from '$lib/supabase';

  /** Workshop job status: pickup or return */
  export let jobStatus: 'pickup' | 'return' = 'pickup';
  export let show: boolean = false;
  /** Set by parent while saving transport and sending notification */
  export let submitting: boolean = false;

  type UserOption = { email: string; full_name: string };

  let users: UserOption[] = [];
  let usersLoading = false;
  let dropdownOpen = false;
  let searchQuery = '';
  let dropdownNode: HTMLDivElement;

  let assignedTo = '';
  let assignedToName = '';
  let schedule = '';

  const dispatch = createEventDispatcher<{
    confirm: { assignedTo: string; assignedToName: string; schedule: string };
    cancel: void;
  }>();

  $: scheduleLabel = jobStatus === 'return' ? 'Return schedule' : 'Pickup schedule';
  $: modalTitle = jobStatus === 'return' ? 'Assign return transport' : 'Assign pickup transport';

  $: filteredUsers = (() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  })();

  $: selectedUserLabel =
    assignedTo && assignedToName
      ? `${assignedToName} (${assignedTo})`
      : assignedTo || '';

  $: assignedInputValue = dropdownOpen ? searchQuery : (assignedTo ? selectedUserLabel : '');

  function isoToDatetimeLocal(iso: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day}T${h}:${min}`;
    } catch {
      return '';
    }
  }

  function datetimeLocalToIso(local: string): string {
    if (!local) return '';
    try {
      const d = new Date(local);
      return isNaN(d.getTime()) ? '' : d.toISOString();
    } catch {
      return '';
    }
  }

  $: scheduleLocal = schedule ? isoToDatetimeLocal(schedule) : '';

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

  function openDropdown() {
    dropdownOpen = true;
    searchQuery = '';
    if (users.length === 0) fetchUsers();
  }

  function selectUser(user: UserOption) {
    assignedTo = user.email;
    assignedToName = user.full_name;
    dropdownOpen = false;
    searchQuery = '';
  }

  function clearAssignment() {
    assignedTo = '';
    assignedToName = '';
    dropdownOpen = false;
    searchQuery = '';
  }

  function handleClickOutside(event: MouseEvent) {
    if (dropdownNode && !dropdownNode.contains(event.target as Node)) {
      dropdownOpen = false;
    }
  }

  function handleScheduleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    schedule = datetimeLocalToIso(value);
  }

  function handleConfirm() {
    if (submitting) return;
    dispatch('confirm', {
      assignedTo,
      assignedToName,
      schedule: schedule.trim()
    });
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
    assignedTo = '';
    assignedToName = '';
    schedule = '';
    dropdownOpen = false;
    searchQuery = '';
  }
  $: prevShow = show;

  $: if (show && users.length === 0 && !usersLoading) {
    fetchUsers();
  }

  function onWindowClick(e: MouseEvent) {
    if (!show) return;
    if (dropdownOpen && dropdownNode && !dropdownNode.contains(e.target as Node)) {
      dropdownOpen = false;
    }
  }
</script>

<svelte:window on:click={onWindowClick} />

{#if show}
  <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    data-backdrop="true"
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === 'Escape' && handleCancel()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="pickup-return-modal-title"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 id="pickup-return-modal-title" class="text-lg font-semibold text-gray-900">
          {modalTitle}
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          Assign a person and set the schedule. This will be saved and a Teams notification will be sent.
        </p>
      </div>

      <div class="px-6 py-4 space-y-4 overflow-y-auto">
        <div class="relative" bind:this={dropdownNode}>
          <label for="transport-assigned-input" class="block text-sm font-medium text-gray-700 mb-1">
            Assigned to
          </label>
          <div
            class="flex rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
          >
            <input
              id="transport-assigned-input"
              type="text"
              value={assignedInputValue}
              on:input={(e) => {
                if (dropdownOpen) searchQuery = (e.target as HTMLInputElement).value;
              }}
              on:focus={openDropdown}
              on:click|stopPropagation={openDropdown}
              class="flex-1 min-w-0 rounded-lg border-0 px-4 py-3 focus:ring-0 focus:outline-none"
              placeholder="Search by name or email..."
              role="combobox"
              aria-expanded={dropdownOpen}
              aria-autocomplete="list"
              aria-controls="transport-user-list"
            />
            {#if assignedTo}
              <button
                type="button"
                class="px-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                on:click|stopPropagation={clearAssignment}
                title="Clear selection"
                aria-label="Clear selection"
              >
                ×
              </button>
            {/if}
          </div>
          {#if dropdownOpen}
            <ul
              id="transport-user-list"
              class="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1"
              role="listbox"
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
                      class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none {user.email === assignedTo ? 'bg-blue-50 text-blue-800' : ''}"
                      role="option"
                      aria-selected={user.email === assignedTo}
                      on:click|stopPropagation={() => selectUser(user)}
                    >
                      <span class="font-medium">{user.full_name}</span>
                      <span class="text-gray-500 ml-1">({user.email})</span>
                    </button>
                  </li>
                {/each}
              {/if}
            </ul>
          {/if}
        </div>

        <div>
          <label for="transport-schedule" class="block text-sm font-medium text-gray-700 mb-1">
            {scheduleLabel}
          </label>
          <input
            id="transport-schedule"
            type="datetime-local"
            value={scheduleLocal}
            on:input={handleScheduleInput}
            class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Select date and time"
          />
        </div>
      </div>

      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
        <button
          type="button"
          class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          on:click={handleCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
          disabled={submitting}
          on:click={handleConfirm}
        >
          {#if submitting}
            <span class="inline-flex items-center">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          {:else}
            Confirm & notify
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
