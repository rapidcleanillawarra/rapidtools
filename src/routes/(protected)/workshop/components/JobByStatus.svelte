<script lang="ts">
  import { onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';
  import type { Chart as ChartInstance } from 'chart.js';
  import ChartDataLabels from 'chartjs-plugin-datalabels';

  export let stats: { status: string; count: number }[] | null = null;
  /** Full list of statuses in display order; used so each status keeps the same color when toggling visibility. */
  export let allStatuses: string[] = [];
  export let isLoading: boolean = false;

  let canvas: HTMLCanvasElement;
  let chart: ChartInstance | null = null;

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

  function formatStatusLabel(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /** Map status -> color based on its index in allStatuses, so colors stay stable when hiding/showing. */
  $: statusToColor = (() => {
    const map: Record<string, string> = {};
    allStatuses.forEach((status, i) => {
      map[status] = BAR_PALETTE[i % BAR_PALETTE.length];
    });
    return map;
  })();

  function getBackgrounds(): string[] {
    if (!stats) return [];
    return stats.map((s) => statusToColor[s.status] ?? BAR_PALETTE[0]);
  }

  function buildChart() {
    if (!canvas || !stats || stats.length === 0) return;
    const labels = stats.map((s) => formatStatusLabel(s.status));
    const data = stats.map((s) => s.count);
    const backgrounds = getBackgrounds();
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
              formatter: (value: number) => String(value)
            }
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: 24
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.raw}`
            }
          },
          datalabels: {
            clip: false
          }
        }
      }
    });
  }

  $: if (chart && stats && stats.length > 0) {
    const labels = stats.map((s) => formatStatusLabel(s.status));
    const data = stats.map((s) => s.count);
    const backgrounds = getBackgrounds();
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = backgrounds;
    chart.update('none');
  }

  onDestroy(() => {
    chart?.destroy();
    chart = null;
  });

  $: hasData = stats && stats.length > 0 && stats.some((s) => s.count > 0);
  /** When loading or no data, canvas is unmounted; destroy chart so it can be rebuilt when canvas is shown again. */
  $: if ((isLoading || !hasData) && chart) {
    chart.destroy();
    chart = null;
  }
  $: if (canvas && stats && !chart && !isLoading && hasData) buildChart();
</script>

<div class="chart-container">
  {#if isLoading}
    <div class="animate-pulse flex items-center justify-center chart-placeholder bg-gray-100 rounded-lg">
      <span class="text-gray-500 text-sm">Loading…</span>
    </div>
  {:else if hasData}
    <div class="chart-wrapper">
      <canvas bind:this={canvas}></canvas>
    </div>
  {:else if stats}
    <div class="flex items-center justify-center chart-placeholder bg-gray-50 rounded-lg text-gray-500 text-sm">
      No job data to display
    </div>
  {/if}
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
