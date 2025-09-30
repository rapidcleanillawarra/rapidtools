<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { base } from '$app/paths';
  import Modal from './Modal.svelte';

  export let show: boolean = false;
  export let message: string = '';
  export let orderId: string | null = null;
  export let isPickup: boolean = false;

  const dispatch = createEventDispatcher<{
    navigateToJobStatus: void;
  }>();

  function handleClose() {
    show = false;
  }

  function handleNavigateToJobStatus() {
    show = false;
    dispatch('navigateToJobStatus');
  }
</script>

<Modal {show} allowClose={false}>
  <div slot="header" class="text-center">
    <h3 class="text-lg font-medium text-gray-900">
      {#if isPickup}
        Pickup Scheduled Successfully!
      {:else}
        Job Created Successfully!
      {/if}
    </h3>
  </div>

  <div slot="body" class="text-center">
    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
      <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>

    <p class="text-sm text-gray-600 mb-4">{message}</p>

    {#if orderId && !isPickup}
      <div class="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
        <div class="text-sm text-blue-800">
          <strong>Order ID:</strong> <span class="font-mono text-blue-900">{orderId}</span>
        </div>
      </div>
    {/if}

    <div class="flex justify-center">
      <button
        type="button"
        class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        on:click={handleNavigateToJobStatus}
      >
        View Job Status
      </button>
    </div>
  </div>
</Modal>
