<script lang="ts">
  export let existingWorkshopId: string | null;
  export let workshopStatus: string | null;
  export let existingOrderId: string | null;
  export let currentJobStatus: { statusDisplay: string };
  export let startedWith: 'form' | 'camera';
  export let onUndoStatus: (() => void) | undefined = undefined;
  export let previousBoardStatusDisplay: string = '';
  export let isSubmitting: boolean = false;
</script>

<div class="pb-6 border-b border-[#262a30]">
  <div class="flex flex-col items-center space-y-3">
    <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight text-center">
      {#if existingWorkshopId && workshopStatus && workshopStatus !== 'new' && existingOrderId}
        Order <a href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={existingOrderId}" target="_blank" class="text-lime-400 hover:text-lime-300 underline font-semibold transition-colors">#{existingOrderId}</a>
      {:else if existingWorkshopId}
        Edit Workshop Job
      {:else}
        Create Workshop Job
      {/if}
    </h1>
    <div class="flex flex-wrap gap-2 justify-center items-center">
      <!-- Status Pill -->
      <div class="text-sm text-gray-300 bg-[#1f2329] border border-[#333842] px-3.5 py-1.5 rounded-full shadow-sm">
        Status: <span class="font-semibold text-lime-400 capitalize">{currentJobStatus.statusDisplay}</span>
      </div>

      <!-- Started Via Pill -->
      <div class="text-sm text-gray-300 bg-[#1f2329] border border-[#333842] px-3.5 py-1.5 rounded-full shadow-sm">
        Started via: <span class="font-medium text-white capitalize">{startedWith}</span>
        {#if startedWith === 'camera'}
          📷
        {:else}
          📝
        {/if}
      </div>

      <!-- Undo Status Pill Button -->
      {#if existingWorkshopId && (workshopStatus === 'completed' || workshopStatus === 'to_be_scrapped') && onUndoStatus}
        <button
          type="button"
          on:click={onUndoStatus}
          disabled={isSubmitting}
          class="text-sm font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500/20 hover:text-amber-200 px-3.5 py-1.5 rounded-full shadow-sm inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          title="Revert back to {previousBoardStatusDisplay || 'previous status'}"
        >
          <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 0 1 5 5v2m0 0l-4-4m4 4l4-4" />
          </svg>
          Undo to {previousBoardStatusDisplay || 'Previous Status'}
        </button>
      {/if}
    </div>
  </div>
</div>
