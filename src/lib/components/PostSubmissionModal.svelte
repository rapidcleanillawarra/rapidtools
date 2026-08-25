<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { base } from '$app/paths';
  import Modal from './Modal.svelte';

  export let show: boolean = false;
  export let message: string = '';
  export let orderId: string | null = null;
  export let isPickup: boolean = false;

  const dispatch = createEventDispatcher<{
    navigateToWorkshopBoard: void;
  }>();

  function handleClose() {
    show = false;
  }

  function handleNavigateToWorkshopBoard() {
    show = false;
    dispatch('navigateToWorkshopBoard');
  }
</script>

<Modal {show} allowClose={false}>
  <div slot="header" class="text-center">
    <h3 class="text-lg font-bold text-white">
      {#if isPickup}
        Pickup Scheduled Successfully!
      {:else}
        Job Created Successfully!
      {/if}
    </h3>
  </div>

  <div slot="body" class="text-center">
    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-lime-950/40 border border-lime-500/30 mb-4">
      <svg class="h-6 w-6 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>

    <p class="text-sm text-gray-300 mb-4">{message}</p>

    {#if orderId && !isPickup}
      <div class="bg-[#181b20] border border-[#262a30] rounded-xl p-4 mb-4">
        <div class="text-sm text-gray-300">
          <strong>Order ID:</strong> <span class="font-mono text-lime-400 font-semibold">{orderId}</span>
        </div>
      </div>
    {/if}

    <div class="flex justify-center">
      <button
        type="button"
        class="btn-primary px-6 py-2 text-sm font-semibold"
        on:click={handleNavigateToWorkshopBoard}
      >
        Continue
      </button>
    </div>
  </div>
</Modal>
