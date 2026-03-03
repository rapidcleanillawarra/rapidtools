<script lang="ts">
  export let stats: {
    totalPhotos: number;
    usedPhotos: number;
    orphanedPhotos: number;
    storageSize: number;
    workshopsCount: number;
  } | null = null;
  export let isLoading: boolean = false;

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
</script>

{#if isLoading}
  <div class="animate-pulse">
    <div class="h-4 bg-gray-300 rounded w-1/3"></div>
  </div>
{:else if stats}
  <div class="bg-white p-4 rounded-lg shadow">
    <div class="text-lg font-semibold text-gray-700">{formatFileSize(stats.storageSize)}</div>
    <div class="text-sm text-gray-600">Storage Used</div>
  </div>
{/if}

<style>
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
