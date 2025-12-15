<script lang="ts">
  export let open: boolean;
  export let images: string[] = [];
  export let index: number = 0;
  export let title: string = '';
  export let onClose: () => void;
  export let onIndexChange: (next: number) => void;

  $: safeIndex = images.length === 0 ? 0 : Math.min(Math.max(0, index), images.length - 1);
  $: current = images[safeIndex] ?? '';
  $: canPrev = images.length > 1 && safeIndex > 0;
  $: canNext = images.length > 1 && safeIndex < images.length - 1;

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
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" on:click={onClose}>
    <div
      class="w-full max-w-5xl rounded-lg bg-white shadow-xl overflow-hidden"
      on:click|stopPropagation
    >
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-gray-900">{title}</div>
          {#if images.length > 0}
            <div class="text-xs text-gray-500">{safeIndex + 1} / {images.length}</div>
          {/if}
        </div>
        <button
          type="button"
          class="rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
          on:click={onClose}
        >
          X
        </button>
      </div>

      <div class="relative bg-black">
        {#if current}
          <img src={current} alt={title || 'Product image'} class="h-[70vh] w-full object-contain bg-black" />
        {:else}
          <div class="flex h-[50vh] items-center justify-center text-sm text-gray-200">No image</div>
        {/if}

        {#if images.length > 1}
          <button
            type="button"
            class="absolute left-2 top-1/2 -translate-y-1/2 rounded bg-white/80 px-3 py-2 text-sm text-gray-900 hover:bg-white disabled:opacity-50"
            on:click={prev}
            disabled={!canPrev}
          >
            &lt;
          </button>
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-white/80 px-3 py-2 text-sm text-gray-900 hover:bg-white disabled:opacity-50"
            on:click={next}
            disabled={!canNext}
          >
            &gt;
          </button>
        {/if}
      </div>

      {#if images.length > 1}
        <div class="flex gap-2 overflow-x-auto border-t bg-white px-4 py-3">
          {#each images as img, i (img)}
            <button
              type="button"
              class="h-14 w-14 flex-none overflow-hidden rounded border {i === safeIndex ? 'border-blue-600' : 'border-gray-200'}"
              on:click={() => onIndexChange(i)}
              aria-label={`View image ${i + 1}`}
            >
              <img src={img} alt="" class="h-full w-full object-contain bg-gray-50" loading="lazy" />
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

