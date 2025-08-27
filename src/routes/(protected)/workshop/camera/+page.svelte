<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { createWorkshop } from '$lib/services/workshop';
  import { toastSuccess, toastError } from '$lib/utils/toast';
  import { currentUser } from '$lib/firebase';
  import { get } from 'svelte/store';

  type PhotoItem = { file: File; url: string };
  let photos: PhotoItem[] = [];
  let showPrompt = true;
  let isSaving = false;
  let selectedPhotoIndex = -1;
  let showImageViewer = false;

  let takePhotoInput: HTMLInputElement | null = null;
  let uploadPhotoInput: HTMLInputElement | null = null;

  // Add keyboard navigation for image viewer
  function handleKeydown(event: KeyboardEvent) {
    if (!showImageViewer) return;

    switch (event.key) {
      case 'Escape':
        closeImageViewer();
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

  onMount(() => {
    // Automatically trigger camera on page load
    triggerTakePhoto();

    // Add keyboard navigation for image viewer
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
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

      // Show prompt immediately after photo is added to allow adding more photos
      // Use setTimeout to ensure photos array is updated
      setTimeout(() => {
        showPrompt = true;
      }, 100);
    } else {
      showPrompt = false;
    }
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

  function openImageViewer(index: number) {
    selectedPhotoIndex = index;
    showImageViewer = true;
  }

  function closeImageViewer() {
    showImageViewer = false;
    selectedPhotoIndex = -1;
  }

  function nextPhoto() {
    if (selectedPhotoIndex < photos.length - 1) {
      selectedPhotoIndex++;
    } else {
      selectedPhotoIndex = 0; // Loop to first photo
    }
  }

  function previousPhoto() {
    if (selectedPhotoIndex > 0) {
      selectedPhotoIndex--;
    } else {
      selectedPhotoIndex = photos.length - 1; // Loop to last photo
    }
  }



  function createWorkshopDataFromPhotos() {
    return {
      locationOfRepair: 'Workshop' as const,
      productName: 'Photos captured via camera', // Required field - provide default
      clientsWorkOrder: `camera_${Date.now()}`, // Generate a unique work order
      makeModel: '',
      serialNumber: '',
      siteLocation: '',
      faultDescription: 'Photos captured via camera',
      customerName: 'Camera Capture', // Required field - provide default
      contactEmail: '',
      contactNumber: '',
      selectedCustomer: null,
      optionalContacts: [],
      photos: photos.map(p => p.file),
      startedWith: 'camera' as const
    };
  }

  async function saveAndTakeMorePhotos() {
    if (photos.length === 0) {
      toastError('No photos to save');
      return;
    }

    if (photos.length < 1) {
      toastError('Please take at least 1 photo before saving');
      return;
    }

    isSaving = true;

    try {
      // Get current user
      const user = get(currentUser);
      if (!user) {
        toastError('You must be logged in to save photos');
        return;
      }

      // Create workshop data from current photos
      const workshopData = createWorkshopDataFromPhotos();

      const workshop = await createWorkshop(workshopData, user.uid);

      toastSuccess(`Photos saved successfully! Workshop ID: ${workshop.id}`);

      // Clear current photos and reset state
      photos.forEach(p => URL.revokeObjectURL(p.url));
      photos = [];
      selectedPhotoIndex = -1;
      showImageViewer = false;
      showPrompt = false;

      // Reopen prompt after a short delay to allow for new photos
      setTimeout(() => {
        showPrompt = true;
      }, 500);

    } catch (error) {
      console.error('Error saving photos:', error);
      toastError('Failed to save photos. Please try again.');
    } finally {
      isSaving = false;
    }
  }

  async function savePhotosToDatabase() {
    if (photos.length === 0) {
      toastError('No photos to save');
      return;
    }

    if (photos.length < 1) {
      toastError('Please take at least 1 photo before saving');
      return;
    }

    isSaving = true;

    try {
      // Get current user
      const user = get(currentUser);
      if (!user) {
        toastError('You must be logged in to save photos');
        return;
      }

      // Create workshop data from current photos
      const workshopData = createWorkshopDataFromPhotos();

      const workshop = await createWorkshop(workshopData, user.uid);

      toastSuccess(`Photos saved successfully! Workshop ID: ${workshop.id}`);

      // Navigate to the create page with the workshop ID for editing
      goto(`${base}/workshop/create?workshop_id=${workshop.id}&from=camera`);

    } catch (error) {
      console.error('Error saving photos:', error);
      toastError('Failed to save photos. Please try again.');
    } finally {
      isSaving = false;
    }
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
      <button class="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700" on:click={() => { showPrompt = true; }}>Add Photos</button>
    </div>

    <div class="p-6">
      {#if photos.length === 0}
        <div class="text-center py-16">
          <div class="text-6xl mb-4">📷</div>
          <p class="text-gray-600">No photos yet. Click "Add Photos" to get started.</p>
        </div>
      {:else}
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900">
            Photos ({photos.length})
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {#each photos as p, i}
              <div class="relative group">
                <div
                  class="relative overflow-hidden rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-colors cursor-pointer"
                  role="button"
                  tabindex="0"
                  aria-label="View photo {i + 1} of {photos.length}"
                  on:click={() => openImageViewer(i)}
                  on:keydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openImageViewer(i);
                    }
                  }}
                >
                  <img
                    src={p.url}
                    alt="Captured photo {i + 1}"
                    class="w-full h-32 sm:h-36 object-cover"
                  />
                  <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                    <svg class="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </div>
                </div>
                <button
                  type="button"
                  class="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs opacity-90 hover:opacity-100 transition-opacity shadow-lg"
                  aria-label="Remove photo"
                  on:click|stopPropagation={() => removePhoto(i)}
                >
                  ×
                </button>
                {#if photos.length > 1}
                  <div class="absolute bottom-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded">
                    {i + 1}/{photos.length}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Hidden inputs -->
<input id="take-photo" class="hidden" type="file" accept="image/*" capture="environment" multiple bind:this={takePhotoInput} on:change={onFilesSelected} />
<input id="upload-photo" class="hidden" type="file" accept="image/*" multiple bind:this={uploadPhotoInput} on:change={onFilesSelected} />

<!-- Image Viewer Modal -->
{#if showImageViewer && selectedPhotoIndex >= 0}
  <div class="fixed inset-0 bg-black z-50 flex items-center justify-center" transition:fade>
    <!-- Close button -->
    <button
      class="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-colors"
      on:click={closeImageViewer}
      aria-label="Close viewer"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>

    <!-- Navigation buttons -->
    {#if photos.length > 1}
      <button
        class="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white rounded-full p-3 hover:bg-opacity-70 transition-colors"
        on:click={previousPhoto}
        aria-label="Previous photo"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
      </button>

      <button
        class="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white rounded-full p-3 hover:bg-opacity-70 transition-colors"
        on:click={nextPhoto}
        aria-label="Next photo"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </button>
    {/if}

    <!-- Main image -->
    <div class="max-w-full max-h-full p-4">
      <img
        src={photos[selectedPhotoIndex].url}
        alt="Photo {selectedPhotoIndex + 1} of {photos.length}"
        class="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        style="max-height: 90vh; max-width: 90vw;"
      />
    </div>

    <!-- Image counter -->
    {#if photos.length > 1}
      <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
        {selectedPhotoIndex + 1} / {photos.length}
      </div>
    {/if}
  </div>
{/if}

<!-- Prompt Modal -->
{#if showPrompt}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" transition:fade>
    <div class="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
      <div class="p-5 border-b">
        <h2 class="text-lg font-semibold">Add Photos</h2>
        <p class="text-gray-600 text-sm mt-1">Choose how you want to add photos.</p>
      </div>
      <div class="p-5 space-y-3">
        <button
          class="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          on:click={triggerTakePhoto}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          Take Photo
        </button>
        <button
          class="w-full px-4 py-3 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          on:click={triggerUploadPhoto}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          Upload from Device
        </button>
      </div>
      <div class="p-4 border-t flex justify-between items-center">
        <button
          class="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          on:click={() => showPrompt = false}
        >
          Cancel
        </button>
        {#if photos.length > 0}
          <div class="flex gap-2">
            <button
              class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
              disabled={isSaving}
              on:click={saveAndTakeMorePhotos}
            >
              {#if isSaving}
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              {:else}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Save & Take More
              {/if}
            </button>
            <button
              class="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving || photos.length === 0}
              on:click={() => { savePhotosToDatabase(); showPrompt = false; }}
            >
              {#if isSaving}
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              {:else}
                Done
              {/if}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}