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
  <label for={id} class="block text-sm font-medium text-gray-700 mb-2">
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
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical min-h-[100px] font-mono text-sm"
        rows="4"
      ></textarea>
    </div>
    {#if value.trim()}
      <button
        type="button"
        on:click={clearSelection}
        class="px-3 py-2 text-gray-400 hover:text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
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
