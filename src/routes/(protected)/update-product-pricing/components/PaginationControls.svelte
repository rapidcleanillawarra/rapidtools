<script lang="ts">
  type PageItems = { start: number; end: number; total: number };

  export let placement: 'top' | 'bottom' = 'top';
  export let currentPage: number;
  export let totalPages: number;
  export let currentPageItems: PageItems;
  export let onPageChange: (page: number) => void;

  $: wrapperClass =
    placement === 'top'
      ? 'mb-4 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6'
      : 'mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6';
</script>

<div class={wrapperClass}>
  <div class="flex flex-1 justify-center gap-2 sm:hidden">
    <button
      class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      on:click={() => onPageChange(currentPage - 1)}
      disabled={currentPage === 1}
    >
      Previous
    </button>
    <button
      class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      on:click={() => onPageChange(currentPage + 1)}
      disabled={currentPage === totalPages}
    >
      Next
    </button>
  </div>

  <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-center sm:gap-4">
    <div>
      <p class="text-xs text-gray-700">
        {currentPageItems.start}-{currentPageItems.end} / {currentPageItems.total}
      </p>
    </div>
    <div>
      <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
        <button
          class="relative inline-flex items-center rounded-l-md px-2 py-1.5 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
          on:click={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <span class="sr-only">Previous</span>
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
              class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold {currentPage === i + 1 ? 'bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'}"
              on:click={() => onPageChange(i + 1)}
            >
              {i + 1}
            </button>
          {/each}
        {:else}
          <!-- First page -->
          <button
            class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold {currentPage === 1 ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}"
            on:click={() => onPageChange(1)}
          >
            1
          </button>

          <!-- Left ellipsis -->
          {#if currentPage > 3}
            <span
              class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-inset ring-gray-300"
              >...</span
            >
          {/if}

          <!-- Pages around current page -->
          {#each Array(3) as _, i}
            {#if currentPage - 1 + i > 1 && currentPage - 1 + i < totalPages}
              <button
                class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold {currentPage === currentPage - 1 + i ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}"
                on:click={() => onPageChange(currentPage - 1 + i)}
              >
                {currentPage - 1 + i}
              </button>
            {/if}
          {/each}

          <!-- Right ellipsis -->
          {#if currentPage < totalPages - 2}
            <span
              class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-inset ring-gray-300"
              >...</span
            >
          {/if}

          <!-- Last page -->
          <button
            class="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold {currentPage === totalPages ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}"
            on:click={() => onPageChange(totalPages)}
          >
            {totalPages}
          </button>
        {/if}

        <button
          class="relative inline-flex items-center rounded-r-md px-2 py-1.5 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
          on:click={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <span class="sr-only">Next</span>
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
