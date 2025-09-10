<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { PhotoItem } from '$lib/types/workshop';

  export let photos: PhotoItem[] = [];
  export let error: string = '';
  export let minPhotosRequired: number = 0;

  let takePhotoInput: HTMLInputElement | null = null;
  let uploadPhotoInput: HTMLInputElement | null = null;

  const dispatch = createEventDispatcher<{
    photosUpdated: { photos: PhotoItem[] };
    error: { message: string };
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
    if (removed) URL.revokeObjectURL(removed.url);
    photos = [...photos];
    dispatch('photosUpdated', { photos });
    dispatch('error', { message: '' });
  }

  onDestroy(() => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
  });

  // Reactive statement to update error when photos change
  $: if (photos.length < minPhotosRequired) {
    dispatch('error', { message: `At least ${minPhotosRequired} photo(s) required` });
  } else {
    dispatch('error', { message: '' });
  }
</script>

<div class="mt-6" id="photos-section">
  <div class="flex items-center justify-between bg-gray-100 px-4 py-3 rounded">
    <h3 class="font-medium text-gray-800">
      Photos
      <span class="text-sm text-gray-600 ml-2">
        ({photos.length} added) <span class="text-gray-500">(optional)</span>
      </span>
    </h3>
    <div class="flex gap-2">
      <button type="button" class="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700" on:click={triggerTakePhoto}>Take Photo</button>
      <button type="button" class="px-3 py-2 bg-gray-700 text-white rounded-md text-sm hover:bg-gray-800" on:click={triggerUploadPhoto}>Upload</button>
    </div>
  </div>

  <!-- Hidden inputs for capture/upload -->
  <input id="take-photo" class="hidden" type="file" accept="image/*" capture="environment" multiple bind:this={takePhotoInput} on:change={onFilesSelected} />
  <input id="upload-photo" class="hidden" type="file" accept="image/*" multiple bind:this={uploadPhotoInput} on:change={onFilesSelected} />

  {#if photos.length > 0}
    <div class="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {#each photos as p, i}
        <div class="relative group">
          <img src={p.url} alt="" class="w-full h-24 sm:h-28 object-cover rounded-md border" />
          <button type="button" class="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs opacity-90 group-hover:opacity-100" aria-label="Remove photo" on:click={() => removePhoto(i)}>×</button>
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
