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
		class="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
		aria-labelledby="modal-title"
		role="dialog"
		aria-modal="true"
	>
		<div class="fixed inset-0" aria-hidden="true" on:click={() => dispatch('close')}></div>

		<div
			class="relative w-full max-w-lg rounded-2xl border border-[#262a30] bg-[#141619] p-6 text-left shadow-2xl transition-all"
		>
			<div>
				<h3 class="text-lg font-bold text-white" id="modal-title">
					Notes for Invoice {selectedOrder.invoice}
				</h3>
				<p class="mt-1 text-sm text-gray-400">
					Customer: <span class="text-gray-200 font-medium">{selectedOrder.customer}</span>
				</p>

				<!-- Existing Notes -->
				<div class="mt-4 mb-4 max-h-60 overflow-y-auto space-y-2 pr-1">
					<h4 class="text-xs font-semibold uppercase tracking-wider text-gray-400">
						Past Notes:
					</h4>
					{#if notesLoading}
						<p class="text-sm text-gray-400">Loading notes...</p>
					{:else if selectedOrder.notes.length === 0}
						<p class="text-sm italic text-gray-500">No notes yet</p>
					{:else}
						<div class="space-y-2">
							{#each selectedOrder.notes as note, index}
								<div class="rounded-xl border border-[#262a30] bg-[#181b20] p-3">
									<p class="text-sm text-gray-200">{note.note}</p>
									<div class="mt-2 flex items-center justify-between text-xs text-gray-400">
										<span>Note #{index + 1}</span>
										<span>
											{note.creator_full_name || note.created_by} • {new Date(
												note.created_at
											).toLocaleDateString()}
										</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Add New Note -->
				<div class="mt-4">
					<label for="new-note" class="block text-sm font-medium text-gray-300 mb-1.5">
						Add New Note:
					</label>
					<textarea
						id="new-note"
						rows="3"
						class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] p-3 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
						placeholder="Enter your note here..."
						bind:value={newNote}
						disabled={notesLoading}
						autofocus
					></textarea>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-3 border-t border-[#262a30] pt-4">
				<button
					type="button"
					on:click={() => dispatch('close')}
					class="btn-secondary text-sm"
				>
					Close
				</button>
				<button
					type="button"
					on:click={() => dispatch('save')}
					disabled={!newNote.trim() || notesLoading}
					class="btn-primary text-sm"
				>
					{#if notesLoading}
						Saving...
					{:else}
						Add Note
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
