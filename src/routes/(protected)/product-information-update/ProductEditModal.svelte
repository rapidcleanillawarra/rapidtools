<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { toastSuccess, toastError } from '$lib/utils/toast';
  import { updateProduct } from '$lib/services/products';
  import { saveProductBackup } from '$lib/services/productBackup';
  import type { ProductInfo, CategoryTreeNode, CategoryOperation, ImageOperation } from './types';
  import { buildCategoryHierarchy, flattenCategoryTree } from './utils';
  import { transformProductsData } from './productTransformer';
  import TinyMCEEditor from './TinyMCEEditor.svelte';
  import CategoryDropdown from './CategoryDropdown.svelte';
  import BrandDropdown from './BrandDropdown.svelte';
  import KeywordPills from './KeywordPills.svelte';
  import ImageUploadComponent from './ImageUploadComponent.svelte';

  export let show: boolean = false;
  export let product: ProductInfo | null = null;

  const dispatch = createEventDispatcher();

  let isSaving = false;
  let formData: ProductInfo | null = null;

  // Category hierarchy state
  let categories: CategoryTreeNode[] = [];
  let flattenedCategories: CategoryTreeNode[] = [];
  let categoryMap = new Map<string, CategoryTreeNode>();

  // Category management state
  let categoryOperations: CategoryOperation[] = [];
  let selectedCategoryToAdd: string = '';
  let originalCategories: string[] = [];

  // Temporary storage for category operations across modal sessions
  // Keyed by product SKU to persist changes during a session
  let tempCategoryStorage = new Map<string, CategoryOperation[]>();

  // Image management state
  let imageOperations: ImageOperation[] = [];

  // Temporary storage for image operations across modal sessions
  let tempImageStorage = new Map<string, ImageOperation[]>();

  // JSON import state
  let jsonText: string = '';
  let jsonFile: File | null = null;
  let importErrors: string[] = [];
  let showJsonImport: boolean = false;

  // Placeholder text for JSON textarea
  const jsonPlaceholder = '{"name": "Product Name", "description": "Product description...", ...}';

  // Reactive statement to ensure UI updates when category operations change
  $: effectiveCategories = getEffectiveCategories(product?.categories || [], categoryOperations);

  // Save operations to temporary storage whenever they change
  $: if (product?.sku && categoryOperations.length >= 0) {
    tempCategoryStorage.set(product.sku, [...categoryOperations]);

    // Dispatch optimistic update to parent for immediate UI feedback
    const optimisticCategories = getEffectiveCategories(product?.categories || [], categoryOperations);
    const optimisticProduct = {
      ...product,
      categories: optimisticCategories
    };
    dispatch('optimistic-update', { product: optimisticProduct });
  }

  // Save image operations to temporary storage whenever they change
  $: if (product?.sku && imageOperations.length >= 0) {
    tempImageStorage.set(product.sku, [...imageOperations]);
  }

  // Reset form data when product changes (optimized type safety)
  $: if (product) {
    // Parse keywords if they're a string
    const keywords = typeof product.search_keywords === 'string'
      ? product.search_keywords.split(',').map(k => k.trim()).filter(k => k)
      : product.search_keywords || [];

    formData = {
      ...product,
      search_keywords: keywords
    };

    // Store original categories for comparison
    originalCategories = product.categories || [];

    // Load any existing operations from temporary storage
    categoryOperations = tempCategoryStorage.get(product.sku) || [];
    selectedCategoryToAdd = '';

    // Load any existing image operations from temporary storage
    imageOperations = tempImageStorage.get(product.sku) || [];
  } else {
    formData = null;
    categoryOperations = [];
    selectedCategoryToAdd = '';
    originalCategories = [];
  }

  // Load categories when modal is shown
  $: if (show && categories.length === 0) {
    loadCategories();
  }

  function closeModal() {
    // Reset category operations when modal closes without saving
    categoryOperations = [];
    // Reset image operations when modal closes without saving
    imageOperations = [];
    dispatch('close');
    formData = null;
  }

  async function handleSave() {
    if (!product || !formData) return;

    try {
      isSaving = true;

      // Save backup of current product data before making changes
      try {
        await saveProductBackup(product.sku, product);
      } catch (backupError) {
        // Continue with the update even if backup fails - don't block the user's action
      }

      // Prepare formData with category and image operations
      const updateData = {
        ...formData,
        categoryOperations: categoryOperations.length > 0 ? categoryOperations : undefined,
        imageOperations: imageOperations.length > 0 ? imageOperations : undefined
      };

      // Call the products API directly instead of going through SvelteKit API route
      // This works in GitHub Pages static hosting
      const updateResponse = await updateProduct(product.sku, updateData);
      console.log('Product update payload sent:', updateData);
      console.log('Update response:', updateResponse);

      // Transform the response to get updated product data
      const updatedProductData = updateResponse.Item && updateResponse.Item.length > 0
        ? transformProductsData(updateResponse.Item, formData.brand)[0]
        : product;

      // Calculate final categories after operations are applied
      const finalCategories = getEffectiveCategories(updatedProductData?.categories || [], categoryOperations);

      const updatedProduct = {
        ...formData,
        categories: finalCategories,
        images: updatedProductData?.images || [] // Use updated images from server
      };

      // Clear temporary storage since changes are now saved
      if (product?.sku) {
        tempCategoryStorage.delete(product.sku);
        tempImageStorage.delete(product.sku);
      }

      toastSuccess('Product updated successfully');
      dispatch('save', { product: updatedProduct });
      closeModal();
    } catch (error) {
      console.error('Error updating product:', error);

      // Revert optimistic changes on failure
      dispatch('revert-optimistic', { productId: product.id });

      toastError(error instanceof Error ? error.message : 'Failed to update product');
    } finally {
      isSaving = false;
    }
  }

  function handleBrandSelect(event: CustomEvent) {
    const brand = event.detail.brand;
    formData = { ...formData, brand: brand.name };
  }

  function handleBrandClear() {
    formData = { ...formData, brand: '' };
  }

  function handleInputChange(field: keyof ProductInfo, value: string | boolean | string[]) {
    formData = { ...formData, [field]: value };
  }

  function handleKeywordsChange(event: CustomEvent<{ keywords: string[] }>) {
    formData = { ...formData, search_keywords: event.detail.keywords };
  }

  async function loadCategories() {
    try {
      const response = await fetch('/api/categories');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.data) {
        // Build hierarchical structure
        categories = buildCategoryHierarchy(data.data);
        flattenedCategories = flattenCategoryTree(categories);

        // Create a map for quick lookup
        categoryMap.clear();
        flattenedCategories.forEach(cat => {
          categoryMap.set(cat.id, cat);
        });
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      // Don't show error to user as this is background loading
    }
  }

  function getCategoryByName(categoryName: string): CategoryTreeNode | null {
    // Find category by name in the flattened categories
    return flattenedCategories.find(cat => cat.name === categoryName) || null;
  }

  function getCategoryPath(categoryName: string): string {
    const category = getCategoryByName(categoryName);
    return category ? category.path : categoryName;
  }

  function getCategoryHierarchy(categoryName: string): { parent: string | null; children: CategoryTreeNode[] } {
    const category = getCategoryByName(categoryName);
    if (!category) return { parent: null, children: [] };

    let parent = null;
    if (category.parentCategoryId && category.parentCategoryId !== '0') {
      const parentCategory = categoryMap.get(category.parentCategoryId);
      parent = parentCategory ? parentCategory.name : null;
    }

    return {
      parent,
      children: category.children || []
    };
  }

  function removeCategory(categoryName: string) {
    const category = getCategoryByName(categoryName);
    if (!category) return;

    // Check if this category is already in operations
    const existingOp = categoryOperations.find(op => op.CategoryID === category.categoryId);
    if (existingOp) {
      // If it was being added, remove the operation entirely
      if (!existingOp.Delete) {
        categoryOperations = categoryOperations.filter(op => op.CategoryID !== category.categoryId);
      }
      // If it was already being deleted, do nothing
    } else {
      // Add delete operation
      categoryOperations = [...categoryOperations, { CategoryID: category.categoryId, Delete: true }];
    }
  }

  function addCategory() {
    if (!selectedCategoryToAdd) return;

    const category = categoryMap.get(selectedCategoryToAdd);
    if (!category) return;

    // Check if this category is already in operations
    const existingOp = categoryOperations.find(op => op.CategoryID === category.categoryId);
    if (existingOp) {
      // If it was being deleted, change to add
      if (existingOp.Delete) {
        categoryOperations = categoryOperations.map(op =>
          op.CategoryID === category.categoryId ? { CategoryID: op.CategoryID } : op
        );
      }
      // If it was already being added, do nothing
    } else {
      // Add add operation
      categoryOperations = [...categoryOperations, { CategoryID: category.categoryId }];
    }

    // Reset selection
    selectedCategoryToAdd = '';
  }

  function getEffectiveCategories(productCategories: string[] = [], operations: CategoryOperation[] = []): string[] {
    let effectiveCategories = [...productCategories];

    // Apply operations
    operations.forEach(op => {
      const category = flattenedCategories.find(cat => cat.categoryId === op.CategoryID);
      if (category) {
        if (op.Delete) {
          // Remove category
          effectiveCategories = effectiveCategories.filter(catName => catName !== category.name);
        } else {
          // Add category
          if (!effectiveCategories.includes(category.name)) {
            effectiveCategories.push(category.name);
          }
        }
      }
    });

    return effectiveCategories;
  }

  // JSON import functions
  function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file && file.type === 'application/json') {
      jsonFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        jsonText = e.target?.result as string;
      };
      reader.readAsText(file);
    } else if (file) {
      toastError('Please select a valid JSON file');
    }
  }

  function validateAndParseJson(jsonString: string): { valid: boolean; data?: Partial<ProductInfo>; errors: string[] } {
    const errors: string[] = [];

    if (!jsonString.trim()) {
      errors.push('JSON content is empty');
      return { valid: false, errors };
    }

    try {
      const data = JSON.parse(jsonString);

      // Validate structure - should be an object
      if (typeof data !== 'object' || data === null) {
        errors.push('JSON must be an object');
        return { valid: false, errors };
      }

      // Validate known fields and their types
      const allowedFields: (keyof ProductInfo)[] = [
        'name', 'subtitle', 'description', 'short_description', 'specifications', 'features',
        'search_keywords', 'seo_page_title', 'seo_meta_description', 'seo_page_heading',
        'categories'
      ];

      const validatedData: Partial<ProductInfo> = {};

      for (const [key, value] of Object.entries(data)) {
        if (!allowedFields.includes(key as keyof ProductInfo)) {
          errors.push(`Unknown field: ${key}`);
          continue;
        }

        // Type validation
        switch (key) {
          case 'description':
          case 'short_description':
          case 'specifications':
          case 'features':
          case 'seo_page_title':
          case 'seo_meta_description':
          case 'seo_page_heading':
            if (typeof value === 'string') {
              validatedData[key] = value;
            } else {
              errors.push(`Field '${key}' must be a string`);
            }
            break;
          case 'name':
          case 'subtitle':
          case 'search_keywords':
            if (typeof value === 'string') {
              validatedData[key] = value.split(',').map(k => k.trim()).filter(k => k);
            } else if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
              validatedData[key] = value;
            } else {
              errors.push(`Field '${key}' must be a string or array of strings`);
            }
            break;
          case 'categories':
            if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
              validatedData[key] = value;
            } else {
              errors.push(`Field '${key}' must be an array of strings`);
            }
            break;
          default:
            // Skip unknown fields
            break;
        }
      }

      return {
        valid: errors.length === 0,
        data: validatedData,
        errors
      };

    } catch (error) {
      errors.push(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors };
    }
  }

  function applyJsonImport() {
    if (!formData) return;

    const validation = validateAndParseJson(jsonText);

    if (!validation.valid) {
      importErrors = validation.errors;
      return;
    }

    if (!validation.data) {
      importErrors = ['No valid data found in JSON'];
      return;
    }

    // Apply the validated data to formData
    formData = {
      ...formData,
      ...validation.data
    };

    // Handle categories specially - convert to category operations if needed
    if (validation.data.categories) {
      // Reset existing category operations and set new categories
      categoryOperations = [];

      // For each category in the imported data, we need to add operations
      // This is complex because we need to map category names to category IDs
      // For now, we'll update the effective categories directly
      // Note: This might need refinement based on how categories are handled
      const currentCategories = product?.categories || [];
      const importedCategories = validation.data.categories;

      // Categories that need to be added
      const categoriesToAdd = importedCategories.filter(cat => !currentCategories.includes(cat));
      // Categories that need to be removed
      const categoriesToRemove = currentCategories.filter(cat => !importedCategories.includes(cat));

      // Add operations for categories to add
      categoriesToAdd.forEach(catName => {
        const category = getCategoryByName(catName);
        if (category) {
          categoryOperations = [...categoryOperations, { CategoryID: category.categoryId }];
        }
      });

      // Add operations for categories to remove
      categoriesToRemove.forEach(catName => {
        const category = getCategoryByName(catName);
        if (category) {
          categoryOperations = [...categoryOperations, { CategoryID: category.categoryId, Delete: true }];
        }
      });
    }

    importErrors = [];
    toastSuccess('JSON data imported successfully');
    showJsonImport = false;
  }

  function clearJsonImport() {
    jsonText = '';
    jsonFile = null;
    importErrors = [];
  }

  function exportToJson() {
    if (!formData) return;

    try {
      // Create a clean export object with only the fields we support for import
      const exportData: Partial<ProductInfo> = {};

      // Copy supported fields from formData
      const supportedFields: (keyof ProductInfo)[] = [
        'name', 'subtitle', 'description', 'short_description', 'specifications', 'features',
        'search_keywords', 'seo_page_title', 'seo_meta_description', 'seo_page_heading',
        'categories'
      ];

      supportedFields.forEach(field => {
        const value = formData[field];
        if (value !== undefined && value !== null && value !== '') {
          exportData[field] = value;
        }
      });

      // Format the JSON with proper indentation
      const jsonString = JSON.stringify(exportData, null, 2);

      // Put the JSON in the textarea for easy copying
      jsonText = jsonString;

      // Clear any previous errors
      importErrors = [];

      toastSuccess('Product data exported to JSON');

      // Scroll to make the textarea visible
      showJsonImport = true;

    } catch (error) {
      console.error('Error exporting to JSON:', error);
      importErrors = ['Failed to export data to JSON'];
      toastError('Failed to export data to JSON');
    }
  }

  function downloadJson() {
    if (!formData) return;

    try {
      // Create a clean export object with only the fields we support for import
      const exportData: Partial<ProductInfo> = {};

      // Copy supported fields from formData
      const supportedFields: (keyof ProductInfo)[] = [
        'name', 'subtitle', 'description', 'short_description', 'specifications', 'features',
        'search_keywords', 'seo_page_title', 'seo_meta_description', 'seo_page_heading',
        'categories'
      ];

      supportedFields.forEach(field => {
        const value = formData[field];
        if (value !== undefined && value !== null && value !== '') {
          exportData[field] = value;
        }
      });

      // Format the JSON with proper indentation
      const jsonString = JSON.stringify(exportData, null, 2);

      // Create a blob and download it
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create a temporary link element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `${formData.sku || 'product'}-export.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object
      URL.revokeObjectURL(url);

      toastSuccess('JSON file downloaded successfully');

    } catch (error) {
      console.error('Error downloading JSON:', error);
      toastError('Failed to download JSON file');
    }
  }
</script>

<Modal {show} on:close={closeModal} size="xl" style="max-width: 90vw;">
  <div slot="header">
    Edit Product: {product?.name || 'Unknown Product'}
  </div>

  <div slot="body" class="max-h-[80vh] overflow-y-auto space-y-6 p-6">
    {#if product}
      <!-- JSON Import Section -->
      <div class="border border-blue-200 rounded-lg p-4 bg-blue-50">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-medium text-blue-900">Import from JSON</h3>
          <button
            type="button"
            class="text-blue-600 hover:text-blue-800 text-sm underline"
            on:click={() => showJsonImport = !showJsonImport}
          >
            {showJsonImport ? 'Hide' : 'Show'} Import Options
          </button>
        </div>

        {#if showJsonImport}
          <div class="space-y-4">
            <!-- File Upload -->
            <div>
              <label class="block text-sm font-medium text-blue-800 mb-2">Upload JSON File</label>
              <input
                type="file"
                accept=".json"
                class="block w-full text-sm text-blue-900 border border-blue-300 rounded-md cursor-pointer bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                on:change={handleFileUpload}
                disabled={isSaving}
              />
              <p class="mt-1 text-xs text-blue-600">Select a JSON file containing product data</p>
            </div>

            <!-- Or paste JSON -->
            <div class="text-center text-sm text-blue-700 font-medium">OR</div>

            <!-- JSON Textarea -->
            <div>
              <label class="block text-sm font-medium text-blue-800 mb-2">Paste JSON Data</label>
              <textarea
                class="w-full h-32 border border-blue-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                placeholder={jsonPlaceholder}
                bind:value={jsonText}
                disabled={isSaving}
              ></textarea>
            </div>

            <!-- Import Actions -->
            <div class="flex items-center justify-between">
              <div class="flex space-x-2">
                <button
                  type="button"
                  class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  on:click={applyJsonImport}
                  disabled={isSaving || !jsonText.trim()}
                >
                  Import JSON
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 border border-blue-300 text-blue-700 text-sm rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  on:click={clearJsonImport}
                  disabled={isSaving}
                >
                  Clear
                </button>
              </div>
              <div class="flex space-x-2">
                <button
                  type="button"
                  class="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                  on:click={exportToJson}
                  disabled={isSaving}
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 border border-green-600 text-green-700 text-sm rounded-md hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                  on:click={downloadJson}
                  disabled={isSaving}
                >
                  Download JSON
                </button>
              </div>
            </div>

            <!-- Import Errors -->
            {#if importErrors.length > 0}
              <div class="bg-red-50 border border-red-200 rounded-md p-3">
                <h4 class="text-sm font-medium text-red-800 mb-2">Import Errors:</h4>
                <ul class="text-sm text-red-700 space-y-1">
                  {#each importErrors as error}
                    <li>• {error}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            <!-- Help Text -->
            <div class="bg-blue-100 border border-blue-200 rounded-md p-3">
              <h4 class="text-sm font-medium text-blue-800 mb-2">Supported Fields:</h4>
              <div class="text-sm text-blue-700 grid grid-cols-2 gap-1">
                <div>• name</div>
                <div>• subtitle</div>
                <div>• description</div>
                <div>• short_description</div>
                <div>• specifications</div>
                <div>• features</div>
                <div>• search_keywords</div>
                <div>• seo_page_title</div>
                <div>• seo_meta_description</div>
                <div>• seo_page_heading</div>
                <div>• categories</div>
              </div>
              <p class="text-xs text-blue-600 mt-2">
                Note: categories should be an array of strings. search_keywords can be a string (comma-separated) or array of strings.
              </p>
              <p class="text-xs text-blue-600 mt-1">
                <strong>Export:</strong> Use "Export JSON" to copy data to the textarea, or "Download JSON" to save as a file.
              </p>
            </div>
          </div>
        {/if}
      </div>
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

          <!-- Brand -->
          <div>
            <label for="brand" class="block text-sm font-medium text-gray-700 mb-1">Brand</label>
            <BrandDropdown
              id="brand-select"
              placeholder="Select a brand..."
              value={formData.brand || ''}
              disabled={isSaving}
              on:select={handleBrandSelect}
              on:clear={handleBrandClear}
            />
          </div>

          <!-- Category Management -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Product Categories</label>
            <div class="space-y-3">
              <!-- Current Categories -->
              {#each effectiveCategories as categoryName}
                {@const categoryObj = getCategoryByName(categoryName)}
                {@const hierarchy = getCategoryHierarchy(categoryName)}
                <div class="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      {#if categoryObj}
                        <div class="flex items-center gap-2">
                          <div class="font-medium text-gray-900">{categoryObj.name}</div>
                          {#if hierarchy.parent}
                            <div class="text-sm text-gray-600">
                              <span class="text-gray-500">under</span> <span class="font-medium text-blue-700">{hierarchy.parent}</span>
                            </div>
                          {/if}
                        </div>
                        {#if hierarchy.children && hierarchy.children.length > 0}
                          <div class="text-sm text-gray-600 mt-2">
                            <span class="font-medium">Contains:</span>
                            <div class="flex flex-wrap gap-1 mt-1">
                              {#each hierarchy.children.slice(0, 5) as child}
                                <span class="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-700">
                                  {child.name}
                                </span>
                              {/each}
                              {#if hierarchy.children.length > 5}
                                <span class="text-xs text-gray-500">+{hierarchy.children.length - 5} more</span>
                              {/if}
                            </div>
                          </div>
                        {/if}
                      {:else}
                        <div class="font-medium text-gray-900">{categoryName}</div>
                      {/if}
                    </div>
                    <button
                      type="button"
                      class="ml-3 text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                      on:click={() => removeCategory(categoryName)}
                      disabled={isSaving}
                      title="Remove category"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              {/each}

              <!-- Add Category -->
              <div class="border border-dashed border-gray-300 rounded-lg p-3 bg-white">
                <div class="flex items-center gap-3">
                  <div class="flex-1">
                    <CategoryDropdown
                      id="add-category"
                      placeholder="Select a category to add..."
                      value={selectedCategoryToAdd}
                      on:change={(e) => selectedCategoryToAdd = e.detail.value}
                      disabled={isSaving}
                    />
                  </div>
                  <button
                    type="button"
                    class="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    on:click={addCategory}
                    disabled={isSaving || !selectedCategoryToAdd}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            {#if effectiveCategories.length === 0}
              <p class="mt-2 text-sm text-gray-500 italic">No categories assigned to this product</p>
            {:else}
              <p class="mt-2 text-xs text-gray-500">Categories assigned to this product, showing their parent and child relationships</p>
            {/if}
          </div>

        </div>
      </div>

      <!-- Image Management -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Product Images</label>
        <ImageUploadComponent
          images={product?.images || []}
          imageOperations={imageOperations}
          disabled={isSaving}
          on:images-changed={(e) => imageOperations = e.detail.imageOperations}
        />
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
