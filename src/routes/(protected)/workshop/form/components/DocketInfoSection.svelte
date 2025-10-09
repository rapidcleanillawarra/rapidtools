<script lang="ts">
  import type { JobStatus } from '../workshop-status.service';

  export let workshopStatus: JobStatus;
  export let quoteOrRepair: 'Quote' | 'Repaired' = 'Quote';
  export let quoteDescription = '';
  export let additionalInformation = '';
  export let stockOnHand = '';
  export let labour = '';
  export let travelTime = '';
  export let callOut = '';
  export let parts: Array<{ sku: string; quantity: string }> = [{ sku: '', quantity: '' }];

  // Only show docket info for non-new and non-pickup workshops
  $: shouldShowDocketInfo = workshopStatus && workshopStatus !== 'new' && workshopStatus !== 'pickup';

  function addPartRow() {
    parts = [...parts, { sku: '', quantity: '' }];
  }

  function removePartRow(index: number) {
    // Don't remove if it's the last row
    if (parts.length <= 1) return;

    // Remove the part at the specified index
    parts = parts.filter((_, i) => i !== index);

    // If we now have no parts, add an empty one back
    if (parts.length === 0) {
      parts = [{ sku: '', quantity: '' }];
    }
  }

  // Determine docket info background color based on quote or repair selection
  $: docketInfoBackgroundClass = quoteOrRepair === 'Quote'
    ? 'bg-purple-100 text-purple-800'
    : 'bg-green-100 text-green-800';
</script>

{#if shouldShowDocketInfo}
  <!-- Docket Info Title -->
  <div
    class="flex items-center justify-between px-4 py-3 rounded"
    style="background-color: rgb(30, 30, 30);"
  >
    <h2 class="font-medium text-white">Docket Info</h2>
  </div>

  <!-- Docket Info Content -->
  <div class="space-y-4 {docketInfoBackgroundClass} px-4 py-3 rounded">
    <!-- Quote or Repair -->
    <div>
      <fieldset class="bg-white border border-gray-300 rounded-lg px-4 py-3">
        <legend class="block text-sm font-medium text-gray-700 mb-1">Quote or Repair</legend>
        <div class="flex items-center gap-6">
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <input id="quote-radio" type="radio" name="quoteOrRepair" value="Quote" bind:group={quoteOrRepair} class="h-4 w-4 text-blue-600" />
            <span>Quote</span>
          </label>
          <label class="inline-flex items-center gap-2 cursor-pointer">
            <input id="repair-radio" type="radio" name="quoteOrRepair" value="Repaired" bind:group={quoteOrRepair} class="h-4 w-4 text-blue-600" />
            <span>Repair</span>
          </label>
        </div>
      </fieldset>
    </div>

    <!-- Quote Description | Additional Information -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="quote-description">Quote Description</label>
        <textarea id="quote-description" rows="3" bind:value={quoteDescription} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="additional-information">Additional Information</label>
        <textarea id="additional-information" rows="3" bind:value={additionalInformation} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
      </div>
    </div>

    <!-- Stock On Hand | Labour -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="stock-on-hand">Stock On Hand</label>
        <input id="stock-on-hand" type="text" bind:value={stockOnHand} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="labour">Labour</label>
        <input id="labour" type="text" bind:value={labour} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>
    </div>

    <!-- Travel Time | Call out -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="travel-time">Travel Time</label>
        <input id="travel-time" type="text" bind:value={travelTime} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="call-out">Call out</label>
        <input id="call-out" type="text" bind:value={callOut} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>
    </div>

    <!-- Parts -->
    <div>
      <div class="flex items-center justify-between border border-gray-300 px-4 py-3 rounded-lg" style="background-color: rgb(30, 30, 30);">
        <h3 class="font-medium text-white">Parts</h3>
        <button type="button" on:click={addPartRow} class="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">Add</button>
      </div>

      <div class="mt-3 space-y-3">
        {#each parts as part, idx}
          <div class="flex gap-4 items-end">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1" for={`sku-${idx}`}>SKU</label>
              <input id={`sku-${idx}`} type="text" bind:value={part.sku} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1" for={`qty-${idx}`}>Quantity</label>
              <input id={`qty-${idx}`} type="text" bind:value={part.quantity} class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div class="flex items-end">
              <button
                type="button"
                on:click={() => removePartRow(idx)}
                disabled={parts.length <= 1}
                class="w-10 h-10 flex items-center justify-center px-2 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600 transition-colors"
                aria-label="Remove part row"
              >
                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
