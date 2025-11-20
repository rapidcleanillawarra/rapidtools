<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
  import { fetchBrands } from '$lib/services/brands';
  import type { Brand } from './types';

  const dispatch = createEventDispatcher();

  export let value: string = '';
  export let placeholder: string = 'Search brands...';
  export let id: string | undefined = undefined;

  let isOpen = false;
  let searchTerm = '';
  let brands: Brand[] = [];
  let filteredBrands: Brand[] = [];
  let isLoading = false;
  let error: string | null = null;
  let selectedBrand: Brand | null = null;

  // Debounce search
  let searchTimeout: number;

  $: if (searchTerm) {
    clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
      filterBrands();
    }, 300);
  } else {
    filteredBrands = brands.slice(0, 10); // Show first 10 when no search
  }

  function filterBrands() {
    if (!searchTerm.trim()) {
      filteredBrands = brands.slice(0, 10);
      return;
    }

    const term = searchTerm.toLowerCase();
    filteredBrands = brands.filter(brand => {
      const name = brand.name.toLowerCase();
      return name.includes(term);
    }).slice(0, 10); // Limit to 10 results
  }

  async function loadBrands() {
    isLoading = true;
    error = null;

    try {
      // Call the brands API directly instead of going through SvelteKit API route
      // This works in GitHub Pages static hosting
      const brandData = await fetchBrands();
      
      // Transform the API response to match the expected format
      brands = brandData.Content?.map(brand => ({
        id: brand.ContentID,
        name: brand.ContentName,
        value: brand.ContentName,
        label: brand.ContentName,
        contentId: brand.ContentID
      })) || [];
      
      filteredBrands = brands.slice(0, 10);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load brands';
      console.error('Error loading brands:', err);
    } finally {
      isLoading = false;
    }
  }

  function selectBrand(brand: Brand) {
    selectedBrand = brand;
    value = brand.name;
    searchTerm = '';
    isOpen = false;
    dispatch('select', { brand });
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchTerm = target.value;

    // If user types something that doesn't match selected brand, clear selection
    if (selectedBrand && searchTerm !== selectedBrand.name) {
      selectedBrand = null;
      value = searchTerm;
      dispatch('clear');
    } else {
      value = searchTerm;
    }
  }

  function toggleDropdown() {
    if (!brands.length && !isLoading) {
      loadBrands();
    }
    isOpen = !isOpen;
  }

  function handleFocus() {
    if (!brands.length && !isLoading) {
      loadBrands();
    }
    isOpen = true;
  }

  function handleBlur() {
    // Delay closing to allow for clicks on dropdown items
    setTimeout(() => {
      isOpen = false;
    }, 200);
  }

  // Load brands on mount
  onMount(() => {
    loadBrands();
  });
</script>

<div class="relative">
  <div class="relative">
    <input
      type="text"
      {id}
      {placeholder}
      bind:value={searchTerm}
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      autocomplete="off"
    />
    <button
      type="button"
      on:click={toggleDropdown}
      class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
      aria-label="Toggle brand dropdown"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </button>
  </div>

  {#if isOpen}
    <div class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
      {#if isLoading}
        <div class="p-4">
          <SkeletonLoader type="text" height="1.25rem" className="mb-2" />
          <SkeletonLoader type="text" height="1rem" width="80%" className="mb-2" />
          <SkeletonLoader type="text" height="1rem" width="60%" />
        </div>
      {:else if error}
        <div class="p-4 text-red-600 text-sm">
          {error}
          <button
            type="button"
            on:click={loadBrands}
            class="ml-2 text-blue-600 hover:text-blue-800 underline"
          >
            Retry
          </button>
        </div>
      {:else if filteredBrands.length === 0}
        <div class="p-4 text-gray-500 text-sm">
          {#if searchTerm}
            No brands found matching "{searchTerm}"
          {:else}
            No brands available
          {/if}
        </div>
      {:else}
        {#each filteredBrands as brand}
          <button
            type="button"
            on:click={() => selectBrand(brand)}
            class="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 focus:outline-none focus:bg-gray-50"
          >
            <div class="font-medium text-gray-900">
              {brand.name}
            </div>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Ensure dropdown appears above other elements */
  .relative {
    z-index: 1;
  }
</style>
