<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ProductInfo } from './types';

  export let showImageViewer: boolean = false;
  export let product: ProductInfo | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  function closeViewer() {
    dispatch('close');
  }

  // Keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    if (!showImageViewer) return;

    switch (event.key) {
      case 'Escape':
        closeViewer();
        break;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if showImageViewer && product?.image}
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
    <!-- Close button -->
    <button
      class="absolute top-4 right-4 z-20 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-colors"
      on:click={closeViewer}
      aria-label="Close viewer"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>

    <!-- Main image -->
    <div class="max-w-full max-h-full p-4 relative">
      <img
        src={product.image}
        alt={product.name}
        class="image-viewer-main object-contain rounded-lg shadow-2xl"
      />
    </div>

    <!-- Product info overlay -->
    <div class="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded text-sm">
      <div class="font-medium">{product.name}</div>
      <div class="text-gray-300">SKU: {product.sku}</div>
      <div class="text-gray-300">Brand: {product.brand}</div>
    </div>
  </div>
{/if}

<style>
  .image-viewer-main {
    max-height: 80vh;
    max-width: 80vw;
  }
</style>
