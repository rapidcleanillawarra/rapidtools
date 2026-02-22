<script lang="ts">
  import { supabase } from '$lib/supabase';
  import { onMount } from 'svelte';

  /** Shown when workshop status is pickup or return. Assign a person and set schedule. */
  export let workshopStatus: string | null;
  export let assignedTo: string = '';
  export let assignedToName: string = '';
  /** Schedule as ISO string (timestamptz). Bound to parent. */
  export let schedule: string = '';
  export let canEdit: boolean = true;
  export let minDateTime: string = '';

  type UserOption = { email: string; full_name: string };

  let users: UserOption[] = [];
  let usersLoading = false;
  let dropdownOpen = false;
  let searchQuery = '';
  let dropdownNode: HTMLDivElement;

  $: scheduleLabel =
    workshopStatus === 'return' ? 'Return schedule' : 'Pickup schedule';
  $: sectionTitle =
    workshopStatus === 'return' ? 'Transport (return)' : 'Transport (pickup)';

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

  /** Input shows search when open, selected user when closed */
  $: assignedInputValue = dropdownOpen ? searchQuery : (assignedTo ? selectedUserLabel : '');

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
    if (!canEdit) return;
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

  onMount(() => {
    if (workshopStatus === 'pickup' || workshopStatus === 'return') {
      fetchUsers();
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });

  // datetime-local uses YYYY-MM-DDTHH:mm (no seconds, no Z)
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

  function handleScheduleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    schedule = datetimeLocalToIso(value);
  }
</script>

{#if workshopStatus === 'pickup' || workshopStatus === 'return'}
  <div class="transport-section">
    <div
      class="flex items-center justify-between px-4 py-3 rounded"
      style="background-color: rgb(30, 30, 30);"
    >
      <h2 class="font-medium text-white">{sectionTitle}</h2>
    </div>

    <div class="space-y-4 bg-gray-50 border border-gray-200 border-t-0 px-4 py-3 rounded">
      <p class="text-sm text-gray-600">
        Assign a person for this transport and set the scheduled date and time.
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="relative" bind:this={dropdownNode}>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="transport-assigned-input">
            Assigned to
          </label>
          <div
            class="flex rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 {!canEdit ? 'opacity-50 pointer-events-none' : ''}"
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
              disabled={!canEdit}
              role="combobox"
              aria-expanded={dropdownOpen}
              aria-autocomplete="list"
              aria-controls="transport-user-list"
            />
            {#if assignedTo && canEdit}
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
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="transport-schedule">
          {scheduleLabel}
        </label>
        <input
          id="transport-schedule"
          type="datetime-local"
          value={scheduleLocal}
          on:input={handleScheduleInput}
          min={minDateTime}
          class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="Select date and time"
          disabled={!canEdit}
        />
      </div>
    </div>
  </div>
{/if}
