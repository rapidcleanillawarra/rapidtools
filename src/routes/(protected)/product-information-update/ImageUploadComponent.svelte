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
    // Check if this is an existing image that needs to be marked for deletion
    const existingImage = images.find(img => img.Name === imageName);

    // Check if there's already a delete operation for this image
    const existingDeleteOp = imageOperations.find(op => op.Name === imageName && op.Delete);

    if (existingImage && !existingDeleteOp) {
      // Mark for deletion only if not already marked
      const deleteOperation = {
        Name: imageName,
        Delete: true
      };
      imageOperations = [...imageOperations, deleteOperation];
    } else if (!existingImage) {
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

    // Return existing image URL with timestamp processing
    const existingImage = images.find(img => img.Name === imageName);
    if (existingImage?.URL && existingImage?.Timestamp) {
      const timestampParam = formatTimestampForImageUrl(existingImage.Timestamp);
      return timestampParam ? `${existingImage.URL}?${timestampParam}` : existingImage.URL;
    }

    return existingImage?.URL || null;
  }

  // Check if an image is marked for deletion
  function isImageDeleted(imageName: string): boolean {
    return imageOperations.some(op => op.Name === imageName && op.Delete);
  }

</script>

<div class="space-y-6">
  <!-- Main Image Section -->
  <div class="space-y-3">
    <h3 class="text-base font-semibold text-white">Main Image</h3>

    <div class="border border-[#262a30] bg-[#141619] rounded-xl p-4">
      <div class="relative mb-4">
        {#if uiTrigger !== undefined && isImageDeleted('Main')}
          <div class="w-full max-h-96 py-12 flex items-center justify-center rounded-lg border border-red-500/30 bg-red-950/20 text-red-400">
            <div class="text-center">
              <svg class="mx-auto h-8 w-8 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              <span class="text-sm font-medium">Image marked for deletion</span>
              <br>
              <span class="text-xs text-red-400/80">Changes will be saved when you submit</span>
            </div>
          </div>
        {:else if uiTrigger !== undefined && getImageUrl('Main')}
          <img
            src={getImageUrl('Main')}
            alt="Main product image"
            class="w-full max-h-96 object-contain rounded-lg border border-[#262a30] bg-[#0e1012]"
          />
          {#if !disabled}
            <button
              type="button"
              on:click={() => {
                deleteImage('Main');
              }}
              class="absolute top-2 right-2 bg-red-950/80 border border-red-500/40 text-red-400 rounded-full p-2 hover:bg-red-900 hover:text-red-300 transition-colors z-10 shadow-lg"
              title="Remove image"
              aria-label="Remove main image"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          {/if}
        {:else}
          <div class="w-full h-48 flex items-center justify-center rounded-lg border-2 border-dashed border-[#262a30] bg-[#0e1012] text-gray-500">
            <span class="text-sm">No main image</span>
          </div>
        {/if}
      </div>

      {#if !disabled}
        <div class="space-y-3">
          <div>
            <label class="form-label">Image URL</label>
            <input
              type="text"
              placeholder="Enter image URL"
              value={textInputs.Main || ''}
              on:input={(e) => handleTextInputChange('Main', e.currentTarget.value)}
              class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
            />
            {#if urlPreviewStates.Main?.loading}
              <div class="mt-1.5 text-xs text-lime-400 flex items-center">
                <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-lime-400 mr-1.5"></div>
                Validating URL...
              </div>
            {:else if urlPreviewStates.Main?.error}
              <div class="mt-1.5 text-xs text-red-400">
                Invalid image URL
              </div>
            {:else if urlPreviewStates.Main?.valid}
              <div class="mt-1.5 text-xs text-lime-400">
                Image URL valid ✓ - URL will be used automatically
              </div>
              {#if urlPreviewStates.Main?.valid && textInputs.Main?.trim()}
                <div class="mt-2 relative max-h-32 overflow-hidden rounded-lg border border-[#262a30] bg-[#0e1012]">
                  <img
                    src={textInputs.Main}
                    alt="URL preview"
                    class="w-full max-h-32 object-contain rounded"
                  />
                  <div class="absolute inset-0 bg-black/40 hover:bg-transparent transition-opacity flex items-center justify-center">
                    <span class="text-xs text-white font-medium bg-black/60 px-2 py-0.5 rounded">Preview</span>
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
      <h3 class="text-base font-semibold text-white">Alternative Images</h3>
      {#if !disabled}
        <button
          type="button"
          on:click={() => {
            const availableAlt = generateAltImageNames().find(name => !visibleAltImages[name]);
            if (availableAlt) showAltImage(availableAlt);
          }}
          class="btn-secondary text-xs inline-flex items-center gap-1.5 hover:text-lime-400"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div class="border border-[#262a30] bg-[#141619] rounded-xl p-4 relative">
            <!-- Remove button for the alt image section -->
            {#if !disabled}
              <button
                type="button"
                on:click={() => hideAltImage(altName)}
                class="absolute top-3 right-3 text-gray-400 hover:text-red-400 transition-colors"
                title="Remove this alt image"
                aria-label="Remove this alt image slot"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            {/if}

            <div class="text-sm font-medium text-gray-200 mb-3 pr-8">{altName}</div>

            <div class="relative mb-3">
              {#if isDeleted}
                <div class="w-full max-h-32 py-6 flex items-center justify-center rounded-lg border border-red-500/30 bg-red-950/20 text-red-400">
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
                  class="w-full max-h-32 object-contain rounded-lg border border-[#262a30] bg-[#0e1012]"
                />
                {#if !disabled}
                  <button
                    type="button"
                    on:click={() => {
                      deleteImage(altName);
                    }}
                    class="absolute top-1.5 right-1.5 bg-red-950/80 border border-red-500/40 text-red-400 rounded-full p-1.5 hover:bg-red-900 hover:text-red-300 transition-colors z-10 shadow-lg"
                    title="Remove image"
                    aria-label="Delete image"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                {/if}
              {:else}
                <div class="w-full h-28 flex items-center justify-center rounded-lg border-2 border-dashed border-[#262a30] bg-[#0e1012] text-gray-500">
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
                  class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
                />
                {#if urlPreviewStates[altName]?.loading}
                  <div class="mt-1 text-xs text-lime-400 flex items-center">
                    <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-lime-400 mr-1"></div>
                    Validating...
                  </div>
                {:else if urlPreviewStates[altName]?.error}
                  <div class="mt-1 text-xs text-red-400">
                    Invalid URL
                  </div>
                {:else if urlPreviewStates[altName]?.valid}
                  <div class="mt-1 text-xs text-lime-400">
                    Valid ✓ - URL will be used automatically
                  </div>
                  {#if urlPreviewStates[altName]?.valid && textInputs[altName]?.trim()}
                    <div class="mt-2 relative max-h-24 overflow-hidden rounded-lg border border-[#262a30] bg-[#0e1012]">
                      <img
                        src={textInputs[altName]}
                        alt="URL preview"
                        class="w-full max-h-24 object-contain rounded"
                      />
                      <div class="absolute inset-0 bg-black/40 hover:bg-transparent transition-opacity rounded flex items-center justify-center">
                        <span class="text-xs text-white font-medium bg-black/60 px-2 py-0.5 rounded">Preview</span>
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
      <div class="text-center py-8 text-gray-500 border border-dashed border-[#262a30] rounded-xl bg-[#141619]/40">
        <svg class="mx-auto h-10 w-10 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
        <p class="text-sm text-gray-400">No alternative images added yet</p>
        <p class="text-xs text-gray-500 mt-0.5">Click "Add Alt Image" to add alternative product images</p>
      </div>
    {/if}

    <p class="text-xs text-gray-500">
      Add up to 10 alternative images. Each image must be less than 5MB.
    </p>
  </div>
</div>

<style>
  /* Custom styles if needed */
</style>
