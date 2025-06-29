<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';

	export let show = false;

	const dispatch = createEventDispatcher();

	function closeModal() {
		dispatch('close');
	}

	// Close on escape key
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeModal();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
		on:click={closeModal}
		transition:fade={{ duration: 200 }}
	>
		<div
			class="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg"
			on:click|stopPropagation
			role="dialog"
			aria-modal="true"
		>
			<div class="flex justify-between items-center border-b pb-3 mb-4">
				<h2 class="text-xl font-semibold">
					<slot name="header">Modal Title</slot>
				</h2>
				<button on:click={closeModal} class="text-gray-500 hover:text-gray-800 text-2xl"
					>&times;</button
				>
			</div>
			<div class="modal-content">
				<slot name="body">Modal Content</slot>
			</div>
		</div>
	</div>
{/if} 