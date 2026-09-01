<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { currentUser } from '$lib/firebase';
  import { userProfile } from '$lib/userProfile';
  import {
    addWorkshopComment,
    getWorkshop,
    getWorkshopTechScheduleHistory,
    type TechJobsSummaryRow,
    type WorkshopHistoryEntry,
    type WorkshopRecord,
    type WorkshopTechScheduleRecord
  } from '$lib/services/workshop';
  import { toastError, toastSuccess } from '$lib/utils/toast';
  import {
    assignmentStatusClass,
    formatStatusLabel,
    formatSydneyDate,
    jobTypeClass
  } from '../utils';

  interface Props {
    workshopId: string;
    row?: TechJobsSummaryRow | null;
    onclose?: () => void;
  }

  let { workshopId, row = null, onclose }: Props = $props();

  type TabType = 'notes' | 'assignment_history' | 'status_history';
  let activeTab = $state<TabType>('notes');

  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let workshop = $state<WorkshopRecord | null>(null);
  let comments = $state<Array<{ id: string; text: string; author: string; created_at: string }>>([]);
  let techScheduleHistory = $state<WorkshopTechScheduleRecord[]>([]);
  let statusHistory = $state<WorkshopHistoryEntry[]>([]);

  let newCommentText = $state('');
  let isAddingComment = $state(false);

  const commentsCount = $derived(comments.length);
  const assignmentCount = $derived(techScheduleHistory.length);
  const statusHistoryCount = $derived(statusHistory.length);

  async function loadJobDetails() {
    isLoading = true;
    error = null;
    try {
      const [workshopData, scheduleHistoryData] = await Promise.all([
        getWorkshop(workshopId),
        getWorkshopTechScheduleHistory(workshopId)
      ]);

      if (!workshopData) {
        throw new Error('Workshop job not found');
      }

      workshop = workshopData;

      // Extract comments
      if (workshopData.comments) {
        if (Array.isArray(workshopData.comments)) {
          comments = workshopData.comments;
        } else if (typeof workshopData.comments === 'string') {
          try {
            comments = JSON.parse(workshopData.comments);
          } catch {
            comments = [];
          }
        }
      } else {
        comments = [];
      }

      // Extract status history
      statusHistory = Array.isArray(workshopData.history) ? workshopData.history : [];

      // Extract tech schedule history
      techScheduleHistory = scheduleHistoryData;
    } catch (err) {
      console.error('[JOB_NOTES_HISTORY] Failed to load details:', err);
      const msg = err instanceof Error ? err.message : 'Failed to load job details';
      error = msg;
      toastError(msg);
    } finally {
      isLoading = false;
    }
  }

  async function handleAddComment() {
    const text = newCommentText.trim();
    if (!text) return;

    const user = $currentUser;
    const profile = $userProfile;
    const author = user
      ? profile
        ? `${profile.firstName} ${profile.lastName}`.trim()
        : user.displayName || user.email?.split('@')[0] || 'Unknown User'
      : 'Unknown User';

    try {
      isAddingComment = true;
      const updated = await addWorkshopComment(workshopId, text, author);
      comments = updated;
      newCommentText = '';
      toastSuccess('Note added successfully');
    } catch (err) {
      console.error('[JOB_NOTES_HISTORY] Failed to add note:', err);
      toastError('Failed to add note. Please try again.');
    } finally {
      isAddingComment = false;
    }
  }

  function handleClose() {
    onclose?.();
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  }

  function getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  onMount(() => {
    void loadJobDetails();
  });
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
  <!-- Backdrop -->
  <button
    type="button"
    class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
    aria-label="Close dialog"
    onclick={handleClose}
  ></button>

  <!-- Modal Container -->
  <div
    class="relative z-10 flex flex-col w-full max-w-3xl max-h-[90vh] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
    role="dialog"
    aria-modal="true"
    aria-labelledby="job-notes-history-title"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="flex-shrink-0 bg-gray-50 border-b border-gray-200 px-6 py-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h2 id="job-notes-history-title" class="text-xl font-bold text-gray-900">
              Job Notes & History
            </h2>
            {#if workshop?.status || row?.current_workshop_status}
              <span
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-800"
              >
                {formatStatusLabel(workshop?.status || row?.current_workshop_status)}
              </span>
            {/if}
            {#if row?.job_type}
              <span
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold {jobTypeClass(
                  row.job_type
                )}"
              >
                {row.job_type}
              </span>
            {/if}
          </div>

          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            {#if workshop?.customer_name || row?.customer_name}
              <span class="font-medium text-gray-900">
                {workshop?.customer_name || row?.customer_name}
              </span>
            {/if}
            {#if workshop?.product_name || row?.product_name}
              <span class="text-gray-500">
                {workshop?.product_name || row?.product_name}
              </span>
            {/if}
            {#if (workshop?.make_model || row?.make_model) || (workshop?.serial_number || row?.serial_number)}
              <span class="text-gray-400 text-xs">
                {[
                  workshop?.make_model || row?.make_model,
                  workshop?.serial_number || row?.serial_number
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            {/if}
            {#if workshop?.order_id || row?.order_id}
              <a
                href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={workshop?.order_id || row?.order_id}"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:text-blue-800 underline font-medium text-xs"
              >
                Order #{workshop?.order_id || row?.order_id}
              </a>
            {/if}
          </div>
        </div>

        <button
          type="button"
          class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 transition-colors"
          aria-label="Close modal"
          onclick={handleClose}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Tab Buttons -->
      <div class="mt-4 flex border-b border-gray-200 -mb-4">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'notes'}
          onclick={() => (activeTab = 'notes')}
          class="inline-flex items-center gap-2 py-2.5 px-4 text-sm font-medium border-b-2 transition-colors {activeTab ===
          'notes'
            ? 'border-yellow-500 text-yellow-600 font-semibold'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
          </svg>
          Notes & Comments
          {#if commentsCount > 0}
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-800"
            >
              {commentsCount}
            </span>
          {/if}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'assignment_history'}
          onclick={() => (activeTab = 'assignment_history')}
          class="inline-flex items-center gap-2 py-2.5 px-4 text-sm font-medium border-b-2 transition-colors {activeTab ===
          'assignment_history'
            ? 'border-yellow-500 text-yellow-600 font-semibold'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Assignment History
          {#if assignmentCount > 0}
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-800"
            >
              {assignmentCount}
            </span>
          {/if}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'status_history'}
          onclick={() => (activeTab = 'status_history')}
          class="inline-flex items-center gap-2 py-2.5 px-4 text-sm font-medium border-b-2 transition-colors {activeTab ===
          'status_history'
            ? 'border-yellow-500 text-yellow-600 font-semibold'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          Status History
          {#if statusHistoryCount > 0}
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-800"
            >
              {statusHistoryCount}
            </span>
          {/if}
        </button>
      </div>
    </div>

    <!-- Body / Content -->
    <div class="flex-1 overflow-y-auto px-6 py-6">
      {#if isLoading}
        <div class="flex flex-col items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
          <p class="mt-3 text-sm text-gray-500">Loading job notes and history...</p>
        </div>
      {:else if error}
        <div class="rounded-lg bg-red-50 border border-red-200 p-4 text-center">
          <p class="text-sm text-red-700 font-medium">{error}</p>
          <button
            type="button"
            onclick={loadJobDetails}
            class="mt-3 inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      {:else}
        <!-- TAB 1: Notes & Comments -->
        {#if activeTab === 'notes'}
          <div class="space-y-6">
            <!-- Fault / Initial Note if present -->
            {#if workshop?.fault_description}
              <div class="rounded-lg bg-amber-50/70 border border-amber-200/80 p-4">
                <div class="flex items-start gap-2.5">
                  <svg
                    class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 class="text-xs font-bold text-amber-900 uppercase tracking-wide">
                      Fault / Initial Description
                    </h3>
                    <p class="mt-1 text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                      {workshop.fault_description}
                    </p>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Comments List -->
            <div>
              <h3 class="text-sm font-semibold text-gray-900 mb-3">Comments & Notes</h3>
              {#if comments.length === 0}
                <div class="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <svg class="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <p class="mt-2 text-sm text-gray-500">No notes or comments added yet.</p>
                </div>
              {:else}
                <div class="space-y-3">
                  {#each comments as comment (comment.id)}
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 transition-all">
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <span
                            class="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold"
                          >
                            {getInitials(comment.author)}
                          </span>
                          <span class="text-sm font-semibold text-gray-900">{comment.author}</span>
                        </div>
                        <span class="text-xs text-gray-500">
                          {formatSydneyDate(comment.created_at)}
                        </span>
                      </div>
                      <p class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed pl-8">
                        {comment.text}
                      </p>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Add Note Form -->
            <div class="border-t border-gray-200 pt-4">
              <label for="new-job-note" class="block text-sm font-medium text-gray-700 mb-1">
                Add a note
              </label>
              <textarea
                id="new-job-note"
                bind:value={newCommentText}
                rows="3"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="Write a note about this job, technician update, parts required, etc..."
              ></textarea>
              <div class="mt-2 flex justify-end">
                <button
                  type="button"
                  disabled={!newCommentText.trim() || isAddingComment}
                  onclick={handleAddComment}
                  class="inline-flex items-center gap-1.5 px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {#if isAddingComment}
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  {:else}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Note
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {/if}

        <!-- TAB 2: Tech Assignment History -->
        {#if activeTab === 'assignment_history'}
          <div>
            {#if techScheduleHistory.length === 0}
              <div class="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <svg class="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p class="mt-2 text-sm text-gray-500">No tech assignment history recorded for this job.</p>
              </div>
            {:else}
              <div class="space-y-4">
                {#each techScheduleHistory as scheduleItem, index (scheduleItem.id)}
                  <div
                    class="rounded-lg border p-4 transition-all {scheduleItem.assignment_status === 'active'
                      ? 'border-green-300 bg-green-50/40'
                      : scheduleItem.assignment_status === 'cancelled'
                        ? 'border-red-200 bg-red-50/30'
                        : 'border-gray-200 bg-white'}"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold {assignmentStatusClass(
                            scheduleItem.assignment_status
                          )}"
                        >
                          {formatStatusLabel(scheduleItem.assignment_status)}
                        </span>
                        {#if scheduleItem.job_type}
                          <span
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold {jobTypeClass(
                              scheduleItem.job_type
                            )}"
                          >
                            {scheduleItem.job_type}
                          </span>
                        {/if}
                        {#if index === 0 && scheduleItem.assignment_status === 'active'}
                          <span class="inline-flex items-center text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                            Current Assignment
                          </span>
                        {/if}
                      </div>

                      <span class="text-xs text-gray-500">
                        {formatSydneyDate(scheduleItem.created_at)}
                      </span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span class="text-gray-500 font-medium">Technician:</span>
                        <span class="text-gray-900 font-semibold ml-1">
                          {scheduleItem.assigned_tech_name || scheduleItem.assigned_tech || 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span class="text-gray-500 font-medium">Schedule:</span>
                        <span class="text-gray-900 ml-1">
                          {scheduleItem.schedule ? formatSydneyDate(scheduleItem.schedule) : 'Unscheduled'}
                        </span>
                      </div>
                      <div>
                        <span class="text-gray-500 font-medium">Assigned by:</span>
                        <span class="text-gray-900 ml-1">
                          {scheduleItem.assigned_by_name || scheduleItem.assigned_by || '—'}
                        </span>
                      </div>
                      {#if scheduleItem.workshop_status}
                        <div>
                          <span class="text-gray-500 font-medium">Board status:</span>
                          <span class="text-gray-900 ml-1">
                            {formatStatusLabel(scheduleItem.workshop_status)}
                          </span>
                        </div>
                      {/if}
                    </div>

                    {#if scheduleItem.change_reason}
                      <div class="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs">
                        <span class="font-semibold text-amber-900">Change / Cancellation Reason:</span>
                        <p class="text-amber-800 mt-0.5 whitespace-pre-wrap">{scheduleItem.change_reason}</p>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- TAB 3: Status History -->
        {#if activeTab === 'status_history'}
          <div>
            {#if statusHistory.length === 0}
              <div class="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <svg class="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p class="mt-2 text-sm text-gray-500">No status transition history found.</p>
              </div>
            {:else}
              <div class="space-y-3">
                {#each statusHistory as entry (entry.id)}
                  <div class="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3.5">
                    <div class="flex-shrink-0 mt-0.5">
                      <div class="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-2">
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold {entry.isCreation
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'}"
                        >
                          {#if entry.isCreation}
                            Job Created ({formatStatusLabel(entry.status)})
                          {:else}
                            {formatStatusLabel(entry.status)}
                          {/if}
                        </span>
                        <span class="text-xs text-gray-500">
                          {formatSydneyDate(entry.timestamp)}
                        </span>
                      </div>
                      <p class="text-xs text-gray-500 mt-1">
                        Updated by <span class="font-medium text-gray-700">{entry.user || 'Unknown'}</span>
                      </p>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-3.5 flex items-center justify-between">
      <a
        href="{base}/workshop/form?workshop_id={workshopId}"
        class="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 underline"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        Open full workshop form
      </a>

      <button
        type="button"
        onclick={handleClose}
        class="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 shadow-sm transition-colors"
      >
        Close
      </button>
    </div>
  </div>
</div>
