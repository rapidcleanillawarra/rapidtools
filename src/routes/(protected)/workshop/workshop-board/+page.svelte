<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { deleteWorkshop as deleteWorkshopService, getWorkshops, notifyCompletedToTeams, notifyPickupToTeams, updateWorkshop, type WorkshopRecord } from '$lib/services/workshop';
  import { toastError, toastSuccess } from '$lib/utils/toast';
  import { currentUser } from '$lib/firebase';
  import { userProfile } from '$lib/userProfile';

  import PhotoViewer from '$lib/components/PhotoViewer.svelte';
  import DeleteConfirmationModal from '$lib/components/DeleteConfirmationModal.svelte';
  import StatusColumn from '$lib/components/StatusColumn.svelte';

  const BOARD_STATUSES = [
    { key: 'new', title: 'New' },
    { key: 'pickup', title: 'Pickup' },
    { key: 'to_be_quoted', title: 'To be Quoted' },
    { key: 'docket_ready', title: 'Docket Ready' },
    { key: 'quoted', title: 'Quoted' },
    { key: 'waiting_approval_po', title: 'Waiting Approval PO' },
    { key: 'waiting_for_parts', title: 'Waiting for Parts' },
    { key: 'booked_in_for_repair_service', title: 'Booked in for Repair/Service' },
    { key: 'repaired', title: 'Repaired' },
    { key: 'pickup_from_workshop', title: 'Workshop Pickup' },
    { key: 'return', title: 'Return' },
    { key: 'pending_jobs', title: 'PENDING JOBS' },
    { key: 'warranty_claim', title: 'WARRANTY CLAIM' }
  ] as const satisfies ReadonlyArray<{ key: WorkshopRecord['status']; title: string }>;

  type BoardStatusKey = (typeof BOARD_STATUSES)[number]['key'];

  const BOARD_STATUS_KEYS = BOARD_STATUSES.map((status) => status.key) as Array<BoardStatusKey>;
  const BOARD_STATUS_KEY_SET = new Set<WorkshopRecord['status']>(BOARD_STATUS_KEYS);

  const STATUS_VISIBILITY_KEY = 'workshop-status-visibility';

  let workshops: WorkshopRecord[] = [];
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
  let recentlyMovedTimeout: ReturnType<typeof setTimeout> | null = null;

  // Filter states
  let searchFilter = '';
  let showImages = false;

  // Status visibility states
  let visibleStatuses: Record<BoardStatusKey, boolean> = createAllStatusesVisibility(true);

  let activeWorkshops: WorkshopRecord[] = [];
  let filteredWorkshops: WorkshopRecord[] = [];
  let workshopsByStatus: Record<BoardStatusKey, WorkshopRecord[]> = createEmptyGroupedWorkshops();

  let visibleStatusCount = 0;
  let showAllStatuses = true;

  $: visibleStatusCount = Object.values(visibleStatuses).filter(Boolean).length;
  $: showAllStatuses = visibleStatusCount === BOARD_STATUS_KEYS.length;

  $: activeWorkshops = workshops;

  $: {
    const normalizedSearch = searchFilter.trim().toLowerCase();
    filteredWorkshops = normalizedSearch
      ? activeWorkshops.filter((workshop) => matchesSearch(workshop, normalizedSearch))
      : activeWorkshops;
  }

  $: workshopsByStatus = groupWorkshopsByStatus(filteredWorkshops);

  function createAllStatusesVisibility(value: boolean): Record<BoardStatusKey, boolean> {
    return BOARD_STATUS_KEYS.reduce(
      (acc, key) => {
        acc[key] = value;
        return acc;
      },
      {} as Record<BoardStatusKey, boolean>
    );
  }

  function createEmptyGroupedWorkshops(): Record<BoardStatusKey, WorkshopRecord[]> {
    return BOARD_STATUS_KEYS.reduce(
      (acc, key) => {
        acc[key] = [];
        return acc;
      },
      {} as Record<BoardStatusKey, WorkshopRecord[]>
    );
  }

  function matchesSearch(workshop: WorkshopRecord, term: string) {
    const customerName = workshop.customer_name?.toLowerCase() ?? '';
    const orderId = workshop.order_id?.toLowerCase() ?? '';
    const workOrder = workshop.clients_work_order?.toLowerCase() ?? '';
    const companyName = workshop.customer_data?.BillingAddress?.BillCompany?.toLowerCase() ?? '';
    const machineMake = workshop.make_model?.toLowerCase() ?? '';
    const machineProduct = workshop.product_name?.toLowerCase() ?? '';

    return (
      customerName.includes(term) ||
      orderId.includes(term) ||
      workOrder.includes(term) ||
      companyName.includes(term) ||
      machineMake.includes(term) ||
      machineProduct.includes(term)
    );
  }

  function groupWorkshopsByStatus(workshopsToGroup: WorkshopRecord[]): Record<BoardStatusKey, WorkshopRecord[]> {
    const grouped = createEmptyGroupedWorkshops();
    for (const workshop of workshopsToGroup) {
      if (BOARD_STATUS_KEY_SET.has(workshop.status)) {
        grouped[workshop.status as BoardStatusKey].push(workshop);
      }
    }
    return grouped;
  }

  async function loadWorkshops() {
    try {
      loading = true;
      error = null;
      workshops = await getWorkshops({ excludeStatuses: ['completed', 'to_be_scrapped'] });
    } catch (err) {
      console.error('[WORKSHOP_BOARD] Failed to load workshops:', err);
      error = err instanceof Error ? err.message : 'Failed to load workshops';
    } finally {
      loading = false;
    }
  }

  function toggleStatusVisibility(status: BoardStatusKey) {
    const next = { ...visibleStatuses, [status]: !visibleStatuses[status] };
    visibleStatuses = next;
    saveStatusVisibilityToLocalStorage(next);
  }

  function showAllStatusColumns() {
    if (showAllStatuses) return;
    const next = createAllStatusesVisibility(true);
    visibleStatuses = next;
    saveStatusVisibilityToLocalStorage(next);
  }

  function hideAllStatusColumns() {
    const next = createAllStatusesVisibility(false);
    visibleStatuses = next;
    saveStatusVisibilityToLocalStorage(next);
  }

  function saveStatusVisibilityToLocalStorage(next: Record<BoardStatusKey, boolean>) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STATUS_VISIBILITY_KEY, JSON.stringify(next));
      }
    } catch (err) {
      console.warn('[WORKSHOP_BOARD] Failed to save status visibility:', err);
    }
  }

  function loadStatusVisibilityFromLocalStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(STATUS_VISIBILITY_KEY);
        if (!saved) return;

        const parsed: unknown = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object') return;

        const next = createAllStatusesVisibility(true);
        for (const key of BOARD_STATUS_KEYS) {
          const value = (parsed as Record<string, unknown>)[key];
          if (typeof value === 'boolean') next[key] = value;
        }

        visibleStatuses = next;
      }
    } catch (err) {
      console.warn('[WORKSHOP_BOARD] Failed to load status visibility:', err);
    }
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
    if (isDeletingWorkshop) return;

    try {
      isDeletingWorkshop = true;
      await deleteWorkshopService(workshopId);
      await loadWorkshops();

      toastSuccess('Workshop has been successfully deleted.', 'Deletion Complete');
      closeDeleteModal();
    } catch (err) {
      console.error('[WORKSHOP_BOARD] Failed to delete workshop:', workshopId, 'Error:', err);
      error = 'Failed to delete workshop';
    } finally {
      isDeletingWorkshop = false;
    }
  }

  function handleWorkshopDragStart(event: CustomEvent<{ workshop: WorkshopRecord; event: DragEvent }>) {
    draggedWorkshopId = event.detail.workshop.id;
  }

  function handleCardClick(event: CustomEvent<{ workshop: WorkshopRecord }>) {
    handleWorkshopClick(event.detail.workshop);
  }

  function handleCardPhotoClick(event: CustomEvent<{ workshop: WorkshopRecord; photoIndex: number }>) {
    openPhotoViewer(event.detail.workshop, event.detail.photoIndex);
  }

  function handleCardDeleteClick(event: CustomEvent<{ workshop: WorkshopRecord }>) {
    openDeleteModal(event.detail.workshop);
  }

  function setRecentlyMovedWorkshop(workshopId: string) {
    recentlyMovedWorkshopId = workshopId;
    if (recentlyMovedTimeout) clearTimeout(recentlyMovedTimeout);
    recentlyMovedTimeout = setTimeout(() => {
      recentlyMovedWorkshopId = null;
      recentlyMovedTimeout = null;
    }, 2000);
  }

  function setWorkshopStatusLocally(workshopId: string, newStatus: WorkshopRecord['status']) {
    workshops = workshops.map((workshop) => (workshop.id === workshopId ? { ...workshop, status: newStatus } : workshop));
  }

  function formatStatusForToast(status: WorkshopRecord['status']) {
    if (status === 'completed') return 'COMPLETED';
    if (status === 'to_be_scrapped') return 'TO BE SCRAPPED';

    const config = BOARD_STATUSES.find((s) => s.key === status);
    if (config) return config.title.toUpperCase();

    return status.replace(/_/g, ' ').toUpperCase();
  }

  async function persistWorkshopStatusChange(workshop: WorkshopRecord, newStatus: WorkshopRecord['status']) {
    const updatedHistory = addHistoryEntry(workshop, newStatus);
    await updateWorkshop(workshop.id, { status: newStatus, history: updatedHistory });
  }

  async function handleWorkshopDrop(event: CustomEvent<{ workshopId: string; newStatus: string }>) {
    const { workshopId, newStatus } = event.detail;
    const workshop = workshops.find((w) => w.id === workshopId);
    if (!workshop) return;

    const previousStatus = workshop.status;
    const nextStatus = newStatus as WorkshopRecord['status'];
    if (previousStatus === nextStatus) return;

    setWorkshopStatusLocally(workshopId, nextStatus);
    setRecentlyMovedWorkshop(workshopId);

    try {
      await persistWorkshopStatusChange(workshop, nextStatus);
      toastSuccess(
        `Workshop "${workshop.customer_name ?? 'Unknown Customer'}" moved to ${formatStatusForToast(nextStatus)}`,
        'Status Updated'
      );
      if (nextStatus === 'pickup' || nextStatus === 'return') {
        notifyPickupToTeams(workshop, nextStatus).then((ok) => {
          if (!ok) {
            toastError('Teams notification failed. Status was updated.');
          }
        });
      }
    } catch (err) {
      console.error('[WORKSHOP_BOARD] Failed to update workshop status:', workshopId, 'Error:', err);
      error = 'Failed to update workshop status';
      setWorkshopStatusLocally(workshopId, previousStatus);
    } finally {
      draggedWorkshopId = null;
    }
  }

  async function handleWorkshopCompleted(event: CustomEvent<{ workshop: WorkshopRecord }>) {
    const workshopId = event.detail.workshop.id;
    const workshop = workshops.find((w) => w.id === workshopId);
    if (!workshop) return;

    const previousStatus = workshop.status;
    if (previousStatus === 'completed') return;

    setWorkshopStatusLocally(workshopId, 'completed');
    setRecentlyMovedWorkshop(workshopId);

    try {
      await persistWorkshopStatusChange(workshop, 'completed');
      toastSuccess(`Workshop "${workshop.customer_name ?? 'Unknown Customer'}" marked as completed`, 'Workshop Completed');

      const user = $currentUser;
      const profile = $userProfile;
      const triggeredBy = user
        ? (profile ? `${profile.firstName} ${profile.lastName}`.trim() : user.displayName || user.email?.split('@')[0] || 'Unknown User') || 'Unknown User'
        : 'Unknown User';
      notifyCompletedToTeams(workshop, triggeredBy).then((ok) => {
        if (!ok) toastError('Teams notification failed. Status was updated.');
      });
    } catch (err) {
      console.error('[WORKSHOP_BOARD] Failed to complete workshop:', workshopId, 'Error:', err);
      error = 'Failed to complete workshop';
      setWorkshopStatusLocally(workshopId, previousStatus);
    }
  }

  function handleWorkshopClick(workshop: WorkshopRecord) {
    goto(`${base}/workshop/form?workshop_id=${workshop.id}`);
  }

  function addHistoryEntry(
    workshop: WorkshopRecord,
    newStatus: WorkshopRecord['status']
  ): Array<{
    id: string;
    timestamp: string;
    user: string;
    status: string;
    isCreation?: boolean;
  }> {
    const user = $currentUser;
    if (!user) return Array.isArray(workshop.history) ? workshop.history : [];

    const profile = $userProfile;
    const userName = profile
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : user.displayName || user.email?.split('@')[0] || 'Unknown User';

    const historyEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: userName,
      status: newStatus,
      isCreation: false
    };

    const existingHistory = Array.isArray(workshop.history) ? workshop.history : [];
    return [...existingHistory, historyEntry];
  }

  onMount(() => {
    loadStatusVisibilityFromLocalStorage();
    loadWorkshops();
  });
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
            href="{base}/workshop/form?workshop_id="
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
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
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
            placeholder="Search customer, company, machine, order ID, work order..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          />
        </div>
        <!-- Action Buttons -->
        <div class="flex items-center gap-3">
          <a
            href="{base}/workshop/completed"
            class="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            Completed Jobs
          </a>
          <a
            href="{base}/workshop/scrapped"
            class="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            To Be Scrapped
          </a>
        </div>
      </div>
    </div>

    <!-- Status Pills -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div class="flex flex-wrap gap-2">
        <button
          on:click={showAllStatusColumns}
          class="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full transition-colors {showAllStatuses
            ? 'bg-blue-100 text-blue-800 border border-blue-200'
            : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'}"
        >
          Show All
        </button>
        <button
          on:click={hideAllStatusColumns}
          class="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full transition-colors bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
        >
          Hide All
        </button>

        {#each BOARD_STATUSES as status (status.key)}
          <button
            on:click={() => toggleStatusVisibility(status.key)}
            class="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full transition-colors {visibleStatuses[status.key]
              ? 'bg-blue-100 text-blue-800 border border-blue-200'
              : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'}"
          >
            {status.title} ({workshopsByStatus[status.key].length})
          </button>
        {/each}
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
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No workshops found</h3>
          <p class="mt-1 text-sm text-gray-500">
            {workshops.length === 0
              ? 'No workshop jobs have been created yet.'
              : activeWorkshops.length === 0
                ? 'No active workshop jobs right now.'
                : 'Try adjusting your filters.'}
          </p>
        </div>
      {:else}
        <div class="relative">
          <!-- Scroll indicator (fade effect) -->
          <div class="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
          <div class="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>

          <!-- Scrollable container with better vertical space -->
          <div
            class="flex gap-6 overflow-x-auto pb-6 px-4 scroll-smooth scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 scroll-snap-x-mandatory"
            style="scroll-behavior: smooth; scrollbar-width: thin; scroll-padding-left: 1rem; scroll-padding-right: 1rem; min-height: 600px;"
          >
            <div class="flex gap-6 min-w-max py-2">
              {#each BOARD_STATUSES as status (status.key)}
                {#if visibleStatuses[status.key]}
                  <StatusColumn
                    status={status.key}
                    title={status.title}
                    workshops={workshopsByStatus[status.key]}
                    {draggedWorkshopId}
                    {recentlyMovedWorkshopId}
                    {showImages}
                    on:click={handleCardClick}
                    on:photoClick={handleCardPhotoClick}
                    on:deleteClick={handleCardDeleteClick}
                    on:dragstart={handleWorkshopDragStart}
                    on:drop={handleWorkshopDrop}
                    on:completed={handleWorkshopCompleted}
                  />
                {/if}
              {/each}
            </div>
          </div>
        </div>

        <!-- Summary for Board View -->
        <div class="mt-6 bg-gray-50 px-4 py-4 rounded-lg border border-gray-200">
          <div class="text-sm text-gray-700">
            Showing {filteredWorkshops.length} of {activeWorkshops.length} active workshop{activeWorkshops.length !== 1
              ? 's'
              : ''} across {visibleStatusCount} visible status{visibleStatusCount !== 1 ? 'es' : ''}
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
  on:photoIndexChanged={({ detail }) => (currentPhotoIndex = detail.index)}
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
