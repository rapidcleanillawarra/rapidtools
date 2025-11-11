<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let searchFilter: string = '';

  const dispatch = createEventDispatcher<{
    searchFilterChanged: { value: string };
    applyFilters: void;
  }>();

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchFilter = target.value;
    dispatch('searchFilterChanged', { value: searchFilter });
    dispatch('applyFilters');
  }
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
  <div class="max-w-md">
    <!-- Combined Search Filter -->
    <div>
      <label for="search-filter" class="block text-sm font-medium text-gray-700 mb-1">Search Workshops</label>
      <input
        id="search-filter"
        type="text"
        bind:value={searchFilter}
        on:input={handleSearchInput}
        placeholder="Search customer, order ID, work order..."
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
      />
    </div>
  </div>
</div>
