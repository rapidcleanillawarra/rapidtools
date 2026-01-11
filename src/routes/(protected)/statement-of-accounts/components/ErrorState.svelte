<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let error: string;

	const dispatch = createEventDispatcher<{ retry: void }>();

	function handleRetry() {
		dispatch('retry');
	}
</script>

<div class="rounded-lg bg-red-50 p-6 shadow-md">
	<div class="flex">
		<div class="flex-shrink-0">
			<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
					clip-rule="evenodd"
				/>
			</svg>
		</div>
		<div class="ml-3">
			<h3 class="text-sm font-medium text-red-800">Error loading statement accounts</h3>
			<div class="mt-2 text-sm text-red-700">
				<p>{error}</p>
			</div>
			<div class="mt-4">
				<button
					on:click={handleRetry}
					class="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
				>
					Try Again
				</button>
			</div>
		</div>
	</div>
</div>
