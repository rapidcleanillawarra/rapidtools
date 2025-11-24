<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ProductImage, ImageOperation } from './types';

  export let images: ProductImage[] = [];
  export let imageOperations: ImageOperation[] = [];
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{
    'images-changed': { imageOperations: ImageOperation[] };
  }>();

  // Text input values for each image
  let textInputs: Record<string, string> = {};

  // URL validation and preview states
  let urlPreviewStates: Record<string, { loading: boolean; error: boolean; valid: boolean }> = {};

  // Visibility state for alt images
  let visibleAltImages: Record<string, boolean> = {};

  // Generate image names for alt images
  function generateAltImageNames(): string[] {
    const altNames: string[] = [];
    for (let i = 1; i <= 10; i++) {
      altNames.push(`Alt ${i}`);
    }
    return altNames;
  }

  // Get current image operations state
  function getCurrentImageState(): ImageOperation[] {
    const operations: ImageOperation[] = [];

    // Add existing images that aren't being deleted
    images.forEach(img => {
      const operation = imageOperations.find(op => op.Name === img.Name);
      if (!operation || !operation.Delete) {
        operations.push({
          Name: img.Name,
          URL: img.URL
        });
      }
    });

    // Add new operations
    imageOperations.forEach(op => {
      if (!operations.find(existing => existing.Name === op.Name)) {
        operations.push(op);
      }
    });

    return operations;
  }

  // Handle main image upload or URL input
  function handleMainImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image file size must be less than 5MB');
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);

    // Remove any existing main image operation
    imageOperations = imageOperations.filter(op => op.Name !== 'Main');

    // Clear text input
    textInputs = { ...textInputs, Main: '' };

    // Add new main image operation
    imageOperations = [...imageOperations, {
      Name: 'Main',
      file,
      localPreviewUrl
    }];

    dispatch('images-changed', { imageOperations });
  }

  // Handle URL input for main image
  function handleMainImageUrl(imageName: string) {
    const url = textInputs[imageName]?.trim();
    if (!url) return;

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      alert('Please enter a valid URL');
      return;
    }

    // Remove any existing operation for this image
    imageOperations = imageOperations.filter(op => op.Name !== imageName);

    // Add URL-based image operation
    imageOperations = [...imageOperations, {
      Name: imageName,
      URL: url
    }];

    dispatch('images-changed', { imageOperations });
  }

  // Handle alt image upload
  function handleAltImageUpload(event: Event, imageName: string) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image file size must be less than 5MB');
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);

    // Show the alt image section
    showAltImage(imageName);

    // Remove any existing operation for this alt image
    imageOperations = imageOperations.filter(op => op.Name !== imageName);

    // Clear text input
    textInputs = { ...textInputs, [imageName]: '' };

    // Add new alt image operation
    imageOperations = [...imageOperations, {
      Name: imageName,
      file,
      localPreviewUrl
    }];

    dispatch('images-changed', { imageOperations });
  }

  // Handle URL input for alt images
  function handleAltImageUrl(imageName: string) {
    const url = textInputs[imageName]?.trim();
    if (!url) return;

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      alert('Please enter a valid URL');
      return;
    }

    // Remove any existing operation for this image
    imageOperations = imageOperations.filter(op => op.Name !== imageName);

    // Add URL-based image operation
    imageOperations = [...imageOperations, {
      Name: imageName,
      URL: url
    }];

    dispatch('images-changed', { imageOperations });
  }

  // Show an alt image section
  function showAltImage(imageName: string) {
    visibleAltImages = { ...visibleAltImages, [imageName]: true };
  }

  // Hide an alt image section
  function hideAltImage(imageName: string) {
    visibleAltImages = { ...visibleAltImages, [imageName]: false };
    // Clear any data for this image
    textInputs = { ...textInputs, [imageName]: '' };
    urlPreviewStates = { ...urlPreviewStates, [imageName]: { loading: false, error: false, valid: false } };
    // Remove from image operations
    imageOperations = imageOperations.filter(op => op.Name !== imageName);
  }

  // Handle text input changes with URL validation
  function handleTextInputChange(imageName: string, value: string) {
    textInputs = { ...textInputs, [imageName]: value };

    // Clear previous state
    urlPreviewStates = { ...urlPreviewStates, [imageName]: { loading: false, error: false, valid: false } };

    // Show the alt image section if it has content
    if (value.trim()) {
      showAltImage(imageName);
      validateImageUrl(imageName, value.trim());
    }
  }

  // Initialize visibility for existing images and operations
  $: {
    // Show existing images from database
    if (images && images.length > 0) {
      const existingImages = images.filter(img => img.Name !== 'Main');
      existingImages.forEach(img => {
        if (!visibleAltImages[img.Name]) {
          visibleAltImages = { ...visibleAltImages, [img.Name]: true };
        }
      });
    }

    // Show images with active operations
    if (imageOperations && imageOperations.length > 0) {
      const activeOperations = imageOperations.filter(op => !op.Delete && op.Name !== 'Main');
      activeOperations.forEach(op => {
        if (!visibleAltImages[op.Name]) {
          visibleAltImages = { ...visibleAltImages, [op.Name]: true };
        }
      });
    }
  }

  // Validate image URL and update preview state
  async function validateImageUrl(imageName: string, url: string) {
    // Set loading state
    urlPreviewStates = { ...urlPreviewStates, [imageName]: { loading: true, error: false, valid: false } };

    try {
      // Basic URL validation
      new URL(url);

      // For CORS-restricted images, we'll assume they're valid if URL format is correct
      // and the domain looks trustworthy (contains common image hosting patterns)
      const isTrustedDomain = url.includes('rapidsupplies.com.au') ||
                              url.includes('cdn') ||
                              url.includes('img') ||
                              url.includes('image') ||
                              url.includes('assets') ||
                              url.match(/\.(jpg|jpeg|png|gif|webp)$/i);

      if (isTrustedDomain) {
        // Skip CORS validation for trusted domains and assume valid
        urlPreviewStates = { ...urlPreviewStates, [imageName]: { loading: false, error: false, valid: true } };
        return;
      }

      // For untrusted domains, try to load the image
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      // URL is valid and image loads
      urlPreviewStates = { ...urlPreviewStates, [imageName]: { loading: false, error: false, valid: true } };

    } catch (error) {
      // Check if it's a CORS error but URL format is valid
      if (error instanceof Error && error.message.includes('CORS') && url.startsWith('https://')) {
        // Treat CORS errors for HTTPS URLs as valid (likely just server policy)
        urlPreviewStates = { ...urlPreviewStates, [imageName]: { loading: false, error: false, valid: true } };
      } else {
        // URL is invalid or other error
        urlPreviewStates = { ...urlPreviewStates, [imageName]: { loading: false, error: true, valid: false } };
      }
    }
  }

  // Delete an image
  function deleteImage(imageName: string) {
    // Check if this is an existing image that needs to be marked for deletion
    const existingImage = images.find(img => img.Name === imageName);
    if (existingImage) {
      // Mark for deletion
      imageOperations = [...imageOperations, {
        Name: imageName,
        Delete: true
      }];
    } else {
      // Remove from operations (was a new upload that's now cancelled)
      imageOperations = imageOperations.filter(op => op.Name !== imageName);
    }

    dispatch('images-changed', { imageOperations });
  }

  // Get display URL for an image (handles local previews and server URLs)
  function getImageUrl(imageName: string): string | null {
    // Check for local preview first
    const operation = imageOperations.find(op => op.Name === imageName && op.localPreviewUrl);
    if (operation) {
      return operation.localPreviewUrl!;
    }

    // Check if not marked for deletion
    const deleteOp = imageOperations.find(op => op.Name === imageName && op.Delete);
    if (deleteOp) {
      return null;
    }

    // Return existing image URL
    const existingImage = images.find(img => img.Name === imageName);
    return existingImage?.URL || null;
  }

  // Check if an image is marked for deletion
  function isImageDeleted(imageName: string): boolean {
    return imageOperations.some(op => op.Name === imageName && op.Delete);
  }

  // Check if an image has a pending upload
  function hasPendingUpload(imageName: string): boolean {
    return imageOperations.some(op => op.Name === imageName && op.file);
  }
</script>

<div class="space-y-6">
  <!-- Main Image Section -->
  <div class="space-y-3">
    <h3 class="text-lg font-medium text-gray-900">Main Image</h3>

    <div class="border border-gray-200 rounded-lg p-4">
      {#if getImageUrl('Main')}
        <div class="relative mb-4">
          <img
            src={getImageUrl('Main')}
            alt="Main product image"
            class="w-full max-h-96 object-contain rounded-lg border bg-gray-50"
          />
          {#if !disabled}
            <button
              type="button"
              on:click={() => deleteImage('Main')}
              class="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors"
              title="Remove image"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          {/if}
          {#if hasPendingUpload('Main')}
            <div class="absolute bottom-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs">
              Pending Upload
            </div>
          {/if}
        </div>
      {/if}

      {#if !disabled}
        <!-- 2-column layout: Text input and Upload/Preview area -->
        <div class="grid grid-cols-2 gap-4">
          <!-- Column 1: Text Input -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
            <input
              type="text"
              placeholder="Enter image URL or leave empty to upload file"
              value={textInputs.Main || ''}
              on:input={(e) => handleTextInputChange('Main', e.currentTarget.value)}
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {#if urlPreviewStates.Main?.loading}
              <div class="mt-1 text-xs text-blue-600 flex items-center">
                <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                Validating URL...
              </div>
            {:else if urlPreviewStates.Main?.error}
              <div class="mt-1 text-xs text-red-600">
                Invalid image URL
              </div>
            {:else if urlPreviewStates.Main?.valid}
              <div class="mt-1 text-xs text-green-600">
                Image URL valid ✓
              </div>
            {/if}
          </div>

          <!-- Column 2: Upload/URL Button or Image Preview -->
          <div class="flex items-end">
            {#if urlPreviewStates.Main?.valid && textInputs.Main?.trim()}
              <!-- Show image preview and Use URL button -->
              <div class="w-full space-y-2">
                <div class="relative max-h-32 overflow-hidden">
                  <img
                    src={textInputs.Main}
                    alt="URL preview"
                    class="w-full max-h-32 object-contain rounded border bg-gray-50"
                  />
                  <div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-opacity rounded flex items-center justify-center">
                    <span class="text-xs text-white font-medium opacity-0 hover:opacity-100">Preview</span>
                  </div>
                </div>
                <button
                  type="button"
                  on:click={() => handleMainImageUrl('Main')}
                  class="w-full inline-flex items-center justify-center px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                  </svg>
                  Use URL
                </button>
              </div>
            {:else}
              <!-- Show upload button -->
              <label class="w-full cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                {getImageUrl('Main') ? 'Replace' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  on:change={handleMainImageUpload}
                  class="hidden"
                />
              </label>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Alt Images Section -->
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium text-gray-900">Alternative Images</h3>
      {#if !disabled}
        <button
          type="button"
          on:click={() => {
            const availableAlt = generateAltImageNames().find(name => !visibleAltImages[name]);
            if (availableAlt) showAltImage(availableAlt);
          }}
          class="inline-flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
          </svg>
          Add Alt Image
        </button>
      {/if}
    </div>

    <div class="space-y-4">
      {#each generateAltImageNames() as altName}
        {@const isVisible = visibleAltImages[altName]}
        {@const imageUrl = getImageUrl(altName)}
        {@const isDeleted = isImageDeleted(altName)}
        {@const hasPending = hasPendingUpload(altName)}

        {#if isVisible}
          <div class="border border-gray-200 rounded-lg p-4 relative">
            <!-- Remove button for the alt image section -->
            {#if !disabled}
              <button
                type="button"
                on:click={() => hideAltImage(altName)}
                class="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                title="Remove this alt image"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            {/if}

            <div class="text-sm font-medium text-gray-700 mb-3 pr-8">{altName}</div>

            {#if imageUrl && !isDeleted}
              <div class="relative mb-3">
                <img
                  src={imageUrl}
                  alt={altName}
                  class="w-full max-h-32 object-contain rounded border bg-gray-50"
                />
                {#if !disabled}
                  <button
                    type="button"
                    on:click={() => deleteImage(altName)}
                    class="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors"
                    title="Remove image"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                {/if}
                {#if hasPending}
                  <div class="absolute bottom-1 left-1 bg-blue-600 text-white px-1 py-0.5 rounded text-xs">
                    New
                  </div>
                {/if}
              </div>
            {/if}

            {#if !disabled}
              <!-- 2-column layout: Text input and Upload/Preview area -->
              <div class="grid grid-cols-2 gap-4">
                <!-- Column 1: Text Input -->
                <div>
                  <input
                    type="text"
                    placeholder="Enter image URL"
                    value={textInputs[altName] || ''}
                    on:input={(e) => handleTextInputChange(altName, e.currentTarget.value)}
                    class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {#if urlPreviewStates[altName]?.loading}
                    <div class="mt-1 text-xs text-blue-600 flex items-center">
                      <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                      Validating...
                    </div>
                  {:else if urlPreviewStates[altName]?.error}
                    <div class="mt-1 text-xs text-red-600">
                      Invalid URL
                    </div>
                  {:else if urlPreviewStates[altName]?.valid}
                    <div class="mt-1 text-xs text-green-600">
                      Valid ✓
                    </div>
                  {/if}
                </div>

                <!-- Column 2: Upload/URL Button or Image Preview -->
                <div class="flex items-center">
                  {#if urlPreviewStates[altName]?.valid && textInputs[altName]?.trim()}
                    <!-- Show image preview and Use URL button -->
                    <div class="w-full space-y-2">
                      <div class="relative max-h-24 overflow-hidden">
                        <img
                          src={textInputs[altName]}
                          alt="URL preview"
                          class="w-full max-h-24 object-contain rounded border bg-gray-50"
                        />
                        <div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-opacity rounded flex items-center justify-center">
                          <span class="text-xs text-white font-medium opacity-0 hover:opacity-100">Preview</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        on:click={() => handleAltImageUrl(altName)}
                        class="w-full inline-flex items-center justify-center px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                        </svg>
                        Use URL
                      </button>
                    </div>
                  {:else}
                    <!-- Show upload button -->
                    <label class="w-full cursor-pointer inline-flex items-center justify-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
                      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                      </svg>
                      {imageUrl && !isDeleted ? 'Replace' : 'Upload'}
                      <input
                        type="file"
                        accept="image/*"
                        on:change={(e) => handleAltImageUpload(e, altName)}
                        class="hidden"
                      />
                    </label>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>

    {#if Object.keys(visibleAltImages).length === 0}
      <div class="text-center py-8 text-gray-500">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
        <p class="mt-2 text-sm">No alternative images added yet</p>
        <p class="text-xs">Click "Add Alt Image" to add alternative product images</p>
      </div>
    {/if}

    <p class="text-sm text-gray-500">
      Add up to 10 alternative images. Each image must be less than 5MB.
    </p>
  </div>
</div>

<style>
  /* Custom styles if needed */
</style>
