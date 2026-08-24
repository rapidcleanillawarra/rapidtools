<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';

  export let show: boolean;
  export let totalProducts: number;
</script>

<Modal {show} size="md" allowClose={false}>
  <div slot="header" class="flex items-center text-white">
    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-lime-500 mr-3"></div>
    Loading Products
  </div>
  <div slot="body" class="space-y-4">
    <div class="text-center">
      <div class="text-lg font-semibold text-white">
        {totalProducts} products loaded
      </div>
    </div>

    <div class="text-center text-xs text-gray-400">
      Please wait while we fetch all products...
    </div>
  </div>
</Modal>

