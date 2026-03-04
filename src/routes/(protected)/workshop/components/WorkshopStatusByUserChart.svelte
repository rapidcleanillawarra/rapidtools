<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';
  import type { Chart as ChartInstance } from 'chart.js';
  import ChartDataLabels from 'chartjs-plugin-datalabels';
  import {
    getStatusHistoryCountsByUserThisWeek,
    getStatusHistoryCountsByUserDateRange,
    getStatusHistoryCountsByUserByStatus
  } from '$lib/services/workshop';

  /** Display order for statuses in the chart (matches workshop page). */
  const WORKSHOP_STATUS_DISPLAY_ORDER: string[] = [
    'new',
    'pickup',
    'to_be_quoted',
    'docket_ready',
    'quoted',
    'waiting_approval_po',
    'waiting_for_parts',
    'booked_in_for_repair_service',
    'repaired',
    'workshop_pickup',
    'return',
    'pending_jobs',
    'warranty_claim'
  ];

  const BAR_PALETTE = [
    '#3b82f6',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#6366f1',
    '#14b8a6',
    '#a855f7'
  ];

  let userList: { user_email: string; full_name: string | null; count: number }[] = [];
  let isLoadingUsers = true;
  let userError: string | null = null;

  let dateFrom = '';
  let dateTo = '';
  let dateError: string | null = null;
  type PresetKey = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | '';
  let selectedPreset: PresetKey = '';

  let selectedUserEmail = '';

  let statusCounts: { status: string; count: number }[] = [];
  let isLoadingChart = false;
  let chartError: string | null = null;

  let canvas: HTMLCanvasElement;
  let chart: ChartInstance | null = null;

  function toDateOnly(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  function getTodayRange(): { from: string; to: string } {
    const d = new Date();
    const from = toDateOnly(d);
    return { from, to: from };
  }

  function getYesterdayRange(): { from: string; to: string } {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    const from = toDateOnly(d);
    return { from, to: from };
  }

  function getThisWeekRange(): { from: string; to: string } {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setUTCDate(now.getUTCDate() + diff);
    mon.setUTCHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setUTCDate(mon.getUTCDate() + 6);
    sun.setUTCHours(23, 59, 59, 999);
    return { from: toDateOnly(mon), to: toDateOnly(sun) };
  }

  function getThisMonthRange(): { from: string; to: string } {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return { from: toDateOnly(first), to: toDateOnly(last) };
  }

  function getLastMonthRange(): { from: string; to: string } {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    return { from: toDateOnly(first), to: toDateOnly(last) };
  }

  /** Resolve current date range for API: custom range or this week. */
  function getEffectiveDateRange(): { from: Date; to: Date } {
    if (dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      return { from, to };
    }
    const r = getThisWeekRange();
    return { from: new Date(r.from), to: new Date(r.to) };
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

  async function loadUserList() {
    if (!validateDates()) return;
    isLoadingUsers = true;
    userError = null;
    try {
      if (dateFrom && dateTo) {
        userList = await getStatusHistoryCountsByUserDateRange(new Date(dateFrom), new Date(dateTo));
      } else {
        userList = await getStatusHistoryCountsByUserThisWeek();
      }
    } catch (e) {
      userError = e instanceof Error ? e.message : 'Failed to load users';
      userList = [];
    } finally {
      isLoadingUsers = false;
    }
    if (!selectedUserEmail && userList.length > 0) {
      selectedUserEmail = userList[0].user_email;
    } else if (selectedUserEmail) {
      loadChartData();
    }
  }

  $: if (selectedUserEmail) {
    loadChartData();
  } else {
    statusCounts = [];
    chartError = null;
  }

  function applyPreset(preset: PresetKey) {
    dateError = null;
    if (preset === '') {
      dateFrom = '';
      dateTo = '';
      selectedPreset = '';
      loadUserList();
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
    loadUserList();
  }

  function clearDateFilter() {
    applyPreset('');
  }

  function sortByStatusOrder(items: { status: string; count: number }[]): { status: string; count: number }[] {
    const order = new Map(WORKSHOP_STATUS_DISPLAY_ORDER.map((s, i) => [s, i]));
    return [...items].sort((a, b) => (order.get(a.status) ?? 999) - (order.get(b.status) ?? 999));
  }

  function formatStatusLabel(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  const statusToColor: Record<string, string> = {};
  WORKSHOP_STATUS_DISPLAY_ORDER.forEach((status, i) => {
    statusToColor[status] = BAR_PALETTE[i % BAR_PALETTE.length];
  });

  function getBackgrounds(stats: { status: string; count: number }[]): string[] {
    return stats.map((s) => statusToColor[s.status] ?? BAR_PALETTE[0]);
  }

  async function loadChartData() {
    if (!selectedUserEmail) {
      statusCounts = [];
      return;
    }
    isLoadingChart = true;
    chartError = null;
    try {
      const { from, to } = getEffectiveDateRange();
      const raw = await getStatusHistoryCountsByUserByStatus(selectedUserEmail, from, to);
      statusCounts = sortByStatusOrder(raw);
    } catch (e) {
      chartError = e instanceof Error ? e.message : 'Failed to load chart data';
      statusCounts = [];
    } finally {
      isLoadingChart = false;
    }
  }

  function buildChart() {
    if (!canvas || !statusCounts.length) return;
    chart?.destroy();
    chart = null;
    const labels = statusCounts.map((s) => formatStatusLabel(s.status));
    const data = statusCounts.map((s) => s.count);
    const total = data.reduce((a, b) => a + b, 0);
    const backgrounds = getBackgrounds(statusCounts);
    chart = new Chart(canvas, {
      type: 'bar',
      plugins: [ChartDataLabels],
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: backgrounds,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.8)',
            datalabels: {
              anchor: 'end',
              align: 'end',
              offset: 2,
              color: '#374151',
              font: { weight: 'bold' as const, size: 11 },
              formatter: (value: number, ctx) => {
                const t = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const pct = t ? ((value / t) * 100).toFixed(1) : '0';
                return `${value} (${pct}%)`;
              }
            }
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 24 },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = ctx.raw as number;
                const t = data.reduce((a, b) => a + b, 0);
                const pct = t ? ((value / t) * 100).toFixed(1) : '0';
                return `${ctx.label}: ${value} (${pct}%)`;
              }
            }
          },
          datalabels: { clip: false }
        }
      }
    });
  }

  $: if (chart && statusCounts.length > 0) {
    const labels = statusCounts.map((s) => formatStatusLabel(s.status));
    const data = statusCounts.map((s) => s.count);
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = getBackgrounds(statusCounts);
    chart.update('none');
  }

  $: hasChartData = statusCounts.length > 0 && statusCounts.some((s) => s.count > 0);
  /** When data is empty, destroy chart so it can be built again when data returns. */
  $: if (!hasChartData && chart) {
    chart.destroy();
    chart = null;
  }
  /** When loading chart data, destroy chart so it can be rebuilt on the new canvas after load. */
  $: if (isLoadingChart && chart) {
    chart.destroy();
    chart = null;
  }
  $: if (canvas && statusCounts.length > 0 && !chart && !isLoadingChart && hasChartData) buildChart();

  onMount(() => {
    loadUserList();
  });

  onDestroy(() => {
    chart?.destroy();
    chart = null;
  });
</script>

<div class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col col-span-1 md:col-span-3 min-h-0">
  <div class="px-6 py-4 border-b border-gray-200">
    <h2 class="text-lg font-semibold text-gray-800">Status breakdown by user</h2>
    <p class="text-sm text-gray-500 mt-0.5">Select a user and date range to see status-change counts per status</p>
    <div class="flex flex-wrap items-end gap-3 mt-3">
      <div class="flex flex-wrap items-end gap-2">
        <div>
          <label for="chart-preset" class="block text-xs font-medium text-gray-500 mb-1">Quick range</label>
          <select
            id="chart-preset"
            bind:value={selectedPreset}
            on:change={(e) => {
              const v = (e.currentTarget.value || '') as PresetKey;
              if (v === '') selectedPreset = '';
              else applyPreset(v);
            }}
            disabled={isLoadingUsers}
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
          <label for="chart-date-from" class="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            id="chart-date-from"
            type="date"
            bind:value={dateFrom}
            on:input={() => (selectedPreset = '')}
            class="rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label for="chart-date-to" class="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            id="chart-date-to"
            type="date"
            bind:value={dateTo}
            on:input={() => (selectedPreset = '')}
            class="rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          type="button"
          on:click={loadUserList}
          disabled={isLoadingUsers}
          class="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply
        </button>
      </div>
      <button
        type="button"
        on:click={clearDateFilter}
        disabled={isLoadingUsers}
        class="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        Clear dates
      </button>
      <div>
        <label for="chart-user" class="block text-xs font-medium text-gray-500 mb-1">User</label>
        <select
          id="chart-user"
          bind:value={selectedUserEmail}
          disabled={isLoadingUsers}
          class="rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[180px] disabled:opacity-50"
        >
          <option value="">Select a user</option>
          {#each userList as { user_email, full_name }}
            <option value={user_email}>{full_name ?? user_email}</option>
          {/each}
        </select>
      </div>
      {#if dateError}
        <p class="text-sm text-red-600 w-full">{dateError}</p>
      {/if}
    </div>
  </div>
  <div class="p-6 min-h-0">
    {#if userError}
      <p class="text-sm text-red-600">{userError}</p>
    {:else if !selectedUserEmail}
      <p class="text-sm text-gray-500">Select a user to see breakdown</p>
    {:else if chartError}
      <p class="text-sm text-red-600">{chartError}</p>
    {:else if isLoadingChart}
      <div class="animate-pulse flex items-center justify-center chart-placeholder bg-gray-100 rounded-lg">
        <span class="text-gray-500 text-sm">Loading…</span>
      </div>
    {:else if hasChartData}
      <div class="chart-container">
        <div class="chart-wrapper">
          <canvas bind:this={canvas}></canvas>
        </div>
      </div>
    {:else}
      <p class="text-sm text-gray-500">No status changes in the selected date range</p>
    {/if}
  </div>
</div>

<style>
  .chart-container {
    min-height: 24rem;
    width: 100%;
  }
  .chart-wrapper {
    width: 100%;
    min-height: 24rem;
    position: relative;
  }
  .chart-placeholder {
    min-height: 24rem;
  }
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
