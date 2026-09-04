<script lang="ts">
  export let open: boolean;
  export let images: string[] = [];
  export let index: number = 0;
  export let title: string = '';
  export let onClose: () => void;
  export let onIndexChange: (next: number) => void;

  $: {
    if (images == null) {
      console.error('[update-product-pricing] PhotoViewerModal: images is null', new Error().stack);
    }
  }
  $: safeImages = images ?? [];
  $: safeIndex = safeImages.length === 0 ? 0 : Math.min(Math.max(0, index), safeImages.length - 1);
  $: current = safeImages[safeIndex] ?? '';
  $: canPrev = safeImages.length > 1 && safeIndex > 0;
  $: canNext = safeImages.length > 1 && safeIndex < safeImages.length - 1;

  function prev() {
    if (!canPrev) return;
    onIndexChange(safeIndex - 1);
  }

  function next() {
    if (!canNext) return;
    onIndexChange(safeIndex + 1);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" on:click={onClose}>
    <div
      class="w-full max-w-5xl rounded-2xl bg-[#141619] border border-[#262a30] shadow-2xl overflow-hidden text-gray-200"
      on:click|stopPropagation
    >
      <div class="flex items-center justify-between border-b border-[#262a30] bg-[#181b20] px-5 py-3.5">
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-white">{title}</div>
          {#if safeImages.length > 0}
            <div class="text-xs text-gray-400 font-medium">{safeIndex + 1} / {safeImages.length}</div>
          {/if}
        </div>
        <button
          type="button"
          class="rounded-lg p-1.5 text-gray-400 hover:text-lime-400 hover:bg-[#1f2329] transition-colors"
          on:click={onClose}
          aria-label="Close photo viewer"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="relative bg-[#0e1012] flex items-center justify-center">
        {#if current}
          <img src={current} alt={title || 'Product image'} class="h-[70vh] w-full object-contain bg-[#0e1012]" />
        {:else}
          <div class="flex h-[50vh] items-center justify-center text-sm text-gray-400">No image</div>
        {/if}

        {#if safeImages.length > 1}
          <button
            type="button"
            class="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-[#141619]/90 border border-[#333842] p-2 text-gray-200 hover:text-lime-300 hover:bg-[#1f2329] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-lg"
            on:click={prev}
            disabled={!canPrev}
            aria-label="Previous image"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#141619]/90 border border-[#333842] p-2 text-gray-200 hover:text-lime-300 hover:bg-[#1f2329] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-lg"
            on:click={next}
            disabled={!canNext}
            aria-label="Next image"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        {/if}
      </div>

      {#if safeImages.length > 1}
        <div class="flex gap-2.5 overflow-x-auto border-t border-[#262a30] bg-[#181b20] px-4 py-3">
          {#each safeImages as img, i (img)}
            <button
              type="button"
              class="h-14 w-14 flex-none overflow-hidden rounded-lg border {i === safeIndex ? 'border-lime-500 ring-2 ring-lime-500/40' : 'border-[#262a30] hover:border-gray-500'} bg-[#0e1012] transition-colors"
              on:click={() => onIndexChange(i)}
              aria-label={`View image ${i + 1}`}
            >
              <img src={img} alt="" class="h-full w-full object-contain p-0.5" loading="lazy" />
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

