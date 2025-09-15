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
  let isSaving = false;
  let selectedPhotoIndex = -1;
  let showImageViewer = false;
  let isPickup = false;
  let siteLocation = '';
  let siteLocationError = false;

  // Success modal state
  let showSuccessModal = false;
  let lastWorkshopId = '';

  let takePhotoInput: HTMLInputElement | null = null;
  let uploadPhotoInput: HTMLInputElement | null = null;

  // Touch/swipe handling for image viewer
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

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
    // Add keyboard navigation for image viewer
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    photos.forEach((p) => URL.revokeObjectURL(p.url));
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

  // Touch event handlers for swipe gestures
  function handleTouchStart(event: TouchEvent) {
    touchStartX = event.changedTouches[0].screenX;
    touchStartY = event.changedTouches[0].screenY;
  }

  function handleTouchEnd(event: TouchEvent) {
    touchEndX = event.changedTouches[0].screenX;
    touchEndY = event.changedTouches[0].screenY;
    handleSwipe();
  }

  function handleSwipe() {
    if (!showImageViewer || photos.length <= 1) return;

    const deltaX = touchStartX - touchEndX;
    const deltaY = touchStartY - touchEndY;
    const minSwipeDistance = 50;

    // Check if horizontal swipe is greater than vertical swipe
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // Swipe left - next photo
        nextPhoto();
      } else {
        // Swipe right - previous photo
        previousPhoto();
      }
    }
  }

  function validateSiteLocation() {
    if (isPickup && (!siteLocation || siteLocation.trim() === '')) {
      siteLocationError = true;
      return false;
    }
    siteLocationError = false;
    return true;
  }

  function createWorkshopDataFromPhotos() {
    return {
      locationOfRepair: isPickup ? ('Site' as const) : null,
      productName: null,
      clientsWorkOrder: '', // Empty work order
      makeModel: '',
      serialNumber: '',
      siteLocation: isPickup ? siteLocation : '',
      faultDescription: 'Photos captured via camera',
      customerName: null,
      contactEmail: '',
      contactNumber: '',
      selectedCustomer: null,
      optionalContacts: [],
      photos: photos.map(p => p.file),
      startedWith: 'camera' as const,
      quoteOrRepaired: 'Repaired' as const
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

    // Confirm if pickup is not selected
    if (!isPickup) {
      const confirmed = confirm('Are you sure this is not a pickup job? If this item needs to be picked up from a location, please check the "Pickup Service" option above.');
      if (!confirmed) {
        return;
      }
    }

    // Validate site location if pickup is selected
    if (!validateSiteLocation()) {
      toastError('Please enter a site location for pickup');
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
      isPickup = false;
      siteLocation = '';
      siteLocationError = false;

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

    // Confirm if pickup is not selected
    if (!isPickup) {
      const confirmed = confirm('Are you sure this is not a pickup job? If this item needs to be picked up from a location, please check the "Pickup Service" option above.');
      if (!confirmed) {
        return;
      }
    }

    // Validate site location if pickup is selected
    if (!validateSiteLocation()) {
      toastError('Please enter a site location for pickup');
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

      // Store workshop ID and show success modal
      lastWorkshopId = workshop.id;
      showSuccessModal = true;

      // Reset pickup state
      isPickup = false;
      siteLocation = '';
      siteLocationError = false;

    } catch (error) {
      console.error('Error saving photos:', error);
      toastError('Failed to save photos. Please try again.');
    } finally {
      isSaving = false;
    }
  }

  function takeMorePhotos() {
    // Reset photos and close modal
    photos.forEach(p => URL.revokeObjectURL(p.url));
    photos = [];
    selectedPhotoIndex = -1;
    showImageViewer = false;
    showSuccessModal = false;
    lastWorkshopId = '';
  }

  function goToJobStatus() {
    // Navigate to job status page
    goto(`${base}/workshop/job-status`);
  }
</script>

<div class="container mx-auto px-2 py-4 sm:px-4 sm:py-8" in:fade>
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <div class="px-4 py-6 sm:px-6 sm:py-8 border-b border-gray-200">
      <div class="text-center">
        <h1 class="text-3xl sm:text-4xl font-bold text-gray-900">Camera</h1>
      </div>
    </div>

    <div class="p-4 sm:p-6">
      <!-- Photos Section -->
      <div class="space-y-4">
        {#if photos.length > 0}
          <h3 class="text-lg font-medium text-gray-900">
            Photos ({photos.length})
          </h3>
        {/if}
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          <!-- Add Photo Placeholder Button -->
          <div class="relative group">
            <button
              class="w-full h-40 sm:h-32 md:h-36 border-2 border-dashed border-blue-300 hover:border-blue-400 rounded-lg transition-colors flex flex-col items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 active:bg-blue-200"
              on:click={triggerTakePhoto}
              aria-label="Take new photo"
            >
              <div class="text-3xl sm:text-4xl text-blue-500 group-hover:text-blue-600 transition-colors">
                📷
              </div>
              <div class="text-xs sm:text-sm text-blue-600 group-hover:text-blue-700 transition-colors font-medium">
                Take Photo
              </div>
            </button>
          </div>

          <!-- Upload Photo Placeholder Button -->
          <div class="relative group">
            <button
              class="w-full h-40 sm:h-32 md:h-36 border-2 border-dashed border-green-300 hover:border-green-400 rounded-lg transition-colors flex flex-col items-center justify-center gap-2 bg-green-50 hover:bg-green-100 active:bg-green-200"
              on:click={triggerUploadPhoto}
              aria-label="Upload photo from device"
            >
              <div class="text-3xl sm:text-4xl text-green-500 group-hover:text-green-600 transition-colors">
                📤
              </div>
              <div class="text-xs sm:text-sm text-green-600 group-hover:text-green-700 transition-colors font-medium">
                Upload
              </div>
            </button>
          </div>

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
                  class="w-full h-40 sm:h-32 md:h-36 object-cover"
                />
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                  <svg class="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
              </div>
              <button
                type="button"
                class="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-7 h-7 sm:w-6 sm:h-6 text-sm sm:text-xs opacity-90 hover:opacity-100 active:opacity-100 transition-opacity shadow-lg"
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

      <!-- Photo Options Section -->
      <div class="border-t pt-6 mt-6">
        <div class="space-y-4">
          <!-- Pickup Options -->
          <div class="border-t pt-6 space-y-4">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
              <div class="flex items-center space-x-4">
                <div class="flex-shrink-0">
                  <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                </div>
                <div class="flex-1">
                  <div class="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="pickup-checkbox"
                      bind:checked={isPickup}
                      class="w-6 h-6 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 focus:border-blue-500"
                    />
                    <label for="pickup-checkbox" class="text-lg font-semibold text-gray-800 cursor-pointer">Pickup Service</label>
                  </div>
                  <p class="text-sm text-gray-600 mt-1 ml-9">Check if you need to pick up the item from a specific location</p>
                </div>
              </div>
            </div>

            {#if isPickup}
              <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 sm:p-6 animate-in slide-in-from-top-2 duration-300">
                <div class="space-y-4">
                  <div class="flex items-center space-x-2">
                    <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <label for="site-location" class="block text-lg font-semibold text-gray-800">
                      Site Location
                      <span class="text-red-500 ml-1">*</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    id="site-location"
                    bind:value={siteLocation}
                    placeholder="Enter the pickup address or location details"
                    class="w-full px-4 py-4 text-lg border-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-orange-500 {siteLocationError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-orange-500'} bg-white"
                    on:input={() => { if (siteLocationError) siteLocationError = false; }}
                  />
                  {#if siteLocationError}
                    <div class="flex items-center space-x-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                      </svg>
                      <p class="text-sm font-medium">Site location is required when pickup is selected.</p>
                    </div>
                  {/if}
                  <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div class="flex items-start space-x-2">
                      <svg class="w-4 h-4 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <p class="text-sm text-blue-800">Please provide the exact address or location details where the item needs to be picked up from.</p>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <!-- Action Buttons -->
          {#if photos.length > 0}
            <div class="border-t pt-4">
              <div class="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  class="flex-1 sm:flex-none px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium"
                  disabled={isSaving || photos.length === 0 || (isPickup && (!siteLocation || siteLocation.trim() === ''))}
                  on:click={saveAndTakeMorePhotos}
                >
                  {#if isSaving}
                    <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  {:else}
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    Save & Take More
                  {/if}
                </button>
                <button
                  class="flex-1 sm:flex-none px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 active:bg-gray-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium"
                  disabled={isSaving || photos.length === 0 || (isPickup && (!siteLocation || siteLocation.trim() === ''))}
                  on:click={savePhotosToDatabase}
                >
                  {#if isSaving}
                    <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  {:else}
                    Done
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Hidden inputs -->
<input id="take-photo" class="hidden" type="file" accept="image/*" capture="environment" multiple bind:this={takePhotoInput} on:change={onFilesSelected} />
<input id="upload-photo" class="hidden" type="file" accept="image/*" multiple bind:this={uploadPhotoInput} on:change={onFilesSelected} />

<!-- Image Viewer Modal -->
{#if showImageViewer && selectedPhotoIndex >= 0}
  <div
    class="fixed inset-0 bg-black z-50 flex items-center justify-center"
    transition:fade
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
  >
    <!-- Close button -->
    <button
      class="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white rounded-full p-3 hover:bg-opacity-70 active:bg-opacity-80 transition-colors"
      on:click={closeImageViewer}
      aria-label="Close viewer"
    >
      <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>

    <!-- Navigation buttons -->
    {#if photos.length > 1}
      <button
        class="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white rounded-full p-4 sm:p-3 hover:bg-opacity-70 active:bg-opacity-80 transition-colors"
        on:click={previousPhoto}
        aria-label="Previous photo"
      >
        <svg class="w-7 h-7 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
      </button>

      <button
        class="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white rounded-full p-4 sm:p-3 hover:bg-opacity-70 active:bg-opacity-80 transition-colors"
        on:click={nextPhoto}
        aria-label="Next photo"
      >
        <svg class="w-7 h-7 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </button>
    {/if}

    <!-- Main image -->
    <div class="max-w-full max-h-full p-2 sm:p-4">
      <img
        src={photos[selectedPhotoIndex].url}
        alt="Photo {selectedPhotoIndex + 1} of {photos.length}"
        class="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        style="max-height: 85vh; max-width: 95vw;"
      />
    </div>

    <!-- Image counter -->
    {#if photos.length > 1}
      <div class="absolute bottom-6 sm:bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full text-base font-medium">
        {selectedPhotoIndex + 1} / {photos.length}
      </div>
    {/if}
  </div>
{/if}

<!-- Success Modal -->
{#if showSuccessModal}
  <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" transition:fade>
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-auto">
      <div class="p-6 text-center">
        <!-- Success Icon -->
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
          <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>

        <!-- Title -->
        <h3 class="text-xl font-semibold text-gray-900 mb-2">
          Photos Saved Successfully!
        </h3>

        <!-- Workshop ID -->
        <p class="text-sm text-gray-600 mb-6">
          Workshop ID: <span class="font-mono font-semibold text-gray-800">{lastWorkshopId}</span>
        </p>

        <!-- Options -->
        <div class="space-y-3">
          <button
            on:click={takeMorePhotos}
            class="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            Take More Photos
          </button>

          <button
            on:click={goToJobStatus}
            class="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
            View Job Status
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}