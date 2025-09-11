<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getWorkshops, deleteWorkshop as deleteWorkshopService, type WorkshopRecord } from '$lib/services/workshop';
  import { fade } from 'svelte/transition';
  import Select from 'svelte-select';
  import { toastSuccess } from '$lib/utils/toast';

  let workshops: WorkshopRecord[] = [];
  let filteredWorkshops: WorkshopRecord[] = [];
  let loading = true;
  let error: string | null = null;

  // Photo viewer modal state
  let showPhotoViewer = false;
  let currentPhotoIndex = 0;
  let currentWorkshopPhotos: string[] = [];
  let currentWorkshopId = '';

  // Delete confirmation modal state
  let showDeleteModal = false;
  let workshopToDelete: WorkshopRecord | null = null;
  let isDeletingWorkshop = false;

  // Photo loading states (using arrays for better reactivity)
  let loadedPhotos: string[] = [];
  let failedPhotos: string[] = [];

  // View states
  let currentView: 'table' | 'board' = loadViewPreference();

  // LocalStorage functions for view preference
  // Saves user's preferred view (table or board) to localStorage
  function saveViewPreference(view: 'table' | 'board') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('workshop-view-preference', view);
    }
  }

  // Loads user's saved view preference from localStorage
  // Defaults to 'table' if no preference is saved or localStorage is unavailable
  function loadViewPreference(): 'table' | 'board' {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('workshop-view-preference');
      if (saved === 'table' || saved === 'board') {
        return saved;
      }
    }
    return 'table'; // default fallback
  }

  // Filter states
  let statusFilter = '';
  let customerFilter = '';
  let sortBy = 'created_at';
  let sortOrder: 'asc' | 'desc' = 'desc';

  // Status options for filter
  const statusOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'To be Quoted', value: 'to_be_quoted' },
    { label: 'Docket Ready', value: 'docket_ready' },
    { label: 'Quoted/Repaired', value: 'quoted_repaired' },
    { label: 'WAITING APPROVAL PO', value: 'waiting_approval_po' },
    { label: 'Waiting for Parts', value: 'waiting_for_parts' },
    { label: 'BOOKED IN FOR REPAIR/ SERVICE', value: 'booked_in_for_repair_service' },
    { label: 'PENDING JOBS', value: 'pending_jobs' }
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

  function getWorkshopsByStatus() {
    const grouped: { [key: string]: WorkshopRecord[] } = {
      draft: [],
      to_be_quoted: [],
      docket_ready: [],
      quoted_repaired: [],
      waiting_approval_po: [],
      waiting_for_parts: [],
      booked_in_for_repair_service: [],
      pending_jobs: []
    };

    filteredWorkshops.forEach(workshop => {
      if (grouped[workshop.status]) {
        grouped[workshop.status].push(workshop);
      }
    });

    return grouped;
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
      case 'to_be_quoted': return 'bg-orange-100 text-orange-800';
      case 'docket_ready': return 'bg-blue-100 text-blue-800';
      case 'quoted_repaired': return 'bg-teal-100 text-teal-800';
      case 'waiting_approval_po': return 'bg-purple-100 text-purple-800';
      case 'waiting_for_parts': return 'bg-gray-100 text-gray-800';
      case 'booked_in_for_repair_service': return 'bg-indigo-100 text-indigo-800';
      case 'pending_jobs': return 'bg-red-100 text-red-800';
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

  function openDeleteModal(workshop: WorkshopRecord) {
    workshopToDelete = workshop;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    workshopToDelete = null;
    isDeletingWorkshop = false; // Reset loading state when modal closes
  }

  async function deleteWorkshop(workshopId: string) {
    if (isDeletingWorkshop) return; // Prevent multiple clicks

    try {
      isDeletingWorkshop = true;

      // Call the actual service function to soft delete the workshop
      await deleteWorkshopService(workshopId);

      // Reload the workshops data from the database
      await loadWorkshops();

      // Show success message
      toastSuccess(
        'Workshop has been successfully deleted.',
        'Deletion Complete'
      );

      closeDeleteModal();
      console.log('Workshop deleted:', workshopId);
    } catch (err) {
      console.error('Error deleting workshop:', err);
      error = 'Failed to delete workshop';
    } finally {
      isDeletingWorkshop = false;
    }
  }

  function handleRowClick(workshop: WorkshopRecord) {
    goto(`/workshop/create?workshop_id=${workshop.id}`);
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

  // Save view preference to localStorage when it changes
  $: if (currentView) {
    saveViewPreference(currentView);
  }
</script>

<svelte:head>
  <title>Workshop Job Status - RapidTools</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 mb-2">Workshop Job Status</h1>
          <p class="text-gray-600">View and manage all workshop jobs</p>
        </div>
        <!-- View Toggle -->
        <div class="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
          <button
            class="px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 {currentView === 'table' ? 'bg-yellow-400 text-white' : 'text-gray-700 hover:bg-gray-100'}"
            on:click={() => {
              currentView = 'table';
              saveViewPreference('table');
            }}
          >
            <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
            </svg>
            Table
          </button>
          <button
            class="px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 {currentView === 'board' ? 'bg-yellow-400 text-white' : 'text-gray-700 hover:bg-gray-100'}"
            on:click={() => {
              currentView = 'board';
              saveViewPreference('board');
            }}
          >
            <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            Board
          </button>
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

    {#if currentView === 'table'}
      <!-- Table View -->
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
                  <tr class="hover:bg-gray-50 transition-colors cursor-pointer" transition:fade on:click={() => handleRowClick(workshop)}>
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
                                on:click={(e) => {
                                  e.stopPropagation();
                                  openPhotoViewer(workshop, index);
                                }}
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
                    <td class="px-4 py-4 whitespace-normal">
                      <div class="text-sm font-medium text-gray-900">
                        {workshop.product_name}
                      </div>
                      <div class="text-sm text-gray-500">
                        {workshop.make_model}
                      </div>
                    </td>
                    <td class="px-4 py-4 whitespace-normal">
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
                        class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                        on:click={(e) => {
                          e.stopPropagation();
                          openDeleteModal(workshop);
                        }}
                      >
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Delete
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
    {:else}
      <!-- Board View -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
          {@const workshopsByStatus = getWorkshopsByStatus()}
          <div class="flex gap-6 overflow-x-auto pb-4 min-w-max">
            <!-- Draft Column -->
            <div class="bg-yellow-50 rounded-lg p-4 min-h-96 w-72 flex-shrink-0">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xs font-semibold text-gray-900 uppercase tracking-wider">Draft</h3>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  {workshopsByStatus.draft.length}
                </span>
              </div>
              <div class="space-y-3">
                {#each workshopsByStatus.draft as workshop (workshop.id)}
                  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer" on:click={() => handleRowClick(workshop)} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(workshop); }}} role="button" tabindex="0" aria-label={`View details for ${workshop.customer_name}'s workshop`}>
                    <!-- Photo Section -->
                    {#if workshop.photo_urls && workshop.photo_urls.length > 0}
                      <div class="mb-3">
                        <div class="relative">
                          <!-- Skeleton loader -->
                          {#if !isPhotoReady(workshop.photo_urls[0]) && !failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-200 rounded animate-pulse"></div>
                          {/if}

                          <!-- Photo thumbnail -->
                          <button
                            type="button"
                            class="w-full h-32 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
                            on:click={(e) => {
                              e.stopPropagation();
                              openPhotoViewer(workshop, 0);
                            }}
                            aria-label="View photo for {workshop.customer_name}'s workshop"
                          >
                            <!-- Always render img to trigger load/error events -->
                            <img
                              src={workshop.photo_urls[0]}
                              alt="Photo for {workshop.customer_name}"
                              class="w-full h-full object-cover {isPhotoReady(workshop.photo_urls[0]) ? 'opacity-100' : 'opacity-0'}"
                              on:load={() => handlePhotoLoad(workshop.photo_urls[0])}
                              on:error={() => handlePhotoError(workshop.photo_urls[0])}
                            />
                          </button>

                          <!-- Error indicator -->
                          {#if failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500 border border-gray-300">
                              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                              </svg>
                            </div>
                          {/if}

                          <!-- Photo count indicator if multiple photos -->
                          {#if workshop.photo_urls.length > 1}
                            <div class="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
                              {workshop.photo_urls.length}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {:else}
                      <!-- No photos placeholder -->
                      <div class="mb-3">
                        <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-200">
                          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                        </div>
                      </div>
                    {/if}

                    <div class="flex items-start justify-between mb-2">
                      <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-medium text-gray-900 truncate">{workshop.customer_name}</h4>
                        <p class="text-xs text-gray-500 truncate">{workshop.product_name}</p>
                      </div>
                    </div>

                    <div class="text-xs text-gray-500 mb-2">
                      <div>WO: {workshop.clients_work_order || 'N/A'}</div>
                      <div>{formatDate(workshop.created_at)}</div>
                    </div>

                    <button
                      type="button"
                      class="w-full inline-flex items-center justify-center px-2 py-1 border border-transparent text-xs leading-3 font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-200"
                      on:click={(e) => {
                        e.stopPropagation();
                        openDeleteModal(workshop);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                {/each}
              </div>
            </div>

            <!-- To be Quoted Column -->
            <div class="bg-orange-50 rounded-lg p-4 min-h-96 w-72 flex-shrink-0">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xs font-semibold text-gray-900 uppercase tracking-wider">To be Quoted</h3>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  {workshopsByStatus.to_be_quoted.length}
                </span>
              </div>
              <div class="space-y-3">
                {#each workshopsByStatus.to_be_quoted as workshop (workshop.id)}
                  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer" on:click={() => handleRowClick(workshop)} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(workshop); }}} role="button" tabindex="0" aria-label={`View details for ${workshop.customer_name}'s workshop`}>
                    <!-- Photo Section -->
                    {#if workshop.photo_urls && workshop.photo_urls.length > 0}
                      <div class="mb-3">
                        <div class="relative">
                          <!-- Skeleton loader -->
                          {#if !isPhotoReady(workshop.photo_urls[0]) && !failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-200 rounded animate-pulse"></div>
                          {/if}

                          <!-- Photo thumbnail -->
                          <button
                            type="button"
                            class="w-full h-32 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
                            on:click={(e) => {
                              e.stopPropagation();
                              openPhotoViewer(workshop, 0);
                            }}
                            aria-label="View photo for {workshop.customer_name}'s workshop"
                          >
                            <!-- Always render img to trigger load/error events -->
                            <img
                              src={workshop.photo_urls[0]}
                              alt="Photo for {workshop.customer_name}"
                              class="w-full h-full object-cover {isPhotoReady(workshop.photo_urls[0]) ? 'opacity-100' : 'opacity-0'}"
                              on:load={() => handlePhotoLoad(workshop.photo_urls[0])}
                              on:error={() => handlePhotoError(workshop.photo_urls[0])}
                            />
                          </button>

                          <!-- Error indicator -->
                          {#if failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500 border border-gray-300">
                              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                              </svg>
                            </div>
                          {/if}

                          <!-- Photo count indicator if multiple photos -->
                          {#if workshop.photo_urls.length > 1}
                            <div class="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
                              {workshop.photo_urls.length}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {:else}
                      <!-- No photos placeholder -->
                      <div class="mb-3">
                        <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-200">
                          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                        </div>
                      </div>
                    {/if}

                    <div class="flex items-start justify-between mb-2">
                      <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-medium text-gray-900 truncate">{workshop.customer_name}</h4>
                        <p class="text-xs text-gray-500 truncate">{workshop.product_name}</p>
                      </div>
                    </div>

                    <div class="text-xs text-gray-500 mb-2">
                      <div>WO: {workshop.clients_work_order || 'N/A'}</div>
                      <div>{formatDate(workshop.created_at)}</div>
                    </div>

                    <button
                      type="button"
                      class="w-full inline-flex items-center justify-center px-2 py-1 border border-transparent text-xs leading-3 font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-200"
                      on:click={(e) => {
                        e.stopPropagation();
                        openDeleteModal(workshop);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Docket Ready Column -->
            <div class="bg-blue-50 rounded-lg p-4 min-h-96 w-72 flex-shrink-0">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xs font-semibold text-gray-900 uppercase tracking-wider">Docket Ready</h3>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {workshopsByStatus.docket_ready.length}
                </span>
              </div>
              <div class="space-y-3">
                {#each workshopsByStatus.docket_ready as workshop (workshop.id)}
                  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer" on:click={() => handleRowClick(workshop)} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(workshop); }}} role="button" tabindex="0" aria-label={`View details for ${workshop.customer_name}'s workshop`}>
                    <!-- Photo Section -->
                    {#if workshop.photo_urls && workshop.photo_urls.length > 0}
                      <div class="mb-3">
                        <div class="relative">
                          <!-- Skeleton loader -->
                          {#if !isPhotoReady(workshop.photo_urls[0]) && !failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-200 rounded animate-pulse"></div>
                          {/if}

                          <!-- Photo thumbnail -->
                          <button
                            type="button"
                            class="w-full h-32 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
                            on:click={(e) => {
                              e.stopPropagation();
                              openPhotoViewer(workshop, 0);
                            }}
                            aria-label="View photo for {workshop.customer_name}'s workshop"
                          >
                            <!-- Always render img to trigger load/error events -->
                            <img
                              src={workshop.photo_urls[0]}
                              alt="Photo for {workshop.customer_name}"
                              class="w-full h-full object-cover {isPhotoReady(workshop.photo_urls[0]) ? 'opacity-100' : 'opacity-0'}"
                              on:load={() => handlePhotoLoad(workshop.photo_urls[0])}
                              on:error={() => handlePhotoError(workshop.photo_urls[0])}
                            />
                          </button>

                          <!-- Error indicator -->
                          {#if failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500 border border-gray-300">
                              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                              </svg>
                            </div>
                          {/if}

                          <!-- Photo count indicator if multiple photos -->
                          {#if workshop.photo_urls.length > 1}
                            <div class="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
                              {workshop.photo_urls.length}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {:else}
                      <!-- No photos placeholder -->
                      <div class="mb-3">
                        <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-200">
                          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                        </div>
                      </div>
                    {/if}

                    <div class="flex items-start justify-between mb-2">
                      <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-medium text-gray-900 truncate">{workshop.customer_name}</h4>
                        <p class="text-xs text-gray-500 truncate">{workshop.product_name}</p>
                      </div>
                    </div>

                    <div class="text-xs text-gray-500 mb-2">
                      <div>WO: {workshop.clients_work_order || 'N/A'}</div>
                      <div>{formatDate(workshop.created_at)}</div>
                    </div>

                    <button
                      type="button"
                      class="w-full inline-flex items-center justify-center px-2 py-1 border border-transparent text-xs leading-3 font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-200"
                      on:click={(e) => {
                        e.stopPropagation();
                        openDeleteModal(workshop);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Quoted/Repaired Column -->
            <div class="bg-teal-50 rounded-lg p-4 min-h-96 w-72 flex-shrink-0">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xs font-semibold text-gray-900 uppercase tracking-wider">Quoted/Repaired</h3>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                  {workshopsByStatus.quoted_repaired.length}
                </span>
              </div>
              <div class="space-y-3">
                {#each workshopsByStatus.quoted_repaired as workshop (workshop.id)}
                  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer" on:click={() => handleRowClick(workshop)} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(workshop); }}} role="button" tabindex="0" aria-label={`View details for ${workshop.customer_name}'s workshop`}>
                    <!-- Photo Section -->
                    {#if workshop.photo_urls && workshop.photo_urls.length > 0}
                      <div class="mb-3">
                        <div class="relative">
                          <!-- Skeleton loader -->
                          {#if !isPhotoReady(workshop.photo_urls[0]) && !failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-200 rounded animate-pulse"></div>
                          {/if}

                          <!-- Photo thumbnail -->
                          <button
                            type="button"
                            class="w-full h-32 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
                            on:click={(e) => {
                              e.stopPropagation();
                              openPhotoViewer(workshop, 0);
                            }}
                            aria-label="View photo for {workshop.customer_name}'s workshop"
                          >
                            <!-- Always render img to trigger load/error events -->
                            <img
                              src={workshop.photo_urls[0]}
                              alt="Photo for {workshop.customer_name}"
                              class="w-full h-full object-cover {isPhotoReady(workshop.photo_urls[0]) ? 'opacity-100' : 'opacity-0'}"
                              on:load={() => handlePhotoLoad(workshop.photo_urls[0])}
                              on:error={() => handlePhotoError(workshop.photo_urls[0])}
                            />
                          </button>

                          <!-- Error indicator -->
                          {#if failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500 border border-gray-300">
                              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                              </svg>
                            </div>
                          {/if}

                          <!-- Photo count indicator if multiple photos -->
                          {#if workshop.photo_urls.length > 1}
                            <div class="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
                              {workshop.photo_urls.length}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {:else}
                      <!-- No photos placeholder -->
                      <div class="mb-3">
                        <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-200">
                          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                        </div>
                      </div>
                    {/if}

                    <div class="flex items-start justify-between mb-2">
                      <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-medium text-gray-900 truncate">{workshop.customer_name}</h4>
                        <p class="text-xs text-gray-500 truncate">{workshop.product_name}</p>
                      </div>
                    </div>

                    <div class="text-xs text-gray-500 mb-2">
                      <div>WO: {workshop.clients_work_order || 'N/A'}</div>
                      <div>{formatDate(workshop.created_at)}</div>
                    </div>

                    <button
                      type="button"
                      class="w-full inline-flex items-center justify-center px-2 py-1 border border-transparent text-xs leading-3 font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-200"
                      on:click={(e) => {
                        e.stopPropagation();
                        openDeleteModal(workshop);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                {/each}
              </div>
            </div>

            <!-- WAITING APPROVAL PO Column -->
            <div class="bg-purple-50 rounded-lg p-4 min-h-96 w-72 flex-shrink-0">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xs font-semibold text-gray-900 uppercase tracking-wider">WAITING APPROVAL PO</h3>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {workshopsByStatus.waiting_approval_po.length}
                </span>
              </div>
              <div class="space-y-3">
                {#each workshopsByStatus.waiting_approval_po as workshop (workshop.id)}
                  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer" on:click={() => handleRowClick(workshop)} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(workshop); }}} role="button" tabindex="0" aria-label={`View details for ${workshop.customer_name}'s workshop`}>
                    <!-- Photo Section -->
                    {#if workshop.photo_urls && workshop.photo_urls.length > 0}
                      <div class="mb-3">
                        <div class="relative">
                          <!-- Skeleton loader -->
                          {#if !isPhotoReady(workshop.photo_urls[0]) && !failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-200 rounded animate-pulse"></div>
                          {/if}

                          <!-- Photo thumbnail -->
                          <button
                            type="button"
                            class="w-full h-32 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
                            on:click={(e) => {
                              e.stopPropagation();
                              openPhotoViewer(workshop, 0);
                            }}
                            aria-label="View photo for {workshop.customer_name}'s workshop"
                          >
                            <!-- Always render img to trigger load/error events -->
                            <img
                              src={workshop.photo_urls[0]}
                              alt="Photo for {workshop.customer_name}"
                              class="w-full h-full object-cover {isPhotoReady(workshop.photo_urls[0]) ? 'opacity-100' : 'opacity-0'}"
                              on:load={() => handlePhotoLoad(workshop.photo_urls[0])}
                              on:error={() => handlePhotoError(workshop.photo_urls[0])}
                            />
                          </button>

                          <!-- Error indicator -->
                          {#if failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500 border border-gray-300">
                              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                              </svg>
                            </div>
                          {/if}

                          <!-- Photo count indicator if multiple photos -->
                          {#if workshop.photo_urls.length > 1}
                            <div class="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
                              {workshop.photo_urls.length}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {:else}
                      <!-- No photos placeholder -->
                      <div class="mb-3">
                        <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-200">
                          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                        </div>
                      </div>
                    {/if}

                    <div class="flex items-start justify-between mb-2">
                      <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-medium text-gray-900 truncate">{workshop.customer_name}</h4>
                        <p class="text-xs text-gray-500 truncate">{workshop.product_name}</p>
                      </div>
                    </div>

                    <div class="text-xs text-gray-500 mb-2">
                      <div>WO: {workshop.clients_work_order || 'N/A'}</div>
                      <div>{formatDate(workshop.created_at)}</div>
                    </div>

                    <button
                      type="button"
                      class="w-full inline-flex items-center justify-center px-2 py-1 border border-transparent text-xs leading-3 font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-200"
                      on:click={(e) => {
                        e.stopPropagation();
                        openDeleteModal(workshop);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Waiting for Parts Column -->
            <div class="bg-gray-50 rounded-lg p-4 min-h-96 w-72 flex-shrink-0">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xs font-semibold text-gray-900 uppercase tracking-wider">Waiting for Parts</h3>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {workshopsByStatus.waiting_for_parts.length}
                </span>
              </div>
              <div class="space-y-3">
                {#each workshopsByStatus.waiting_for_parts as workshop (workshop.id)}
                  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer" on:click={() => handleRowClick(workshop)} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(workshop); }}} role="button" tabindex="0" aria-label={`View details for ${workshop.customer_name}'s workshop`}>
                    <!-- Photo Section -->
                    {#if workshop.photo_urls && workshop.photo_urls.length > 0}
                      <div class="mb-3">
                        <div class="relative">
                          <!-- Skeleton loader -->
                          {#if !isPhotoReady(workshop.photo_urls[0]) && !failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-200 rounded animate-pulse"></div>
                          {/if}

                          <!-- Photo thumbnail -->
                          <button
                            type="button"
                            class="w-full h-32 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
                            on:click={(e) => {
                              e.stopPropagation();
                              openPhotoViewer(workshop, 0);
                            }}
                            aria-label="View photo for {workshop.customer_name}'s workshop"
                          >
                            <!-- Always render img to trigger load/error events -->
                            <img
                              src={workshop.photo_urls[0]}
                              alt="Photo for {workshop.customer_name}"
                              class="w-full h-full object-cover {isPhotoReady(workshop.photo_urls[0]) ? 'opacity-100' : 'opacity-0'}"
                              on:load={() => handlePhotoLoad(workshop.photo_urls[0])}
                              on:error={() => handlePhotoError(workshop.photo_urls[0])}
                            />
                          </button>

                          <!-- Error indicator -->
                          {#if failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500 border border-gray-300">
                              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                              </svg>
                            </div>
                          {/if}

                          <!-- Photo count indicator if multiple photos -->
                          {#if workshop.photo_urls.length > 1}
                            <div class="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
                              {workshop.photo_urls.length}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {:else}
                      <!-- No photos placeholder -->
                      <div class="mb-3">
                        <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-200">
                          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                        </div>
                      </div>
                    {/if}

                    <div class="flex items-start justify-between mb-2">
                      <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-medium text-gray-900 truncate">{workshop.customer_name}</h4>
                        <p class="text-xs text-gray-500 truncate">{workshop.product_name}</p>
                      </div>
                    </div>

                    <div class="text-xs text-gray-500 mb-2">
                      <div>WO: {workshop.clients_work_order || 'N/A'}</div>
                      <div>{formatDate(workshop.created_at)}</div>
                    </div>

                    <button
                      type="button"
                      class="w-full inline-flex items-center justify-center px-2 py-1 border border-transparent text-xs leading-3 font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-200"
                      on:click={(e) => {
                        e.stopPropagation();
                        openDeleteModal(workshop);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                {/each}
              </div>
            </div>

            <!-- BOOKED IN FOR REPAIR/ SERVICE Column -->
            <div class="bg-indigo-50 rounded-lg p-4 min-h-96 w-72 flex-shrink-0">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xs font-semibold text-gray-900 uppercase tracking-wider">BOOKED IN FOR REPAIR/ SERVICE</h3>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {workshopsByStatus.booked_in_for_repair_service.length}
                </span>
              </div>
              <div class="space-y-3">
                {#each workshopsByStatus.booked_in_for_repair_service as workshop (workshop.id)}
                  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer" on:click={() => handleRowClick(workshop)} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(workshop); }}} role="button" tabindex="0" aria-label={`View details for ${workshop.customer_name}'s workshop`}>
                    <!-- Photo Section -->
                    {#if workshop.photo_urls && workshop.photo_urls.length > 0}
                      <div class="mb-3">
                        <div class="relative">
                          <!-- Skeleton loader -->
                          {#if !isPhotoReady(workshop.photo_urls[0]) && !failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-200 rounded animate-pulse"></div>
                          {/if}

                          <!-- Photo thumbnail -->
                          <button
                            type="button"
                            class="w-full h-32 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
                            on:click={(e) => {
                              e.stopPropagation();
                              openPhotoViewer(workshop, 0);
                            }}
                            aria-label="View photo for {workshop.customer_name}'s workshop"
                          >
                            <!-- Always render img to trigger load/error events -->
                            <img
                              src={workshop.photo_urls[0]}
                              alt="Photo for {workshop.customer_name}"
                              class="w-full h-full object-cover {isPhotoReady(workshop.photo_urls[0]) ? 'opacity-100' : 'opacity-0'}"
                              on:load={() => handlePhotoLoad(workshop.photo_urls[0])}
                              on:error={() => handlePhotoError(workshop.photo_urls[0])}
                            />
                          </button>

                          <!-- Error indicator -->
                          {#if failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500 border border-gray-300">
                              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                              </svg>
                            </div>
                          {/if}

                          <!-- Photo count indicator if multiple photos -->
                          {#if workshop.photo_urls.length > 1}
                            <div class="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
                              {workshop.photo_urls.length}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {:else}
                      <!-- No photos placeholder -->
                      <div class="mb-3">
                        <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-200">
                          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                        </div>
                      </div>
                    {/if}

                    <div class="flex items-start justify-between mb-2">
                      <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-medium text-gray-900 truncate">{workshop.customer_name}</h4>
                        <p class="text-xs text-gray-500 truncate">{workshop.product_name}</p>
                      </div>
                    </div>

                    <div class="text-xs text-gray-500 mb-2">
                      <div>WO: {workshop.clients_work_order || 'N/A'}</div>
                      <div>{formatDate(workshop.created_at)}</div>
                    </div>

                    <button
                      type="button"
                      class="w-full inline-flex items-center justify-center px-2 py-1 border border-transparent text-xs leading-3 font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-200"
                      on:click={(e) => {
                        e.stopPropagation();
                        openDeleteModal(workshop);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                {/each}
              </div>
            </div>

            <!-- PENDING JOBS Column -->
            <div class="bg-red-50 rounded-lg p-4 min-h-96 w-72 flex-shrink-0">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xs font-semibold text-gray-900 uppercase tracking-wider">PENDING JOBS</h3>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {workshopsByStatus.pending_jobs.length}
                </span>
              </div>
              <div class="space-y-3">
                {#each workshopsByStatus.pending_jobs as workshop (workshop.id)}
                  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer" on:click={() => handleRowClick(workshop)} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(workshop); }}} role="button" tabindex="0" aria-label={`View details for ${workshop.customer_name}'s workshop`}>
                    <!-- Photo Section -->
                    {#if workshop.photo_urls && workshop.photo_urls.length > 0}
                      <div class="mb-3">
                        <div class="relative">
                          <!-- Skeleton loader -->
                          {#if !isPhotoReady(workshop.photo_urls[0]) && !failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-200 rounded animate-pulse"></div>
                          {/if}

                          <!-- Photo thumbnail -->
                          <button
                            type="button"
                            class="w-full h-32 rounded overflow-hidden border-0 p-0 bg-transparent cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
                            on:click={(e) => {
                              e.stopPropagation();
                              openPhotoViewer(workshop, 0);
                            }}
                            aria-label="View photo for {workshop.customer_name}'s workshop"
                          >
                            <!-- Always render img to trigger load/error events -->
                            <img
                              src={workshop.photo_urls[0]}
                              alt="Photo for {workshop.customer_name}"
                              class="w-full h-full object-cover {isPhotoReady(workshop.photo_urls[0]) ? 'opacity-100' : 'opacity-0'}"
                              on:load={() => handlePhotoLoad(workshop.photo_urls[0])}
                              on:error={() => handlePhotoError(workshop.photo_urls[0])}
                            />
                          </button>

                          <!-- Error indicator -->
                          {#if failedPhotos.includes(workshop.photo_urls[0])}
                            <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500 border border-gray-300">
                              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                              </svg>
                            </div>
                          {/if}

                          <!-- Photo count indicator if multiple photos -->
                          {#if workshop.photo_urls.length > 1}
                            <div class="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
                              {workshop.photo_urls.length}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {:else}
                      <!-- No photos placeholder -->
                      <div class="mb-3">
                        <div class="w-full h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-200">
                          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                        </div>
                      </div>
                    {/if}

                    <div class="flex items-start justify-between mb-2">
                      <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-medium text-gray-900 truncate">{workshop.customer_name}</h4>
                        <p class="text-xs text-gray-500 truncate">{workshop.product_name}</p>
                      </div>
                    </div>

                    <div class="text-xs text-gray-500 mb-2">
                      <div>WO: {workshop.clients_work_order || 'N/A'}</div>
                      <div>{formatDate(workshop.created_at)}</div>
                    </div>

                    <button
                      type="button"
                      class="w-full inline-flex items-center justify-center px-2 py-1 border border-transparent text-xs leading-3 font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-200"
                      on:click={(e) => {
                        e.stopPropagation();
                        openDeleteModal(workshop);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                {/each}
              </div>
            </div>



          </div>

          <!-- Summary for Board View -->
          <div class="mt-6 bg-gray-50 px-4 py-4 rounded-lg border border-gray-200">
            <div class="text-sm text-gray-700">
              Showing {filteredWorkshops.length} of {workshops.length} workshop{workshops.length !== 1 ? 's' : ''} across all statuses
            </div>
          </div>
        {/if}
      </div>
    {/if}
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

  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && workshopToDelete}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" transition:fade>
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="px-6 py-4">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-lg font-medium text-gray-900">Delete Workshop</h3>
            <div class="mt-2">
              <p class="text-sm text-gray-500">
                Are you sure you want to delete the workshop for <strong>{workshopToDelete.customer_name}</strong>?
                This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
        <button
          type="button"
          class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          on:click={closeDeleteModal}
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
          disabled={isDeletingWorkshop}
          on:click={() => workshopToDelete && deleteWorkshop(workshopToDelete.id)}
        >
          {#if isDeletingWorkshop}
            <div class="flex items-center">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Deleting...</span>
            </div>
          {:else}
            Delete
          {/if}
        </button>
      </div>
    </div>
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
