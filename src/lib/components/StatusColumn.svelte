<script lang="ts">
  import WorkshopCard from './WorkshopCard.svelte';
  import type { WorkshopRecord } from '$lib/services/workshop';
  import { createEventDispatcher } from 'svelte';

  interface Props {
    status: string;
    title: string;
    workshops?: WorkshopRecord[];
    draggedWorkshopId?: string | null;
    recentlyMovedWorkshopId?: string | null;
    showImages?: boolean;
  }

  let {
    status,
    title,
    workshops = [],
    draggedWorkshopId = null,
    recentlyMovedWorkshopId = null,
    showImages = true
  }: Props = $props();

  const dispatch = createEventDispatcher<{
    drop: { workshopId: string; newStatus: string };
    completed: { workshop: WorkshopRecord };
  }>();

  let isDragOver = $state(false);

  function getTopBorderColor(status: string) {
    switch (status) {
      case 'new': return 'border-t-2 border-t-yellow-400';
      case 'pickup': return 'border-t-2 border-t-sky-400';
      case 'to_be_quoted': return 'border-t-2 border-t-orange-400';
      case 'docket_ready': return 'border-t-2 border-t-blue-400';
      case 'quoted': return 'border-t-2 border-t-green-400';
      case 'waiting_approval_po': return 'border-t-2 border-t-purple-400';
      case 'waiting_for_parts': return 'border-t-2 border-t-amber-400';
      case 'booked_in_for_repair_service': return 'border-t-2 border-t-indigo-400';
      case 'repaired': return 'border-t-2 border-t-teal-400';
      case 'pickup_from_workshop': return 'border-t-2 border-t-cyan-400';
      case 'return': return 'border-t-2 border-t-lime-400';
      case 'pending_jobs': return 'border-t-2 border-t-red-400';
      case 'warranty_claim': return 'border-t-2 border-t-rose-400';
      default: return 'border-t-2 border-t-gray-500';
    }
  }

  function getBadgeColor(status: string) {
    switch (status) {
      case 'new': return 'bg-yellow-400/10 text-yellow-400';
      case 'pickup': return 'bg-sky-400/10 text-sky-400';
      case 'to_be_quoted': return 'bg-orange-400/10 text-orange-400';
      case 'docket_ready': return 'bg-blue-400/10 text-blue-400';
      case 'quoted': return 'bg-green-400/10 text-green-400';
      case 'waiting_approval_po': return 'bg-purple-400/10 text-purple-400';
      case 'waiting_for_parts': return 'bg-amber-400/10 text-amber-400';
      case 'booked_in_for_repair_service': return 'bg-indigo-400/10 text-indigo-400';
      case 'repaired': return 'bg-teal-400/10 text-teal-400';
      case 'pickup_from_workshop': return 'bg-cyan-400/10 text-cyan-400';
      case 'return': return 'bg-lime-400/10 text-lime-400';
      case 'pending_jobs': return 'bg-red-400/10 text-red-400';
      case 'warranty_claim': return 'bg-rose-400/10 text-rose-400';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    console.log('[COLUMN_DRAG_ENTER] Column:', status, 'Timestamp:', Date.now());
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    // Only set isDragOver to false if we're actually leaving the column (not entering a child element)
    if (event.currentTarget === event.target) {
      console.log('[COLUMN_DRAG_LEAVE] Column:', status, 'Timestamp:', Date.now());
      isDragOver = false;
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    console.log('[COLUMN_DROP] Column:', status, 'Timestamp:', Date.now());
    isDragOver = false;

    try {
      const rawData = event.dataTransfer!.getData('application/json');
      console.log('[COLUMN_DROP_DATA] Raw data:', rawData);
      const data = JSON.parse(rawData);
      console.log('[COLUMN_DROP_PARSED] Parsed data:', data);

      if (data.workshopId && data.currentStatus !== status) {
        console.log('[COLUMN_DROP_DISPATCH] Dispatching drop event - Workshop:', data.workshopId, 'From:', data.currentStatus, 'To:', status);
        dispatch('drop', {
          workshopId: data.workshopId,
          newStatus: status
        });
      } else {
        console.log('[COLUMN_DROP_SKIP] Drop skipped - Workshop:', data.workshopId, 'Same status:', data.currentStatus === status);
      }
    } catch (error) {
      console.error('[COLUMN_DROP_ERROR] Error parsing drag data:', error, 'Raw data:', event.dataTransfer!.getData('application/json'));
    }
  }
</script>

<div
  class="{getTopBorderColor(status)} {isDragOver ? 'bg-[#1f2329] border-lime-500/50 ring-2 ring-lime-500/20' : 'bg-[#181b20] border-[#262a30]'} rounded-lg border snap-start flex flex-col w-72 flex-shrink-0 min-h-96 max-h-[70vh] transition-all duration-200"
  role="region"
  aria-label="{title} status column"
  ondragover={handleDragOver}
  ondragenter={handleDragEnter}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <!-- Header - Fixed, non-scrollable -->
  <div class="flex items-center justify-between p-4 pb-3 border-b border-[#262a30] flex-shrink-0">
    <h3 class="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</h3>
    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getBadgeColor(status)}">
      {workshops.length}
    </span>
  </div>

  <!-- Content - Scrollable -->
  <div class="flex-1 overflow-y-auto p-4 pt-3 status-column-scroll">
    {#if workshops.length === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <svg class="w-12 h-12 text-gray-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p class="text-sm text-gray-600">No workshops in this status</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each workshops as workshop (workshop.id)}
          <WorkshopCard
            {workshop}
            viewMode="board"
            {draggedWorkshopId}
            {recentlyMovedWorkshopId}
            {showImages}
            on:click
            on:photoClick
            on:deleteClick
            on:dragstart
            on:completed
            on:assignTech
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
    background: #141619;
    border-radius: 3px;
  }

  :global(.status-column-scroll::-webkit-scrollbar-thumb) {
    background: #262a30;
    border-radius: 3px;
    transition: background-color 0.2s ease;
  }

  :global(.status-column-scroll::-webkit-scrollbar-thumb:hover) {
    background: #333842;
  }

  /* Firefox scrollbar styling */
  :global(.status-column-scroll) {
    scrollbar-width: thin;
    scrollbar-color: #262a30 #141619;
  }
</style>
