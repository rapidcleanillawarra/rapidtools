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

  const trackingChips: { key: TrackingFilter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'done', label: 'Done' },
    { key: 'all', label: 'All' }
  ];

  let rows = $state<DeliveryTrackingRow[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchTerm = $state('');
  let trackingFilter = $state<TrackingFilter>('pending');
  let confirmingId = $state<string | null>(null);

  let showPhotoViewer = $state(false);
  let currentPhotoIndex = $state(0);
  let currentPhotoUrls = $state<string[]>([]);

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

{#snippet cardList(columnRows: DeliveryTrackingRow[], emptyMessage: string)}
  {#if columnRows.length === 0}
    <div class="py-10 text-center text-gray-500 text-sm">{emptyMessage}</div>
  {:else}
    <ul class="space-y-3">
      {#each columnRows as row (row.workshop.id)}
        <li>
          <div
            class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm active:bg-gray-50"
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
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span
                class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold
                  {row.job_status === 'return'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-sky-100 text-sky-800'}"
              >
                {row.job_status === 'return' ? 'Return' : 'Pickup'}
              </span>
              <span
                class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold
                  {row.is_pending ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}"
              >
                {trackingLabel(row)}
              </span>
            </div>

            <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {row.workshop.order_id || 'No order ID'}
            </p>
            <h2 class="mt-0.5 text-base font-semibold text-gray-900 leading-snug">
              {row.workshop.customer_name || 'Unknown customer'}
            </h2>
            <p class="mt-1 text-sm text-gray-700">
              {row.workshop.product_name || '—'}
              {#if row.workshop.make_model}
                <span class="text-gray-500">· {row.workshop.make_model}</span>
              {/if}
            </p>

            {#if row.workshop.photo_urls?.length}
              <div class="mt-2 flex items-center gap-1.5">
                {#each row.workshop.photo_urls.slice(0, 3) as photoUrl, index (photoUrl)}
                  <button
                    type="button"
                    class="h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-md border-0 bg-transparent p-0"
                    onclick={(e) => openPhotoViewer(row.workshop.photo_urls, index, e)}
                    aria-label="View photo {index + 1} of {row.workshop.photo_urls.length}"
                  >
                    <img src={photoUrl} alt="" class="h-full w-full rounded-md object-cover" />
                  </button>
                {/each}
                {#if row.workshop.photo_urls.length > 3}
                  <button
                    type="button"
                    class="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-medium text-gray-600"
                    onclick={(e) => openPhotoViewer(row.workshop.photo_urls, 3, e)}
                    aria-label="View {row.workshop.photo_urls.length - 3} more photos"
                  >
                    +{row.workshop.photo_urls.length - 3}
                  </button>
                {/if}
              </div>
            {/if}

            <dl class="mt-3 grid grid-cols-1 gap-1.5 text-sm">
              <div class="flex gap-2">
                <dt class="shrink-0 text-gray-500 w-20">Site</dt>
                <dd class="text-gray-800 min-w-0 break-words">{row.workshop.site_location || '—'}</dd>
              </div>
              <div class="flex gap-2">
                <dt class="shrink-0 text-gray-500 w-20">Assigned</dt>
                <dd class="text-gray-800 min-w-0 break-words">{row.assigned_to_name || '—'}</dd>
              </div>
              <div class="flex gap-2">
                <dt class="shrink-0 text-gray-500 w-20">Schedule</dt>
                <dd class="text-gray-800 min-w-0">{formatSchedule(row.schedule)}</dd>
              </div>
            </dl>

            {#if row.is_pending}
              <button
                type="button"
                class="mt-4 w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                disabled={confirmingId === row.workshop.id}
                onclick={(e) => handleConfirm(row, e)}
              >
                {confirmingId === row.workshop.id ? 'Updating…' : confirmLabel(row)}
              </button>
            {/if}
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

<div class="min-h-screen bg-gray-50 flex flex-col">
  <header class="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
    <div class="px-4 pt-4 pb-3">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Deliveries</h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {pendingCount} pending · {rows.length} total
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
      <div class="py-16 text-center text-gray-500 text-sm">Loading deliveries…</div>
    {:else if error && rows.length === 0}
      <div class="py-16 text-center">
        <p class="text-red-600 text-sm mb-3">{error}</p>
        <button
          type="button"
          class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          onclick={loadDeliveries}
        >
          Try again
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-2 gap-4 items-start">
        <section class="min-w-0">
          <div
            class="sticky top-[8.5rem] z-10 -mx-1 mb-3 border-b border-gray-200 bg-gray-50/95 px-1 py-2 backdrop-blur-sm"
          >
            <h2 class="text-sm font-semibold text-gray-900">
              Delivery
              <span class="ml-1 font-normal text-gray-500">({pickupRows.length})</span>
            </h2>
          </div>
          {@render cardList(pickupRows, 'No pickups')}
        </section>

        <section class="min-w-0">
          <div
            class="sticky top-[8.5rem] z-10 -mx-1 mb-3 border-b border-gray-200 bg-gray-50/95 px-1 py-2 backdrop-blur-sm"
          >
            <h2 class="text-sm font-semibold text-gray-900">
              Return
              <span class="ml-1 font-normal text-gray-500">({returnRows.length})</span>
            </h2>
          </div>
          {@render cardList(returnRows, 'No returns')}
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
