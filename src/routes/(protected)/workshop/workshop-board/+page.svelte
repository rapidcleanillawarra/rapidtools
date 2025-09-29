<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getWorkshops, deleteWorkshop as deleteWorkshopService, updateWorkshopStatus, type WorkshopRecord } from '$lib/services/workshop';
  import { toastSuccess } from '$lib/utils/toast';

  // Import components
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

  // Drag states
  let draggedWorkshopId: string | null = null;
  let recentlyMovedWorkshopId: string | null = null;

  // Filter states
  let statusFilter = '';
  let customerFilter = '';
  let sortBy = 'created_at';
  let sortOrder: 'asc' | 'desc' = 'desc';

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
      new: [],
      pickup: [],
      to_be_quoted: [],
      docket_ready: [],
      quoted: [],
      repaired: [],
      return: [],
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

  function handleWorkshopDragStart(event: CustomEvent<{ workshop: WorkshopRecord; event: DragEvent }>) {
    draggedWorkshopId = event.detail.workshop.id;
    console.log('Started dragging workshop:', draggedWorkshopId);
  }

  function handleWorkshopDragEnd() {
    draggedWorkshopId = null;
    console.log('Finished dragging workshop');
  }

  async function handleWorkshopDrop(event: CustomEvent<{ workshopId: string; newStatus: string }>) {
    const { workshopId, newStatus } = event.detail;

    // Immediately update local state for smooth UI
    const workshopIndex = workshops.findIndex(w => w.id === workshopId);
    if (workshopIndex !== -1) {
      workshops[workshopIndex] = { ...workshops[workshopIndex], status: newStatus as WorkshopRecord['status'] };
      workshops = [...workshops]; // Trigger reactivity
      applyFilters(); // Update filtered workshops
    }

    const workshop = workshops.find(w => w.id === workshopId);

    try {
      // Update the workshop status in the backend
      await updateWorkshopStatus(workshopId, newStatus as WorkshopRecord['status']);

      // Show success message
      if (workshop) {
        toastSuccess(
          `Workshop "${workshop.customer_name}" moved to ${newStatus.replace('_', ' ').toUpperCase()}`,
          'Status Updated'
        );
      }

      console.log('Workshop status updated:', workshopId, '->', newStatus);
    } catch (err) {
      console.error('Error updating workshop status:', err);
      error = 'Failed to update workshop status';

      // Revert the local change on error
      if (workshopIndex !== -1 && workshop?.status) {
        workshops[workshopIndex] = { ...workshops[workshopIndex], status: workshop.status };
        workshops = [...workshops];
        applyFilters();
      }
    } finally {
      // Reset drag state
      draggedWorkshopId = null;
    }

    // Highlight the moved workshop for visual feedback
    if (workshopId) {
      recentlyMovedWorkshopId = workshopId;
      // Clear the highlight after 2 seconds
      setTimeout(() => {
        recentlyMovedWorkshopId = null;
      }, 2000);
    }
  }

  function handleWorkshopClick(workshop: WorkshopRecord) {
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
</script>

<svelte:head>
  <title>Workshop Board - RapidTools</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 mb-2">Workshop Board</h1>
          <p class="text-gray-600">Kanban-style workshop job management</p>
        </div>
        <!-- Action Buttons -->
        <div class="flex items-center gap-3">
          <a
            href="/workshop/create"
            class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Create Workshop
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
              status="new"
              title="New"
              workshops={workshopsByStatus.new}
              {loadedPhotos}
              {failedPhotos}
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
            />

            <StatusColumn
              status="pickup"
              title="Pickup"
              workshops={workshopsByStatus.pickup}
              {loadedPhotos}
              {failedPhotos}
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
            />

            <StatusColumn
              status="to_be_quoted"
              title="To be Quoted"
              workshops={workshopsByStatus.to_be_quoted}
              {loadedPhotos}
              {failedPhotos}
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
            />

            <StatusColumn
              status="docket_ready"
              title="Docket Ready"
              workshops={workshopsByStatus.docket_ready}
              {loadedPhotos}
              {failedPhotos}
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
            />

            <StatusColumn
              status="quoted"
              title="Quoted"
              workshops={workshopsByStatus.quoted}
              {loadedPhotos}
              {failedPhotos}
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
            />

            <StatusColumn
              status="waiting_approval_po"
              title="WAITING APPROVAL PO"
              workshops={workshopsByStatus.waiting_approval_po}
              {loadedPhotos}
              {failedPhotos}
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
            />

            <StatusColumn
              status="waiting_for_parts"
              title="Waiting for Parts"
              workshops={workshopsByStatus.waiting_for_parts}
              {loadedPhotos}
              {failedPhotos}
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
            />

            <StatusColumn
              status="booked_in_for_repair_service"
              title="BOOKED IN FOR REPAIR/ SERVICE"
              workshops={workshopsByStatus.booked_in_for_repair_service}
              {loadedPhotos}
              {failedPhotos}
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
            />

            <StatusColumn
              status="repaired"
              title="Repaired"
              workshops={workshopsByStatus.repaired}
              {loadedPhotos}
              {failedPhotos}
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
            />

            <StatusColumn
              status="return"
              title="Return"
              workshops={workshopsByStatus.return}
              {loadedPhotos}
              {failedPhotos}
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
            />

            <StatusColumn
              status="pending_jobs"
              title="PENDING JOBS"
              workshops={workshopsByStatus.pending_jobs}
              {loadedPhotos}
              {failedPhotos}
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
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

  /* Scroll container snap behavior */
  .scroll-snap-x-mandatory {
    scroll-snap-type: x mandatory;
  }

  /* Smooth drag and drop transitions */
  .workshop-card {
    transition: transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
  }

  .workshop-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .workshop-card.dragging {
    opacity: 0.5;
    transform: rotate(2deg) scale(0.98);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
    z-index: 1000;
  }

  .status-column.drop-target {
    background-color: rgba(59, 130, 246, 0.05);
    border-color: rgba(59, 130, 246, 0.2);
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  .status-column.drop-target .column-header {
    background-color: rgba(59, 130, 246, 0.1);
  }

  /* Smooth transitions for status changes */
  .status-transition {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
