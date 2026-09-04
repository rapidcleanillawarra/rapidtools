<script lang="ts">
  type PageItems = { start: number; end: number; total: number };

  export let placement: 'top' | 'bottom' = 'top';
  export let currentPage: number;
  export let totalPages: number;
  export let currentPageItems: PageItems;
  export let onPageChange: (page: number) => void;

  $: wrapperClass =
    placement === 'top'
      ? 'mb-4 flex items-center justify-between border border-[#262a30] bg-[#141619] rounded-xl px-4 py-3 sm:px-6 shadow-sm'
      : 'mt-4 flex items-center justify-between border border-[#262a30] bg-[#141619] rounded-xl px-4 py-3 sm:px-6 shadow-sm';
</script>

<div class={wrapperClass}>
  <div class="flex flex-1 justify-center gap-2 sm:hidden">
    <button
      class="btn-secondary text-xs py-1.5 px-3"
      on:click={() => onPageChange(currentPage - 1)}
      disabled={currentPage === 1}
    >
      Previous
    </button>
    <button
      class="btn-secondary text-xs py-1.5 px-3 ml-3"
      on:click={() => onPageChange(currentPage + 1)}
      disabled={currentPage === totalPages}
    >
      Next
    </button>
  </div>

  <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between sm:gap-4">
    <div>
      <p class="text-xs text-gray-400 font-medium">
        Showing <span class="text-gray-200 font-semibold">{currentPageItems.start}</span> to <span class="text-gray-200 font-semibold">{currentPageItems.end}</span> of <span class="text-gray-200 font-semibold">{currentPageItems.total}</span> products
      </p>
    </div>
    <div>
      <nav class="isolate inline-flex -space-x-px rounded-lg shadow-sm" aria-label="Pagination">
        <button
          class="relative inline-flex items-center rounded-l-lg px-2.5 py-1.5 text-gray-400 border border-[#262a30] bg-[#141619] hover:bg-[#1f2329] hover:text-lime-300 focus:z-20 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
          on:click={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <span class="sr-only">Previous</span>
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
              clip-rule="evenodd"
            />
          </svg>
        </button>

        <!-- Show ellipsis and limited page numbers -->
        {#if totalPages <= 7}
          {#each Array(totalPages) as _, i}
            <button
              class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold border {currentPage === i + 1 ? 'bg-lime-500 text-gray-950 font-bold border-lime-500 z-10' : 'text-gray-300 bg-[#141619] border-[#262a30] hover:bg-[#1f2329] hover:text-lime-300'} transition-colors"
              on:click={() => onPageChange(i + 1)}
            >
              {i + 1}
            </button>
          {/each}
        {:else}
          <!-- First page -->
          <button
            class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold border {currentPage === 1 ? 'bg-lime-500 text-gray-950 font-bold border-lime-500 z-10' : 'text-gray-300 bg-[#141619] border-[#262a30] hover:bg-[#1f2329] hover:text-lime-300'} transition-colors"
            on:click={() => onPageChange(1)}
          >
            1
          </button>

          <!-- Left ellipsis -->
          {#if currentPage > 3}
            <span
              class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-500 bg-[#141619] border border-[#262a30]"
              >...</span
            >
          {/if}

          <!-- Pages around current page -->
          {#each Array(3) as _, i}
            {#if currentPage - 1 + i > 1 && currentPage - 1 + i < totalPages}
              <button
                class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold border {currentPage === currentPage - 1 + i ? 'bg-lime-500 text-gray-950 font-bold border-lime-500 z-10' : 'text-gray-300 bg-[#141619] border-[#262a30] hover:bg-[#1f2329] hover:text-lime-300'} transition-colors"
                on:click={() => onPageChange(currentPage - 1 + i)}
              >
                {currentPage - 1 + i}
              </button>
            {/if}
          {/each}

          <!-- Right ellipsis -->
          {#if currentPage < totalPages - 2}
            <span
              class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-500 bg-[#141619] border border-[#262a30]"
              >...</span
            >
          {/if}

          <!-- Last page -->
          <button
            class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold border {currentPage === totalPages ? 'bg-lime-500 text-gray-950 font-bold border-lime-500 z-10' : 'text-gray-300 bg-[#141619] border-[#262a30] hover:bg-[#1f2329] hover:text-lime-300'} transition-colors"
            on:click={() => onPageChange(totalPages)}
          >
            {totalPages}
          </button>
        {/if}

        <button
          class="relative inline-flex items-center rounded-r-lg px-2.5 py-1.5 text-gray-400 border border-[#262a30] bg-[#141619] hover:bg-[#1f2329] hover:text-lime-300 focus:z-20 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
          on:click={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <span class="sr-only">Next</span>
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </nav>
    </div>
  </div>
</div>
