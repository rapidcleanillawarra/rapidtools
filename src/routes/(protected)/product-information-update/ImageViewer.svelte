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
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <!-- Close button -->
    <button
      class="absolute top-4 right-4 z-20 bg-[#1f2329] border border-[#333842] text-gray-200 rounded-full p-2.5 hover:bg-[#262a30] hover:text-lime-400 hover:border-lime-500/50 transition-colors shadow-lg"
      on:click={closeViewer}
      aria-label="Close viewer"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>

    <!-- Main image -->
    <div class="max-w-full max-h-full p-4 relative">
      <img
        src={product.image}
        alt={product.name}
        class="image-viewer-main object-contain rounded-xl border border-[#262a30] shadow-2xl bg-[#141619]"
      />
    </div>

    <!-- Product info overlay -->
    <div class="absolute top-4 left-4 bg-[#141619]/90 border border-[#262a30] backdrop-blur-sm text-white px-4 py-3 rounded-xl shadow-xl text-sm max-w-sm">
      <div class="font-semibold text-white truncate">{product.name}</div>
      <div class="text-gray-400 text-xs mt-0.5">SKU: <span class="text-lime-400 font-mono">{product.sku}</span></div>
      <div class="text-gray-400 text-xs">Brand: <span class="text-gray-200">{product.brand}</span></div>
    </div>
  </div>
{/if}

<style>
  .image-viewer-main {
    max-height: 80vh;
    max-width: 80vw;
  }
</style>
