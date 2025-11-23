<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
  import type { CategoryTreeNode } from './types';
  import { buildCategoryHierarchy, flattenCategoryTree } from './utils';

  const dispatch = createEventDispatcher();

  export let value: string = '';
  export let placeholder: string = 'Search categories...';
  export let id: string | undefined = undefined;
  export let disabled: boolean = false;

  let isOpen = false;
  let searchTerm = '';
  let categories: CategoryTreeNode[] = [];
  let flattenedCategories: CategoryTreeNode[] = [];
  let filteredCategories: CategoryTreeNode[] = [];
  let isLoading = false;
  let error: string | null = null;
  let selectedCategory: CategoryTreeNode | null = null;

  // Debounce search
  let searchTimeout: number;

  $: if (searchTerm) {
    clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => {
      filterCategories();
    }, 300);
  } else {
    filteredCategories = flattenedCategories.slice(0, 50); // Show first 50 when no search
  }

  function filterCategories() {
    if (!searchTerm.trim()) {
      filteredCategories = flattenedCategories.slice(0, 50); // Show more categories by default
      return;
    }

    const term = searchTerm.toLowerCase();
    filteredCategories = flattenedCategories.filter(category => {
      const name = category.name.toLowerCase();
      const path = category.path.toLowerCase();
      return name.includes(term) || path.includes(term);
    }).slice(0, 50); // Limit to 50 results for search
  }

  async function loadCategories() {
    isLoading = true;
    error = null;

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

        // Find selected category if value is set
        if (value) {
          selectedCategory = flattenedCategories.find(cat => cat.id === value) || null;
        }

        filterCategories();
      } else {
        throw new Error('Failed to load categories');
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      error = err instanceof Error ? err.message : 'Failed to load categories';
    } finally {
      isLoading = false;
    }
  }

  function selectCategory(category: CategoryTreeNode) {
    selectedCategory = category;
    value = category.id;
    searchTerm = '';
    isOpen = false;
    dispatch('change', { value: category.id, category });
  }

  function clearSelection() {
    selectedCategory = null;
    value = '';
    searchTerm = '';
    dispatch('change', { value: '', category: null });
  }

  function toggleDropdown() {
    // Categories are now preloaded on mount, so no need to load again
    isOpen = !isOpen;
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.category-dropdown')) {
      isOpen = false;
    }
  }

  // Load categories on mount and set up event listeners
  onMount(() => {
    loadCategories();
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="category-dropdown relative">
  <div class="relative">
    <input
      {id}
      type="text"
      class="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent {disabled || isLoading ? 'cursor-not-allowed bg-gray-100' : 'cursor-pointer'}"
      {placeholder}
      value={selectedCategory ? selectedCategory.path : searchTerm}
      on:click={disabled ? undefined : toggleDropdown}
      on:input={(e) => {
        searchTerm = e.currentTarget.value;
        if (!isOpen) isOpen = true;
      }}
      readonly={!isOpen || disabled}
      disabled={disabled || isLoading}
    />

    <button
      type="button"
      class="absolute inset-y-0 right-0 pr-3 flex items-center"
      on:click={disabled ? undefined : toggleDropdown}
      disabled={disabled || isLoading}
    >
      {#if isLoading}
        <SkeletonLoader className="w-5 h-5" />
      {:else}
        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      {/if}
    </button>

    {#if selectedCategory}
      <button
        type="button"
        class="absolute inset-y-0 right-8 pr-2 flex items-center text-gray-400 hover:text-gray-600"
        on:click={disabled ? undefined : clearSelection}
        disabled={disabled}
        title="Clear selection"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    {/if}
  </div>

  {#if isOpen}
    <div class="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
      {#if isLoading}
        <div class="p-4">
          <SkeletonLoader className="h-4 mb-2" />
          <SkeletonLoader className="h-4 mb-2" />
          <SkeletonLoader className="h-4" />
        </div>
      {:else if error}
        <div class="p-4 text-red-600 text-sm">
          {error}
        </div>
      {:else if filteredCategories.length === 0}
        <div class="p-4 text-gray-500 text-sm">
          {#if searchTerm}
            No categories found matching "{searchTerm}"
          {:else}
            No categories available
          {/if}
        </div>
      {:else}
        {#each filteredCategories as category}
          <button
            type="button"
            class="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-100 last:border-b-0"
            style="padding-left: {category.level * 16 + 16}px"
            on:click={() => selectCategory(category)}
          >
            <div class="flex items-center">
              {#if category.level > 0}
                <span class="text-gray-400 mr-2">{"→".repeat(category.level)}</span>
              {/if}
              <span class="font-medium">{category.name}</span>
              {#if category.level > 0}
                <span class="text-gray-500 text-sm ml-2">({category.path.split(' > ')[0]})</span>
              {/if}
            </div>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .category-dropdown {
    position: relative;
  }
</style>
