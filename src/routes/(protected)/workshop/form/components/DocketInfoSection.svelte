<script lang="ts">
  export let workshopStatus: string | null;

  export let quoteOrRepair: string;
  export let quoteDescription: string;
  export let additionalInformation: string;
  export let stockOnHand: string;
  export let labour: string;
  export let travelTime: string;
  export let callOut: string;

  export let parts: Array<{ sku: string; quantity: string }>;
  export let addPartRow: () => void;
  export let removePartRow: (index: number) => void;

  export let docketInfoBackgroundClass: string;
</script>

<!-- Docket Info - Only show for non-new and non-pickup workshops -->
{#if workshopStatus && workshopStatus !== 'new' && workshopStatus !== 'pickup'}
  <!-- Docket Info Title -->
  <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-[#181b20] border border-[#262a30]">
    <h2 class="font-semibold text-white">Docket Info</h2>
  </div>

  <!-- Docket Info Content -->
  <div class="space-y-5 {docketInfoBackgroundClass} p-5 rounded-xl">
    <!-- Quote or Repair -->
    <div>
      <fieldset class="bg-[#0e1012] border border-[#262a30] rounded-lg px-4 py-3">
        <legend class="block text-sm font-medium text-gray-300 mb-1.5">Quote or Repair</legend>
        <div class="flex items-center gap-6">
          <label class="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-200">
            <input id="quote-radio" type="radio" name="quoteOrRepair" value="Quote" bind:group={quoteOrRepair} class="h-4 w-4 rounded-full border-[#333842] bg-[#0e1012] text-lime-500 focus:ring-lime-500 focus:ring-offset-[#141619]" />
            <span>Quote</span>
          </label>
          <label class="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-200">
            <input id="repair-radio" type="radio" name="quoteOrRepair" value="Repair" bind:group={quoteOrRepair} class="h-4 w-4 rounded-full border-[#333842] bg-[#0e1012] text-lime-500 focus:ring-lime-500 focus:ring-offset-[#141619]" />
            <span>Repair</span>
          </label>
        </div>
      </fieldset>
    </div>

    <!-- Quote Description | Additional Information -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1.5" for="quote-description">Quote Description</label>
        <textarea id="quote-description" rows="3" bind:value={quoteDescription} placeholder="Enter quote description..." class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-4 py-3 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"></textarea>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1.5" for="additional-information">Additional Information</label>
        <textarea id="additional-information" rows="3" bind:value={additionalInformation} placeholder="Enter additional information..." class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-4 py-3 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"></textarea>
      </div>
    </div>

    <!-- Stock On Hand | Labour -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1.5" for="stock-on-hand">Stock On Hand</label>
        <input id="stock-on-hand" type="text" bind:value={stockOnHand} placeholder="Enter stock on hand" class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-4 py-3 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors" />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1.5" for="labour">Labour</label>
        <input id="labour" type="text" bind:value={labour} placeholder="Enter labour details" class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-4 py-3 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors" />
      </div>
    </div>

    <!-- Travel Time | Call out -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1.5" for="travel-time">Travel Time</label>
        <input id="travel-time" type="text" bind:value={travelTime} placeholder="Enter travel time" class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-4 py-3 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors" />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1.5" for="call-out">Call out</label>
        <input id="call-out" type="text" bind:value={callOut} placeholder="Enter call out details" class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-4 py-3 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors" />
      </div>
    </div>

    <!-- Parts -->
    <div>
      <div class="flex items-center justify-between border border-[#262a30] px-4 py-3 rounded-xl bg-[#181b20]">
        <h3 class="font-semibold text-white">Parts</h3>
        <button type="button" on:click={addPartRow} class="btn-primary text-xs px-3 py-1.5">Add Part</button>
      </div>

      <div class="mt-3 space-y-3">
        {#each parts as part, idx}
          <div class="flex gap-4 items-end">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-300 mb-1.5" for={`sku-${idx}`}>SKU</label>
              <input id={`sku-${idx}`} type="text" bind:value={part.sku} placeholder="Enter SKU" class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-4 py-3 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors" />
            </div>
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-300 mb-1.5" for={`qty-${idx}`}>Quantity</label>
              <input id={`qty-${idx}`} type="text" bind:value={part.quantity} placeholder="Enter quantity" class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-4 py-3 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors" />
            </div>
            <div class="flex items-end">
              <button
                type="button"
                on:click={() => removePartRow(idx)}
                disabled={parts.length <= 1}
                class="w-11 h-11 flex items-center justify-center rounded-lg border border-red-500/30 bg-red-950/20 text-red-400 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Remove part row"
              >
                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
