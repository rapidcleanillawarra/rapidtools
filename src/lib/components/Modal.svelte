<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';

	export let show: boolean = false;
	export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
	export let allowClose: boolean = true;
	export let style: string = '';

	const dispatch = createEventDispatcher();

	function closeModal() {
		dispatch('close');
	}

	// Close on escape key
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && allowClose) {
			closeModal();
		}
	}
</script>

<svelte:window on:keydown={allowClose ? handleKeydown : undefined} />

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center"
		transition:fade={{ duration: 200 }}
	>
		{#if allowClose}
			<button
				type="button"
				class="absolute inset-0 bg-black bg-opacity-50 cursor-default"
				aria-label="Close modal"
				on:click={closeModal}
			></button>
		{:else}
			<div class="absolute inset-0 bg-black bg-opacity-50" aria-hidden="true"></div>
		{/if}
		<div
			class="relative z-10 bg-white rounded-lg shadow-xl p-6 w-full {size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : size === 'xl' ? 'max-w-4xl' : 'max-w-lg'}"
			style={style}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<div class="flex justify-between items-center border-b pb-3 mb-4">
				<h2 class="text-xl font-semibold">
					<slot name="header">Modal Title</slot>
				</h2>
				{#if allowClose}
					<button type="button" on:click={closeModal} class="text-gray-500 hover:text-gray-800 text-2xl" aria-label="Close modal"
						>&times;</button
					>
				{/if}
			</div>
			<div class="modal-content">
				<slot name="body">Modal Content</slot>
			</div>
			<div class="modal-footer border-t pt-4 mt-6">
				<slot name="footer" />
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-footer:not(:has(> :global(*))) {
		display: none;
	}
</style>