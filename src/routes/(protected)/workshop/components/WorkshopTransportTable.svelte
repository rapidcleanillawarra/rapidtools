<script lang="ts">
  import { onMount } from 'svelte';
  import { getWorkshopTransportList } from '$lib/services/workshop';
  import type { WorkshopTransportListRow } from '$lib/services/workshop';

  let rows: WorkshopTransportListRow[] = [];
  let isLoading = true;
  let error: string | null = null;

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Australia/Sydney',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(d);
    } catch {
      return iso;
    }
  }

  function formatTransportStatus(status: string): string {
    return status === 'confirmed' ? 'Confirmed' : 'New';
  }

  onMount(async () => {
    isLoading = true;
    error = null;
    try {
      rows = await getWorkshopTransportList();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load transport list';
      rows = [];
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col col-span-1 md:col-span-3">
  <div class="px-6 py-4 border-b border-gray-200">
    <h2 class="text-lg font-semibold text-gray-800">Transport assignments</h2>
    <p class="text-gray-500 text-sm mt-0.5">Pickup and return jobs with workshop details</p>
  </div>
  <div class="overflow-x-auto flex-1 min-h-0">
    {#if isLoading}
      <div class="p-8 text-center text-gray-500 text-sm">Loading…</div>
    {:else if error}
      <div class="p-8 text-center text-red-600 text-sm">{error}</div>
    {:else if rows.length === 0}
      <div class="p-8 text-center text-gray-500 text-sm">No transport assignments</div>
    {:else}
      <table class="w-full text-sm text-left">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-4 py-3 font-medium text-gray-700">Order ID</th>
            <th class="px-4 py-3 font-medium text-gray-700">Product name</th>
            <th class="px-4 py-3 font-medium text-gray-700">Fault description</th>
            <th class="px-4 py-3 font-medium text-gray-700">Site location</th>
            <th class="px-4 py-3 font-medium text-gray-700">Transport status</th>
            <th class="px-4 py-3 font-medium text-gray-700">Created at</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          {#each rows as row (row.id)}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 text-gray-900">{row.order_id ?? '—'}</td>
              <td class="px-4 py-3 text-gray-900 max-w-[200px] truncate" title={row.product_name ?? ''}>{row.product_name ?? '—'}</td>
              <td class="px-4 py-3 text-gray-700 max-w-[240px] truncate" title={row.fault_description ?? ''}>{row.fault_description ?? '—'}</td>
              <td class="px-4 py-3 text-gray-700 max-w-[180px] truncate" title={row.site_location ?? ''}>{row.site_location ?? '—'}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {row.transport_status === 'confirmed'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-amber-100 text-amber-800'}"
                >
                  {formatTransportStatus(row.transport_status)}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>
