<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { getWorkshops, deleteWorkshop as deleteWorkshopService, updateWorkshopStatus, getWorkshop, updateWorkshop, type WorkshopRecord } from '$lib/services/workshop';
  import { toastSuccess } from '$lib/utils/toast';
  import { currentUser } from '$lib/firebase';
  import { userProfile } from '$lib/userProfile';
  import { get } from 'svelte/store';

  // Import components
  import PhotoViewer from '$lib/components/PhotoViewer.svelte';
  import DeleteConfirmationModal from '$lib/components/DeleteConfirmationModal.svelte';
  import WorkshopCard from '$lib/components/WorkshopCard.svelte';
  import StatusColumn from '$lib/components/StatusColumn.svelte';

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


  // Drag states
  let draggedWorkshopId: string | null = null;
  let recentlyMovedWorkshopId: string | null = null;

  // Filter states
  let searchFilter = '';

  async function loadWorkshops() {
    try {
      loading = true;
      error = null;
      workshops = await getWorkshops();
      applyFilters();
    } catch (err) {
      console.error('[LOAD_ERROR] Failed to load workshops:', err);
      error = err instanceof Error ? err.message : 'Failed to load workshops';
    } finally {
      loading = false;
    }
  }

  function applyFilters() {
    console.log('[APPLY_FILTERS] Starting applyFilters. Current filters:', { searchFilter });
    console.log('[APPLY_FILTERS] Workshops array length:', workshops.length);

    let filtered = [...workshops];
    console.log('[APPLY_FILTERS] After copying workshops:', filtered.length);

    // Apply combined search filter (customer name, order ID, work order)
    if (searchFilter) {
      const beforeSearch = filtered.length;
      const searchTerm = searchFilter.toLowerCase();
      filtered = filtered.filter(workshop => {
        const customerMatch = workshop.customer_name?.toLowerCase().includes(searchTerm);
        const orderIdMatch = workshop.order_id?.toLowerCase().includes(searchTerm);
        const workOrderMatch = workshop.clients_work_order?.toLowerCase().includes(searchTerm);
        return customerMatch || orderIdMatch || workOrderMatch;
      });
      console.log('[APPLY_FILTERS] Search filter applied:', searchFilter, 'Before:', beforeSearch, 'After:', filtered.length);
    }

    console.log('[APPLY_FILTERS] Filtered length:', filtered.length);
    filteredWorkshops = filtered;
    console.log('[APPLY_FILTERS] Assigned to filteredWorkshops, new length:', filteredWorkshops.length);
  }

  function getWorkshopsByStatus() {
    const grouped: { [key: string]: WorkshopRecord[] } = {
      new: [],
      pickup: [],
      to_be_quoted: [],
      docket_ready: [],
      quoted: [],
      repaired: [],
      pickup_from_workshop: [],
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



  // Debug function to test image URLs (callable from browser console)
  function testImageUrl(url: string) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        console.log('[IMAGE_TEST] ✅ Image loaded successfully:', url, 'Dimensions:', img.naturalWidth, 'x', img.naturalHeight);
        resolve({ success: true, width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = (error) => {
        console.error('[IMAGE_TEST] ❌ Image failed to load:', url, 'Error:', error);
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
      // Workshop deleted successfully
    } catch (err) {
      console.error('[DELETE_ERROR] Failed to delete workshop:', workshopId, 'Error:', err);
      error = 'Failed to delete workshop';
    } finally {
      isDeletingWorkshop = false;
    }
  }

  function handleWorkshopDragStart(event: CustomEvent<{ workshop: WorkshopRecord; event: DragEvent }>) {
    draggedWorkshopId = event.detail.workshop.id;
    console.log('[DRAG_START] Workshop ID:', draggedWorkshopId, 'Status:', event.detail.workshop.status, 'Timestamp:', Date.now());
  }

  function handleWorkshopDragEnd() {
    console.log('[DRAG_END] Workshop ID:', draggedWorkshopId, 'Timestamp:', Date.now());
    draggedWorkshopId = null;
  }

  async function handleWorkshopCompleted(event: CustomEvent<{ workshop: WorkshopRecord }>) {
    const { workshop } = event.detail;
    const workshopId = workshop.id;
    const newStatus = 'completed';

    console.log('[WORKSHOP_COMPLETED] Starting completion for workshop:', workshopId, 'Current status:', workshop.status);

    // Immediately update local state for smooth UI
    const workshopIndex = workshops.findIndex(w => w.id === workshopId);
    console.log('[LOCAL_UPDATE_COMPLETED] Workshop found at index:', workshopIndex);

    if (workshopIndex !== -1) {
      const oldStatus = workshops[workshopIndex].status;
      console.log('[LOCAL_UPDATE_COMPLETED] Old workshop object:', { id: workshops[workshopIndex].id, status: oldStatus });

      // Create a completely new workshops array to ensure proper reactivity
      const updatedWorkshops = workshops.map((w, index) =>
        index === workshopIndex
          ? { ...w, status: newStatus as WorkshopRecord['status'] }
          : w
      );

      console.log('[LOCAL_UPDATE_COMPLETED] Created new workshops array, updating workshop:', updatedWorkshops[workshopIndex].id, 'status to:', updatedWorkshops[workshopIndex].status);

      // Force reactivity by assigning the new array
      workshops = updatedWorkshops;
      console.log('[LOCAL_UPDATE_COMPLETED] Workshops array assigned, length:', workshops.length);

      // Ensure UI has a chance to update before continuing
      await tick();
      console.log('[LOCAL_UPDATE_COMPLETED] Tick completed, UI should be updated');

      console.log('[LOCAL_UPDATE_COMPLETED] Status changed from', oldStatus, 'to', newStatus);
    }

    const currentWorkshop = workshops.find(w => w.id === workshopId);
    console.log('[BACKEND_UPDATE_COMPLETED] Starting backend update for workshop:', workshopId);

    try {
      // Get the current workshop data to update history
      if (!currentWorkshop) {
        throw new Error('Workshop not found for completion update');
      }

      // Create updated history with the status change
      const updatedHistory = addHistoryEntry(currentWorkshop, newStatus);

      // Update the workshop status and history in the backend
      await updateWorkshop(workshopId, {
        status: newStatus as WorkshopRecord['status'],
        history: updatedHistory
      } as any);
      console.log('[BACKEND_UPDATE_COMPLETED] Backend update successful for workshop:', workshopId, 'with history entry added');

      // Show success message
      toastSuccess(
        `Workshop "${currentWorkshop.customer_name}" marked as completed`,
        'Workshop Completed'
      );
    } catch (err) {
      console.error('[BACKEND_UPDATE_COMPLETED_ERROR] Failed to complete workshop:', workshopId, 'Error:', err);
      error = 'Failed to complete workshop';

      // Revert the local change on error
      if (workshopIndex !== -1 && workshop?.status) {
        console.log('[LOCAL_REVERT_COMPLETED] Reverting local status back to:', workshop.status);
        const revertedWorkshops = workshops.map((w, index) =>
          index === workshopIndex
            ? { ...w, status: workshop.status }
            : w
        );
        workshops = revertedWorkshops;
        await tick(); // Ensure UI updates with reverted state
      }
    }

    // Highlight the completed workshop for visual feedback
    recentlyMovedWorkshopId = workshopId;
    // Clear the highlight after 2 seconds
    setTimeout(() => {
      recentlyMovedWorkshopId = null;
    }, 2000);
  }

  async function handleWorkshopDrop(event: CustomEvent<{ workshopId: string; newStatus: string }>) {
    const { workshopId, newStatus } = event.detail;
    console.log('[DRAG_DROP] Workshop ID:', workshopId, 'New Status:', newStatus, 'Timestamp:', Date.now());

    // Immediately update local state for smooth UI
    const workshopIndex = workshops.findIndex(w => w.id === workshopId);
    console.log('[LOCAL_UPDATE] Workshop found at index:', workshopIndex);
    console.log('[LOCAL_UPDATE] Filtered workshops before:', filteredWorkshops.length, 'items');

    if (workshopIndex !== -1) {
      const oldStatus = workshops[workshopIndex].status;
      console.log('[LOCAL_UPDATE] Old workshop object:', { id: workshops[workshopIndex].id, status: oldStatus });

      // Create a completely new workshops array to ensure proper reactivity
      const updatedWorkshops = workshops.map((workshop, index) =>
        index === workshopIndex
          ? { ...workshop, status: newStatus as WorkshopRecord['status'] }
          : workshop
      );

      console.log('[LOCAL_UPDATE] Created new workshops array, updating workshop:', updatedWorkshops[workshopIndex].id, 'status to:', updatedWorkshops[workshopIndex].status);

      // Force reactivity by assigning the new array
      workshops = updatedWorkshops;
      console.log('[LOCAL_UPDATE] Workshops array assigned, length:', workshops.length);

      // Ensure UI has a chance to update before continuing
      await tick();
      console.log('[LOCAL_UPDATE] Tick completed, UI should be updated');

      // Don't call applyFilters() manually - let the reactive statement handle it
      // applyFilters(); // Update filtered workshops

      console.log('[LOCAL_UPDATE] Status changed from', oldStatus, 'to', newStatus);

      // Log the workshops grouped by status to see if the UI update is working
      const groupedAfter = getWorkshopsByStatus();
      console.log('[LOCAL_UPDATE] Workshops by status after update:', Object.keys(groupedAfter).reduce((acc, status) => {
        acc[status] = groupedAfter[status].length;
        return acc;
      }, {} as Record<string, number>));
    }

    const workshop = workshops.find(w => w.id === workshopId);
    console.log('[BACKEND_UPDATE] Starting backend update for workshop:', workshopId);

    try {
      // Get the current workshop data to update history
      const currentWorkshop = workshops.find(w => w.id === workshopId);
      if (!currentWorkshop) {
        throw new Error('Workshop not found for history update');
      }

      // Create updated history with the status change
      const updatedHistory = addHistoryEntry(currentWorkshop, newStatus);

      // Update the workshop status and history in the backend
      await updateWorkshop(workshopId, {
        status: newStatus as WorkshopRecord['status'],
        history: updatedHistory
      } as any);
      console.log('[BACKEND_UPDATE] Backend update successful for workshop:', workshopId, 'with history entry added');

      // Show success message
      if (workshop) {
        toastSuccess(
          `Workshop "${workshop.customer_name}" moved to ${newStatus.replace('_', ' ').toUpperCase()}`,
          'Status Updated'
        );
      }
    } catch (err) {
      console.error('[BACKEND_UPDATE_ERROR] Failed to update workshop status:', workshopId, 'Error:', err);
      error = 'Failed to update workshop status';

      // Revert the local change on error
      if (workshopIndex !== -1 && workshop?.status) {
        console.log('[LOCAL_REVERT] Reverting local status back to:', workshop.status);
        const revertedWorkshops = workshops.map((w, index) =>
          index === workshopIndex
            ? { ...w, status: workshop.status }
            : w
        );
        workshops = revertedWorkshops;
        await tick(); // Ensure UI updates with reverted state
        // applyFilters() will be called by the reactive statement
      }
    } finally {
      // Reset drag state
      console.log('[DRAG_RESET] Resetting drag state');
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
    goto(`${base}/workshop/create?workshop_id=${workshop.id}`);
  }

  function addHistoryEntry(workshop: WorkshopRecord, newStatus: string): Array<{
    id: string;
    timestamp: string;
    user: string;
    status: string;
    isCreation?: boolean;
  }> {
    // Get current user
    const user = get(currentUser);
    if (!user) return workshop.history || [];

    // Use profile name if available, otherwise fallback to email or display name
    const profile = get(userProfile);
    const userName = profile
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : user.displayName || user.email?.split('@')[0] || 'Unknown User';

    const historyEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: userName,
      status: newStatus,
      isCreation: false // Status change, not creation
    };

    // Add to existing history or create new array
    const existingHistory = workshop.history || [];
    return [...existingHistory, historyEntry];
  }

  onMount(() => {
    console.log('[WORKSHOP_BOARD_INIT] Initializing workshop board, Timestamp:', Date.now());
    loadWorkshops();
  });

  // Reactive statements for filters - trigger on any workshops change
  $: workshops, (() => {
    if (workshops.length > 0) {
      console.log('[REACTIVE] Workshops array changed, triggering applyFilters. Length:', workshops.length);
      applyFilters();
    }
  })();

  // Log when filteredWorkshops changes
  $: console.log('[REACTIVE] filteredWorkshops changed. Length:', filteredWorkshops.length, 'Timestamp:', Date.now());

  // Computed property for workshops grouped by status - MUST be reactive for production builds
  $: workshopsByStatus = {
    new: filteredWorkshops.filter(w => w.status === 'new'),
    pickup: filteredWorkshops.filter(w => w.status === 'pickup'),
    to_be_quoted: filteredWorkshops.filter(w => w.status === 'to_be_quoted'),
    docket_ready: filteredWorkshops.filter(w => w.status === 'docket_ready'),
    quoted: filteredWorkshops.filter(w => w.status === 'quoted'),
    repaired: filteredWorkshops.filter(w => w.status === 'repaired'),
    pickup_from_workshop: filteredWorkshops.filter(w => w.status === 'pickup_from_workshop'),
    return: filteredWorkshops.filter(w => w.status === 'return'),
    waiting_approval_po: filteredWorkshops.filter(w => w.status === 'waiting_approval_po'),
    waiting_for_parts: filteredWorkshops.filter(w => w.status === 'waiting_for_parts'),
    booked_in_for_repair_service: filteredWorkshops.filter(w => w.status === 'booked_in_for_repair_service'),
    pending_jobs: filteredWorkshops.filter(w => w.status === 'pending_jobs')
  };

  $: console.log('[REACTIVE] workshopsByStatus computed. Column counts:', {
    new: workshopsByStatus.new.length,
    pickup: workshopsByStatus.pickup.length,
    to_be_quoted: workshopsByStatus.to_be_quoted.length,
    docket_ready: workshopsByStatus.docket_ready.length,
    quoted: workshopsByStatus.quoted.length,
    repaired: workshopsByStatus.repaired.length,
    pickup_from_workshop: workshopsByStatus.pickup_from_workshop.length,
    return: workshopsByStatus.return.length,
    waiting_approval_po: workshopsByStatus.waiting_approval_po.length,
    waiting_for_parts: workshopsByStatus.waiting_for_parts.length,
    booked_in_for_repair_service: workshopsByStatus.booked_in_for_repair_service.length,
    pending_jobs: workshopsByStatus.pending_jobs.length
  });

  // Computed property for completed jobs count
  $: completedJobsCount = workshops.filter(workshop => workshop.status === 'completed').length;

  // Computed property for scrapped jobs count
  $: scrappedJobsCount = workshops.filter(workshop => workshop.status === 'to_be_scrapped').length;

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
            href="{base}/workshop/create"
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

    <!-- Search Filter -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div class="max-w-md">
          <label for="search-filter" class="block text-sm font-medium text-gray-700 mb-1">Search Workshops</label>
          <input
            id="search-filter"
            type="text"
            bind:value={searchFilter}
            on:input={applyFilters}
            placeholder="Search customer, order ID, work order..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          />
        </div>
        <div class="flex items-center gap-3">
          <a
            href="{base}/workshop/completed"
            class="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Completed Jobs ({completedJobsCount})
          </a>
          <a
            href="{base}/workshop/scrapped"
            class="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            To Be Scrapped ({scrappedJobsCount})
          </a>
        </div>
      </div>
    </div>

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
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
              on:completed={handleWorkshopCompleted}
            />

            <StatusColumn
              status="pickup_from_workshop"
              title="Workshop Pickup"
              workshops={workshopsByStatus.pickup_from_workshop}
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
              on:completed={handleWorkshopCompleted}
            />

            <StatusColumn
              status="return"
              title="Return"
              workshops={workshopsByStatus.return}
              {draggedWorkshopId}
              {recentlyMovedWorkshopId}
              on:click={({ detail }) => handleWorkshopClick(detail.workshop)}
              on:photoClick={({ detail }) => openPhotoViewer(detail.workshop, detail.photoIndex)}
              on:deleteClick={({ detail }) => openDeleteModal(detail.workshop)}
              on:dragstart={handleWorkshopDragStart}
              on:drop={handleWorkshopDrop}
              on:completed={handleWorkshopCompleted}
            />

            <StatusColumn
              status="pending_jobs"
              title="PENDING JOBS"
              workshops={workshopsByStatus.pending_jobs}
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
