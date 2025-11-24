<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { toastSuccess, toastError } from '$lib/utils/toast';
  import { updateProduct } from '$lib/services/products';
  import type { ProductInfo } from './types';
  import TinyMCEEditor from './TinyMCEEditor.svelte';
  import CategoryDropdown from './CategoryDropdown.svelte';
  import KeywordPills from './KeywordPills.svelte';

  export let show: boolean = false;
  export let product: ProductInfo | null = null;

  const dispatch = createEventDispatcher();

  let isSaving = false;
  let formData: Partial<ProductInfo> = {};

  // Reset form data when product changes
  $: if (product) {
    formData = {
      ...product,
      search_keywords: product.search_keywords
        ? product.search_keywords.split(',').map(k => k.trim()).filter(k => k)
        : []
    };
  }

  function closeModal() {
    dispatch('close');
    formData = {};
  }

  async function handleSave() {
    if (!product || !formData) return;

    try {
      isSaving = true;

      // Call the products API directly instead of going through SvelteKit API route
      // This works in GitHub Pages static hosting
      await updateProduct(product.sku, formData);

      toastSuccess('Product updated successfully');
      dispatch('save', { product: formData });
      closeModal();
    } catch (error) {
      console.error('Error updating product:', error);
      toastError(error instanceof Error ? error.message : 'Failed to update product');
    } finally {
      isSaving = false;
    }
  }

  function handleInputChange(field: keyof ProductInfo, value: string | boolean | string[]) {
    formData = { ...formData, [field]: value };
  }

  function handleKeywordsChange(event: CustomEvent<{ keywords: string[] }>) {
    formData = { ...formData, search_keywords: event.detail.keywords };
  }
</script>

<Modal {show} on:close={closeModal} size="xl" style="max-width: 90vw;">
  <div slot="header">
    Edit Product: {product?.name || 'Unknown Product'}
  </div>

  <div slot="body" class="max-h-[80vh] overflow-y-auto space-y-6 p-6">
    {#if product}
      <!-- Image Preview -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="md:col-span-1">
          <div class="block text-sm font-medium text-gray-700 mb-2">Product Image</div>
          {#if product.image}
            <div class="border rounded-lg p-4 bg-gray-50">
              <img src={product.image} alt={product.name} class="w-full h-48 object-cover rounded" />
            </div>
          {:else}
            <div class="border rounded-lg p-8 bg-gray-50 text-center text-gray-500">
              No image available
            </div>
          {/if}
        </div>

        <div class="md:col-span-3 space-y-4">
          <!-- SKU and Name -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="sku" class="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <a
                href="https://www.rapidsupplies.com.au/_cpanel/products/view?sku={encodeURIComponent(formData.sku || '')}"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer text-sm"
                title="Click to view product in Rapid Supplies admin"
              >
                {formData.sku || ''}
              </a>
            </div>
            <div>
              <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                id="name"
                type="text"
                class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.name || ''}
                on:input={(e) => handleInputChange('name', e.currentTarget.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          <!-- Brand (readonly) -->
          <div>
            <label for="brand" class="block text-sm font-medium text-gray-700 mb-1">Brand</label>
            <input
              id="brand"
              type="text"
              class="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
              value={formData.brand || ''}
              readonly
            />
          </div>

          <!-- Existing Categories -->
          {#if product.categories && product.categories.length > 0}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Existing Categories</label>
              <div class="flex flex-wrap gap-2">
                {#each product.categories as category}
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    {category}
                  </span>
                {/each}
              </div>
              <p class="mt-1 text-xs text-gray-500">These are the current categories assigned to this product</p>
            </div>
          {:else}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Existing Categories</label>
              <p class="text-sm text-gray-500 italic">No categories currently assigned</p>
            </div>
          {/if}

          <!-- Category -->
          <div>
            <label for="category" class="block text-sm font-medium text-gray-700 mb-1">Primary Category</label>
            <CategoryDropdown
              id="category"
              placeholder="Select a category..."
              value={formData.category_1 || ''}
              on:change={(e) => handleInputChange('category_1', e.detail.value)}
              disabled={isSaving}
            />
            <p class="mt-1 text-xs text-gray-500">Select the primary category for this product</p>
          </div>
        </div>
      </div>

      <!-- Subtitle -->
      <div>
        <label for="subtitle" class="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
        <input
          id="subtitle"
          type="text"
          maxlength="56"
          class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.subtitle || ''}
          on:input={(e) => handleInputChange('subtitle', e.currentTarget.value)}
          disabled={isSaving}
        />
      </div>

      <!-- Search Keywords -->
      <div>
        <label for="search_keywords" class="block text-sm font-medium text-gray-700 mb-1">Search Keywords</label>
        <KeywordPills
          keywords={formData.search_keywords || []}
          on:change={handleKeywordsChange}
          disabled={isSaving}
          placeholder="Type a keyword and press Enter..."
        />
      </div>

      <!-- SEO Fields -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label for="seo_title" class="block text-sm font-medium text-gray-700 mb-1">SEO Page Title</label>
          <input
            id="seo_title"
            type="text"
            maxlength="100"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={formData.seo_page_title || ''}
            on:input={(e) => handleInputChange('seo_page_title', e.currentTarget.value)}
            disabled={isSaving}
          />
        </div>
        <div>
          <label for="seo_heading" class="block text-sm font-medium text-gray-700 mb-1">SEO Page Heading</label>
          <input
            id="seo_heading"
            type="text"
            maxlength="100"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={formData.seo_page_heading || ''}
            on:input={(e) => handleInputChange('seo_page_heading', e.currentTarget.value)}
            disabled={isSaving}
          />
        </div>
      </div>

      <!-- SEO Meta Description -->
      <div>
        <label for="seo_meta" class="block text-sm font-medium text-gray-700 mb-1">SEO Meta Description</label>
        <textarea
          id="seo_meta"
          rows="3"
          maxlength="320"
          class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.seo_meta_description || ''}
          on:input={(e) => handleInputChange('seo_meta_description', e.currentTarget.value)}
          disabled={isSaving}
        ></textarea>
      </div>

      <!-- Description with TinyMCE -->
      <div>
        <label for="description" class="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <TinyMCEEditor
          id="description"
          bind:value={formData.description}
          disabled={isSaving}
          placeholder="Enter product description..."
          height={300}
        />
      </div>

      <!-- Short Description -->
      <div>
        <label for="short_description" class="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
        <textarea
          id="short_description"
          rows="3"
          maxlength="255"
          class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={formData.short_description || ''}
          on:input={(e) => handleInputChange('short_description', e.currentTarget.value)}
          disabled={isSaving}
        ></textarea>
        <p class="mt-1 text-xs text-gray-500">Maximum 255 characters</p>
      </div>

      <!-- Specifications with TinyMCE -->
      <div>
        <label for="specifications" class="block text-sm font-medium text-gray-700 mb-2">Specifications</label>
        <TinyMCEEditor
          id="specifications"
          bind:value={formData.specifications}
          disabled={isSaving}
          placeholder="Enter product specifications..."
          height={300}
        />
      </div>

      <!-- Features with TinyMCE -->
      <div>
        <label for="features" class="block text-sm font-medium text-gray-700 mb-2">Features</label>
        <TinyMCEEditor
          id="features"
          bind:value={formData.features}
          disabled={isSaving}
          placeholder="Enter product features..."
          height={300}
        />
      </div>
    {/if}
  </div>

  <!-- Modal Footer -->
  <div slot="footer" class="flex justify-end space-x-3">
    <button
      type="button"
      class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent disabled:opacity-50"
      on:click={closeModal}
      disabled={isSaving}
    >
      Cancel
    </button>
    <button
      type="button"
      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      on:click={handleSave}
      disabled={isSaving}
    >
      {#if isSaving}
        <div class="flex items-center">
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Saving...
        </div>
      {:else}
        Save Changes
      {/if}
    </button>
  </div>
</Modal>
