<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { groupedTasks, groupBy, allDepartments, addDepartment } from '../stores';
	import TaskBoardColumn from './TaskBoardColumn.svelte';
	import { BUCKET_COLOR_PALETTE, type TaskItem, type TaskStatus } from '../types';
	import { toastSuccess, toastError } from '$lib/utils/toast';

	const dispatch = createEventDispatcher<{
		addTask: string;
		selectTask: TaskItem;
		statusChange: { task: TaskItem; status: TaskStatus };
		deleteTask: TaskItem;
		addBucket: void;
	}>();

	let isAddingBucket = false;
	let newBucketName = '';
	let selectedColor = BUCKET_COLOR_PALETTE[0].class;
	let inputEl: HTMLInputElement | null = null;
	let isSubmitting = false;

	function startAddingBucket() {
		isAddingBucket = true;
		newBucketName = '';
		selectedColor = BUCKET_COLOR_PALETTE[Math.floor(Math.random() * BUCKET_COLOR_PALETTE.length)].class;
		setTimeout(() => inputEl?.focus(), 50);
	}

	function cancelAddingBucket() {
		isAddingBucket = false;
		newBucketName = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			cancelAddingBucket();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			submitNewBucket();
		}
	}

	async function submitNewBucket() {
		const trimmed = newBucketName.trim();
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
			cancelAddingBucket();
		} catch (err: any) {
			console.error('Failed to create bucket:', err);
			toastError(err?.message || 'Failed to create bucket');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="overflow-x-auto pb-4">
	<div class="flex items-start gap-4 min-w-max">
		{#each $groupedTasks as column (column.key)}
			<div class="w-80 flex-shrink-0">
				<TaskBoardColumn
					{column}
					on:addTask={(e) => dispatch('addTask', e.detail)}
					on:selectTask={(e) => dispatch('selectTask', e.detail)}
					on:statusChange={(e) => dispatch('statusChange', e.detail)}
					on:deleteTask={(e) => dispatch('deleteTask', e.detail)}
				/>
			</div>
		{/each}

		{#if $groupBy === 'department'}
			<div class="w-80 flex-shrink-0">
				{#if !isAddingBucket}
					<button
						type="button"
						on:click={startAddingBucket}
						class="group flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#262a30] bg-[#131519]/40 p-4 text-gray-400 transition hover:border-lime-500/50 hover:bg-[#131519] hover:text-lime-400"
					>
						<div class="flex h-9 w-9 items-center justify-center rounded-full bg-[#1c1f26] text-gray-400 transition group-hover:bg-lime-400 group-hover:text-gray-950">
							<svg class="h-4 w-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
							</svg>
						</div>
						<span class="text-xs font-semibold">Add bucket / department</span>
					</button>
				{:else}
					<div class="flex flex-col rounded-xl border border-[#262a30] bg-[#131519] p-3 shadow-xl">
						<div class="mb-2 flex items-center justify-between px-1">
							<span class="text-xs font-bold text-white">New bucket</span>
							<button
								type="button"
								on:click={cancelAddingBucket}
								class="rounded p-1 text-gray-400 transition hover:bg-[#1f2329] hover:text-gray-200"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						<input
							bind:this={inputEl}
							bind:value={newBucketName}
							on:keydown={handleKeydown}
							placeholder="e.g. Sales, Marketing..."
							class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] px-3 py-2 text-xs text-gray-100 placeholder-gray-500 transition focus:border-lime-500 focus:outline-none"
						/>

						<!-- Dot Color Swatches -->
						<div class="my-2.5 flex flex-wrap gap-1.5 px-0.5">
							{#each BUCKET_COLOR_PALETTE as opt}
								<button
									type="button"
									on:click={() => (selectedColor = opt.class)}
									class="relative flex h-5 w-5 items-center justify-center rounded-full transition-transform hover:scale-110 focus:outline-none {selectedColor === opt.class ? 'ring-2 ring-lime-400 ring-offset-1 ring-offset-[#131519]' : ''}"
									title={opt.label}
								>
									<span class="h-4 w-4 rounded-full {opt.class}"></span>
								</button>
							{/each}
						</div>

						<!-- Buttons -->
						<div class="flex items-center gap-2">
							<button
								type="button"
								on:click={submitNewBucket}
								disabled={isSubmitting || !newBucketName.trim()}
								class="flex-1 rounded-lg bg-lime-400 py-1.5 text-xs font-semibold text-gray-950 shadow transition hover:bg-lime-300 disabled:opacity-50"
							>
								{isSubmitting ? 'Adding...' : 'Add bucket'}
							</button>
							<button
								type="button"
								on:click={cancelAddingBucket}
								class="rounded-lg border border-[#2a2f37] bg-[#181b20] px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-[#20242b]"
							>
								Cancel
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
