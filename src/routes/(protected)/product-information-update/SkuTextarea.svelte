<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let value: string = '';
  export let placeholder: string = 'Enter SKUs (one per line)...';
  export let id: string | undefined = undefined;
  export let disabled: boolean = false;

  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    value = target.value;
    dispatch('input', { value });
  }

  function clearSelection() {
    value = '';
    dispatch('clear');
  }
</script>

<div class="relative">
  <label for={id} class="form-label">
    Filter by SKU (multiple SKUs supported)
  </label>
  <div class="flex gap-2">
    <div class="flex-1">
      <textarea
        {id}
        {placeholder}
        {disabled}
        bind:value
        on:input={handleInput}
        class="w-full px-3 py-2 bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg shadow-sm focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-500 disabled:bg-[#141619] disabled:text-gray-500 disabled:border-[#262a30] disabled:cursor-not-allowed resize-vertical min-h-[100px] font-mono text-sm transition-colors"
        rows="4"
      ></textarea>
    </div>
    {#if value.trim()}
      <button
        type="button"
        on:click={clearSelection}
        class="px-3 py-2 text-gray-400 hover:text-lime-400 border border-[#333842] bg-[#1f2329] rounded-lg hover:bg-[#262a30] hover:border-lime-500/40 transition-colors self-start"
        title="Clear SKUs"
      >
        ✕
      </button>
    {/if}
  </div>
  <p class="mt-1 text-xs text-gray-500">
    Enter one SKU per line. Empty lines will be ignored.
  </p>
</div>
