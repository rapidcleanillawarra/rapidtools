<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';

  type PhotoItem = { file: File; url: string };
  let photos: PhotoItem[] = [];
  let showPrompt = true;

  let takePhotoInput: HTMLInputElement | null = null;
  let uploadPhotoInput: HTMLInputElement | null = null;

  onMount(() => {
    // Auto-open system picker via prompt buttons
    // Keep just the modal opening by default
    showPrompt = true;
  });

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
    showPrompt = false;
  }

  function addFiles(fileList: FileList) {
    const newItems: PhotoItem[] = [];
    Array.from(fileList).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      newItems.push({ file, url });
    });
    photos = [...photos, ...newItems];
  }

  function removePhoto(index: number) {
    const [removed] = photos.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.url);
    photos = [...photos];
  }

  onDestroy(() => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
  });
</script>

<div class="container mx-auto px-4 py-8" in:fade>
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">Camera</h1>
        <p class="text-gray-600 text-sm">Capture or upload photos for a workshop job.</p>
      </div>
      <div class="flex gap-2">
        <button class="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700" on:click={() => { showPrompt = true; }}>Add Photos</button>
        <a href="{base}/workshop/create" class="px-3 py-2 bg-gray-700 text-white rounded-md text-sm hover:bg-gray-800">Done</a>
      </div>
    </div>

    <div class="p-6">
      {#if photos.length === 0}
        <div class="text-center py-16">
          <div class="text-6xl mb-4">📷</div>
          <p class="text-gray-600">No photos yet. Click "Add Photos" to get started.</p>
        </div>
      {:else}
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {#each photos as p, i}
            <div class="relative group">
              <img src={p.url} alt="" class="w-full h-28 object-cover rounded-md border" />
              <button type="button" class="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs opacity-90 group-hover:opacity-100" aria-label="Remove photo" on:click={() => removePhoto(i)}>×</button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Hidden inputs -->
<input id="take-photo" class="hidden" type="file" accept="image/*" capture="environment" multiple bind:this={takePhotoInput} on:change={onFilesSelected} />
<input id="upload-photo" class="hidden" type="file" accept="image/*" multiple bind:this={uploadPhotoInput} on:change={onFilesSelected} />

<!-- Prompt Modal -->
{#if showPrompt}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" transition:fade>
    <div class="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
      <div class="p-5 border-b">
        <h2 class="text-lg font-semibold">Add Photos</h2>
        <p class="text-gray-600 text-sm mt-1">Choose how you want to add photos.</p>
      </div>
      <div class="p-5 space-y-3">
        <button class="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700" on:click={triggerTakePhoto}>Take Photo</button>
        <button class="w-full px-4 py-3 bg-gray-700 text-white rounded-md hover:bg-gray-800" on:click={triggerUploadPhoto}>Upload from Device</button>
      </div>
      <div class="p-4 border-t flex justify-end">
        <button class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" on:click={() => showPrompt = false}>Cancel</button>
      </div>
    </div>
  </div>
{/if}


