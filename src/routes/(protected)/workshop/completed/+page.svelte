<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { getWorkshops, type WorkshopRecord } from '$lib/services/workshop';
  import PhotoViewer from '$lib/components/PhotoViewer.svelte';
  import { toastError } from '$lib/utils/toast';

  // Status filter
  type StatusFilter = 'completed' | 'to_be_scrapped';

  function parseStatus(value: string | null): StatusFilter {
    return value === 'to_be_scrapped' ? 'to_be_scrapped' : 'completed';
  }

  let activeFilter: StatusFilter = parseStatus(get(page).url.searchParams.get('status'));

  // Data stores
  let workshops: WorkshopRecord[] = [];
  let loading = true;
  let error: string | null = null;

  // Pagination
  let currentPage = 1;
  let pageSize = 25;
  const pageSizeOptions = [10, 25, 50, 100];

  // Sorting
  type SortField = 'customer_name' | 'product_name' | 'serial_number' | 'order_id' | 'created_at' | 'updated_at';
  let sortField: SortField = 'updated_at';
  let sortDirection: 'asc' | 'desc' = 'desc';

  // Photo viewer modal state
  let showPhotoViewer = false;
  let currentPhotoIndex = 0;
  let currentWorkshop: WorkshopRecord | null = null;

  // Search
  let searchTerm = '';

  async function loadWorkshops() {
    try {
      loading = true;
      error = null;
      workshops = await getWorkshops({ status: activeFilter, includeHistory: false });
      sortWorkshops();
    } catch (err) {
      console.error('Error loading workshops:', err);
      error = err instanceof Error ? err.message : 'Failed to load workshops';
      toastError(error);
    } finally {
      loading = false;
    }
  }

  function switchFilter(filter: StatusFilter) {
    if (activeFilter === filter) return;
    activeFilter = filter;
    searchTerm = '';
    currentPage = 1;
    goto(`${base}/workshop/completed?status=${filter}`, { replaceState: true, keepFocus: true, noScroll: true });
    loadWorkshops();
  }

  function sortWorkshops() {
    workshops = [...workshops].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'created_at':
        case 'updated_at':
          aValue = new Date(a[sortField]).getTime();
          bValue = new Date(b[sortField]).getTime();
          break;
        case 'order_id':
          aValue = a.order_id ? parseInt(a.order_id) : 0;
          bValue = b.order_id ? parseInt(b.order_id) : 0;
          break;
        default:
          aValue = String(a[sortField] || '').toLowerCase();
          bValue = String(b[sortField] || '').toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
    sortWorkshops();
    currentPage = 1;
  }

  function getSortIcon(field: SortField): string {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  // Filter workshops based on search term
  $: filteredWorkshops = workshops.filter(workshop => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      workshop.customer_name?.toLowerCase().includes(searchLower) ||
      workshop.product_name?.toLowerCase().includes(searchLower) ||
      workshop.clients_work_order?.toLowerCase().includes(searchLower) ||
      workshop.order_id?.toLowerCase().includes(searchLower) ||
      workshop.make_model?.toLowerCase().includes(searchLower) ||
      workshop.serial_number?.toLowerCase().includes(searchLower)
    );
  });

  // Reset page when search term changes
  $: if (searchTerm !== undefined) {
    currentPage = 1;
  }

  // Pagination calculations
  $: totalPages = Math.max(1, Math.ceil(filteredWorkshops.length / pageSize));
  $: if (currentPage > totalPages) {
    currentPage = totalPages;
  }
  $: startItem = filteredWorkshops.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  $: endItem = Math.min(currentPage * pageSize, filteredWorkshops.length);
  $: paginatedWorkshops = filteredWorkshops.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  function handlePageSizeChange(newSize: number) {
    pageSize = newSize;
    currentPage = 1;
  }

  // Photo viewer functions
  function openPhotoViewer(workshop: WorkshopRecord, photoIndex: number = 0) {
    if (!workshop.photo_urls || workshop.photo_urls.length === 0) return;
    currentWorkshop = workshop;
    currentPhotoIndex = photoIndex;
    showPhotoViewer = true;
  }

  function closePhotoViewer() {
    showPhotoViewer = false;
    currentWorkshop = null;
    currentPhotoIndex = 0;
  }

  function formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  function handleWorkshopClick(workshop: WorkshopRecord) {
    goto(`${base}/workshop/form?workshop_id=${workshop.id}`);
  }

  $: pageTitle = activeFilter === 'completed' ? 'Completed Jobs' : 'To Be Scrapped';
  $: pageSubtitle = activeFilter === 'completed' ? 'View all completed workshop jobs' : 'View all workshops marked for scrapping';
  $: dateColumnLabel = activeFilter === 'completed' ? 'Completed' : 'Marked for Scrap';
  $: emptyIconPath = activeFilter === 'completed'
    ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    : 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16';
  $: emptyTitle = activeFilter === 'completed' ? 'No completed jobs found' : 'No scrapped jobs found';
  $: emptyMessage = activeFilter === 'completed'
    ? (workshops.length === 0 ? 'No jobs have been completed yet.' : 'Try adjusting your search terms.')
    : (workshops.length === 0 ? 'No jobs have been marked for scrapping yet.' : 'Try adjusting your search terms.');
  $: countBadgeClass = activeFilter === 'completed'
    ? 'bg-lime-950/40 text-lime-400 border border-lime-500/30'
    : 'bg-red-950/40 text-red-400 border border-red-500/30';
  $: countLabel = activeFilter === 'completed'
    ? `${filteredWorkshops.length} completed job${filteredWorkshops.length !== 1 ? 's' : ''}`
    : `${filteredWorkshops.length} to be scrapped job${filteredWorkshops.length !== 1 ? 's' : ''}`;

  onMount(() => {
    loadWorkshops();
  });
</script>

<svelte:head>
  <title>{pageTitle} - RapidTools</title>
</svelte:head>

<div class="min-h-screen py-6 px-2 sm:px-4 lg:px-6">
  <div class="w-full bg-[#141619] border border-[#262a30] shadow-xl rounded-2xl p-4 sm:p-6 lg:p-8">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">{pageTitle}</h1>
        <p class="mt-1 text-sm text-gray-400">{pageSubtitle}</p>
      </div>
      <div class="flex items-center gap-3">
        <a
          href="{base}/workshop/workshop-board"
          class="btn-secondary inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg hover:text-lime-300 transition-colors"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
          Workshop Board
        </a>
      </div>
    </div>

    <!-- Status Filter Toggle -->
    <div class="flex items-center gap-1 p-1 bg-[#0e1012] rounded-xl border border-[#262a30] w-fit mb-6">
      <button
        type="button"
        on:click={() => switchFilter('completed')}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 {activeFilter === 'completed' ? 'bg-lime-500 text-gray-950 shadow' : 'text-gray-400 hover:text-white'}"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Completed
      </button>
      <button
        type="button"
        on:click={() => switchFilter('to_be_scrapped')}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 {activeFilter === 'to_be_scrapped' ? 'bg-red-500 text-white shadow' : 'text-gray-400 hover:text-white'}"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        To Be Scrapped
      </button>
    </div>

    {#if error}
      <div class="bg-red-950/30 border border-red-500/40 rounded-xl p-4 mb-6 text-red-300 flex items-center">
        <svg class="w-5 h-5 text-red-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <span>{error}</span>
      </div>
    {/if}

    <!-- Search and Stats -->
    <div class="bg-[#181b20] rounded-xl border border-[#262a30] p-4 sm:p-5 mb-6 shadow-sm">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="max-w-md w-full">
          <label for="search-jobs" class="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            Search {pageTitle}
          </label>
          <input
            id="search-jobs"
            type="text"
            bind:value={searchTerm}
            placeholder="Search customer, product, serial, order ID..."
            class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3.5 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
          />
        </div>
        <div class="flex items-center gap-4">
          <span class="{countBadgeClass} px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide">
            {countLabel}
          </span>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-xl border border-[#262a30] bg-[#141619] shadow-xl overflow-hidden">
      {#if loading}
        <div class="flex items-center justify-center py-16">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400"></div>
          <span class="ml-3 text-sm text-gray-400">Loading {pageTitle.toLowerCase()}...</span>
        </div>
      {:else if filteredWorkshops.length === 0}
        <div class="text-center py-16">
          <svg class="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={emptyIconPath}/>
          </svg>
          <h3 class="mt-3 text-sm font-semibold text-white">{emptyTitle}</h3>
          <p class="mt-1 text-sm text-gray-400">{emptyMessage}</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full min-w-full divide-y divide-[#262a30] text-sm text-gray-200">
            <thead class="bg-[#181b20] text-xs font-semibold uppercase tracking-wider text-gray-400">
              <tr>
                <th
                  scope="col"
                  class="px-5 py-3.5 text-left cursor-pointer hover:bg-[#1f2329] hover:text-white transition-colors"
                  on:click={() => handleSort('customer_name')}
                >
                  Customer {getSortIcon('customer_name')}
                </th>
                <th
                  scope="col"
                  class="px-5 py-3.5 text-left cursor-pointer hover:bg-[#1f2329] hover:text-white transition-colors"
                  on:click={() => handleSort('product_name')}
                >
                  Product {getSortIcon('product_name')}
                </th>
                <th
                  scope="col"
                  class="px-5 py-3.5 text-left cursor-pointer hover:bg-[#1f2329] hover:text-white transition-colors"
                  on:click={() => handleSort('serial_number')}
                >
                  Serial No. {getSortIcon('serial_number')}
                </th>
                <th
                  scope="col"
                  class="px-5 py-3.5 text-left cursor-pointer hover:bg-[#1f2329] hover:text-white transition-colors"
                  on:click={() => handleSort('order_id')}
                >
                  Order ID {getSortIcon('order_id')}
                </th>
                <th scope="col" class="px-5 py-3.5 text-left">
                  Work Order
                </th>
                <th
                  scope="col"
                  class="px-5 py-3.5 text-left cursor-pointer hover:bg-[#1f2329] hover:text-white transition-colors"
                  on:click={() => handleSort('updated_at')}
                >
                  {dateColumnLabel} {getSortIcon('updated_at')}
                </th>
                <th scope="col" class="px-5 py-3.5 text-left">
                  Photos
                </th>
                <th scope="col" class="px-5 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#262a30] bg-[#141619]">
              {#each paginatedWorkshops as workshop (workshop.id)}
                <tr
                  class="even:bg-[#181b20]/40 hover:bg-[#1f2329]/70 transition-colors cursor-pointer"
                  on:click={() => handleWorkshopClick(workshop)}
                >
                  <td class="px-5 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-white">
                      {workshop.customer_name || 'N/A'}
                    </div>
                    {#if workshop.contact_email}
                      <div class="text-xs text-gray-400 mt-0.5">{workshop.contact_email}</div>
                    {/if}
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-200">
                      {workshop.product_name || 'N/A'}
                    </div>
                    {#if workshop.make_model}
                      <div class="text-xs text-gray-400 mt-0.5">{workshop.make_model}</div>
                    {/if}
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-300">
                    {workshop.serial_number || 'N/A'}
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    {#if workshop.order_id}
                      <a
                        href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={workshop.order_id}"
                        target="_blank"
                        class="text-lime-400 hover:text-lime-300 hover:underline font-medium text-sm"
                        on:click|stopPropagation
                      >
                        #{workshop.order_id}
                      </a>
                    {:else}
                      <span class="text-gray-500 text-sm">No order</span>
                    {/if}
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-300">
                    {workshop.clients_work_order || 'N/A'}
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-400">
                    {formatDate(workshop.updated_at)}
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    {#if workshop.photo_urls && workshop.photo_urls.length > 0}
                      <button
                        type="button"
                        on:click|stopPropagation={() => openPhotoViewer(workshop)}
                        class="inline-flex items-center px-2.5 py-1 border border-lime-500/30 rounded-md text-xs font-medium text-lime-400 bg-lime-950/40 hover:bg-lime-900/40 transition-colors"
                      >
                        <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        {workshop.photo_urls.length}
                      </button>
                    {:else}
                      <span class="text-gray-500 text-xs">No photos</span>
                    {/if}
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      type="button"
                      on:click|stopPropagation={() => handleWorkshopClick(workshop)}
                      class="btn-secondary text-xs px-2.5 py-1 hover:text-lime-300"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        {#if filteredWorkshops.length > 0}
          <div class="bg-[#181b20] px-4 py-3 flex flex-col sm:flex-row items-center justify-between border-t border-[#262a30] gap-3 sm:px-6">
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400">Show</span>
              <select
                value={pageSize}
                on:change={(e) => handlePageSizeChange(Number(e.currentTarget.value))}
                class="bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-colors"
              >
                {#each pageSizeOptions as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
              <span class="text-xs text-gray-400">per page</span>
            </div>

            <div class="flex items-center gap-3">
              <span class="text-xs text-gray-400">
                Showing <span class="font-medium text-gray-200">{startItem}</span> to <span class="font-medium text-gray-200">{endItem}</span> of <span class="font-medium text-gray-200">{filteredWorkshops.length}</span> results
              </span>

              {#if totalPages > 1}
                <nav class="isolate inline-flex -space-x-px rounded-lg shadow-sm" aria-label="Pagination">
                  <button
                    type="button"
                    on:click={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    class="relative inline-flex items-center rounded-l-lg px-2 py-1.5 text-gray-400 ring-1 ring-inset ring-[#262a30] bg-[#141619] hover:bg-[#1f2329] hover:text-gray-200 focus:z-20 disabled:opacity-30 disabled:cursor-not-allowed text-xs transition-colors"
                  >
                    <span class="sr-only">Previous</span>
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
                    </svg>
                  </button>

                  {#if totalPages <= 7}
                    {#each Array(totalPages) as _, i}
                      <button
                        type="button"
                        on:click={() => goToPage(i + 1)}
                        class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold transition-colors {currentPage === i + 1 ? 'bg-lime-500 text-gray-950 font-bold focus:z-20' : 'text-gray-300 ring-1 ring-inset ring-[#262a30] bg-[#141619] hover:bg-[#1f2329] hover:text-lime-300'}"
                      >
                        {i + 1}
                      </button>
                    {/each}
                  {:else}
                    <button
                      type="button"
                      on:click={() => goToPage(1)}
                      class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold transition-colors {currentPage === 1 ? 'bg-lime-500 text-gray-950 font-bold' : 'text-gray-300 ring-1 ring-inset ring-[#262a30] bg-[#141619] hover:bg-[#1f2329] hover:text-lime-300'}"
                    >
                      1
                    </button>
                    {#if currentPage > 3}
                      <span class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-inset ring-[#262a30] bg-[#141619]">...</span>
                    {/if}
                    {#each Array(3) as _, i}
                      {#if currentPage - 1 + i > 1 && currentPage - 1 + i < totalPages}
                        <button
                          type="button"
                          on:click={() => goToPage(currentPage - 1 + i)}
                          class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold transition-colors {currentPage === currentPage - 1 + i ? 'bg-lime-500 text-gray-950 font-bold' : 'text-gray-300 ring-1 ring-inset ring-[#262a30] bg-[#141619] hover:bg-[#1f2329] hover:text-lime-300'}"
                        >
                          {currentPage - 1 + i}
                        </button>
                      {/if}
                    {/each}
                    {#if currentPage < totalPages - 2}
                      <span class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-inset ring-[#262a30] bg-[#141619]">...</span>
                    {/if}
                    <button
                      type="button"
                      on:click={() => goToPage(totalPages)}
                      class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold transition-colors {currentPage === totalPages ? 'bg-lime-500 text-gray-950 font-bold' : 'text-gray-300 ring-1 ring-inset ring-[#262a30] bg-[#141619] hover:bg-[#1f2329] hover:text-lime-300'}"
                    >
                      {totalPages}
                    </button>
                  {/if}

                  <button
                    type="button"
                    on:click={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    class="relative inline-flex items-center rounded-r-lg px-2 py-1.5 text-gray-400 ring-1 ring-inset ring-[#262a30] bg-[#141619] hover:bg-[#1f2329] hover:text-gray-200 focus:z-20 disabled:opacity-30 disabled:cursor-not-allowed text-xs transition-colors"
                  >
                    <span class="sr-only">Next</span>
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </nav>
              {/if}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<!-- Photo Viewer Modal -->
<PhotoViewer
  {showPhotoViewer}
  workshop={currentWorkshop}
  {currentPhotoIndex}
  on:close={closePhotoViewer}
  on:photoIndexChanged={({ detail }) => currentPhotoIndex = detail.index}
/>
