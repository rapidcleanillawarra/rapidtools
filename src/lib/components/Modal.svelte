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
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		transition:fade={{ duration: 200 }}
	>
		{#if allowClose}
			<button
				type="button"
				class="absolute inset-0 bg-black/75 backdrop-blur-sm cursor-default"
				aria-label="Close modal"
				on:click={closeModal}
			></button>
		{:else}
			<div class="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-hidden="true"></div>
		{/if}
		<div
			class="relative z-10 bg-[#141619] text-gray-200 border border-[#262a30] rounded-xl shadow-2xl p-6 w-full {size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : size === 'xl' ? 'max-w-4xl' : 'max-w-lg'}"
			style={style}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<div class="flex justify-between items-center border-b border-[#262a30] pb-3 mb-4">
				<h2 class="text-xl font-bold text-gray-100">
					<slot name="header">Modal Title</slot>
				</h2>
				{#if allowClose}
					<button type="button" on:click={closeModal} class="text-gray-400 hover:text-lime-400 text-2xl transition-colors leading-none" aria-label="Close modal"
						>&times;</button
					>
				{/if}
			</div>
			<div class="modal-content text-gray-300">
				<slot name="body">Modal Content</slot>
			</div>
			<div class="modal-footer border-t border-[#262a30] pt-4 mt-6">
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