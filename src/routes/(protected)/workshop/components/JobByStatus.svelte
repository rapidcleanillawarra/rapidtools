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

  const CHART_PALETTE = [
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
      map[status] = CHART_PALETTE[i % CHART_PALETTE.length];
    });
    return map;
  })();

  function getBackgrounds(): string[] {
    if (!stats) return [];
    return stats.map((s) => statusToColor[s.status] ?? CHART_PALETTE[0]);
  }

  /** Draws a connector line from each pie slice edge to the label area (outside the pie). */
  const pieConnectorPlugin = {
    id: 'pieConnector',
    afterDatasetsDraw(chart: ChartInstance) {
      if ((chart.config as { type?: string }).type !== 'pie') return;
      const meta = chart.getDatasetMeta(0);
      if (!meta?.data?.length) return;
      const ctx = chart.ctx;
      const connectorLength = 16;
      meta.data.forEach((el) => {
        const arc = el as unknown as {
          x: number;
          y: number;
          startAngle: number;
          endAngle: number;
          outerRadius: number;
        };
        const angle = (arc.startAngle + arc.endAngle) / 2;
        const x1 = arc.x + Math.cos(angle) * arc.outerRadius;
        const y1 = arc.y + Math.sin(angle) * arc.outerRadius;
        const x2 = x1 + Math.cos(angle) * connectorLength;
        const y2 = y1 + Math.sin(angle) * connectorLength;
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      });
    }
  };

  function buildChart() {
    if (!canvas || !stats || stats.length === 0) return;
    const labels = stats.map((s) => formatStatusLabel(s.status));
    const data = stats.map((s) => s.count);
    const backgrounds = getBackgrounds();
    chart = new Chart(canvas, {
      type: 'pie',
      plugins: [pieConnectorPlugin, ChartDataLabels],
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
              offset: 8,
              color: '#374151',
              font: { weight: 'bold' as const, size: 11 },
              formatter: (value: number, ctx) => {
                const label = ctx.chart.data.labels?.[ctx.dataIndex];
                return label ? `${label}: ${value}` : String(value);
              }
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
