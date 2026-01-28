<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ProcessedOrder } from '../pastDueAccounts';

	export let show = false;
	export let selectedOrder: ProcessedOrder | null = null;
	export let newNote = '';
	export let notesLoading = false;

	const dispatch = createEventDispatcher<{
		close: void;
		save: void;
	}>();
</script>

{#if show && selectedOrder}
	<div
		class="fixed inset-0 z-50 overflow-y-auto"
		aria-labelledby="modal-title"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0"
		>
			<div
				class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
				aria-hidden="true"
				on:click={() => dispatch('close')}
			></div>

			<span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true"
				>&#8203;</span
			>

			<div
				class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all dark:bg-gray-800 sm:my-8 sm:w-full sm:max-w-lg sm:align-middle"
			>
				<div class="bg-white px-4 pb-4 pt-5 dark:bg-gray-800 sm:p-6 sm:pb-4">
					<div class="sm:flex sm:items-start">
						<div class="mt-3 w-full text-center sm:mt-0 sm:text-left">
							<h3
								class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
								id="modal-title"
							>
								Notes for Invoice {selectedOrder.invoice}
							</h3>
							<div class="mt-4">
								<p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
									Customer: {selectedOrder.customer}
								</p>

								<!-- Existing Notes -->
								<div class="mb-4 max-h-60 overflow-y-auto">
									<h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
										Past Notes:
									</h4>
									{#if notesLoading}
										<p class="text-sm text-gray-500 dark:text-gray-400">Loading notes...</p>
									{:else if selectedOrder.notes.length === 0}
										<p class="text-sm italic text-gray-500 dark:text-gray-400">No notes yet</p>
									{:else}
										<div class="space-y-2">
											{#each selectedOrder.notes as note, index}
												<div class="rounded-md bg-gray-50 p-3 dark:bg-gray-700">
													<p class="text-sm text-gray-900 dark:text-gray-100">{note.note}</p>
													<div class="mt-1 flex items-center justify-between">
														<p class="text-xs text-gray-500 dark:text-gray-400">
															Note #{index + 1}
														</p>
														<p class="text-xs text-gray-500 dark:text-gray-400">
															{note.creator_full_name || note.created_by} â€¢ {new Date(
																note.created_at
															).toLocaleDateString()}
														</p>
													</div>
												</div>
											{/each}
										</div>
									{/if}
								</div>

								<!-- Add New Note -->
								<div>
									<label
										for="new-note"
										class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
									>
										Add New Note:
									</label>
									<textarea
										id="new-note"
										rows="3"
										class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										placeholder="Enter your note here..."
										bind:value={newNote}
										disabled={notesLoading}
										autofocus
									></textarea>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div class="bg-gray-50 px-4 py-3 dark:bg-gray-700 sm:flex sm:flex-row-reverse sm:px-6">
					<button
						type="button"
						on:click={() => dispatch('save')}
						disabled={!newNote.trim() || notesLoading}
						class="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm"
					>
						{#if notesLoading}
							Saving...
						{:else}
							Add Note
						{/if}
					</button>
					<button
						type="button"
						on:click={() => dispatch('close')}
						class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-500 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 sm:ml-3 sm:mt-0 sm:w-auto sm:text-sm"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
