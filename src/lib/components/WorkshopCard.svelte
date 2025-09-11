<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WorkshopRecord } from '$lib/services/workshop';

  export let workshop: WorkshopRecord;
  export let viewMode: 'table' | 'board' = 'table';
  export let loadedPhotos: string[] = [];
  export let failedPhotos: string[] = [];

  const dispatch = createEventDispatcher<{
    click: { workshop: WorkshopRecord };
    photoClick: { workshop: WorkshopRecord; photoIndex: number };
    deleteClick: { workshop: WorkshopRecord };
  }>();

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatDateShort(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function getStatusColor(status: string) {
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

  function isPhotoReady(photoUrl: string) {
    return loadedPhotos.includes(photoUrl) && !failedPhotos.includes(photoUrl);
  }

  function handleClick() {
    dispatch('click', { workshop });
  }

  function handlePhotoClick(photoIndex: number, event: Event) {
    event.stopPropagation();
    dispatch('photoClick', { workshop, photoIndex });
  }

  function handleDeleteClick(event: Event) {
    event.stopPropagation();
    dispatch('deleteClick', { workshop });
  }
</script>

{#if viewMode === 'table'}
  <!-- Table Row View -->
  <tr class="hover:bg-gray-50 transition-colors cursor-pointer" on:click={handleClick}>
    <td class="px-4 py-4 whitespace-nowrap">
      <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getStatusColor(workshop.status)}">
        {workshop.status.replace('_', ' ').toUpperCase()}
      </span>
    </td>
    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
      {#if workshop.photo_urls && workshop.photo_urls.length > 0}
        <div class="flex items-center space-x-1">
          {#each workshop.photo_urls.slice(0, 3) as photoUrl, index}
            <div class="relative group">
              <!-- Skeleton loader -->
              {#if !isPhotoReady(photoUrl) && !failedPhotos.includes(photoUrl)}
                <div class="w-28 h-28 bg-gray-200 rounded animate-pulse"></div>
              {/if}

              <!-- Photo thumbnail -->
              <button
                type="button"
                class="w-28 h-28 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
                on:click={(e) => handlePhotoClick(index, e)}
                aria-label="View photo {index + 1} of {workshop.photo_urls?.length || 0}"
              >
                <!-- Always render img to trigger load/error events -->
                <img
                  src={photoUrl}
                  alt="Photo {index + 1}"
                  class="w-full h-full object-cover {isPhotoReady(photoUrl) ? 'opacity-100' : 'opacity-0'}"
                />
              </button>

              <!-- Error indicator -->
              {#if failedPhotos.includes(photoUrl)}
                <div class="w-28 h-28 bg-gray-100 rounded flex items-center justify-center text-base text-gray-500 border border-gray-300">
                  <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                  </svg>
                </div>
              {/if}
            </div>
          {/each}

          <!-- Show count if more than 3 photos -->
          {#if workshop.photo_urls.length > 3}
            <div class="w-28 h-28 bg-gray-100 rounded flex items-center justify-center text-lg text-gray-600 font-medium">
              +{workshop.photo_urls.length - 3}
            </div>
          {/if}
        </div>
      {:else}
        <div class="text-gray-400 text-xs">No photos</div>
      {/if}
    </td>
    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
      <div class="text-sm font-medium text-gray-900">
        {new Date(workshop.created_at).toLocaleDateString('en-AU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })}
      </div>
      <div class="text-xs text-gray-500">
        {new Date(workshop.created_at).toLocaleTimeString('en-AU', {
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </td>
    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
      <div class="text-sm font-medium text-gray-900">
        {workshop.created_by || 'Unknown'}
      </div>
    </td>
    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
      {workshop.clients_work_order || 'N/A'}
    </td>
    <td class="px-4 py-4 whitespace-normal">
      <div class="text-sm font-medium text-gray-900">
        {workshop.product_name}
      </div>
      <div class="text-sm text-gray-500">
        {workshop.make_model}
      </div>
    </td>
    <td class="px-4 py-4 whitespace-normal">
      <div class="text-sm font-medium text-gray-900">
        {workshop.customer_name}
      </div>
      {#if workshop.customer_data}
        <div class="text-sm text-gray-500">
          {workshop.customer_data.EmailAddress || ''}
        </div>
      {/if}
    </td>
    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
      <button
        type="button"
        class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
        on:click={handleDeleteClick}
      >
        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        Delete
      </button>
    </td>
  </tr>
{:else}
  <!-- Board Card View -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer" on:click={handleClick}>
    <!-- Photo Section -->
    {#if workshop.photo_urls && workshop.photo_urls.length > 0}
      <div class="mb-3">
        <div class="relative">
          <!-- Skeleton loader -->
          {#if !isPhotoReady(workshop.photo_urls[0]) && !failedPhotos.includes(workshop.photo_urls[0])}
            <div class="w-full h-32 bg-gray-200 rounded animate-pulse"></div>
          {/if}

          <!-- Photo thumbnail -->
          <button
            type="button"
            class="w-full h-32 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
            on:click={(e) => handlePhotoClick(0, e)}
            aria-label="View photo for {workshop.customer_name}'s workshop"
          >
            <!-- Always render img to trigger load/error events -->
            <img
              src={workshop.photo_urls[0]}
              alt="Photo for {workshop.customer_name}"
              class="w-full h-full object-cover {isPhotoReady(workshop.photo_urls[0]) ? 'opacity-100' : 'opacity-0'}"
            />
          </button>

          <!-- Error indicator -->
          {#if failedPhotos.includes(workshop.photo_urls[0])}
            <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500 border border-gray-300">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
          {/if}

          <!-- Photo count indicator if multiple photos -->
          {#if workshop.photo_urls.length > 1}
            <div class="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
              {workshop.photo_urls.length}
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <!-- No photos placeholder -->
      <div class="mb-3">
        <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-200">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
        </div>
      </div>
    {/if}

    <div class="flex items-start justify-between mb-2">
      <div class="flex-1 min-w-0">
        <h4 class="text-xs font-medium text-gray-900 truncate">{workshop.customer_name}</h4>
        <p class="text-xs text-gray-500 truncate">{workshop.product_name}</p>
      </div>
    </div>

    <div class="text-xs text-gray-500 mb-2">
      <div>WO: {workshop.clients_work_order || 'N/A'}</div>
      <div>{formatDateShort(workshop.created_at)}</div>
    </div>

    <button
      type="button"
      class="w-full inline-flex items-center justify-center px-2 py-1 border border-transparent text-xs leading-3 font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-200"
      on:click={handleDeleteClick}
    >
      Delete
    </button>
  </div>
{/if}
