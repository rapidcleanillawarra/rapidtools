<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getWorkshops, deleteWorkshop as deleteWorkshopService, type WorkshopRecord } from '$lib/services/workshop';
  import { toastSuccess } from '$lib/utils/toast';

  // Import new components
  import PhotoViewer from '$lib/components/PhotoViewer.svelte';
  import DeleteConfirmationModal from '$lib/components/DeleteConfirmationModal.svelte';
  import WorkshopCard from '$lib/components/WorkshopCard.svelte';
  import StatusColumn from '$lib/components/StatusColumn.svelte';
  import WorkshopFilters from '$lib/components/WorkshopFilters.svelte';

  let workshops: WorkshopRecord[] = [];
  let filteredWorkshops: WorkshopRecord[] = [];
  let loading = true;
  let error: string | null = null;

  // Photo viewer modal state
  let showPhotoViewer = false;
  let currentPhotoIndex = 0;
  let currentWorkshop: WorkshopRecord | null = null;

  // Delete confirmation modal state
  let showDeleteModal = false;
  let workshopToDelete: WorkshopRecord | null = null;
  let isDeletingWorkshop = false;

  // Photo loading states (using arrays for better reactivity)
  let loadedPhotos: string[] = [];
  let failedPhotos: string[] = [];

  // View states
  let currentView: 'table' | 'board' = loadViewPreference();

  // Filter states
  let statusFilter = '';
  let customerFilter = '';
  let sortBy = 'created_at';
  let sortOrder: 'asc' | 'desc' = 'desc';

  // LocalStorage functions for view preference
  function saveViewPreference(view: 'table' | 'board') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('workshop-view-preference', view);
    }
  }

  function loadViewPreference(): 'table' | 'board' {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('workshop-view-preference');
      if (saved === 'table' || saved === 'board') {
        return saved;
      }
    }
    return 'table'; // default fallback
  }

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
    currentWorkshop = workshop;
    currentPhotoIndex = photoIndex;
    showPhotoViewer = true;
  }

  function closePhotoViewer() {
    showPhotoViewer = false;
    currentWorkshop = null;
    currentPhotoIndex = 0;
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
    isDeletingWorkshop = false;
  }

  function handleDeleteConfirm() {
    if (workshopToDelete) {
      deleteWorkshop(workshopToDelete.id);
    }
  }

  function handleDeleteCancel() {
    closeDeleteModal();
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
    <WorkshopFilters
      bind:statusFilter
      bind:customerFilter
      bind:sortBy
      bind:sortOrder
      on:statusFilterChanged={(e) => statusFilter = e.detail.value}
      on:customerFilterChanged={(e) => customerFilter = e.detail.value}
      on:sortByChanged={(e) => sortBy = e.detail.value}
      on:sortOrderChanged={(e) => sortOrder = e.detail.value}
      on:applyFilters={applyFilters}
    />

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
                  <WorkshopCard
                    {workshop}
                    viewMode="table"
                    {loadedPhotos}
                    {failedPhotos}
                    on:click={({ detail }) => handleRowClick(detail.workshop)}
                    on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
                    on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
                  />
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
          <div class="relative">
            <!-- Scroll indicator (fade effect) -->
            <div class="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
            <div class="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>

            <!-- Scrollable container with better vertical space -->
            <div class="flex gap-6 overflow-x-auto pb-6 px-4 scroll-smooth scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 scroll-snap-x-mandatory"
                 style="scroll-behavior: smooth; scrollbar-width: thin; scroll-padding-left: 1rem; scroll-padding-right: 1rem; min-height: 600px;">
              <div class="flex gap-6 min-w-max py-2">
            <StatusColumn
              status="draft"
              title="Draft"
              workshops={workshopsByStatus.draft}
              {loadedPhotos}
              {failedPhotos}
              on:click={({ detail }) => handleRowClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
            />

            <StatusColumn
              status="to_be_quoted"
              title="To be Quoted"
              workshops={workshopsByStatus.to_be_quoted}
              {loadedPhotos}
              {failedPhotos}
              on:click={({ detail }) => handleRowClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
            />

            <StatusColumn
              status="docket_ready"
              title="Docket Ready"
              workshops={workshopsByStatus.docket_ready}
              {loadedPhotos}
              {failedPhotos}
              on:click={({ detail }) => handleRowClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
            />

            <StatusColumn
              status="quoted_repaired"
              title="Quoted/Repaired"
              workshops={workshopsByStatus.quoted_repaired}
              {loadedPhotos}
              {failedPhotos}
              on:click={({ detail }) => handleRowClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
            />

            <StatusColumn
              status="waiting_approval_po"
              title="WAITING APPROVAL PO"
              workshops={workshopsByStatus.waiting_approval_po}
              {loadedPhotos}
              {failedPhotos}
              on:click={({ detail }) => handleRowClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
            />

            <StatusColumn
              status="waiting_for_parts"
              title="Waiting for Parts"
              workshops={workshopsByStatus.waiting_for_parts}
              {loadedPhotos}
              {failedPhotos}
              on:click={({ detail }) => handleRowClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
            />

            <StatusColumn
              status="booked_in_for_repair_service"
              title="BOOKED IN FOR REPAIR/ SERVICE"
              workshops={workshopsByStatus.booked_in_for_repair_service}
              {loadedPhotos}
              {failedPhotos}
              on:click={({ detail }) => handleRowClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
            />

            <StatusColumn
              status="pending_jobs"
              title="PENDING JOBS"
              workshops={workshopsByStatus.pending_jobs}
              {loadedPhotos}
              {failedPhotos}
              on:click={({ detail }) => handleRowClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
            />
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
<PhotoViewer
  {showPhotoViewer}
  workshop={currentWorkshop}
  {currentPhotoIndex}
  {loadedPhotos}
  {failedPhotos}
  on:close={closePhotoViewer}
  on:photoIndexChanged={({ detail }) => currentPhotoIndex = detail.index}
/>

<!-- Delete Confirmation Modal -->
<DeleteConfirmationModal
  show={showDeleteModal}
  title="Delete Workshop"
  message="Are you sure you want to delete the workshop for {workshopToDelete?.customer_name || 'this customer'}?"
  itemName={workshopToDelete?.customer_name || 'Unknown Customer'}
  isDeleting={isDeletingWorkshop}
  on:confirm={handleDeleteConfirm}
  on:cancel={handleDeleteCancel}
/>

<style>
  /* Custom scrollbar styles for webkit browsers */
  .scrollbar-thin::-webkit-scrollbar {
    height: 8px;
    width: 8px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
    transition: background-color 0.2s ease;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  .scrollbar-thin::-webkit-scrollbar-corner {
    background: #f1f5f9;
  }

  /* Custom scrollbar styles for Firefox */
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 #f1f5f9;
  }

  /* Smooth scroll snap for better UX */
  .snap-start {
    scroll-snap-align: start;
  }

  /* Scroll container snap behavior */
  .scroll-snap-x-mandatory {
    scroll-snap-type: x mandatory;
  }

  /* Hide scroll indicators on very small screens */
  @media (max-width: 640px) {
    .scrollbar-thin::-webkit-scrollbar {
      display: none;
    }

    .scrollbar-thin {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  }

  /* Hide scrollbars on mobile devices */
  @media (max-width: 768px) {
    .scrollbar-thin::-webkit-scrollbar {
      display: none;
    }

    .scrollbar-thin {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  }
</style>