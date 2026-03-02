<script lang="ts">
  import type { WorkshopRecord } from '$lib/services/workshop';

  export let workshops: WorkshopRecord[] = [];
  export let isLoading: boolean = false;
  export let base: string = '';

  function getStatusColor(status: WorkshopRecord['status']): string {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
</script>

<div class="bg-white border rounded-lg">
  <div class="px-6 py-4 border-b border-gray-200">
    <h2 class="text-lg font-semibold">Recent Workshops</h2>
  </div>

  {#if isLoading}
    <div class="p-6">
      <div class="animate-pulse space-y-3">
        <div class="h-4 bg-gray-300 rounded"></div>
        <div class="h-4 bg-gray-300 rounded w-3/4"></div>
        <div class="h-4 bg-gray-300 rounded w-1/2"></div>
      </div>
    </div>
  {:else if workshops.length > 0}
    <div class="divide-y divide-gray-200">
      {#each workshops as workshop}
        <div class="p-4 hover:bg-gray-50">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="font-medium text-gray-900">{workshop.customer_name}</div>
              <div class="text-sm text-gray-600">
                {workshop.product_name} • {workshop.location_of_machine}
                {#if workshop.photo_urls && workshop.photo_urls.length > 0}
                  • 📷 {workshop.photo_urls.length} photos
                {/if}
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {new Date(workshop.created_at).toLocaleDateString()}
                {#if workshop.started_with}
                  • Started via {workshop.started_with}
                {/if}
              </div>
            </div>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(workshop.status)}">
              {workshop.status}
            </span>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="p-6 text-center text-gray-500">
      No workshops found. <a href="{base}/workshop/form" class="text-blue-600 hover:text-blue-800">Create your first workshop</a>
    </div>
  {/if}
</div>

<style>
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
