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
  <label for={id} class="block text-xs font-medium text-gray-300 mb-1">
    Filter by SKU
  </label>
  <div class="flex gap-1.5">
    <div class="flex-1">
      <textarea
        {id}
        {placeholder}
        {disabled}
        bind:value
        on:input={handleInput}
        class="w-full px-3 py-2 bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg shadow-sm focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-500 disabled:bg-[#141619] disabled:text-gray-500 disabled:border-[#262a30] disabled:cursor-not-allowed resize-y min-h-[38px] h-[38px] focus:h-20 font-mono text-xs sm:text-sm transition-all"
        rows="1"
      ></textarea>
    </div>
    {#if value.trim()}
      <button
        type="button"
        on:click={clearSelection}
        class="px-2.5 py-2 text-gray-400 hover:text-lime-400 border border-[#333842] bg-[#1f2329] rounded-lg hover:bg-[#262a30] hover:border-lime-500/40 transition-colors self-start text-xs"
        title="Clear SKUs"
      >
        ✕
      </button>
    {/if}
  </div>
</div>
