<script lang="ts">
  import { onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';
  import type { Chart as ChartInstance } from 'chart.js';

  export let stats: {
    usedPhotos: number;
    orphanedPhotos: number;
  } | null = null;
  export let isLoading: boolean = false;

  let canvas: HTMLCanvasElement;
  let chart: ChartInstance | null = null;

  function buildChart() {
    if (!canvas || !stats) return;
    chart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: ['Used photos', 'Orphaned photos'],
        datasets: [
          {
            data: [stats.usedPhotos, stats.orphanedPhotos],
            backgroundColor: ['#22c55e', '#f59e0b'],
            borderWidth: 1,
            borderColor: '#fff'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const pct = total ? ((ctx.raw as number) / total * 100).toFixed(1) : '0';
                return `${ctx.label}: ${ctx.raw} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  $: if (chart && stats) {
    chart.data.datasets[0].data = [stats.usedPhotos, stats.orphanedPhotos];
    chart.update('none');
  }

  onDestroy(() => {
    chart?.destroy();
    chart = null;
  });

  $: if (canvas && stats && !chart && !isLoading) buildChart();
</script>

<div class="chart-container">
  {#if isLoading}
    <div class="animate-pulse flex items-center justify-center h-48 bg-gray-100 rounded-lg">
      <span class="text-gray-500 text-sm">Loading…</span>
    </div>
  {:else if stats && (stats.usedPhotos > 0 || stats.orphanedPhotos > 0)}
    <div class="h-48 md:h-56">
      <canvas bind:this={canvas}></canvas>
    </div>
  {:else if stats}
    <div class="flex items-center justify-center h-48 bg-gray-50 rounded-lg text-gray-500 text-sm">
      No photo data to display
    </div>
  {/if}
</div>

<style>
  .chart-container {
    min-height: 12rem;
  }
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
