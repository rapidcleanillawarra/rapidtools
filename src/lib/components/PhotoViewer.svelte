<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WorkshopRecord } from '$lib/services/workshop';

  export let showPhotoViewer: boolean = false;
  export let workshop: WorkshopRecord | null = null;
  export let photoUrls: string[] = [];
  export let currentPhotoIndex: number = 0;
  export let loadedPhotos: string[] = [];
  export let failedPhotos: string[] = [];

  const dispatch = createEventDispatcher<{
    close: void;
    photoIndexChanged: { index: number };
  }>();

  $: computedPhotoUrls = photoUrls.length > 0 ? photoUrls : (workshop?.photo_urls || []);
  $: currentPhotoUrl = computedPhotoUrls[currentPhotoIndex];

  function closeViewer() {
    dispatch('close');
  }

  function nextPhoto() {
    if (currentPhotoIndex < computedPhotoUrls.length - 1) {
      const newIndex = currentPhotoIndex + 1;
      currentPhotoIndex = newIndex;
      dispatch('photoIndexChanged', { index: newIndex });
    } else {
      const newIndex = 0;
      currentPhotoIndex = newIndex;
      dispatch('photoIndexChanged', { index: newIndex });
    }
  }

  function previousPhoto() {
    if (currentPhotoIndex > 0) {
      const newIndex = currentPhotoIndex - 1;
      currentPhotoIndex = newIndex;
      dispatch('photoIndexChanged', { index: newIndex });
    } else {
      const newIndex = computedPhotoUrls.length - 1;
      currentPhotoIndex = newIndex;
      dispatch('photoIndexChanged', { index: newIndex });
    }
  }

  function handlePhotoLoad(photoUrl: string) {
    // Remove from failed if it was there
    failedPhotos = failedPhotos.filter(url => url !== photoUrl);
    // Add to loaded if not already there
    if (!loadedPhotos.includes(photoUrl)) {
      loadedPhotos = [...loadedPhotos, photoUrl];
    }
  }

  function handlePhotoError(photoUrl: string) {
    // Remove from loaded if it was there
    loadedPhotos = loadedPhotos.filter(url => url !== photoUrl);
    // Add to failed if not already there
    if (!failedPhotos.includes(photoUrl)) {
      failedPhotos = [...failedPhotos, photoUrl];
    }
  }

  function isPhotoReady(photoUrl: string) {
    return loadedPhotos.includes(photoUrl) && !failedPhotos.includes(photoUrl);
  }

  // Keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    if (!showPhotoViewer) return;

    switch (event.key) {
      case 'Escape':
        closeViewer();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        previousPhoto();
        break;
      case 'ArrowRight':
        event.preventDefault();
        nextPhoto();
        break;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if showPhotoViewer && (workshop || photoUrls.length > 0) && computedPhotoUrls.length > 0}
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
    <!-- Close button -->
    <button
      class="absolute top-4 right-4 z-20 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-colors"
      on:click={closeViewer}
      aria-label="Close viewer"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>

    <!-- Navigation buttons -->
    {#if computedPhotoUrls.length > 1}
      <button
        class="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 bg-black bg-opacity-50 text-white rounded-full p-3 hover:bg-opacity-70 transition-colors"
        on:click={previousPhoto}
        aria-label="Previous photo"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
      </button>

      <button
        class="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 bg-black bg-opacity-50 text-white rounded-full p-3 hover:bg-opacity-70 transition-colors"
        on:click={nextPhoto}
        aria-label="Next photo"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </button>
    {/if}

    <!-- Main image -->
    <div class="max-w-full max-h-full p-4 relative">
      <!-- Loading skeleton -->
      {#if !isPhotoReady(currentPhotoUrl) && !failedPhotos.includes(currentPhotoUrl)}
        <div class="w-96 h-96 bg-gray-300 rounded-lg animate-pulse flex items-center justify-center">
          <div class="text-gray-500 text-sm">Loading...</div>
        </div>
      {/if}

      <!-- Error state -->
      {#if failedPhotos.includes(currentPhotoUrl)}
        <div class="w-96 h-96 bg-gray-100 rounded-lg flex flex-col items-center justify-center border border-gray-300">
          <svg class="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
          <div class="text-gray-600 text-center">
            <div class="font-medium">Failed to load image</div>
            <div class="text-sm text-gray-500 mt-1">The image could not be loaded</div>
          </div>
        </div>
      {/if}

      <!-- Photo (always render to trigger load/error events) -->
      <img
        src={currentPhotoUrl}
        alt="Photo {currentPhotoIndex + 1} of {computedPhotoUrls.length}"
        class="max-w-full max-h-full object-contain rounded-lg shadow-2xl {isPhotoReady(currentPhotoUrl) ? 'block' : 'hidden'}"
        style="max-height: 80vh; max-width: 80vw;"
        on:load={() => handlePhotoLoad(currentPhotoUrl)}
        on:error={() => handlePhotoError(currentPhotoUrl)}
      />
    </div>

    <!-- Image counter -->
    {#if computedPhotoUrls.length > 1}
      <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
        {currentPhotoIndex + 1} / {computedPhotoUrls.length}
      </div>
    {/if}

    <!-- Workshop info overlay -->
    <div class="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded text-sm">
      <div class="font-medium">Workshop ID: {workshop?.id || 'create-workshop'}</div>
      <div class="text-gray-300">Photo {currentPhotoIndex + 1} of {computedPhotoUrls.length}</div>
    </div>
  </div>
{/if}
