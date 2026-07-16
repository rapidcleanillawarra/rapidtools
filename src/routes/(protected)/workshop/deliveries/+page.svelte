<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import {
    getDeliveryTrackingList,
    confirmDeliveryTransport,
    updateWorkshop,
    notifyWorkshopPickedUpToTeams,
    type DeliveryTrackingRow
  } from '$lib/services/workshop';
  import { toastError, toastSuccess } from '$lib/utils/toast';
  import PhotoViewer from '$lib/components/PhotoViewer.svelte';
  import { currentUser } from '$lib/firebase';
  import { userProfile } from '$lib/userProfile';
  import { get } from 'svelte/store';

  type TrackingFilter = 'pending' | 'done' | 'all';
  type ColumnVariant = 'pickup' | 'return';
  type SortDaysDir = 'desc' | 'asc';

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
  /** desc = most days pending first (default) */
  let sortDaysDir = $state<SortDaysDir>('desc');

  let showPhotoViewer = $state(false);
  let currentPhotoIndex = $state(0);
  let currentPhotoUrls = $state.raw<string[]>([]);

  let pendingCount = $derived(rows.filter((r) => r.is_pending).length);

  /** Days since assigned (or workshop updated/created if no transport yet) */
  function getPendingDays(row: DeliveryTrackingRow): number {
    const iso =
      row.assigned_at || row.workshop.updated_at || row.workshop.created_at || null;
    if (!iso) return 0;
    const start = new Date(iso).getTime();
    if (Number.isNaN(start)) return 0;
    const ms = Date.now() - start;
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  }

  let filteredRows = $derived.by(() => {
    const filtered = rows.filter((row) => {
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
    });

    return [...filtered].sort((a, b) => {
      const daysDiff =
        sortDaysDir === 'desc'
          ? getPendingDays(b) - getPendingDays(a)
          : getPendingDays(a) - getPendingDays(b);
      if (daysDiff !== 0) return daysDiff;
      // Pending before done when tied
      if (a.is_pending !== b.is_pending) return a.is_pending ? -1 : 1;
      return 0;
    });
  });

  let pickupRows = $derived(filteredRows.filter((row) => row.job_status !== 'return'));
  let returnRows = $derived(filteredRows.filter((row) => row.job_status === 'return'));

  function toggleSortDays() {
    sortDaysDir = sortDaysDir === 'desc' ? 'asc' : 'desc';
  }

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

  /** Shorter date for compact cards */
  function formatDateShort(iso: string | null): string {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney',
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

  /**
   * Age colors for pending cards:
   * &lt; 3 days green · 3–6 days yellow · 7+ days red
   */
  function getAgeCardClass(row: DeliveryTrackingRow): string {
    if (!row.is_pending) {
      return 'border-gray-200 bg-white';
    }
    const days = getPendingDays(row);
    if (days >= 7) {
      return 'border-red-400 bg-red-50 ring-1 ring-red-200';
    }
    if (days >= 3) {
      return 'border-amber-400 bg-amber-50 ring-1 ring-amber-200';
    }
    return 'border-green-400 bg-green-50 ring-1 ring-green-200';
  }

  function getAgeBadgeClass(row: DeliveryTrackingRow): string {
    if (!row.is_pending) {
      return 'bg-green-100 text-green-800';
    }
    const days = getPendingDays(row);
    if (days >= 7) return 'bg-red-600 text-white';
    if (days >= 3) return 'bg-amber-500 text-white';
    return 'bg-green-600 text-white';
  }

  function ageLabel(row: DeliveryTrackingRow): string {
    if (!row.is_pending) return trackingLabel(row);
    const days = getPendingDays(row);
    if (days === 0) return 'Pending · today';
    if (days === 1) return 'Pending · 1 day';
    return `Pending · ${days} days`;
  }

  function trackingLabel(row: DeliveryTrackingRow): string {
    if (row.is_pending) return 'Pending';
    return row.job_status === 'return' ? 'Returned' : 'Picked up';
  }

  function confirmLabel(row: DeliveryTrackingRow): string {
    return row.job_status === 'return' ? 'Mark returned' : 'Mark picked up';
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

    const isPickup = row.job_status === 'pickup';

    // Optimistic: pickup jobs leave this list after move to to_be_quoted
    if (isPickup) {
      rows = rows.filter((r) => r.workshop.id !== row.workshop.id);
    } else {
      rows = rows.map((r) =>
        r.workshop.id === row.workshop.id
          ? {
              ...r,
              transport_status: 'confirmed',
              is_pending: false
            }
          : r
      );
    }

    try {
      const transport = await confirmDeliveryTransport(row.workshop.id, row.job_status);

      if (isPickup) {
        const user = get(currentUser);
        const profile = get(userProfile);
        const userName = user
          ? profile
            ? `${profile.firstName} ${profile.lastName}`.trim()
            : user.displayName || user.email?.split('@')[0] || 'Unknown User'
          : 'Unknown User';

        await updateWorkshop(row.workshop.id, {
          status: 'to_be_quoted',
          history: [
            {
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              user: userName,
              status: 'to_be_quoted',
              isCreation: false
            }
          ]
        });

        toastSuccess('Marked as picked up · moved to To be Quoted', 'Updated');

        notifyWorkshopPickedUpToTeams(row.workshop, userName).then((ok) => {
          if (!ok) toastError('Teams notification failed. Status was updated.');
        });
      } else {
        rows = rows.map((r) =>
          r.workshop.id === row.workshop.id
            ? {
                ...r,
                transport_id: transport.id,
                transport_status: 'confirmed',
                assigned_to_name: transport.assigned_to_name ?? r.assigned_to_name,
                assigned_at: transport.created_at ?? r.assigned_at,
                schedule: transport.schedule ?? r.schedule,
                is_pending: false
              }
            : r
        );
        toastSuccess('Marked as returned', 'Updated');
      }
    } catch (err) {
      console.error('Failed to confirm pickup/return:', err);
      if (isPickup) {
        rows = [...rows, previous];
      } else {
        rows = rows.map((r) => (r.workshop.id === previous.workshop.id ? previous : r));
      }
      toastError('Failed to update. Please try again.');
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
      class="rounded-xl border border-dashed py-8 text-center text-xs
        {variant === 'return'
        ? 'border-violet-200 bg-violet-50/50 text-violet-600'
        : 'border-sky-200 bg-sky-50/50 text-sky-600'}"
    >
      {emptyMessage}
    </div>
  {:else}
    <ul class="grid grid-cols-2 gap-2 md:grid-cols-1 md:gap-3">
      {#each columnRows as row (row.workshop.id)}
        {@const photos = row.workshop.photo_urls ?? []}
        {@const heroPhoto = photos[0]}
        <li class="min-w-0">
          <div
            class="flex h-full flex-col overflow-hidden rounded-lg border-2 shadow-sm active:scale-[0.99] transition-transform md:rounded-xl md:shadow-md {getAgeCardClass(row)}"
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
            <div class="relative aspect-square bg-gray-100 md:aspect-[4/3]">
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
                    class="pointer-events-none absolute right-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white md:right-2 md:top-2 md:rounded-md md:px-2 md:py-1 md:text-xs"
                  >
                    {photos.length}
                  </span>
                {/if}
              {:else}
                <div class="flex h-full w-full items-center justify-center bg-gray-100">
                  <span class="text-[10px] font-medium text-gray-400 md:text-sm">No photo</span>
                </div>
              {/if}
            </div>

            <!-- Card body -->
            <div class="flex flex-1 flex-col p-2 md:p-4">
              <span
                class="inline-flex w-fit max-w-full items-center truncate rounded px-1.5 py-0.5 text-[10px] font-semibold md:rounded-md md:px-2 md:text-xs {getAgeBadgeClass(row)}"
              >
                {ageLabel(row)}
              </span>

              <p class="mt-1 truncate text-[10px] font-medium uppercase tracking-wide text-gray-500 md:mt-2 md:text-xs">
                {row.workshop.order_id || 'No order ID'}
              </p>
              <h2 class="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-gray-900 md:text-lg">
                {row.workshop.customer_name || 'Unknown customer'}
              </h2>
              <p class="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray-700 md:mt-1 md:text-sm">
                {row.workshop.product_name || '—'}
                {#if row.workshop.make_model}
                  <span class="text-gray-500"> · {row.workshop.make_model}</span>
                {/if}
              </p>

              <dl class="mt-1.5 space-y-0.5 text-[10px] leading-snug text-gray-600 md:mt-3 md:space-y-1.5 md:text-sm">
                <div class="truncate">
                  <span class="text-gray-400">Site </span>
                  <span class="text-gray-800">{row.workshop.site_location || '—'}</span>
                </div>
                <div class="truncate">
                  <span class="text-gray-400">Asgn </span>
                  <span class="text-gray-800">{row.assigned_to_name || '—'}</span>
                </div>
                <div class="truncate">
                  <span class="text-gray-400">Date </span>
                  <span class="text-gray-800">{formatDateShort(row.assigned_at)}</span>
                </div>
                <div class="truncate">
                  <span class="text-gray-400">Sched </span>
                  <span class="text-gray-800">{formatDateShort(row.schedule)}</span>
                </div>
              </dl>

              {#if row.is_pending}
                <button
                  type="button"
                  class="mt-auto w-full rounded-md px-2 py-2 text-[11px] font-semibold leading-tight text-white disabled:opacity-60 md:mt-4 md:rounded-lg md:px-4 md:py-3 md:text-sm
                    {variant === 'return'
                    ? 'bg-violet-600 hover:bg-violet-700'
                    : 'bg-green-600 hover:bg-green-700'}"
                  disabled={confirmingId === row.workshop.id}
                  onclick={(e) => handleConfirm(row, e)}
                >
                  {#if confirmingId === row.workshop.id}
                    …
                  {:else if variant === 'return'}
                    <span class="md:hidden">Returned</span>
                    <span class="hidden md:inline">{confirmLabel(row)}</span>
                  {:else}
                    <span class="md:hidden">Picked up</span>
                    <span class="hidden md:inline">{confirmLabel(row)}</span>
                  {/if}
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
          class="inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          onclick={loadDeliveries}
          disabled={loading}
          aria-label="Refresh deliveries"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div class="mt-2">
        <label class="sr-only" for="delivery-search">Search</label>
        <input
          id="delivery-search"
          type="search"
          bind:value={searchTerm}
          placeholder="Search customer, product, order, site…"
          class="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        {#each trackingChips as chip (chip.key)}
          <button
            type="button"
            class="rounded-full px-2.5 py-1 text-xs font-medium transition
              {trackingFilter === chip.key
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
            onclick={() => (trackingFilter = chip.key)}
          >
            {chip.label}
          </button>
        {/each}

        <button
          type="button"
          class="ml-auto inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          onclick={toggleSortDays}
          aria-label={sortDaysDir === 'desc'
            ? 'Sorted by most days pending. Tap to show fewest days first.'
            : 'Sorted by fewest days pending. Tap to show most days first.'}
        >
          <span aria-hidden="true">{sortDaysDir === 'desc' ? '↓' : '↑'}</span>
          {sortDaysDir === 'desc' ? 'Most days' : 'Fewest days'}
        </button>
      </div>

      <!-- Mobile: Pickup / Return tabs (sticky with header) -->
      <div
        class="mt-2 grid grid-cols-2 gap-0.5 rounded-lg bg-gray-100 p-0.5 md:hidden"
        role="tablist"
        aria-label="Pickup or return"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pickup'}
          class="rounded-md px-2 py-1.5 text-xs font-semibold transition
            {activeTab === 'pickup'
            ? 'bg-sky-600 text-white shadow-sm'
            : 'bg-transparent text-gray-600'}"
          onclick={() => (activeTab = 'pickup')}
        >
          Pickup
          <span class="ml-0.5 opacity-80">({pickupRows.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'return'}
          class="rounded-md px-2 py-1.5 text-xs font-semibold transition
            {activeTab === 'return'
            ? 'bg-violet-600 text-white shadow-sm'
            : 'bg-transparent text-gray-600'}"
          onclick={() => (activeTab = 'return')}
        >
          Return
          <span class="ml-0.5 opacity-80">({returnRows.length})</span>
        </button>
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
          class="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
          onclick={loadDeliveries}
        >
          Try again
        </button>
      </div>
    {:else}
      <!-- Mobile: single active column -->
      <div class="md:hidden">
        {#if activeTab === 'pickup'}
          <section class="overflow-hidden rounded-2xl border border-sky-200 bg-sky-50">
            <div class="p-3">
              {@render cardList(pickupRows, 'No pickups', 'pickup')}
            </div>
          </section>
        {:else}
          <section class="overflow-hidden rounded-2xl border border-violet-200 bg-violet-50">
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
              Pickup
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
