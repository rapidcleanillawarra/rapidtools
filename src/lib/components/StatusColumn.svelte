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

<div class="bg-white rounded-lg border border-gray-200 snap-start flex flex-col w-72 flex-shrink-0 min-h-96 max-h-[70vh]">
  <!-- Header - Fixed, non-scrollable -->
  <div class="flex items-center justify-between p-4 pb-3 border-b border-gray-100 flex-shrink-0">
    <h3 class="text-xs font-semibold text-gray-900 uppercase tracking-wider">{title}</h3>
    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getBadgeColor(status)}">
      {workshops.length}
    </span>
  </div>

  <!-- Content - Scrollable -->
  <div class="flex-1 overflow-y-auto p-4 pt-3 status-column-scroll">
    {#if workshops.length === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <svg class="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p class="text-sm text-gray-500">No workshops in this status</p>
      </div>
    {:else}
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
    {/if}
  </div>
</div>

<style>
  /* Custom vertical scrollbar styles for StatusColumn */
  :global(.status-column-scroll::-webkit-scrollbar) {
    width: 6px;
  }

  :global(.status-column-scroll::-webkit-scrollbar-track) {
    background: #f1f5f9;
    border-radius: 3px;
  }

  :global(.status-column-scroll::-webkit-scrollbar-thumb) {
    background: #cbd5e1;
    border-radius: 3px;
    transition: background-color 0.2s ease;
  }

  :global(.status-column-scroll::-webkit-scrollbar-thumb:hover) {
    background: #94a3b8;
  }

  /* Firefox scrollbar styling */
  :global(.status-column-scroll) {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 #f1f5f9;
  }
</style>
