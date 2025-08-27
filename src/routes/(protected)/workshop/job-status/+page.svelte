<script lang="ts">
  import { onMount } from 'svelte';
  import { getWorkshops, type WorkshopRecord } from '$lib/services/workshop';
  import { fade } from 'svelte/transition';
  import Select from 'svelte-select';

  let workshops: WorkshopRecord[] = [];
  let filteredWorkshops: WorkshopRecord[] = [];
  let loading = true;
  let error: string | null = null;

  // Filter states
  let statusFilter = '';
  let customerFilter = '';
  let sortBy = 'created_at';
  let sortOrder: 'asc' | 'desc' = 'desc';

  // Status options for filter
  const statusOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' }
  ];

  // Sort options
  const sortOptions = [
    { label: 'Created Date', value: 'created_at' },
    { label: 'Customer Name', value: 'customer_name' },
    { label: 'Product Name', value: 'product_name' },
    { label: 'Status', value: 'status' },
    { label: 'Work Order', value: 'clients_work_order' }
  ];

  async function loadWorkshops() {
    try {
      loading = true;
      error = null;
      workshops = await getWorkshops();
      applyFilters();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load workshops';
      console.error('Error loading workshops:', err);
    } finally {
      loading = false;
    }
  }

  function applyFilters() {
    let filtered = [...workshops];

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(workshop => workshop.status === statusFilter);
    }

    // Apply customer filter
    if (customerFilter) {
      filtered = filtered.filter(workshop =>
        workshop.customer_name.toLowerCase().includes(customerFilter.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortBy as keyof WorkshopRecord];
      const bValue = b[sortBy as keyof WorkshopRecord];

      let comparison = 0;
      const aStr = aValue?.toString() || '';
      const bStr = bValue?.toString() || '';

      if (aStr < bStr) comparison = -1;
      if (aStr > bStr) comparison = 1;

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    filteredWorkshops = filtered;
  }

  function toggleSort(column: string) {
    if (sortBy === column) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = column;
      sortOrder = 'asc';
    }
    applyFilters();
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getLocationColor(location: string) {
    return location === 'Site' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800';
  }

  onMount(() => {
    loadWorkshops();
  });

  // Reactive statements for filters
  $: if (workshops.length > 0) {
    applyFilters();
  }
</script>

<svelte:head>
  <title>Workshop Job Status - RapidTools</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Workshop Job Status</h1>
      <p class="text-gray-600">View and manage all workshop jobs</p>
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

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Status Filter -->
        <div>
          <label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <Select
            items={statusOptions}
            value={statusOptions.find(opt => opt.value === statusFilter)}
            on:select={(e) => {
              statusFilter = e.detail.value;
              applyFilters();
            }}
            placeholder="Filter by status"
          />
        </div>

        <!-- Customer Filter -->
        <div>
          <label for="customer-filter" class="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
          <input
            id="customer-filter"
            type="text"
            bind:value={customerFilter}
            on:input={applyFilters}
            placeholder="Search customers..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          />
        </div>

        <!-- Sort By -->
        <div>
          <label for="sort-by-filter" class="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
          <Select
            items={sortOptions}
            value={sortOptions.find(opt => opt.value === sortBy)}
            on:select={(e) => {
              sortBy = e.detail.value;
              applyFilters();
            }}
            placeholder="Sort by..."
          />
        </div>

        <!-- Sort Order -->
        <div>
          <label for="sort-order-filter" class="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
          <button
            on:click={() => {
              sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
              applyFilters();
            }}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 flex items-center justify-between"
          >
            <span>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
            <svg class="w-4 h-4 text-gray-400 transform {sortOrder === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {#if loading}
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
          <span class="ml-2 text-gray-600">Loading workshops...</span>
        </div>
      {:else if filteredWorkshops.length === 0}
        <div class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No workshops found</h3>
          <p class="mt-1 text-sm text-gray-500">
            {workshops.length === 0 ? 'No workshop jobs have been created yet.' : 'Try adjusting your filters.'}
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
                  on:click={() => toggleSort('created_at')}
                >
                  <div class="flex items-center">
                    Created
                    {#if sortBy === 'created_at'}
                      <svg class="ml-1 w-4 h-4 transform {sortOrder === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                      </svg>
                    {/if}
                  </div>
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  on:click={() => toggleSort('customer_name')}
                >
                  <div class="flex items-center">
                    Customer
                    {#if sortBy === 'customer_name'}
                      <svg class="ml-1 w-4 h-4 transform {sortOrder === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                      </svg>
                    {/if}
                  </div>
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  on:click={() => toggleSort('product_name')}
                >
                  <div class="flex items-center">
                    Product
                    {#if sortBy === 'product_name'}
                      <svg class="ml-1 w-4 h-4 transform {sortOrder === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                      </svg>
                    {/if}
                  </div>
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  on:click={() => toggleSort('clients_work_order')}
                >
                  <div class="flex items-center">
                    Work Order
                    {#if sortBy === 'clients_work_order'}
                      <svg class="ml-1 w-4 h-4 transform {sortOrder === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                      </svg>
                    {/if}
                  </div>
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  on:click={() => toggleSort('status')}
                >
                  <div class="flex items-center">
                    Status
                    {#if sortBy === 'status'}
                      <svg class="ml-1 w-4 h-4 transform {sortOrder === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                      </svg>
                    {/if}
                  </div>
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Photos
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each filteredWorkshops as workshop (workshop.id)}
                <tr class="hover:bg-gray-50 transition-colors" transition:fade>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(workshop.created_at)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {workshop.customer_name}
                    </div>
                    {#if workshop.customer_data}
                      <div class="text-sm text-gray-500">
                        {workshop.customer_data.EmailAddress || ''}
                      </div>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {workshop.product_name}
                    </div>
                    <div class="text-sm text-gray-500">
                      {workshop.make_model}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {workshop.clients_work_order || 'N/A'}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getStatusColor(workshop.status)}">
                      {workshop.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getLocationColor(workshop.location_of_repair)}">
                      {workshop.location_of_repair}
                    </span>
                    {#if workshop.site_location}
                      <div class="text-xs text-gray-500 mt-1">
                        {workshop.site_location}
                      </div>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>{workshop.contact_number}</div>
                    <div class="text-gray-500">{workshop.contact_email}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div class="flex items-center">
                      <svg class="w-4 h-4 text-gray-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                      </svg>
                      {workshop.photo_urls?.length || 0}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Summary -->
        <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div class="text-sm text-gray-700">
            Showing {filteredWorkshops.length} of {workshops.length} workshop{workshops.length !== 1 ? 's' : ''}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
