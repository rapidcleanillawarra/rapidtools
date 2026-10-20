<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { allDepartments, addDepartment } from '../stores';
	import { BUCKET_COLOR_PALETTE } from '../types';
	import { toastSuccess, toastError } from '$lib/utils/toast';

	export let open = false;

	const dispatch = createEventDispatcher<{
		close: void;
		created: { name: string; color: string };
	}>();

	let bucketName = '';
	let selectedColor = BUCKET_COLOR_PALETTE[0].class;
	let isSubmitting = false;
	let inputEl: HTMLInputElement | null = null;

	$: if (open) {
		bucketName = '';
		selectedColor = BUCKET_COLOR_PALETTE[Math.floor(Math.random() * BUCKET_COLOR_PALETTE.length)].class;
		setTimeout(() => inputEl?.focus(), 50);
	}

	function handleClose() {
		if (isSubmitting) return;
		bucketName = '';
		dispatch('close');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			handleClose();
		}
	}

	async function handleSubmit() {
		const trimmed = bucketName.trim();
		if (!trimmed) {
			toastError('Bucket or department name is required');
			return;
		}

		const exists = $allDepartments.some(
			(d) => d.toLowerCase() === trimmed.toLowerCase()
		);
		if (exists) {
			toastError(`Bucket "${trimmed}" already exists`);
			return;
		}

		isSubmitting = true;
		try {
			await addDepartment(trimmed, selectedColor);
			toastSuccess(`Bucket "${trimmed}" created`);
			dispatch('created', { name: trimmed, color: selectedColor });
			handleClose();
		} catch (err: any) {
			console.error('Failed to create bucket:', err);
			toastError(err?.message || 'Failed to create bucket');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
		on:click={handleClose}
		role="dialog"
		aria-modal="true"
	>
		<!-- Modal Content -->
		<div
			on:click|stopPropagation
			class="relative w-full max-w-md rounded-2xl border border-[#262a30] bg-[#141619] p-6 shadow-2xl text-gray-200"
		>
			<!-- Header -->
			<div class="mb-5 flex items-start justify-between">
				<div>
					<h3 class="text-lg font-bold text-white">Add bucket or department</h3>
					<p class="mt-0.5 text-xs text-gray-400">
						Create a new column to organize tasks.
					</p>
				</div>
				<button
					type="button"
					on:click={handleClose}
					class="rounded-lg p-1 text-gray-400 transition hover:bg-[#1f2329] hover:text-gray-200"
					aria-label="Close"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Form -->
			<form on:submit|preventDefault={handleSubmit} class="space-y-5">
				<!-- Bucket Name Input -->
				<div>
					<label for="new-bucket-name" class="mb-1.5 block text-xs font-semibold text-gray-300">
						Bucket / Department name <span class="text-red-400">*</span>
					</label>
					<input
						id="new-bucket-name"
						type="text"
						bind:this={inputEl}
						bind:value={bucketName}
						placeholder="e.g. Sales, Marketing, Logistics..."
						class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition focus:border-lime-500 focus:outline-none"
					/>
				</div>

				<!-- Color Swatches -->
				<div>
					<label class="mb-2 block text-xs font-semibold text-gray-300">
						Header dot color
					</label>
					<div class="flex flex-wrap gap-2.5">
						{#each BUCKET_COLOR_PALETTE as opt}
							<button
								type="button"
								on:click={() => (selectedColor = opt.class)}
								class="relative flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-none {selectedColor === opt.class
									? 'ring-2 ring-lime-400 ring-offset-2 ring-offset-[#141619]'
									: ''}"
								title={opt.label}
							>
								<span class="h-6 w-6 rounded-full {opt.class}"></span>
								{#if selectedColor === opt.class}
									<svg class="absolute h-3.5 w-3.5 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
									</svg>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<!-- Actions -->
				<div class="flex items-center justify-end gap-3 pt-3 border-t border-[#262a30]">
					<button
						type="button"
						on:click={handleClose}
						disabled={isSubmitting}
						class="rounded-lg border border-[#2a2f37] bg-[#181b20] px-4 py-2 text-xs font-semibold text-gray-300 transition hover:bg-[#20242b] hover:text-white"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSubmitting || !bucketName.trim()}
						class="inline-flex items-center gap-1.5 rounded-lg bg-lime-400 px-4 py-2 text-xs font-semibold text-gray-950 shadow-md transition hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if isSubmitting}
							<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
							</svg>
							<span>Creating...</span>
						{:else}
							<svg class="h-3.5 w-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
							</svg>
							<span>Add bucket</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
