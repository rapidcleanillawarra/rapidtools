<script lang="ts">
  export let open: boolean;
  export let loading: boolean;
  export let onCancel: () => void;
  export let onConfirm: () => void;
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div class="w-full max-w-md rounded-2xl bg-[#141619] border border-[#262a30] shadow-2xl p-6 text-gray-200">
      <div class="border-b border-[#262a30] pb-3 mb-4">
        <h3 class="text-lg font-bold text-white">Confirm Save</h3>
      </div>
      <div class="text-sm text-gray-300 mb-6 leading-relaxed">
        Are you sure you want to save updates for the selected rows?
      </div>
      <div class="flex justify-end gap-3 border-t border-[#262a30] pt-4">
        <button
          class="btn-secondary text-sm"
          on:click={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          class="btn-primary text-sm font-bold inline-flex items-center justify-center gap-2"
          on:click={onConfirm}
          disabled={loading}
        >
          {#if loading}
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-gray-950 border-t-transparent"></div>
          {/if}
          Save
        </button>
      </div>
    </div>
  </div>
{/if}

