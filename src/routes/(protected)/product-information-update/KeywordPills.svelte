<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let keywords: string[] = [];
  export let disabled = false;
  export let placeholder = "Type a keyword and press Enter...";

  const dispatch = createEventDispatcher();

  let inputValue = '';
  let inputElement: HTMLInputElement;

  $: totalLength = keywords.join(', ').length;
  $: maxLength = 255;
  $: isNearLimit = totalLength > maxLength * 0.8;
  $: isOverLimit = totalLength > maxLength;

  function addKeyword(keyword: string) {
    const trimmed = keyword.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      // Calculate length if we add this keyword
      const newKeywords = [...keywords, trimmed];
      const newTotalLength = newKeywords.join(', ').length;

      if (newTotalLength <= maxLength) {
        keywords = newKeywords;
        dispatch('change', { keywords });
        inputValue = '';
      }
    }
  }

  function removeKeyword(index: number) {
    keywords = keywords.filter((_, i) => i !== index);
    dispatch('change', { keywords });
  }

  function handleInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addKeyword(inputValue);
    } else if (event.key === 'Backspace' && !inputValue && keywords.length > 0) {
      // Remove last keyword when backspace is pressed on empty input
      removeKeyword(keywords.length - 1);
    } else if (event.key === ',' || event.key === ';') {
      event.preventDefault();
      addKeyword(inputValue);
    }
  }

  function handleInputBlur() {
    if (inputValue.trim()) {
      addKeyword(inputValue);
    }
  }

  function focusInput() {
    inputElement?.focus();
  }
</script>

<div class="border {isOverLimit ? 'border-red-500/50 bg-red-950/20' : 'border-[#262a30] bg-[#0e1012]'} rounded-lg px-3 py-2 focus-within:ring-1 {isOverLimit ? 'focus-within:ring-red-500 focus-within:border-red-500' : 'focus-within:ring-lime-500 focus-within:border-lime-500'} transition-colors">
  <div class="flex flex-wrap gap-2 min-h-[2.5rem] items-center">
    {#each keywords as keyword, index}
      <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-lime-950/30 text-lime-400 border border-lime-500/30">
        {keyword}
        {#if !disabled}
          <button
            type="button"
            class="ml-1.5 text-lime-400 hover:text-red-400 focus:outline-none transition-colors"
            on:click={() => removeKeyword(index)}
            disabled={disabled}
            aria-label="Remove keyword"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        {/if}
      </span>
    {/each}

    {#if !disabled}
      <input
        bind:this={inputElement}
        bind:value={inputValue}
        type="text"
        {placeholder}
        class="flex-1 min-w-32 outline-none bg-transparent text-sm text-gray-200 placeholder-gray-500 {isOverLimit ? 'text-red-400' : ''}"
        on:keydown={handleInputKeydown}
        on:blur={handleInputBlur}
        disabled={disabled || isOverLimit}
      />
    {/if}
  </div>
</div>

<div class="mt-1.5 flex justify-between items-center">
  <p class="text-xs text-gray-500">
    Press Enter, comma, or semicolon to add keywords. Press Backspace to remove.
  </p>
  <p class="text-xs {isOverLimit ? 'text-red-400 font-medium' : isNearLimit ? 'text-amber-400' : 'text-gray-500'}">
    {totalLength}/{maxLength}
  </p>
</div>
