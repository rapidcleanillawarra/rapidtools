<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let paymentDate = '';
	export let isLoading = false;

	const dispatch = createEventDispatcher<{
		transactionHistory: void;
		submit: void;
	}>();
</script>

<div class="flex justify-between items-center mb-6">
	<div class="flex items-center space-x-4">
		<label for="payment-date" class="text-sm font-medium text-gray-700">Payment Date:</label>
		<input
			type="date"
			id="payment-date"
			class="border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
			required
			bind:value={paymentDate}
		/>
	</div>
	<div class="flex space-x-4">
		<button
			type="button"
			class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
			on:click={() => dispatch('transactionHistory')}
		>
			Transaction History
		</button>
		<button
			type="button"
			class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
			on:click={() => dispatch('submit')}
			disabled={isLoading}
		>
			{isLoading ? 'Submitting...' : 'Submit All Payments'}
		</button>
	</div>
</div>
