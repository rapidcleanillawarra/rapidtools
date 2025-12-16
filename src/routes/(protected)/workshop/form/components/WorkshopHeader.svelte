<script lang="ts">
  export let existingWorkshopId: string | null;
  export let workshopStatus: string | null;
  export let existingOrderId: string | null;
  export let currentJobStatus: { statusDisplay: string };
  export let startedWith: 'form' | 'camera';
</script>

    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex flex-col items-center space-y-3">
        <h1 class="text-2xl font-bold text-center">
          {#if existingWorkshopId && workshopStatus && workshopStatus !== 'new' && existingOrderId}
            Order <a href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={existingOrderId}" target="_blank" class="text-blue-600 hover:text-blue-800 underline">#{existingOrderId}</a>
          {:else if existingWorkshopId}
            Edit Workshop Job
          {:else}
            Create Workshop Job
          {/if}
        </h1>
        <div class="flex flex-wrap gap-2">
          <!-- Status Pill -->
          <div class="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
            Status: <span class="font-semibold capitalize">{currentJobStatus.statusDisplay}</span>
          </div>

          <!-- Started Via Pill -->
          <div class="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
            Started via: <span class="font-medium capitalize">{startedWith}</span>
            {#if startedWith === 'camera'}
              📷
            {:else}
              📝
            {/if}
          </div>
        </div>
      </div>
    </div>
