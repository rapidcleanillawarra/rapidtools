<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { PhotoItem } from '$lib/types/workshop';

  export let photos: PhotoItem[] = [];
  export let error: string = '';
  export let minPhotosRequired: number = 0;
  export let workshopStatus: string | null = null;

  let takePhotoInput: HTMLInputElement | null = null;
  let uploadPhotoInput: HTMLInputElement | null = null;

  // Photo loading states
  let loadedPhotos: string[] = [];
  let failedPhotos: string[] = [];

  const dispatch = createEventDispatcher<{
    photosUpdated: { photos: PhotoItem[] };
    error: { message: string };
    photoClick: { photoIndex: number };
  }>();

  function triggerTakePhoto() {
    takePhotoInput?.click();
  }

  function triggerUploadPhoto() {
    uploadPhotoInput?.click();
  }

  function onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input?.files && input.files.length > 0) {
      addFiles(input.files);
      // Reset to allow selecting the same file again
      input.value = '';
    }
  }

  function addFiles(fileList: FileList) {
    const newItems: PhotoItem[] = [];
    Array.from(fileList).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      newItems.push({ file, url, isExisting: false });
    });
    photos = [...photos, ...newItems];
    console.log('Added new photos:', newItems.length, 'Total photos:', photos.length);
    dispatch('photosUpdated', { photos });
    dispatch('error', { message: '' });
  }

  function removePhoto(index: number) {
    const [removed] = photos.splice(index, 1);
    if (removed && !removed.isExisting) {
      // Only revoke URLs for new photos created with URL.createObjectURL
      URL.revokeObjectURL(removed.url);
    }
    photos = [...photos];
    dispatch('photosUpdated', { photos });
    dispatch('error', { message: '' });
  }

  function handlePhotoClick(index: number, event: Event) {
    event.stopPropagation(); // Prevent event bubbling
    dispatch('photoClick', { photoIndex: index });
  }

  function isPhotoReady(photoUrl: string) {
    return loadedPhotos.includes(photoUrl) && !failedPhotos.includes(photoUrl);
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

  onDestroy(() => {
    photos.forEach((p) => {
      if (!p.isExisting) {
        // Only revoke URLs for new photos created with URL.createObjectURL
        URL.revokeObjectURL(p.url);
      }
    });
  });

  // Reactive statement to update error when photos change
  $: if (photos.length < minPhotosRequired) {
    dispatch('error', { message: `At least ${minPhotosRequired} photo(s) required` });
  } else {
    dispatch('error', { message: '' });
  }
</script>

<div id="photos-section">
  <div class="flex items-center justify-between px-4 py-3 rounded" style="background-color: rgb(30, 30, 30);">
    <h3 class="font-medium text-white">
      Photos
      <span class="text-sm text-gray-300 ml-2">
        ({photos.length} added) <span class="text-gray-400">(optional)</span>
      </span>
    </h3>
    {#if workshopStatus !== 'pickup'}
      <div class="flex gap-2">
        <button type="button" class="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700" on:click={triggerTakePhoto}>Take Photo</button>
        <button type="button" class="px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700" on:click={triggerUploadPhoto}>Upload</button>
      </div>
    {/if}
  </div>

  <!-- Hidden inputs for capture/upload -->
  <input id="take-photo" class="hidden" type="file" accept="image/*" capture="environment" multiple bind:this={takePhotoInput} on:change={onFilesSelected} />
  <input id="upload-photo" class="hidden" type="file" accept="image/*" multiple bind:this={uploadPhotoInput} on:change={onFilesSelected} />

  {#if photos.length > 0}
    <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {#each photos as p, i}
        <div class="relative group">
          <button
            type="button"
            class="w-full h-48 sm:h-52 md:h-56 lg:h-48 rounded-md border-0 p-0 bg-transparent cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
            on:click={(e) => handlePhotoClick(i, e)}
            aria-label="View photo {i + 1} of {photos.length}"
          >
            <div class="w-full h-full relative">
              <!-- Loading skeleton -->
              {#if !isPhotoReady(p.url) && !failedPhotos.includes(p.url)}
                <div class="w-full h-full bg-gray-200 rounded-md animate-pulse flex items-center justify-center">
                  <div class="text-gray-500 text-sm">Loading...</div>
                </div>
              {/if}

              <!-- Photo -->
              <img
                src={p.url}
                alt=""
                class="w-full h-full object-cover rounded-md {isPhotoReady(p.url) ? 'opacity-100' : 'opacity-0'}"
                on:load={() => handlePhotoLoad(p.url)}
                on:error={() => handlePhotoError(p.url)}
              />

              <!-- Error indicator -->
              {#if failedPhotos.includes(p.url)}
                <div class="w-full h-full bg-gray-100 rounded-md flex flex-col items-center justify-center border border-gray-300">
                  <svg class="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                  </svg>
                  <div class="text-xs text-gray-600 text-center">
                    <div class="font-medium">Failed to load</div>
                    <div class="text-gray-500">Try re-uploading</div>
                  </div>
                </div>
              {/if}
            </div>
          </button>
          {#if workshopStatus !== 'pickup'}
            <button type="button" class="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs opacity-90 group-hover:opacity-100" aria-label="Remove photo" on:click={() => removePhoto(i)}>×</button>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="mt-4 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-md text-center">
      <p class="text-gray-500 text-sm">No photos added yet</p>
      <p class="text-gray-400 text-xs mt-1">Use the buttons above to take photos or upload images</p>
    </div>
  {/if}

  {#if error}
    <div class="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
      {error}
    </div>
  {/if}
</div>
