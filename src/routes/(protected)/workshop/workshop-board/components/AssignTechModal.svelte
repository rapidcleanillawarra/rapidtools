<script lang="ts">
  import { beforeUpdate, createEventDispatcher } from 'svelte';
  import { supabase } from '$lib/supabase';
  import {
    sydneyInputToUtcIso,
    utcIsoToSydneyInput
  } from '../../../orders-past-due-accounts/utils/dueDate';
  import { WORKSHOP_TECH_JOB_TYPES } from '$lib/services/workshop';

  export let show: boolean = false;
  /** Optional label shown under the title (e.g. customer name) */
  export let workshopLabel: string = '';
  /** Preselect current assignment email when opening */
  export let initialAssignedTo: string = '';
  /** Optional ISO datetime string to prefill schedule when opening */
  export let initialSchedule: string = '';
  /** Prefill job type when opening */
  export let initialJobType: string = '';
  export let submitting: boolean = false;

  type UserOption = { email: string; full_name: string };

  const PRIORITY_EMAIL = 'service@rapidcleanillawarra.com.au';

  let users: UserOption[] = [];
  let usersLoading = false;
  let usersError: string | null = null;
  let searchQuery = '';
  let selectedEmail = '';
  let schedule = '';
  let jobType = '';
  let loadSeq = 0;
  let wasShown = false;

  const dispatch = createEventDispatcher<{
    cancel: void;
    confirm: { assignedTo: string; assignedToName: string; schedule: string; jobType: string };
  }>();

  $: scheduleLocal = schedule ? utcIsoToSydneyInput(schedule) : '';

  $: filteredUsers = !searchQuery.trim()
    ? users
    : users.filter((u) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          (u.full_name ?? '').toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q)
        );
      });

  $: techChanged = selectedEmail !== (initialAssignedTo || '');
  $: scheduleChanged = (schedule || '') !== (initialSchedule || '');
  $: jobTypeChanged = (jobType || '') !== (initialJobType || '');
  $: scheduleRequired = !!selectedEmail;
  $: scheduleValid = !scheduleRequired || !!schedule.trim();
  $: jobTypeRequired = !!selectedEmail;
  $: jobTypeValid = !jobTypeRequired || !!jobType.trim();
  $: canSave =
    !submitting &&
    scheduleValid &&
    jobTypeValid &&
    (techChanged || scheduleChanged || jobTypeChanged);

  beforeUpdate(() => {
    if (show && !wasShown) {
      searchQuery = '';
      selectedEmail = initialAssignedTo || '';
      schedule = initialSchedule || '';
      jobType = initialJobType || '';
      users = [];
      usersError = null;
      fetchUsers();
    }
    wasShown = show;
  });

  function sortUsers(list: UserOption[]): UserOption[] {
    const priority: UserOption[] = [];
    const rest: UserOption[] = [];
    for (const user of list) {
      if ((user.email ?? '').toLowerCase() === PRIORITY_EMAIL) {
        priority.push(user);
      } else {
        rest.push(user);
      }
    }
    rest.sort((a, b) =>
      (a.full_name ?? '').localeCompare(b.full_name ?? '', undefined, { sensitivity: 'base' })
    );
    return [...priority, ...rest];
  }

  async function fetchUsers() {
    const seq = ++loadSeq;
    usersLoading = true;
    usersError = null;

    try {
      const response = await supabase
        .from('users')
        .select('email, full_name')
        .order('full_name', { ascending: true });

      if (seq !== loadSeq) return;

      if (response.error) throw response.error;

      users = sortUsers(response.data ?? []);
      if (initialAssignedTo) {
        selectedEmail = initialAssignedTo;
      }
    } catch (e) {
      console.error('[AssignTech] Failed to fetch users:', e);
      if (seq !== loadSeq) return;
      users = [];
      usersError =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : e instanceof Error
            ? e.message
            : 'Failed to load users';
    } finally {
      if (seq === loadSeq) usersLoading = false;
    }
  }

  function selectUser(user: UserOption) {
    selectedEmail = user.email;
  }

  function clearSelection() {
    selectedEmail = '';
  }

  function handleScheduleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    schedule = sydneyInputToUtcIso(value) ?? '';
  }

  function handleConfirm() {
    if (!canSave) return;
    const user = users.find((u) => u.email === selectedEmail);
    const assignedTo = selectedEmail;
    dispatch('confirm', {
      assignedTo,
      assignedToName: user?.full_name ?? '',
      // Schedule/job type required when assigning a tech; clear when unassigning
      schedule: assignedTo ? schedule.trim() : '',
      jobType: assignedTo ? jobType.trim() : ''
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
</script>

{#if show}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    data-backdrop="true"
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === 'Escape' && handleCancel()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="assign-tech-modal-title"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      role="document"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <div class="flex-shrink-0 border-b border-gray-200 px-6 py-4">
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

      <div class="space-y-4 overflow-y-auto px-6 py-4">
        <div>
          <label for="assign-tech-search" class="mb-1 block text-sm font-medium text-gray-700">
            Search
          </label>
          <input
            id="assign-tech-search"
            type="text"
            bind:value={searchQuery}
            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search by name or email..."
          />
        </div>

        {#if usersError}
          <p class="text-sm text-red-600">{usersError}</p>
        {/if}

        <ul
          class="h-80 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white"
          role="listbox"
          aria-label="Technicians"
        >
          {#if usersLoading}
            <li class="px-4 py-3 text-sm text-gray-500">Loading users...</li>
          {:else}
            <li>
              <button
                type="button"
                class="w-full px-4 py-3 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none {!selectedEmail
                  ? 'bg-blue-50 text-blue-800'
                  : ''}"
                role="option"
                aria-selected={!selectedEmail}
                on:click={clearSelection}
              >
                <span class="block font-medium">Unassigned</span>
                <span class="text-xs text-gray-500">Remove technician assignment</span>
              </button>
            </li>
            {#if filteredUsers.length === 0}
              <li class="px-4 py-3 text-sm text-gray-500">
                {searchQuery ? 'No users match your search.' : 'No users found.'}
              </li>
            {:else}
              {#each filteredUsers as user (user.email)}
                <li>
                  <button
                    type="button"
                    class="w-full px-4 py-3 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none {user.email ===
                    selectedEmail
                      ? 'bg-blue-50 text-blue-800'
                      : ''}"
                    role="option"
                    aria-selected={user.email === selectedEmail}
                    on:click={() => selectUser(user)}
                  >
                    <span class="block font-medium">{user.full_name}</span>
                    <span class="text-xs text-gray-500">{user.email}</span>
                  </button>
                </li>
              {/each}
            {/if}
          {/if}
        </ul>

        <div>
          <label for="assign-tech-schedule" class="mb-1 block text-sm font-medium text-gray-700">
            Schedule{#if scheduleRequired}<span class="text-red-600"> *</span>{/if}
          </label>
          <input
            id="assign-tech-schedule"
            type="datetime-local"
            value={scheduleLocal}
            on:input={handleScheduleInput}
            required={scheduleRequired}
            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Select date and time"
          />
          <p class="mt-1 text-xs text-gray-400">Times are Australia/Sydney</p>
          {#if scheduleRequired && !schedule.trim()}
            <p class="mt-1 text-sm text-red-600">Schedule is required when assigning a technician.</p>
          {/if}
        </div>

        <div>
          <label for="assign-tech-job-type" class="mb-1 block text-sm font-medium text-gray-700">
            Job type{#if jobTypeRequired}<span class="text-red-600"> *</span>{/if}
          </label>
          <select
            id="assign-tech-job-type"
            bind:value={jobType}
            required={jobTypeRequired}
            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select job type...</option>
            {#each WORKSHOP_TECH_JOB_TYPES as type (type)}
              <option value={type}>{type}</option>
            {/each}
          </select>
          {#if jobTypeRequired && !jobType.trim()}
            <p class="mt-1 text-sm text-red-600">
              Job type is required when assigning a technician.
            </p>
          {/if}
        </div>
      </div>

      <div
        class="flex flex-shrink-0 justify-end gap-3 rounded-b-lg border-t border-gray-200 bg-gray-50 px-6 py-4"
      >
        <button
          type="button"
          class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          on:click={handleCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          class="min-w-[100px] rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canSave}
          on:click={handleConfirm}
        >
          {#if submitting}
            <span class="inline-flex items-center">
              <svg class="mr-2 -ml-1 h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </span>
          {:else}
            Save
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
