<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let paymentDate = '';
	export let isLoading = false;

	const dispatch = createEventDispatcher<{
		transactionHistory: void;
		submit: void;
	}>();
</script>

<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
	<div class="flex items-center space-x-4">
		<label for="payment-date" class="form-label mb-0">Payment Date:</label>
		<input
			type="date"
			id="payment-date"
			class="bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-1.5 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-500 transition-colors"
			required
			bind:value={paymentDate}
		/>
	</div>
	<div class="flex items-center space-x-3">
		<button
			type="button"
			class="btn-secondary text-sm"
			on:click={() => dispatch('transactionHistory')}
		>
			Transaction History
		</button>
		<button
			type="button"
			class="btn-primary text-sm flex items-center gap-2"
			on:click={() => dispatch('submit')}
			disabled={isLoading}
		>
			{#if isLoading}
				<svg class="animate-spin -ml-1 mr-1 h-4 w-4 text-gray-950" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				Submitting...
			{:else}
				Submit All Payments
			{/if}
		</button>
	</div>
</div>
