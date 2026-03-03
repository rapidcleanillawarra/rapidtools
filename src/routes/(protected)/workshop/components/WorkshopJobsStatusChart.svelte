<script lang="ts">
  import { onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';
  import type { Chart as ChartInstance } from 'chart.js';
  import ChartDataLabels from 'chartjs-plugin-datalabels';

  export let stats: { status: string; count: number }[] | null = null;
  export let isLoading: boolean = false;

  let canvas: HTMLCanvasElement;
  let chart: ChartInstance | null = null;

  const PIE_PALETTE = [
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

  function buildChart() {
    if (!canvas || !stats || stats.length === 0) return;
    const labels = stats.map((s) => formatStatusLabel(s.status));
    const data = stats.map((s) => s.count);
    const total = data.reduce((a, b) => a + b, 0);
    const backgrounds = stats.map((_, i) => PIE_PALETTE[i % PIE_PALETTE.length]);
    chart = new Chart(canvas, {
      type: 'pie',
      plugins: [ChartDataLabels],
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: backgrounds,
            borderWidth: 1,
            borderColor: '#fff',
            datalabels: {
              color: '#fff',
              font: { weight: 'bold' as const, size: 12 },
              formatter: (value: number, ctx) => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const pct = total ? ((value / total) * 100).toFixed(1) : '0';
                return `${value}\n(${pct}%)`;
              }
            }
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              generateLabels: (chart) => {
                const dataset = chart.data.datasets[0];
                const data = (dataset.data as number[]) ?? [];
                const total = data.reduce((a, b) => a + b, 0);
                const labels = chart.data.labels ?? [];
                const backgrounds = Array.isArray(dataset.backgroundColor)
                  ? dataset.backgroundColor
                  : [dataset.backgroundColor];
                return labels.map((label, i) => ({
                  text: `${label}: ${data[i]} (${total ? ((data[i] / total) * 100).toFixed(1) : '0'}%)`,
                  fillStyle: backgrounds[i] ?? backgrounds[0],
                  strokeStyle: '#fff',
                  lineWidth: 1,
                  hidden: false,
                  index: i
                }));
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = ctx.raw as number;
                const pct = total ? ((value / total) * 100).toFixed(1) : '0';
                return `${ctx.label}: ${value} (${pct}%)`;
              }
            }
          },
          datalabels: {
            anchor: 'center',
            align: 'center',
            clamp: true
          }
        }
      }
    });
  }

  $: if (chart && stats && stats.length > 0) {
    const labels = stats.map((s) => formatStatusLabel(s.status));
    const data = stats.map((s) => s.count);
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update('none');
  }

  onDestroy(() => {
    chart?.destroy();
    chart = null;
  });

  $: hasData = stats && stats.length > 0 && stats.some((s) => s.count > 0);
  $: if (canvas && stats && !chart && !isLoading && hasData) buildChart();
</script>

<div class="chart-container">
  {#if isLoading}
    <div class="animate-pulse flex items-center justify-center h-48 bg-gray-100 rounded-lg">
      <span class="text-gray-500 text-sm">Loading…</span>
    </div>
  {:else if hasData}
    <div class="chart-wrapper">
      <canvas bind:this={canvas}></canvas>
    </div>
  {:else if stats}
    <div class="flex items-center justify-center h-48 bg-gray-50 rounded-lg text-gray-500 text-sm">
      No job data to display
    </div>
  {/if}
</div>

<style>
  .chart-container {
    min-height: 12rem;
    width: 100%;
  }
  .chart-wrapper {
    width: 100%;
    min-height: 12rem;
    position: relative;
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
