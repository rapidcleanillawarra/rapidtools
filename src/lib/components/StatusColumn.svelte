<script lang="ts">
  import WorkshopCard from './WorkshopCard.svelte';
  import type { WorkshopRecord } from '$lib/services/workshop';

  export let status: string;
  export let title: string;
  export let workshops: WorkshopRecord[] = [];
  export let loadedPhotos: string[] = [];
  export let failedPhotos: string[] = [];

  function getColumnColor(status: string) {
    switch (status) {
      case 'draft': return 'bg-yellow-50';
      case 'to_be_quoted': return 'bg-orange-50';
      case 'docket_ready': return 'bg-blue-50';
      case 'quoted_repaired': return 'bg-teal-50';
      case 'waiting_approval_po': return 'bg-purple-50';
      case 'waiting_for_parts': return 'bg-gray-50';
      case 'booked_in_for_repair_service': return 'bg-indigo-50';
      case 'pending_jobs': return 'bg-red-50';
      default: return 'bg-gray-50';
    }
  }

  function getBadgeColor(status: string) {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'to_be_quoted': return 'bg-orange-100 text-orange-800';
      case 'docket_ready': return 'bg-blue-100 text-blue-800';
      case 'quoted_repaired': return 'bg-teal-100 text-teal-800';
      case 'waiting_approval_po': return 'bg-purple-100 text-purple-800';
      case 'waiting_for_parts': return 'bg-gray-100 text-gray-800';
      case 'booked_in_for_repair_service': return 'bg-indigo-100 text-indigo-800';
      case 'pending_jobs': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
</script>

<div class="bg-white rounded-lg p-4 min-h-96 w-72 flex-shrink-0 border border-gray-200">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-xs font-semibold text-gray-900 uppercase tracking-wider">{title}</h3>
    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getBadgeColor(status)}">
      {workshops.length}
    </span>
  </div>
  <div class="space-y-3">
    {#each workshops as workshop (workshop.id)}
      <WorkshopCard
        {workshop}
        viewMode="board"
        {loadedPhotos}
        {failedPhotos}
        on:click
        on:photoClick
        on:deleteClick
      />
    {/each}
  </div>
</div>
