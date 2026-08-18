<script lang="ts">
  interface Props {
    workshopLabel?: string;
    assignedTechName?: string;
    scheduleLabel?: string;
    jobType?: string;
    submitting?: boolean;
    onconfirm?: (changeReason: string) => void;
    oncancel?: () => void;
  }

  let {
    workshopLabel = '',
    assignedTechName = '',
    scheduleLabel = '',
    jobType = '',
    submitting = false,
    onconfirm,
    oncancel
  }: Props = $props();

  let changeReason = $state('');
  let changeReasonTouched = $state(false);

  const reasonValid = $derived(!!changeReason.trim());
  const canConfirm = $derived(!submitting && reasonValid);

  function handleConfirm() {
    changeReasonTouched = true;
    if (!canConfirm) return;
    onconfirm?.(changeReason.trim());
  }

  function handleCancel() {
    if (submitting) return;
    oncancel?.();
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center">
  <button
    type="button"
    class="absolute inset-0 bg-black bg-opacity-50"
    aria-label="Close dialog"
    onclick={handleCancel}
    disabled={submitting}
  ></button>

  <div
    class="relative z-10 mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cancel-job-modal-title"
    tabindex="-1"
  >
    <div class="flex-shrink-0 border-b border-gray-200 px-6 py-4">
      <h2 id="cancel-job-modal-title" class="text-lg font-semibold text-gray-900">
        Cancel job / Unassign technician
      </h2>
      <p class="mt-1 text-sm text-gray-500">
        {#if workshopLabel}
          This will cancel the scheduled assignment for
          <span class="font-medium text-gray-700">{workshopLabel}</span>
          and unassign the technician.
        {:else}
          This will cancel the scheduled assignment and unassign the technician.
        {/if}
      </p>
    </div>

    <div class="space-y-4 overflow-y-auto px-6 py-4">
      <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {#if assignedTechName}
          <p><span class="font-medium">Technician:</span> {assignedTechName} → Unassigned</p>
        {/if}
        {#if scheduleLabel}
          <p class={assignedTechName ? 'mt-1' : ''}>
            <span class="font-medium">Schedule:</span>
            {scheduleLabel}
          </p>
        {/if}
        {#if jobType}
          <p class={assignedTechName || scheduleLabel ? 'mt-1' : ''}>
            <span class="font-medium">Job type:</span>
            {jobType}
          </p>
        {/if}
      </div>

      <div>
        <label for="cancel-job-change-reason" class="mb-1 block text-sm font-medium text-gray-700">
          Reason for cancellation<span class="text-red-600"> *</span>
        </label>
        <textarea
          id="cancel-job-change-reason"
          bind:value={changeReason}
          rows="4"
          class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Explain why this job is being cancelled or unassigned..."
          oninput={() => (changeReasonTouched = true)}
        ></textarea>
        {#if changeReasonTouched && !reasonValid}
          <p class="mt-1 text-sm text-red-600">An explanation is required to cancel or unassign a job.</p>
        {/if}
      </div>
    </div>

    <div
      class="flex flex-shrink-0 flex-wrap justify-end gap-3 rounded-b-lg border-t border-gray-200 bg-gray-50 px-6 py-4"
    >
      <button
        type="button"
        class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        onclick={handleCancel}
        disabled={submitting}
      >
        Keep assignment
      </button>
      <button
        type="button"
        class="min-w-[140px] rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canConfirm}
        onclick={handleConfirm}
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
            Cancelling...
          </span>
        {:else}
          Cancel & unassign
        {/if}
      </button>
    </div>
  </div>
</div>
