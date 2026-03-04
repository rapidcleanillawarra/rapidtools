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

  type PresetKey = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | '';
  let selectedPreset: PresetKey = '';

  /** Today start and end in UTC. */
  function getTodayRange(): { from: string; to: string } {
    const d = new Date();
    const from = toDateOnly(d);
    return { from, to: from };
  }

  /** Yesterday in UTC. */
  function getYesterdayRange(): { from: string; to: string } {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    const from = toDateOnly(d);
    return { from, to: from };
  }

  /** Start of current week (Monday) and end (Sunday) in UTC. */
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

  /** First and last day of current month in UTC. */
  function getThisMonthRange(): { from: string; to: string } {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return { from: toDateOnly(first), to: toDateOnly(last) };
  }

  /** First and last day of previous month in UTC. */
  function getLastMonthRange(): { from: string; to: string } {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    return { from: toDateOnly(first), to: toDateOnly(last) };
  }

  function applyPreset(preset: PresetKey) {
    dateError = null;
    if (preset === '') {
      dateFrom = '';
      dateTo = '';
      selectedPreset = '';
      load();
      return;
    }
    selectedPreset = preset;
    let range: { from: string; to: string };
    if (preset === 'today') range = getTodayRange();
    else if (preset === 'yesterday') range = getYesterdayRange();
    else if (preset === 'this_week') range = getThisWeekRange();
    else if (preset === 'this_month') range = getThisMonthRange();
    else range = getLastMonthRange();
    dateFrom = range.from;
    dateTo = range.to;
    load();
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

  function clearDateFilter() {
    applyPreset('');
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
          <label for="preset" class="block text-xs font-medium text-gray-500 mb-1">Quick range</label>
          <select
            id="preset"
            bind:value={selectedPreset}
            on:change={(e) => {
              const v = (e.currentTarget.value || '') as PresetKey;
              if (v === '') selectedPreset = '';
              else applyPreset(v);
            }}
            disabled={isLoading}
            class="rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px] disabled:opacity-50"
          >
            <option value="">Custom range</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This week</option>
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
          </select>
        </div>
        <div>
          <label for="date-from" class="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            id="date-from"
            type="date"
            bind:value={dateFrom}
            on:input={() => (selectedPreset = '')}
            class="rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label for="date-to" class="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            id="date-to"
            type="date"
            bind:value={dateTo}
            on:input={() => (selectedPreset = '')}
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
      <button
        type="button"
        on:click={clearDateFilter}
        disabled={isLoading}
        class="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        Clear dates
      </button>
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
