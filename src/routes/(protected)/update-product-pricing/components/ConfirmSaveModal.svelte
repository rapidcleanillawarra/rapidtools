<script lang="ts">
  export let open: boolean;
  export let loading: boolean;
  export let onCancel: () => void;
  export let onConfirm: () => void;
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
    <div class="w-full max-w-md rounded-lg bg-white shadow-xl">
      <div class="border-b px-4 py-3">
        <h3 class="text-base font-semibold text-gray-900">Confirm Save</h3>
      </div>
      <div class="px-4 py-3 text-sm text-gray-700">
        Are you sure you want to save updates for the selected rows?
      </div>
      <div class="flex justify-end gap-2 border-t px-4 py-3">
        <button
          class="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          on:click={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          class="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
          on:click={onConfirm}
          disabled={loading}
        >
          {#if loading}
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
          {/if}
          Save
        </button>
      </div>
    </div>
  </div>
{/if}

