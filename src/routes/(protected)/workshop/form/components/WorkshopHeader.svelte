<script lang="ts">
  export let existingWorkshopId: string | null;
  export let workshopStatus: string | null;
  export let existingOrderId: string | null;
  export let currentJobStatus: { statusDisplay: string };
  export let startedWith: 'form' | 'camera';
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
    <div class="flex flex-wrap gap-2 justify-center">
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
    </div>
  </div>
</div>
