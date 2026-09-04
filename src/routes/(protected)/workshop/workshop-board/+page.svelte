<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { deleteWorkshop as deleteWorkshopService, getWorkshops, getTechSchedulesByWorkshopIds, notifyAssignTechToTeams, notifyCompletedToTeams, notifyPickupToTeams, updateWorkshop, upsertWorkshopTransport, assignWorkshopTech, type WorkshopRecord } from '$lib/services/workshop';
  import { toastError, toastSuccess } from '$lib/utils/toast';
  import { currentUser } from '$lib/firebase';
  import { userProfile } from '$lib/userProfile';

  import PhotoViewer from '$lib/components/PhotoViewer.svelte';
  import DeleteConfirmationModal from '$lib/components/DeleteConfirmationModal.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import StatusColumn from '$lib/components/StatusColumn.svelte';
  import PickupReturnTransportModal from './components/PickupReturnTransportModal.svelte';
  import AssignTechModal from './components/AssignTechModal.svelte';

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

  /** Minimal columns needed for board cards, search, status updates, and Teams notifications */
  const BOARD_SELECT: string[] = [
    'id',
    'status',
    'created_at',
    'created_by',
    'customer_name',
    'contact_email',
    'contact_number',
    'customer_data',
    'optional_contacts',
    'order_id',
    'clients_work_order',
    'product_name',
    'make_model',
    'serial_number',
    'photo_urls',
    'site_location',
    'location_of_machine',
    'fault_description',
    'docket_info',
    'comments',
    'history'
  ];

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

  // Pickup/Return transport modal state (assign person + schedule before notifying)
  let showPickupReturnModal = false;
  let workshopForTransport: WorkshopRecord | null = null;
  let nextStatusForTransport: 'pickup' | 'return' | null = null;
  let pickupReturnSubmitting = false;

  // Assign Tech modal state
  let showAssignTechModal = false;
  let workshopForAssignTech: WorkshopRecord | null = null;
  let assignTechSubmitting = false;

  // Column status toggles modal
  let showColumnTogglesModal = false;

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
    const serialNumber = workshop.serial_number?.toLowerCase() ?? '';

    return (
      customerName.includes(term) ||
      orderId.includes(term) ||
      workOrder.includes(term) ||
      companyName.includes(term) ||
      machineMake.includes(term) ||
      machineProduct.includes(term) ||
      serialNumber.includes(term)
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
      const rows = await getWorkshops({ excludeStatuses: ['completed', 'to_be_scrapped'], select: BOARD_SELECT });
      const schedules = await getTechSchedulesByWorkshopIds(rows.map((w) => w.id));
      workshops = rows.map((w) => {
        const tech = schedules.get(w.id);
        return {
          ...w,
          assigned_tech: tech?.assigned_tech ?? null,
          assigned_tech_name: tech?.assigned_tech_name ?? null,
          tech_schedule: tech?.schedule ?? null,
          tech_job_type: tech?.job_type ?? null
        };
      });
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

  function closePickupReturnModal() {
    showPickupReturnModal = false;
    workshopForTransport = null;
    nextStatusForTransport = null;
  }

  async function handlePickupReturnConfirm(event: CustomEvent<{ assignedTo: string; assignedToName: string; schedule: string }>) {
    const workshop = workshopForTransport;
    const status = nextStatusForTransport;
    if (!workshop || !status) return;

    const { assignedTo, assignedToName, schedule } = event.detail;
    const user = $currentUser;
    const profile = $userProfile;
    const assignedByName = user
      ? (profile ? `${profile.firstName} ${profile.lastName}`.trim() : user.displayName || user.email?.split('@')[0] || 'Unknown User')
      : 'Unknown User';
    const assignedBy = user?.email ?? null;

    try {
      pickupReturnSubmitting = true;
      await upsertWorkshopTransport({
        workshopId: workshop.id,
        jobStatus: status,
        assignedTo: assignedTo || null,
        assignedToName: assignedToName || null,
        schedule: schedule || null,
        assignedBy: assignedBy ?? undefined,
        assignedByName: assignedByName || undefined
      });
      const ok = await notifyPickupToTeams(workshop, status, {
        assignedToName: assignedToName || null,
        schedule: schedule || null
      });
      closePickupReturnModal();
      if (!ok) {
        toastError('Teams notification failed. Transport was saved.');
      }
    } catch (err) {
      console.error('[WORKSHOP_BOARD] Failed to save transport or notify:', err);
      toastError('Failed to save transport. Please try again.');
    } finally {
      pickupReturnSubmitting = false;
    }
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

  function handleAssignTechClick(event: CustomEvent<{ workshop: WorkshopRecord }>) {
    workshopForAssignTech = event.detail.workshop;
    showAssignTechModal = true;
  }

  function closeAssignTechModal() {
    showAssignTechModal = false;
    workshopForAssignTech = null;
  }

  async function handleAssignTechConfirm(
    event: CustomEvent<{
      assignedTo: string;
      assignedToName: string;
      schedule: string;
      jobType: string;
      changeReason: string;
      save: boolean;
      sendNotice: boolean;
      isUpdate?: boolean;
    }>
  ) {
    const workshop = workshopForAssignTech;
    if (!workshop) return;

    const { assignedTo, assignedToName, schedule, jobType, changeReason, save, sendNotice, isUpdate } =
      event.detail;
    const user = $currentUser;
    const profile = $userProfile;
    const assignedByName = user
      ? (profile ? `${profile.firstName} ${profile.lastName}`.trim() : user.displayName || user.email?.split('@')[0] || 'Unknown User')
      : 'Unknown User';
    const assignedBy = user?.email ?? null;

    try {
      assignTechSubmitting = true;

      if (save) {
        await assignWorkshopTech(workshop.id, assignedTo || null, assignedToName || null, {
          schedule: schedule || null,
          jobType: jobType || null,
          workshopStatus: workshop.status,
          assignedBy,
          assignedByName: assignedByName || null,
          changeReason: changeReason || null
        });
        workshops = workshops.map((w) =>
          w.id === workshop.id
            ? {
                ...w,
                assigned_tech: assignedTo || null,
                assigned_tech_name: assignedToName || null,
                tech_schedule: assignedTo ? schedule || null : null,
                tech_job_type: assignedTo ? jobType || null : null
              }
            : w
        );
      }

      let teamsOk = true;
      if (sendNotice) {
        teamsOk = await notifyAssignTechToTeams(workshop, {
          assignedToName: assignedToName || null,
          schedule,
          jobType: jobType || null,
          assignedByName: assignedByName || null,
          changeReason: changeReason || null,
          isUpdate: isUpdate ?? (!!workshop.assigned_tech || !!workshop.tech_schedule)
        });
        if (!teamsOk) {
          toastError(
            save
              ? 'Teams notification failed. Technician was assigned.'
              : 'Teams notification failed. Please try again.'
          );
          if (save) closeAssignTechModal();
          return;
        }
      }

      closeAssignTechModal();
      if (save && sendNotice) {
        toastSuccess(
          assignedTo
            ? (isUpdate ? 'Technician assignment updated and Teams notice sent.' : 'Technician assigned and Teams notice sent.')
            : 'Technician assignment removed and Teams notice sent.'
        );
      } else if (save) {
        toastSuccess(
          assignedTo
            ? (isUpdate ? 'Technician assignment updated.' : 'Technician assigned successfully.')
            : 'Technician assignment removed.'
        );
      } else if (sendNotice) {
        toastSuccess('Teams notice sent.');
      }
    } catch (err) {
      console.error('[WORKSHOP_BOARD] Failed to assign tech:', err);
      toastError(
        sendNotice && !save
          ? 'Failed to send Teams notice. Please try again.'
          : 'Failed to assign technician. Please try again.'
      );
    } finally {
      assignTechSubmitting = false;
    }
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

  function formatAddress(workshop: WorkshopRecord): string {
    if (!workshop.site_location) return '';

    return ` (${workshop.site_location})`;
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
      const addressInfo = (nextStatus === 'pickup' || nextStatus === 'return') ? formatAddress(workshop) : '';
      toastSuccess(
        `Workshop "${workshop.customer_name ?? 'Unknown Customer'}"${addressInfo} moved to ${formatStatusForToast(nextStatus)}`,
        'Status Updated'
      );
      if (nextStatus === 'pickup' || nextStatus === 'return') {
        workshopForTransport = workshop;
        nextStatusForTransport = nextStatus;
        showPickupReturnModal = true;
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

<div class="min-h-screen py-6 px-2 sm:px-4 lg:px-6">
  <!-- Compact toolbar: title, search, actions -->
  <div class="bg-[#141619] rounded-xl border border-[#262a30] shadow-xl px-4 py-3 mb-3">
    <div class="flex flex-col lg:flex-row lg:items-center gap-3">
      <div class="shrink-0">
        <h1 class="text-xl font-bold text-white leading-tight">Workshop Board</h1>
      </div>

      <div class="flex-1 min-w-0 lg:max-w-md xl:max-w-lg">
        <label for="search-filter" class="sr-only">Search Workshops</label>
        <input
          id="search-filter"
          type="text"
          bind:value={searchFilter}
          placeholder="Search customer, company, machine, serial, order ID, work order..."
          class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-1.5 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors focus:outline-none"
        />
      </div>

      <div class="flex flex-wrap items-center gap-2 lg:ml-auto">
        <button
          type="button"
          onclick={() => (showColumnTogglesModal = !showColumnTogglesModal)}
          class="btn-secondary inline-flex items-center px-3 py-1.5 text-sm"
        >
          <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h10M4 18h14"
            />
          </svg>
          Columns ({visibleStatusCount}/{BOARD_STATUS_KEYS.length})
        </button>
        <a
          href="{base}/workshop/form?workshop_id="
          class="btn-primary inline-flex items-center px-3 py-1.5 text-sm"
        >
          <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Create Workshop
        </a>
        <a
          href="{base}/workshop/completed"
          class="btn-secondary inline-flex items-center px-3 py-1.5 text-sm hover:text-lime-300"
        >
          <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          Completed / Scrapped
        </a>
      </div>
    </div>
  </div>

  {#if error}
    <div class="bg-red-950/20 border border-red-500/30 rounded-lg p-3 mb-3">
      <div class="flex">
        <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="text-red-400">{error}</span>
      </div>
    </div>
  {/if}

  <!-- Board View -->
  <div class="bg-[#141619] rounded-xl border border-[#262a30] shadow-xl p-6">
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-500"></div>
        <span class="ml-2 text-gray-400">Loading workshops...</span>
      </div>
    {:else if filteredWorkshops.length === 0}
      <div class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-white">No workshops found</h3>
        <p class="mt-1 text-sm text-gray-400">
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
        <div class="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#141619] to-transparent z-10 pointer-events-none"></div>
        <div class="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#141619] to-transparent z-10 pointer-events-none"></div>

        <!-- Scrollable container with better vertical space -->
        <div
          class="flex gap-6 overflow-x-auto pb-6 px-4 scroll-smooth scrollbar-thin scroll-snap-x-mandatory"
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
                  on:assignTech={handleAssignTechClick}
                />
              {/if}
            {/each}
          </div>
        </div>
      </div>

      <!-- Summary for Board View -->
      <div class="mt-6 bg-[#181b20] px-4 py-4 rounded-lg border border-[#262a30]">
        <div class="text-sm text-gray-400">
          Showing {filteredWorkshops.length} of {activeWorkshops.length} active workshop{activeWorkshops.length !== 1
            ? 's'
            : ''} across {visibleStatusCount} visible status{visibleStatusCount !== 1 ? 'es' : ''}
        </div>
      </div>
    {/if}
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

<!-- Pickup/Return transport modal: assign person + schedule, then save and notify -->
<PickupReturnTransportModal
  show={showPickupReturnModal}
  jobStatus={nextStatusForTransport ?? 'pickup'}
  submitting={pickupReturnSubmitting}
  on:confirm={handlePickupReturnConfirm}
  on:cancel={closePickupReturnModal}
/>

<!-- Assign Tech modal: list users + schedule + job type -->
<AssignTechModal
  show={showAssignTechModal}
  workshopLabel={workshopForAssignTech?.customer_name || workshopForAssignTech?.order_id || ''}
  initialAssignedTo={workshopForAssignTech?.assigned_tech || ''}
  initialAssignedToName={workshopForAssignTech?.assigned_tech_name || ''}
  initialSchedule={workshopForAssignTech?.tech_schedule || ''}
  initialJobType={workshopForAssignTech?.tech_job_type ||
    (workshopForAssignTech?.status === 'to_be_quoted' ? 'Quote' : '')}
  submitting={assignTechSubmitting}
  on:confirm={handleAssignTechConfirm}
  on:cancel={closeAssignTechModal}
/>

<!-- Column status toggles modal -->
<Modal
  show={showColumnTogglesModal}
  size="xl"
  allowClose={true}
  on:close={() => (showColumnTogglesModal = false)}
>
  <svelte:fragment slot="header">Visible Columns</svelte:fragment>
  <div slot="body" class="flex flex-wrap gap-1.5">
    <button
      type="button"
      onclick={showAllStatusColumns}
      class="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full transition-colors {showAllStatuses
        ? 'bg-lime-500/20 text-lime-400 border border-lime-500/30'
        : 'bg-[#1f2329] text-gray-400 border border-[#333842] hover:bg-[#262a30]'}"
    >
      Show All
    </button>
    <button
      type="button"
      onclick={hideAllStatusColumns}
      class="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full transition-colors bg-[#1f2329] text-gray-400 border border-[#333842] hover:bg-[#262a30]"
    >
      Hide All
    </button>

    {#each BOARD_STATUSES as status (status.key)}
      <button
        type="button"
        onclick={() => toggleStatusVisibility(status.key)}
        class="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full transition-colors {visibleStatuses[status.key]
          ? 'bg-lime-500/20 text-lime-400 border border-lime-500/30'
          : 'bg-[#1f2329] text-gray-400 border border-[#333842] hover:bg-[#262a30]'}"
      >
        {status.title} ({workshopsByStatus[status.key].length})
      </button>
    {/each}
  </div>
</Modal>

<style>
  /* Custom scrollbar styles for webkit browsers */
  .scrollbar-thin::-webkit-scrollbar {
    height: 8px;
    width: 8px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: #141619;
    border-radius: 4px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #262a30;
    border-radius: 4px;
    transition: background-color 0.2s ease;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #333842;
  }

  .scrollbar-thin::-webkit-scrollbar-corner {
    background: #141619;
  }

  /* Custom scrollbar styles for Firefox */
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: #262a30 #141619;
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
