<script lang="ts">
  import { onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';
  import type { Chart as ChartInstance } from 'chart.js';

  export let stats: {
    totalPhotos: number;
    usedPhotos: number;
    orphanedPhotos: number;
    storageSize: number;
    workshopsCount: number;
  } | null = null;
  export let isLoading: boolean = false;

  let canvas: HTMLCanvasElement;
  let chart: ChartInstance | null = null;

  function buildChart() {
    if (!canvas || !stats) return;
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Total photos', 'Used photos', 'Orphaned photos'],
        datasets: [
          {
            label: 'Count',
            data: [stats.totalPhotos, stats.usedPhotos, stats.orphanedPhotos],
            backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b'],
            borderWidth: 1,
            borderColor: '#fff'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `Count: ${ctx.raw}`
            }
          }
        }
      }
    });
  }

  $: if (chart && stats) {
    chart.data.datasets[0].data = [
      stats.totalPhotos,
      stats.usedPhotos,
      stats.orphanedPhotos
    ];
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
  {:else if stats}
    <div class="h-48 md:h-56">
      <canvas bind:this={canvas}></canvas>
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
