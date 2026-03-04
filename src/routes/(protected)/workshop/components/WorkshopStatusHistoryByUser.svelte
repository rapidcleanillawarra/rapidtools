<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getStatusHistoryCountsByUserThisWeek,
    getStatusHistoryCountsByUserDateRange
  } from '$lib/services/workshop';

  let rows: { user_email: string; full_name: string | null; count: number }[] = [];
  let isLoading = true;
  let error: string | null = null;

  /** Custom date range; when both set, use date-range API instead of "this week". */
  let dateFrom = '';
  let dateTo = '';
  let dateError: string | null = null;

  function toDateOnly(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /** Start of current week (Monday) and end (Sunday) in UTC, for "This week" default. */
  function getThisWeekRange(): { from: string; to: string } {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday = 1
    const mon = new Date(now);
    mon.setUTCDate(now.getUTCDate() + diff);
    mon.setUTCHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setUTCDate(mon.getUTCDate() + 6);
    sun.setUTCHours(23, 59, 59, 999);
    return { from: toDateOnly(mon), to: toDateOnly(sun) };
  }

  function validateDates(): boolean {
    dateError = null;
    if (!dateFrom && !dateTo) return true;
    if (!dateFrom || !dateTo) {
      dateError = 'Set both From and To to filter by date range.';
      return false;
    }
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (to < from) {
      dateError = 'End date cannot be before start date.';
      return false;
    }
    return true;
  }

  async function load() {
    if (!validateDates()) return;
    isLoading = true;
    error = null;
    try {
      if (dateFrom && dateTo) {
        rows = await getStatusHistoryCountsByUserDateRange(new Date(dateFrom), new Date(dateTo));
      } else {
        rows = await getStatusHistoryCountsByUserThisWeek();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
      rows = [];
    } finally {
      isLoading = false;
    }
  }

  function setThisWeek() {
    const { from, to } = getThisWeekRange();
    dateFrom = from;
    dateTo = to;
    dateError = null;
    load();
  }

  function clearDateFilter() {
    dateFrom = '';
    dateTo = '';
    dateError = null;
    load();
  }

  onMount(() => {
    load();
  });
</script>

<div class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col col-span-1 md:col-span-3 min-h-0">
  <div class="px-6 py-4 border-b border-gray-200">
    <h2 class="text-lg font-semibold text-gray-800">Status changes by user</h2>
    <p class="text-sm text-gray-500 mt-0.5">Filter by this week or a custom date range</p>
    <div class="flex flex-wrap items-end gap-3 mt-3">
      <div class="flex flex-wrap items-end gap-2">
        <div>
          <label for="date-from" class="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            id="date-from"
            type="date"
            bind:value={dateFrom}
            class="rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label for="date-to" class="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            id="date-to"
            type="date"
            bind:value={dateTo}
            class="rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          type="button"
          on:click={load}
          disabled={isLoading}
          class="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply
        </button>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          on:click={setThisWeek}
          disabled={isLoading}
          class="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          This week
        </button>
        <button
          type="button"
          on:click={clearDateFilter}
          disabled={isLoading}
          class="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Clear dates
        </button>
      </div>
      {#if dateError}
        <p class="text-sm text-red-600 w-full">{dateError}</p>
      {/if}
    </div>
  </div>
  <div class="p-6 min-h-0">
    {#if isLoading}
      <p class="text-sm text-gray-500">Loading…</p>
    {:else if error}
      <p class="text-sm text-red-600">{error}</p>
    {:else if rows.length === 0}
      <p class="text-sm text-gray-500">
        {dateFrom && dateTo ? 'No status changes in the selected date range' : 'No status changes this week'}
      </p>
    {:else}
      <ul class="divide-y divide-gray-200">
        {#each rows as { user_email, full_name, count }}
          <li class="flex items-center justify-between py-2 first:pt-0 last:pb-0">
            <span class="text-sm text-gray-700 truncate" title={user_email}>{full_name ?? user_email}</span>
            <span class="text-sm font-medium text-gray-900 tabular-nums shrink-0 ml-4">{count}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
