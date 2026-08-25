<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { PhotoItem } from '$lib/types/workshop';

  export let photos: PhotoItem[] = [];
  export let error: string = '';
  export let minPhotosRequired: number = 0;
  export let workshopStatus: string | null = null;

  let takePhotoInput: HTMLInputElement | null = null;
  let uploadPhotoInput: HTMLInputElement | null = null;

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
  <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-[#181b20] border border-[#262a30]">
    <h3 class="font-semibold text-white">
      Photos
      <span class="text-sm text-gray-400 ml-2">
        ({photos.length} added) <span class="text-gray-500">(optional)</span>
      </span>
    </h3>
    {#if workshopStatus !== 'pickup'}
      <div class="flex gap-2">
        <button type="button" class="btn-secondary text-xs sm:text-sm px-3 py-1.5" on:click={triggerTakePhoto}>Take Photo</button>
        <button type="button" class="btn-primary text-xs sm:text-sm px-3 py-1.5" on:click={triggerUploadPhoto}>Upload</button>
      </div>
    {/if}
  </div>

  <!-- Hidden inputs for capture/upload -->
  <input id="take-photo" class="hidden" type="file" accept="image/*" capture="environment" multiple bind:this={takePhotoInput} on:change={onFilesSelected} />
  <input id="upload-photo" class="hidden" type="file" accept="image/*" multiple bind:this={uploadPhotoInput} on:change={onFilesSelected} />

  {#if photos.length > 0}
    <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {#each photos as p, i}
        <div class="relative group rounded-xl overflow-hidden border border-[#262a30] bg-[#141619]">
          <button
            type="button"
            class="w-full h-48 sm:h-52 md:h-56 lg:h-48 rounded-xl border-0 p-0 bg-transparent cursor-pointer hover:ring-2 hover:ring-lime-400/50 transition-all block"
            on:click={(e) => handlePhotoClick(i, e)}
            aria-label="View photo {i + 1} of {photos.length}"
          >
            <img src={p.url} alt="" class="w-full h-full object-cover rounded-xl" />
          </button>
          {#if workshopStatus !== 'pickup'}
            <button
              type="button"
              class="absolute top-2 right-2 bg-red-600/90 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-90 group-hover:opacity-100 hover:bg-red-500 shadow-md transition-all"
              aria-label="Remove photo"
              on:click={() => removePhoto(i)}
            >
              ×
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="mt-4 p-8 bg-[#181b20]/50 border-2 border-dashed border-[#262a30] rounded-xl text-center">
      <div class="text-gray-500 mb-2">
        <svg class="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
      </div>
      <p class="text-gray-300 text-sm font-medium">No photos added yet</p>
      <p class="text-gray-500 text-xs mt-1">Use the buttons above to take photos or upload images</p>
    </div>
  {/if}

  {#if error}
    <div class="mt-4 p-3 bg-red-950/30 border border-red-500/30 text-red-300 rounded-lg text-sm">
      {error}
    </div>
  {/if}
</div>
