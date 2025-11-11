<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { getWorkshops, type WorkshopRecord } from '$lib/services/workshop';
  import PhotoViewer from '$lib/components/PhotoViewer.svelte';
  import { toastError } from '$lib/utils/toast';

  // Data stores
  let workshops: WorkshopRecord[] = [];
  let loading = true;
  let error: string | null = null;

  // Sorting
  type SortField = 'customer_name' | 'product_name' | 'order_id' | 'created_at' | 'updated_at';
  let sortField: SortField = 'updated_at';
  let sortDirection: 'asc' | 'desc' = 'desc';

  // Photo viewer modal state
  let showPhotoViewer = false;
  let currentPhotoIndex = 0;
  let currentWorkshop: WorkshopRecord | null = null;

  // Search
  let searchTerm = '';

  async function loadCompletedWorkshops() {
    try {
      loading = true;
      error = null;
      workshops = await getWorkshops({ status: 'completed' });
      sortWorkshops();
    } catch (err) {
      console.error('Error loading completed workshops:', err);
      error = err instanceof Error ? err.message : 'Failed to load completed workshops';
      toastError(error);
    } finally {
      loading = false;
    }
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
      workshop.make_model?.toLowerCase().includes(searchLower)
    );
  });

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
    goto(`${base}/workshop/create?workshop_id=${workshop.id}`);
  }

  onMount(() => {
    loadCompletedWorkshops();
  });
</script>

<svelte:head>
  <title>Completed Jobs - RapidTools</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 mb-2">Completed Jobs</h1>
          <p class="text-gray-600">View all completed workshop jobs</p>
        </div>
        <div class="flex items-center gap-3">
          <a
            href="{base}/workshop/workshop-board"
            class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            Workshop Board
          </a>
        </div>
      </div>
    </div>

    {#if error}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div class="flex">
          <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          <span class="text-red-800">{error}</span>
        </div>
      </div>
    {/if}

    <!-- Search and Stats -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="max-w-md">
          <label for="search-completed" class="block text-sm font-medium text-gray-700 mb-1">Search Completed Jobs</label>
          <input
            id="search-completed"
            type="text"
            bind:value={searchTerm}
            placeholder="Search customer, product, order ID..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div class="flex items-center gap-4 text-sm text-gray-600">
          <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
            {filteredWorkshops.length} completed job{filteredWorkshops.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {#if loading}
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
          <span class="ml-2 text-gray-600">Loading completed jobs...</span>
        </div>
      {:else if filteredWorkshops.length === 0}
        <div class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No completed jobs found</h3>
          <p class="mt-1 text-sm text-gray-500">
            {workshops.length === 0 ? 'No jobs have been completed yet.' : 'Try adjusting your search terms.'}
          </p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  on:click={() => handleSort('customer_name')}
                >
                  Customer {getSortIcon('customer_name')}
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  on:click={() => handleSort('product_name')}
                >
                  Product {getSortIcon('product_name')}
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  on:click={() => handleSort('order_id')}
                >
                  Order ID {getSortIcon('order_id')}
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Work Order
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  on:click={() => handleSort('updated_at')}
                >
                  Completed {getSortIcon('updated_at')}
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Photos
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each filteredWorkshops as workshop (workshop.id)}
                <tr class="hover:bg-gray-50 cursor-pointer" on:click={() => handleWorkshopClick(workshop)}>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {workshop.customer_name || 'N/A'}
                    </div>
                    {#if workshop.contact_email}
                      <div class="text-sm text-gray-500">{workshop.contact_email}</div>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                      {workshop.product_name || 'N/A'}
                    </div>
                    {#if workshop.make_model}
                      <div class="text-sm text-gray-500">{workshop.make_model}</div>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    {#if workshop.order_id}
                      <a
                        href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={workshop.order_id}"
                        target="_blank"
                        class="text-blue-600 hover:text-blue-800 underline font-medium"
                        on:click|stopPropagation
                      >
                        #{workshop.order_id}
                      </a>
                    {:else}
                      <span class="text-gray-400">No order</span>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {workshop.clients_work_order || 'N/A'}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(workshop.updated_at)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    {#if workshop.photo_urls && workshop.photo_urls.length > 0}
                      <button
                        type="button"
                        on:click|stopPropagation={() => openPhotoViewer(workshop)}
                        class="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
                      >
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        {workshop.photo_urls.length}
                      </button>
                    {:else}
                      <span class="text-gray-400 text-xs">No photos</span>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      type="button"
                      on:click|stopPropagation={() => handleWorkshopClick(workshop)}
                      class="text-blue-600 hover:text-blue-900"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
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
