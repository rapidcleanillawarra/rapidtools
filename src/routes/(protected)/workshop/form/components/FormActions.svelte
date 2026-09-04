<script lang="ts">
  export let base: string;
  export let existingWorkshopId: string | null;
  export let workshopStatus: string | null;
  export let isSubmitting: boolean;

  export let confirmDeleteJob: () => void;
  export let regenerateAndSendTag: () => void;
  export let handleUpdateJob: (event: Event) => void;

  export let repairedStatusTransition: string;
  export let handleSubmit: (event: Event) => void;

  export let getSubmitButtonLoadingText: () => string;
  export let submitButtonText: string;
</script>

<!-- Responsive button layout -->
<div class="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center pt-4 border-t border-[#262a30]">
  <!-- Delete Job Button - Only show for existing workshops -->
  {#if existingWorkshopId}
    <div class="sm:flex-shrink-0">
      <button
        type="button"
        on:click={confirmDeleteJob}
        disabled={isSubmitting}
        class="w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-30 transition-colors gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
        Delete Job
      </button>
    </div>
  {:else}
    <div></div>
  {/if}

  <!-- Right side buttons - responsive grid on small screens -->
  <div class="flex flex-col gap-3 sm:flex-row sm:gap-3 sm:flex-wrap sm:justify-end">
    <!-- Cancel Button -->
    <a href="{base}/workshop/workshop-board" class="btn-secondary w-full sm:w-auto px-4 py-2.5 text-sm text-center inline-flex items-center justify-center">Cancel</a>

    <!-- Regenerate Tag Button - show for all existing workshops -->
    {#if existingWorkshopId}
      <button
        type="button"
        on:click={regenerateAndSendTag}
        disabled={isSubmitting}
        class="btn-secondary w-full sm:w-auto px-4 py-2.5 text-sm inline-flex items-center justify-center gap-2 hover:text-purple-300 transition-colors"
      >
        <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
        </svg>
        Regenerate Tag
      </button>
    {/if}

    <!-- Update Job Button - always visible for data updates only -->
    <button
      type="button"
      on:click={handleUpdateJob}
      disabled={isSubmitting}
      class="btn-secondary w-full sm:w-auto px-4 py-2.5 text-sm inline-flex items-center justify-center gap-2 hover:text-lime-300"
    >
      {#if isSubmitting}
        <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Updating Job...
      {:else}
        {existingWorkshopId ? 'Update Job' : 'Create Job'}
      {/if}
    </button>

    <!-- Status Transition Dropdown - only show for repaired status -->
    {#if existingWorkshopId && workshopStatus === 'repaired'}
      <select
        bind:value={repairedStatusTransition}
        class="w-full sm:w-auto px-4 py-2.5 bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-colors {!repairedStatusTransition ? 'border-amber-500/40' : ''}"
      >
        <option value="">Select next status...</option>
        <option value="completed">Completed</option>
        <option value="return">Return</option>
        <option value="pickup_from_workshop">Pickup From Workshop</option>
        <option value="to_be_scrapped">To Be Scrapped</option>
        <option value="pending_jobs">Pending Jobs</option>
        <option value="drawing_request">Drawing Request</option>
      </select>
    {/if}

    <!-- Submit Button - for order creation, status transitions, and updates -->
    {#if existingWorkshopId}
      <button
        type="button"
        on:click={handleSubmit}
        disabled={isSubmitting || (existingWorkshopId !== null && workshopStatus === null) || (workshopStatus === 'repaired' && !repairedStatusTransition)}
        class="btn-primary w-full sm:w-auto px-5 py-2.5 text-sm inline-flex items-center justify-center gap-2"
      >
        {#if isSubmitting}
          <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {getSubmitButtonLoadingText()}
        {:else}
          {submitButtonText}
        {/if}
      </button>
    {/if}
  </div>
</div>
