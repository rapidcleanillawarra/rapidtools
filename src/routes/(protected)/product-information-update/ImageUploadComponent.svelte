<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ProductImage, ImageOperation } from './types';
  import { formatTimestampForImageUrl } from './utils';

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

  // Force reactivity updates
  $: imageOperationsChanged = imageOperations.length;

  // Force component re-render when imageOperations changes
  $: if (imageOperationsChanged !== undefined) {
    // Trigger a re-render by updating a local state
    renderTrigger = !renderTrigger;
  }

  let renderTrigger = false;

  // Simple reactive trigger for UI updates
  $: uiTrigger = imageOperations?.length || 0;

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


  // Automatically handle URL when it becomes valid
  function handleUrlAutomatically(imageName: string, url: string) {
    console.log('Automatically using URL for', imageName, ':', url);

    // Remove any existing operation for this image
    imageOperations = imageOperations.filter(op => op.Name !== imageName);

    // Add URL-based image operation
    imageOperations = [...imageOperations, {
      Name: imageName,
      URL: url
    }];

    console.log('Added automatic URL operation:', { Name: imageName, URL: url });
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
        // Automatically use the URL when it becomes valid
        handleUrlAutomatically(imageName, url);
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
      // Automatically use the URL when it becomes valid
      handleUrlAutomatically(imageName, url);

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
    console.log('deleteImage called for:', imageName);
    console.log('Current images:', images);
    console.log('Current imageOperations before:', imageOperations);

    // Check if this is an existing image that needs to be marked for deletion
    const existingImage = images.find(img => img.Name === imageName);
    console.log('Existing image found:', existingImage);

    // Check if there's already a delete operation for this image
    const existingDeleteOp = imageOperations.find(op => op.Name === imageName && op.Delete);
    console.log('Existing delete operation found:', existingDeleteOp);

    if (existingImage && !existingDeleteOp) {
      // Mark for deletion only if not already marked
      const deleteOperation = {
        Name: imageName,
        Delete: true
      };
      imageOperations = [...imageOperations, deleteOperation];
      console.log('Added delete operation:', deleteOperation);
    } else if (!existingImage) {
      // Remove from operations (was a new upload that's now cancelled)
      imageOperations = imageOperations.filter(op => op.Name !== imageName);
      console.log('Removed operation for new upload');
    } else {
      console.log('Image already marked for deletion, ignoring duplicate click');
    }

    console.log('Final imageOperations after delete:', imageOperations);
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
      console.log('getImageUrl - image marked for deletion:', imageName);
      return null;
    }

    // Return existing image URL with timestamp processing
    const existingImage = images.find(img => img.Name === imageName);
    if (existingImage?.URL && existingImage?.Timestamp) {
      const timestampParam = formatTimestampForImageUrl(existingImage.Timestamp);
      const result = timestampParam ? `${existingImage.URL}?${timestampParam}` : existingImage.URL;
      console.log('getImageUrl called for:', imageName, 'result:', result);
      return result;
    }

    const result = existingImage?.URL || null;
    console.log('getImageUrl called for:', imageName, 'result:', result);
    return result;
  }

  // Check if an image is marked for deletion
  function isImageDeleted(imageName: string): boolean {
    const result = imageOperations.some(op => op.Name === imageName && op.Delete);
    console.log('isImageDeleted called for:', imageName, 'result:', result, 'operations:', imageOperations.filter(op => op.Name === imageName));
    return result;
  }

</script>

<div class="space-y-6">
  <!-- Main Image Section -->
  <div class="space-y-3">
    <h3 class="text-lg font-medium text-gray-900">Main Image</h3>

    <div class="border border-gray-200 rounded-lg p-4">
      <div class="relative mb-4">
        {#if uiTrigger !== undefined && isImageDeleted('Main')}
          <div class="w-full max-h-96 flex items-center justify-center rounded-lg border bg-red-50 text-red-600">
            <div class="text-center">
              <svg class="mx-auto h-8 w-8 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              <span class="text-sm font-medium">Image marked for deletion</span>
              <br>
              <span class="text-xs">Changes will be saved when you submit</span>
            </div>
          </div>
        {:else if uiTrigger !== undefined && getImageUrl('Main')}
          <img
            src={getImageUrl('Main')}
            alt="Main product image"
            class="w-full max-h-96 object-contain rounded-lg border bg-gray-50"
          />
          {#if !disabled}
            <button
              type="button"
              on:click={() => {
                console.log('Delete button clicked for Main');
                console.log('Before delete - images:', images);
                console.log('Before delete - imageOperations:', imageOperations);
                deleteImage('Main');
                console.log('After delete - imageOperations:', imageOperations);
              }}
              class="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 hover:bg-red-700 transition-colors z-10 shadow-lg"
              title="Remove image"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          {/if}
        {:else}
          <div class="w-full max-h-96 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400">
            <span class="text-sm">No main image</span>
          </div>
        {/if}
        </div>

      {#if !disabled}
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
            <input
              type="text"
              placeholder="Enter image URL"
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
                Image URL valid ✓ - URL will be used automatically
              </div>
              {#if urlPreviewStates.Main?.valid && textInputs.Main?.trim()}
                <div class="mt-2 relative max-h-32 overflow-hidden">
                  <img
                    src={textInputs.Main}
                    alt="URL preview"
                    class="w-full max-h-32 object-contain rounded border bg-gray-50"
                  />
                  <div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-opacity rounded flex items-center justify-center">
                    <span class="text-xs text-white font-medium opacity-0 hover:opacity-100">Preview</span>
                  </div>
                </div>
              {/if}
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
        {@const imageUrl = uiTrigger !== undefined ? getImageUrl(altName) : null}
        {@const isDeleted = uiTrigger !== undefined ? isImageDeleted(altName) : false}
        {#if isVisible}
          <div class="border border-gray-200 rounded-lg p-4 relative">
            <!-- Remove button for the alt image section -->
            {#if !disabled}
              <button
                type="button"
                on:click={() => hideAltImage(altImage.name)}
                class="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                title="Remove this alt image"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            {/if}

            <div class="text-sm font-medium text-gray-700 mb-3 pr-8">{altName}</div>

            <div class="relative mb-3">
              {#if isDeleted}
                <div class="w-full max-h-32 flex items-center justify-center rounded border bg-red-50 text-red-600">
                  <div class="text-center">
                    <svg class="mx-auto h-6 w-6 text-red-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    <span class="text-xs font-medium">Marked for deletion</span>
                  </div>
                </div>
              {:else if imageUrl}
                <img
                  src={imageUrl}
                  alt={altName}
                  class="w-full max-h-32 object-contain rounded border bg-gray-50"
                />
                {#if !disabled}
                  <button
                    type="button"
                    on:click={() => {
                      console.log('Delete button clicked for', altName);
                      console.log('Before delete - images:', images);
                      console.log('Before delete - imageOperations:', imageOperations);
                      deleteImage(altName);
                      console.log('After delete - imageOperations:', imageOperations);
                    }}
                    class="absolute top-1 right-1 bg-red-600 text-white rounded-full p-2 hover:bg-red-700 transition-colors z-10 shadow-lg"
                    title="Remove image"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                {/if}
              {:else}
                <div class="w-full max-h-32 flex items-center justify-center rounded border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400">
                  <span class="text-xs">No image</span>
                </div>
              {/if}
            </div>

            {#if !disabled}
              <div class="space-y-2">
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
                    Valid ✓ - URL will be used automatically
                  </div>
                  {#if urlPreviewStates[altName]?.valid && textInputs[altName]?.trim()}
                    <div class="mt-2 relative max-h-24 overflow-hidden">
                      <img
                        src={textInputs[altName]}
                        alt="URL preview"
                        class="w-full max-h-24 object-contain rounded border bg-gray-50"
                      />
                      <div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-opacity rounded flex items-center justify-center">
                        <span class="text-xs text-white font-medium opacity-0 hover:opacity-100">Preview</span>
                      </div>
                    </div>
                  {/if}
                {/if}
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
