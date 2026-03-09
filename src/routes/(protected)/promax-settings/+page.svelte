<script lang="ts">
  import { onMount } from 'svelte';
  import {
    originalData,
    tableData,
    isLoading,
    currentPage,
    itemsPerPage,
    sortField,
    sortDirection,
    searchFilters,
    paginatedData,
    isModalOpen,
    backgroundImageUrl,
    isUploadingBackground
  } from './stores';
  import { getSortIcon, sortData } from './utils';
  import type { ProMaxProduct } from './types';
  import Modal from '$lib/components/Modal.svelte';
  import { db } from '$lib/firebase';
  import { collection, addDoc, getDocs, query, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
  import { supabase } from '$lib/supabase';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import { toastSuccess, toastError } from '$lib/utils/toast';

  // Form state
  let newProduct = {
    imageUrl: '',
    name: '',
    code: '',
    color: '#000000',
    brand: 'Rapid Clean'
  };
  let isSaving = false;

  // Background image state
  let selectedBackgroundFile: File | null = null;
  let selectedBackgroundPreviewUrl: string | null = null;

  // Handler for clicking a table header to sort
  function handleSortClick(field: keyof ProMaxProduct) {
    const currentField = $sortField;
    const currentDirection = $sortDirection;

    let newDirection: 'asc' | 'desc' = 'asc';
    if (currentField === field && currentDirection === 'asc') {
      newDirection = 'desc';
    }

    sortField.set(field);
    sortDirection.set(newDirection);
    $tableData = sortData($tableData, field, newDirection);
  }

  function openAddProductModal() {
    // Reset form state
    newProduct = {
      imageUrl: '',
      name: '',
      code: '',
      color: '#000000',
      brand: 'Rapid Clean'
    };
    selectedBackgroundFile = null;
    if (selectedBackgroundPreviewUrl) {
      URL.revokeObjectURL(selectedBackgroundPreviewUrl);
      selectedBackgroundPreviewUrl = null;
    }
    isModalOpen.set(true);
  }

  async function handleSubmit() {
    try {
      if (!newProduct.name || !newProduct.code || !newProduct.brand) {
        toastError('Please fill in all required fields');
        return;
      }

      isSaving = true;
      
      // Add document to Firebase
      const docRef = await addDoc(collection(db, 'template_products'), {
        ...newProduct,
        image: newProduct.imageUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Add new product to local state
      const newProductWithId: ProMaxProduct = {
        id: docRef.id,
        image: newProduct.imageUrl,
        name: newProduct.name,
        code: newProduct.code,
        color: newProduct.color,
        brand: newProduct.brand
      };

      originalData.update(data => [...data, newProductWithId]);
      tableData.update(data => [...data, newProductWithId]);
      
      toastSuccess('Product added successfully');
      isModalOpen.set(false);
    } catch (error) {
      console.error('Error adding product:', error);
      toastError('Failed to add product');
    } finally {
      isSaving = false;
    }
  }

  async function fetchProducts() {
    try {
      isLoading.set(true);
      const productsQuery = query(collection(db, 'template_products'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(productsQuery);
      
      const products: ProMaxProduct[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        image: doc.data().image || '',
        name: doc.data().name,
        code: doc.data().code,
        color: doc.data().color,
        brand: doc.data().brand
      }));

      originalData.set(products);
      tableData.set(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      toastError('Failed to load products');
    } finally {
      isLoading.set(false);
    }
  }

  const PROMAX_SETTINGS_DOC = doc(db, 'promax_settings', 'default');
  const SUPABASE_BUCKET = 'promax-yaaama';

  async function fetchBackgroundSettings() {
    try {
      const snap = await getDoc(PROMAX_SETTINGS_DOC);
      backgroundImageUrl.set(snap.data()?.backgroundImageUrl ?? null);
    } catch (err) {
      console.error('Error fetching background settings:', err);
      toastError('Failed to load background settings');
    }
  }

  function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  async function saveBackgroundImage() {
    if (!selectedBackgroundFile) {
      toastError('Please select an image first');
      return;
    }
    const file = selectedBackgroundFile;
    if (file.size > 2 * 1024 * 1024) {
      toastError('Image must be smaller than 2MB');
      return;
    }
    try {
      isUploadingBackground.set(true);
      const sanitized = sanitizeFileName(file.name);
      const path = `backgrounds/background_${Date.now()}_${sanitized}`;
      const { error: uploadError } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      await setDoc(PROMAX_SETTINGS_DOC, { backgroundImageUrl: publicUrl, updatedAt: new Date() }, { merge: true });
      backgroundImageUrl.set(publicUrl);
      selectedBackgroundFile = null;
      if (selectedBackgroundPreviewUrl) {
        URL.revokeObjectURL(selectedBackgroundPreviewUrl);
        selectedBackgroundPreviewUrl = null;
      }
      toastSuccess('Background image saved');
    } catch (err) {
      console.error('Error saving background image:', err);
      toastError('Failed to save background image');
    } finally {
      isUploadingBackground.set(false);
    }
  }

  async function clearBackgroundImage() {
    try {
      isUploadingBackground.set(true);
      await setDoc(PROMAX_SETTINGS_DOC, { backgroundImageUrl: null, updatedAt: new Date() }, { merge: true });
      backgroundImageUrl.set(null);
      selectedBackgroundFile = null;
      if (selectedBackgroundPreviewUrl) {
        URL.revokeObjectURL(selectedBackgroundPreviewUrl);
        selectedBackgroundPreviewUrl = null;
      }
      toastSuccess('Background image cleared');
    } catch (err) {
      console.error('Error clearing background image:', err);
      toastError('Failed to clear background image');
    } finally {
      isUploadingBackground.set(false);
    }
  }

  function onBackgroundFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (selectedBackgroundPreviewUrl) {
      URL.revokeObjectURL(selectedBackgroundPreviewUrl);
      selectedBackgroundPreviewUrl = null;
    }
    if (file) {
      selectedBackgroundFile = file;
      selectedBackgroundPreviewUrl = URL.createObjectURL(file);
    } else {
      selectedBackgroundFile = null;
    }
  }

  // Reactive statement to handle searching
  $: {
    let filtered = $originalData;
    for (const [key, value] of Object.entries($searchFilters)) {
      if (value) {
        filtered = filtered.filter(item =>
          String(item[key as keyof ProMaxProduct]).toLowerCase().includes(value.toLowerCase())
        );
      }
    }
    tableData.set(filtered);
    currentPage.set(1);
  }

  onMount(() => {
    fetchProducts();
    fetchBackgroundSettings();
  });
</script>

<ToastContainer />

<div class="container mx-auto p-4">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">ProMax Settings</h1>
    <button 
      class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      on:click={openAddProductModal}
    >
      Add Product
    </button>
  </div>

  <div class="bg-white rounded-lg shadow overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('image')}>
                  Image {getSortIcon('image', $sortField, $sortDirection)}
                </div>
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('brand')}>
                  Brand {getSortIcon('brand', $sortField, $sortDirection)}
                </div>
                <input
                  type="text"
                  placeholder="Search Brand..."
                  class="border rounded px-2 py-1"
                  bind:value={$searchFilters.brand}
                />
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('name')}>
                  Name {getSortIcon('name', $sortField, $sortDirection)}
                </div>
                <input
                  type="text"
                  placeholder="Search Name..."
                  class="border rounded px-2 py-1"
                  bind:value={$searchFilters.name}
                />
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('code')}>
                  Code {getSortIcon('code', $sortField, $sortDirection)}
                </div>
                <input
                  type="text"
                  placeholder="Search Code..."
                  class="border rounded px-2 py-1"
                  bind:value={$searchFilters.code}
                />
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('color')}>
                  Color {getSortIcon('color', $sortField, $sortDirection)}
                </div>
                <input
                  type="text"
                  placeholder="Search Color..."
                  class="border rounded px-2 py-1"
                  bind:value={$searchFilters.color}
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#if $isLoading}
            <tr>
              <td colspan="5" class="px-6 py-4 text-center">Loading...</td>
            </tr>
          {:else if $paginatedData.length === 0}
            <tr>
              <td colspan="5" class="px-6 py-4 text-center">No products found.</td>
            </tr>
          {:else}
            {#each $paginatedData as product (product.id)}
              <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                  {#if product.image}
                    <img src={product.image} alt={product.name} class="h-10 w-10 rounded-full object-cover" />
                  {:else}
                    <div class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span class="text-gray-500">No img</span>
                    </div>
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">{product.brand}</td>
                <td class="px-6 py-4 whitespace-nowrap">{product.name}</td>
                <td class="px-6 py-4 whitespace-nowrap">{product.code}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <div class="h-6 w-6 rounded" style="background-color: {product.color}"></div>
                    {product.color}
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-700">Show</span>
        <select
          bind:value={$itemsPerPage}
          class="border rounded px-2 py-1 text-sm"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <span class="text-sm text-gray-700">entries</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          on:click={() => currentPage.update(p => Math.max(1, p - 1))}
          disabled={$currentPage === 1}
        >
          Previous
        </button>
        <span class="text-sm text-gray-700">Page {$currentPage}</span>
        <button
          class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          on:click={() => currentPage.update(p => p + 1)}
          disabled={$paginatedData.length < $itemsPerPage}
        >
          Next
        </button>
      </div>
    </div>
  </div>
</div>

{#if $isModalOpen}
  <Modal show={true} on:close={() => isModalOpen.set(false)}>
    <h2 slot="header" class="text-xl font-semibold">Add New Product</h2>
    <div slot="body" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700">Brand</label>
        <input 
          type="text" 
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
          bind:value={newProduct.brand}
          required
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700">Name</label>
        <input 
          type="text" 
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
          bind:value={newProduct.name}
          required
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700">Code</label>
        <input 
          type="text" 
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
          bind:value={newProduct.code}
          required
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700">Color</label>
        <input 
          type="color" 
          class="mt-1 block w-full h-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
          bind:value={newProduct.color}
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700">Image URL (Optional)</label>
        <input 
          type="text" 
          placeholder="https://example.com/image.png"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          bind:value={newProduct.imageUrl}
        />
      </div>
      <div class="border-t border-gray-200 pt-4 mt-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-2">Background image</h3>
        <p class="text-xs text-gray-600 mb-3">Upload an image to use as the ProMax background. Saved to Supabase (bucket promax-yaaama) and stored in Firestore.</p>
        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-0 flex-1">
            <label for="background-image-input" class="block text-sm font-medium text-gray-700 mb-1">Choose image</label>
            <input
              id="background-image-input"
              type="file"
              accept="image/*"
              class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              on:change={onBackgroundFileChange}
              disabled={$isUploadingBackground}
            />
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
              on:click={saveBackgroundImage}
              disabled={$isUploadingBackground || !selectedBackgroundFile}
            >
              {$isUploadingBackground ? 'Saving...' : 'Upload and save'}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={clearBackgroundImage}
              disabled={$isUploadingBackground}
            >
              Clear
            </button>
          </div>
        </div>
        <div class="mt-3">
          {#if selectedBackgroundPreviewUrl}
            <p class="text-xs text-gray-500 mb-1">New selection (not saved yet):</p>
            <img src={selectedBackgroundPreviewUrl} alt="Preview" class="h-20 rounded border border-gray-200 object-cover" />
          {:else if $backgroundImageUrl}
            <p class="text-xs text-gray-500 mb-1">Current background:</p>
            <img src={$backgroundImageUrl} alt="Background" class="h-20 rounded border border-gray-200 object-cover" />
          {:else}
            <p class="text-sm text-gray-500">No background image set.</p>
          {/if}
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-6">
        <button
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          on:click={() => isModalOpen.set(false)}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
          on:click={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Add Product'}
        </button>
      </div>
    </div>
  </Modal>
{/if} 