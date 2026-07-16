<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import {
    getDeliveryTrackingList,
    confirmDeliveryTransport,
    type DeliveryTrackingRow
  } from '$lib/services/workshop';
  import { toastError, toastSuccess } from '$lib/utils/toast';
  import PhotoViewer from '$lib/components/PhotoViewer.svelte';

  type TrackingFilter = 'pending' | 'done' | 'all';
  type ColumnVariant = 'pickup' | 'return';

  const trackingChips: { key: TrackingFilter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'done', label: 'Done' },
    { key: 'all', label: 'All' }
  ];

  let rows = $state.raw<DeliveryTrackingRow[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchTerm = $state('');
  let trackingFilter = $state<TrackingFilter>('pending');
  let confirmingId = $state<string | null>(null);
  let activeTab = $state<ColumnVariant>('pickup');

  let showPhotoViewer = $state(false);
  let currentPhotoIndex = $state(0);
  let currentPhotoUrls = $state.raw<string[]>([]);

  let pendingCount = $derived(rows.filter((r) => r.is_pending).length);

  let filteredRows = $derived(
    rows.filter((row) => {
      if (trackingFilter === 'pending' && !row.is_pending) return false;
      if (trackingFilter === 'done' && row.is_pending) return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.trim().toLowerCase();
      const w = row.workshop;
      return (
        w.customer_name?.toLowerCase().includes(q) ||
        w.product_name?.toLowerCase().includes(q) ||
        w.order_id?.toLowerCase().includes(q) ||
        w.site_location?.toLowerCase().includes(q) ||
        w.make_model?.toLowerCase().includes(q) ||
        row.assigned_to_name?.toLowerCase().includes(q)
      );
    })
  );

  let pickupRows = $derived(filteredRows.filter((row) => row.job_status !== 'return'));
  let returnRows = $derived(filteredRows.filter((row) => row.job_status === 'return'));

  async function loadDeliveries() {
    try {
      loading = true;
      error = null;
      rows = await getDeliveryTrackingList();
    } catch (err) {
      console.error('Error loading deliveries:', err);
      error = err instanceof Error ? err.message : 'Failed to load deliveries';
      toastError(error);
      rows = [];
    } finally {
      loading = false;
    }
  }

  function formatSchedule(iso: string | null): string {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function trackingLabel(row: DeliveryTrackingRow): string {
    if (row.is_pending) return 'Pending';
    return row.job_status === 'return' ? 'Returned' : 'Delivered';
  }

  function confirmLabel(row: DeliveryTrackingRow): string {
    return row.job_status === 'return' ? 'Mark returned' : 'Mark delivered';
  }

  function openWorkshop(row: DeliveryTrackingRow) {
    goto(`${base}/workshop/form?workshop_id=${row.workshop.id}`);
  }

  function openPhotoViewer(photoUrls: string[], photoIndex: number, event: MouseEvent) {
    event.stopPropagation();
    if (!photoUrls.length) return;
    currentPhotoUrls = photoUrls;
    currentPhotoIndex = photoIndex;
    showPhotoViewer = true;
  }

  function closePhotoViewer() {
    showPhotoViewer = false;
    currentPhotoUrls = [];
    currentPhotoIndex = 0;
  }

  async function handleConfirm(row: DeliveryTrackingRow, event: MouseEvent) {
    event.stopPropagation();
    if (confirmingId || !row.is_pending) return;

    const previous = { ...row };
    confirmingId = row.workshop.id;

    rows = rows.map((r) =>
      r.workshop.id === row.workshop.id
        ? {
            ...r,
            transport_status: 'confirmed',
            is_pending: false
          }
        : r
    );

    try {
      const transport = await confirmDeliveryTransport(row.workshop.id, row.job_status);
      rows = rows.map((r) =>
        r.workshop.id === row.workshop.id
          ? {
              ...r,
              transport_id: transport.id,
              transport_status: 'confirmed',
              assigned_to_name: transport.assigned_to_name ?? r.assigned_to_name,
              schedule: transport.schedule ?? r.schedule,
              is_pending: false
            }
          : r
      );
      toastSuccess(
        row.job_status === 'return' ? 'Marked as returned' : 'Marked as delivered',
        'Delivery updated'
      );
    } catch (err) {
      console.error('Failed to confirm delivery:', err);
      rows = rows.map((r) => (r.workshop.id === previous.workshop.id ? previous : r));
      toastError('Failed to update delivery. Please try again.');
    } finally {
      confirmingId = null;
    }
  }
  onMount(() => {
    loadDeliveries();
  });
</script>

{#snippet cardList(
  columnRows: DeliveryTrackingRow[],
  emptyMessage: string,
  variant: ColumnVariant
)}
  {#if columnRows.length === 0}
    <div
      class="rounded-xl border border-dashed py-12 text-center text-sm
        {variant === 'return'
        ? 'border-violet-200 bg-violet-50/50 text-violet-600'
        : 'border-sky-200 bg-sky-50/50 text-sky-600'}"
    >
      {emptyMessage}
    </div>
  {:else}
    <ul class="space-y-4">
      {#each columnRows as row (row.workshop.id)}
        {@const photos = row.workshop.photo_urls ?? []}
        {@const heroPhoto = photos[0]}
        {@const extraPhotos = photos.slice(1, 4)}
        <li>
          <div
            class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md active:scale-[0.99] transition-transform"
            role="button"
            tabindex="0"
            onclick={() => openWorkshop(row)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openWorkshop(row);
              }
            }}
          >
            <!-- Hero image -->
            <div class="relative aspect-[4/3] bg-gray-100">
              {#if heroPhoto}
                <button
                  type="button"
                  class="absolute inset-0 block h-full w-full cursor-pointer border-0 bg-transparent p-0"
                  onclick={(e) => openPhotoViewer(photos, 0, e)}
                  aria-label="View photo 1 of {photos.length}"
                >
                  <img src={heroPhoto} alt="" class="h-full w-full object-cover" />
                </button>
                {#if photos.length > 1}
                  <span
                    class="pointer-events-none absolute right-2 top-2 rounded-md bg-black/65 px-2 py-1 text-xs font-semibold text-white"
                  >
                    {photos.length} photos
                  </span>
                {/if}
              {:else}
                <div class="flex h-full w-full items-center justify-center bg-gray-100">
                  <span class="text-sm font-medium text-gray-400">No photo</span>
                </div>
              {/if}
            </div>

            <!-- Secondary thumbs -->
            {#if extraPhotos.length > 0}
              <div class="flex gap-2 overflow-x-auto border-b border-gray-100 bg-gray-50 px-3 py-2.5">
                {#each extraPhotos as photoUrl, index (photoUrl)}
                  <button
                    type="button"
                    class="h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border-0 bg-transparent p-0 ring-1 ring-gray-200"
                    onclick={(e) => openPhotoViewer(photos, index + 1, e)}
                    aria-label="View photo {index + 2} of {photos.length}"
                  >
                    <img src={photoUrl} alt="" class="h-full w-full object-cover" />
                  </button>
                {/each}
                {#if photos.length > 4}
                  <button
                    type="button"
                    class="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-sm font-semibold text-gray-700"
                    onclick={(e) => openPhotoViewer(photos, 4, e)}
                    aria-label="View {photos.length - 4} more photos"
                  >
                    +{photos.length - 4}
                  </button>
                {/if}
              </div>
            {/if}

            <!-- Card body -->
            <div class="p-4">
              <span
                class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold
                  {row.is_pending ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}"
              >
                {trackingLabel(row)}
              </span>

              <p class="mt-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                {row.workshop.order_id || 'No order ID'}
              </p>
              <h2 class="mt-0.5 text-lg font-semibold leading-snug text-gray-900">
                {row.workshop.customer_name || 'Unknown customer'}
              </h2>
              <p class="mt-1 text-sm text-gray-700">
                {row.workshop.product_name || '—'}
                {#if row.workshop.make_model}
                  <span class="text-gray-500">· {row.workshop.make_model}</span>
                {/if}
              </p>

              <dl class="mt-3 grid grid-cols-1 gap-1.5 text-sm">
                <div class="flex gap-2">
                  <dt class="w-20 shrink-0 text-gray-500">Site</dt>
                  <dd class="min-w-0 break-words text-gray-800">
                    {row.workshop.site_location || '—'}
                  </dd>
                </div>
                <div class="flex gap-2">
                  <dt class="w-20 shrink-0 text-gray-500">Assigned</dt>
                  <dd class="min-w-0 break-words text-gray-800">{row.assigned_to_name || '—'}</dd>
                </div>
                <div class="flex gap-2">
                  <dt class="w-20 shrink-0 text-gray-500">Schedule</dt>
                  <dd class="min-w-0 text-gray-800">{formatSchedule(row.schedule)}</dd>
                </div>
              </dl>

              {#if row.is_pending}
                <button
                  type="button"
                  class="mt-4 w-full rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-60
                    {variant === 'return'
                    ? 'bg-violet-600 hover:bg-violet-700'
                    : 'bg-green-600 hover:bg-green-700'}"
                  disabled={confirmingId === row.workshop.id}
                  onclick={(e) => handleConfirm(row, e)}
                >
                  {confirmingId === row.workshop.id ? 'Updating…' : confirmLabel(row)}
                </button>
              {/if}
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<svelte:head>
  <title>Deliveries - RapidTools</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-gray-50">
  <header class="sticky top-0 z-20 border-b border-gray-200 bg-white shadow-sm">
    <div class="px-4 pb-3 pt-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Deliveries</h1>
          <p class="mt-0.5 text-sm text-gray-500">
            {pendingCount} pending · {rows.length} total
          </p>
        </div>
        <button
          type="button"
          class="inline-flex shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          onclick={loadDeliveries}
          disabled={loading}
          aria-label="Refresh deliveries"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div class="mt-3">
        <label class="sr-only" for="delivery-search">Search</label>
        <input
          id="delivery-search"
          type="search"
          bind:value={searchTerm}
          placeholder="Search customer, product, order, site…"
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        {#each trackingChips as chip (chip.key)}
          <button
            type="button"
            class="rounded-full px-3 py-1.5 text-sm font-medium transition
              {trackingFilter === chip.key
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
            onclick={() => (trackingFilter = chip.key)}
          >
            {chip.label}
          </button>
        {/each}
      </div>
    </div>
  </header>

  <main class="flex-1 px-4 py-4 pb-8">
    {#if loading && rows.length === 0}
      <div class="py-16 text-center text-sm text-gray-500">Loading deliveries…</div>
    {:else if error && rows.length === 0}
      <div class="py-16 text-center">
        <p class="mb-3 text-sm text-red-600">{error}</p>
        <button
          type="button"
          class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          onclick={loadDeliveries}
        >
          Try again
        </button>
      </div>
    {:else}
      <!-- Mobile tab switcher -->
      <div class="mb-4 grid grid-cols-2 gap-2 md:hidden">
        <button
          type="button"
          class="rounded-lg px-3 py-2.5 text-sm font-semibold transition
            {activeTab === 'pickup'
            ? 'bg-sky-600 text-white shadow-sm'
            : 'border border-sky-200 bg-sky-50 text-sky-800'}"
          onclick={() => (activeTab = 'pickup')}
        >
          Delivery ({pickupRows.length})
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-2.5 text-sm font-semibold transition
            {activeTab === 'return'
            ? 'bg-violet-600 text-white shadow-sm'
            : 'border border-violet-200 bg-violet-50 text-violet-800'}"
          onclick={() => (activeTab = 'return')}
        >
          Return ({returnRows.length})
        </button>
      </div>

      <!-- Mobile: single active column -->
      <div class="md:hidden">
        {#if activeTab === 'pickup'}
          <section class="overflow-hidden rounded-2xl border border-sky-200 bg-sky-50">
            <div class="bg-sky-600 px-4 py-3">
              <h2 class="text-sm font-semibold text-white">
                Delivery
                <span class="ml-1 font-normal text-sky-100">({pickupRows.length})</span>
              </h2>
            </div>
            <div class="p-3">
              {@render cardList(pickupRows, 'No pickups', 'pickup')}
            </div>
          </section>
        {:else}
          <section class="overflow-hidden rounded-2xl border border-violet-200 bg-violet-50">
            <div class="bg-violet-600 px-4 py-3">
              <h2 class="text-sm font-semibold text-white">
                Return
                <span class="ml-1 font-normal text-violet-100">({returnRows.length})</span>
              </h2>
            </div>
            <div class="p-3">
              {@render cardList(returnRows, 'No returns', 'return')}
            </div>
          </section>
        {/if}
      </div>

      <!-- Desktop: two side-by-side panels -->
      <div class="hidden items-start gap-4 md:grid md:grid-cols-2">
        <section class="min-w-0 overflow-hidden rounded-2xl border border-sky-200 bg-sky-50">
          <div class="sticky top-[8.5rem] z-10 bg-sky-600 px-4 py-3">
            <h2 class="text-sm font-semibold text-white">
              Delivery
              <span class="ml-1 font-normal text-sky-100">({pickupRows.length})</span>
            </h2>
          </div>
          <div class="p-3">
            {@render cardList(pickupRows, 'No pickups', 'pickup')}
          </div>
        </section>

        <section class="min-w-0 overflow-hidden rounded-2xl border border-violet-200 bg-violet-50">
          <div class="sticky top-[8.5rem] z-10 bg-violet-600 px-4 py-3">
            <h2 class="text-sm font-semibold text-white">
              Return
              <span class="ml-1 font-normal text-violet-100">({returnRows.length})</span>
            </h2>
          </div>
          <div class="p-3">
            {@render cardList(returnRows, 'No returns', 'return')}
          </div>
        </section>
      </div>
    {/if}
  </main>
</div>

<PhotoViewer
  {showPhotoViewer}
  photoUrls={currentPhotoUrls}
  {currentPhotoIndex}
  on:close={closePhotoViewer}
  on:photoIndexChanged={({ detail }) => (currentPhotoIndex = detail.index)}
/>
