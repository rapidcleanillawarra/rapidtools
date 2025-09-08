<script lang="ts">
  import { onMount } from 'svelte';
  import { getWorkshops, type WorkshopRecord } from '$lib/services/workshop';
  import { fade } from 'svelte/transition';
  import Select from 'svelte-select';

  let workshops: WorkshopRecord[] = [];
  let filteredWorkshops: WorkshopRecord[] = [];
  let loading = true;
  let error: string | null = null;

  // Photo viewer modal state
  let showPhotoViewer = false;
  let currentPhotoIndex = 0;
  let currentWorkshopPhotos: string[] = [];
  let currentWorkshopId = '';

  // Photo loading states (using arrays for better reactivity)
  let loadedPhotos: string[] = [];
  let failedPhotos: string[] = [];

  // Filter states
  let statusFilter = '';
  let customerFilter = '';
  let sortBy = 'created_at';
  let sortOrder: 'asc' | 'desc' = 'desc';

  // Status options for filter
  const statusOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Draft', value: 'draft' },
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
        workshop.customer_name?.toLowerCase().includes(customerFilter.toLowerCase())
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
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getLocationColor(location: string) {
    return location === 'Site' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800';
  }

  // Photo viewer functions
  function openPhotoViewer(workshop: WorkshopRecord, photoIndex: number = 0) {
    if (!workshop.photo_urls || workshop.photo_urls.length === 0) return;

    currentWorkshopPhotos = workshop.photo_urls;
    currentPhotoIndex = photoIndex;
    currentWorkshopId = workshop.id;
    showPhotoViewer = true;

    // Debug: Log the URLs being used
    console.log('Opening photo viewer for workshop:', workshop.id);
    console.log('Photo URLs:', workshop.photo_urls);
    console.log('Selected photo URL:', workshop.photo_urls[photoIndex]);
    console.log('Photo ready state:', isPhotoReady(workshop.photo_urls[photoIndex]));
  }

  function closePhotoViewer() {
    showPhotoViewer = false;
    currentPhotoIndex = 0;
    currentWorkshopPhotos = [];
    currentWorkshopId = '';
  }

  function nextPhoto() {
    if (currentPhotoIndex < currentWorkshopPhotos.length - 1) {
      currentPhotoIndex++;
    } else {
      currentPhotoIndex = 0; // Loop to first photo
    }
  }

  function previousPhoto() {
    if (currentPhotoIndex > 0) {
      currentPhotoIndex--;
    } else {
      currentPhotoIndex = currentWorkshopPhotos.length - 1; // Loop to last photo
    }
  }

  function handlePhotoLoad(photoUrl: string) {
    // Remove from failed if it was there
    failedPhotos = failedPhotos.filter(url => url !== photoUrl);
    // Add to loaded if not already there
    if (!loadedPhotos.includes(photoUrl)) {
      loadedPhotos = [...loadedPhotos, photoUrl];
    }
    console.log('✅ Photo loaded successfully:', photoUrl);
    console.log('Current loaded photos count:', loadedPhotos.length);
    console.log('Current failed photos count:', failedPhotos.length);
  }

  function handlePhotoError(photoUrl: string) {
    // Remove from loaded if it was there
    loadedPhotos = loadedPhotos.filter(url => url !== photoUrl);
    // Add to failed if not already there
    if (!failedPhotos.includes(photoUrl)) {
      failedPhotos = [...failedPhotos, photoUrl];
    }
    console.error('❌ Photo failed to load:', photoUrl);
    console.log('Current loaded photos count:', loadedPhotos.length);
    console.log('Current failed photos count:', failedPhotos.length);
  }

  function isPhotoReady(photoUrl: string) {
    return loadedPhotos.includes(photoUrl) && !failedPhotos.includes(photoUrl);
  }

  // Debug function to test image URLs (callable from browser console)
  function testImageUrl(url: string) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        console.log('✅ Image loaded successfully:', url);
        console.log('Image dimensions:', img.naturalWidth, 'x', img.naturalHeight);
        resolve({ success: true, width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = (error) => {
        console.error('❌ Image failed to load:', url, error);
        reject({ success: false, error });
      };
      img.src = url;
    });
  }

  // Make testImageUrl available globally for debugging
  if (typeof window !== 'undefined') {
    (window as any).testImageUrl = testImageUrl;
  }

  onMount(() => {
    loadWorkshops();
  });

  // Reactive statements for filters
  $: if (workshops.length > 0) {
    applyFilters();
  }

  // Reactive statement to trigger updates when photo loading states change
  $: photoStatesChanged = loadedPhotos.length + failedPhotos.length;
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
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  on:click={() => toggleSort('status')}
                >
                  <div class="flex items-center">
                    <span class="truncate">Status</span>
                    {#if sortBy === 'status'}
                      <svg class="ml-1 w-4 h-4 flex-shrink-0 transform {sortOrder === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                      </svg>
                    {/if}
                  </div>
                </th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span class="truncate">Photos</span>
                </th>
                <th
                  scope="col"
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  on:click={() => toggleSort('created_at')}
                >
                  <div class="flex items-center">
                    <span class="truncate">Date</span>
                    {#if sortBy === 'created_at'}
                      <svg class="ml-1 w-4 h-4 flex-shrink-0 transform {sortOrder === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                      </svg>
                    {/if}
                  </div>
                </th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span class="truncate">Created By</span>
                </th>
                <th
                  scope="col"
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  on:click={() => toggleSort('clients_work_order')}
                >
                  <div class="flex items-center">
                    <span class="truncate">Work Order</span>
                    {#if sortBy === 'clients_work_order'}
                      <svg class="ml-1 w-4 h-4 flex-shrink-0 transform {sortOrder === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                      </svg>
                    {/if}
                  </div>
                </th>
                <th
                  scope="col"
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  on:click={() => toggleSort('product_name')}
                >
                  <div class="flex items-center">
                    <span class="truncate">Product</span>
                    {#if sortBy === 'product_name'}
                      <svg class="ml-1 w-4 h-4 flex-shrink-0 transform {sortOrder === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                      </svg>
                    {/if}
                  </div>
                </th>
                <th
                  scope="col"
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  on:click={() => toggleSort('customer_name')}
                >
                  <div class="flex items-center">
                    <span class="truncate">Customer</span>
                    {#if sortBy === 'customer_name'}
                      <svg class="ml-1 w-4 h-4 flex-shrink-0 transform {sortOrder === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                      </svg>
                    {/if}
                  </div>
                </th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span class="truncate">Action</span>
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each filteredWorkshops as workshop (workshop.id)}
                <tr class="hover:bg-gray-50 transition-colors" transition:fade>
                  <td class="px-4 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getStatusColor(workshop.status)}">
                      {workshop.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {#if workshop.photo_urls && workshop.photo_urls.length > 0}
                      <div class="flex items-center space-x-1">
                        {#each workshop.photo_urls.slice(0, 3) as photoUrl, index}
                          <div class="relative group">
                            <!-- Skeleton loader -->
                            {#if !isPhotoReady(photoUrl) && !failedPhotos.includes(photoUrl)}
                              <div class="w-28 h-28 bg-gray-200 rounded animate-pulse"></div>
                            {/if}

                            <!-- Photo thumbnail -->
                            <button
                              type="button"
                              class="w-28 h-28 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
                              on:click={() => openPhotoViewer(workshop, index)}
                              aria-label="View photo {index + 1} of {workshop.photo_urls?.length || 0}"
                            >
                              <!-- Always render img to trigger load/error events -->
                              <img
                                src={photoUrl}
                                alt="Photo {index + 1}"
                                class="w-full h-full object-cover {isPhotoReady(photoUrl) ? 'opacity-100' : 'opacity-0'}"
                                on:load={() => handlePhotoLoad(photoUrl)}
                                on:error={() => handlePhotoError(photoUrl)}
                              />
                            </button>

                            <!-- Error indicator -->
                            {#if failedPhotos.includes(photoUrl)}
                              <div class="w-28 h-28 bg-gray-100 rounded flex items-center justify-center text-base text-gray-500 border border-gray-300">
                                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                                </svg>
                              </div>
                            {/if}
                          </div>
                        {/each}

                        <!-- Show count if more than 3 photos -->
                        {#if workshop.photo_urls.length > 3}
                          <div class="w-28 h-28 bg-gray-100 rounded flex items-center justify-center text-lg text-gray-600 font-medium">
                            +{workshop.photo_urls.length - 3}
                          </div>
                        {/if}
                      </div>
                    {:else}
                      <div class="text-gray-400 text-xs">No photos</div>
                    {/if}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div class="text-sm font-medium text-gray-900">
                      {new Date(workshop.created_at).toLocaleDateString('en-AU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </div>
                    <div class="text-xs text-gray-500">
                      {new Date(workshop.created_at).toLocaleTimeString('en-AU', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div class="text-sm font-medium text-gray-900">
                      {workshop.created_by || 'Unknown'}
                    </div>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {workshop.clients_work_order || 'N/A'}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {workshop.product_name}
                    </div>
                    <div class="text-sm text-gray-500">
                      {workshop.make_model}
                    </div>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {workshop.customer_name}
                    </div>
                    {#if workshop.customer_data}
                      <div class="text-sm text-gray-500">
                        {workshop.customer_data.EmailAddress || ''}
                      </div>
                    {/if}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <button
                      type="button"
                      class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                      on:click={() => console.log('Process workshop:', workshop.id)}
                    >
                      Process
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Summary -->
        <div class="bg-gray-50 px-4 py-4 border-t border-gray-200">
          <div class="text-sm text-gray-700">
            Showing {filteredWorkshops.length} of {workshops.length} workshop{workshops.length !== 1 ? 's' : ''}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Photo Viewer Modal -->
{#if showPhotoViewer && currentWorkshopPhotos.length > 0}
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" transition:fade>
    <!-- Close button -->
    <button
      class="absolute top-4 right-4 z-20 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-colors"
      on:click={closePhotoViewer}
      aria-label="Close viewer"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>

    <!-- Navigation buttons -->
    {#if currentWorkshopPhotos.length > 1}
      <button
        class="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 bg-black bg-opacity-50 text-white rounded-full p-3 hover:bg-opacity-70 transition-colors"
        on:click={previousPhoto}
        aria-label="Previous photo"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
      </button>

      <button
        class="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 bg-black bg-opacity-50 text-white rounded-full p-3 hover:bg-opacity-70 transition-colors"
        on:click={nextPhoto}
        aria-label="Next photo"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </button>
    {/if}

    <!-- Main image -->
    <div class="max-w-full max-h-full p-4 relative">
      <!-- Loading skeleton -->
      {#if !isPhotoReady(currentWorkshopPhotos[currentPhotoIndex]) && !failedPhotos.includes(currentWorkshopPhotos[currentPhotoIndex])}
        <div class="w-96 h-96 bg-gray-300 rounded-lg animate-pulse flex items-center justify-center">
          <div class="text-gray-500 text-sm">Loading...</div>
        </div>
      {/if}

      <!-- Error state -->
      {#if failedPhotos.includes(currentWorkshopPhotos[currentPhotoIndex])}
        <div class="w-96 h-96 bg-gray-100 rounded-lg flex flex-col items-center justify-center border border-gray-300">
          <svg class="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
          <div class="text-gray-600 text-center">
            <div class="font-medium">Failed to load image</div>
            <div class="text-sm text-gray-500 mt-1">The image could not be loaded</div>
          </div>
        </div>
      {/if}

      <!-- Photo (always render to trigger load/error events) -->
      <img
        src={currentWorkshopPhotos[currentPhotoIndex]}
        alt="Photo {currentPhotoIndex + 1} of {currentWorkshopPhotos.length}"
        class="max-w-full max-h-full object-contain rounded-lg shadow-2xl {isPhotoReady(currentWorkshopPhotos[currentPhotoIndex]) ? 'block' : 'hidden'}"
        style="max-height: 80vh; max-width: 80vw;"
        on:load={() => handlePhotoLoad(currentWorkshopPhotos[currentPhotoIndex])}
        on:error={() => handlePhotoError(currentWorkshopPhotos[currentPhotoIndex])}
      />
    </div>

    <!-- Image counter -->
    {#if currentWorkshopPhotos.length > 1}
      <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
        {currentPhotoIndex + 1} / {currentWorkshopPhotos.length}
      </div>
    {/if}

    <!-- Workshop info overlay -->
    <div class="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded text-sm">
      <div class="font-medium">Workshop ID: {currentWorkshopId}</div>
      <div class="text-gray-300">Photo {currentPhotoIndex + 1} of {currentWorkshopPhotos.length}</div>
    </div>

    <!-- Debug overlay (only in development) -->
    {#if typeof window !== 'undefined' && window.location.hostname === 'localhost'}
      <div class="absolute top-4 right-16 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-xs max-w-xs">
        <div class="font-medium mb-1">Debug Info:</div>
        <div class="text-gray-300 break-all">
          {currentWorkshopPhotos[currentPhotoIndex]}
        </div>
        <button
          class="mt-1 text-blue-300 hover:text-blue-100 underline text-xs"
          on:click={() => {
            navigator.clipboard.writeText(currentWorkshopPhotos[currentPhotoIndex]);
            console.log('URL copied to clipboard:', currentWorkshopPhotos[currentPhotoIndex]);
          }}
        >
          Copy URL
        </button>
      </div>
    {/if}
  </div>
{/if}

<!-- Keyboard navigation -->
<svelte:window on:keydown={(e) => {
  if (!showPhotoViewer) return;

  switch (e.key) {
    case 'Escape':
      closePhotoViewer();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      previousPhoto();
      break;
    case 'ArrowRight':
      e.preventDefault();
      nextPhoto();
      break;
  }
}} />
