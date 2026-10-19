<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		parseNoteContent,
		type NoteAttachment,
		type ProcessedOrder
	} from '../pastDueAccounts';

	export let show = false;
	export let selectedOrder: ProcessedOrder | null = null;
	export let newNote = '';
	export let outlookLink = '';
	export let pendingFiles: File[] = [];
	export let notesLoading = false;
	export let uploadError = '';

	const dispatch = createEventDispatcher<{
		close: void;
		save: void;
	}>();

	let fileInput: HTMLInputElement;
	let isDragging = false;
	let previewImageUrl: string | null = null;

	function classifyFile(file: File): 'image' | 'email' | 'file' {
		const lower = file.name.toLowerCase();
		if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lower)) {
			return 'image';
		}
		if (
			lower.endsWith('.eml') ||
			lower.endsWith('.msg') ||
			file.type === 'message/rfc822' ||
			file.type === 'application/vnd.ms-outlook'
		) {
			return 'email';
		}
		return 'file';
	}

	function addFiles(files: FileList | File[]) {
		const incoming = Array.from(files);
		if (incoming.length === 0) return;
		pendingFiles = [...pendingFiles, ...incoming];
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			addFiles(target.files);
			target.value = '';
		}
	}

	function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;

		const imageFiles: File[] = [];
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.kind === 'file' && item.type.startsWith('image/')) {
				const blob = item.getAsFile();
				if (blob) {
					const ext = blob.type.split('/')[1] || 'png';
					const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
					const namedFile = new File([blob], `pasted-image-${timestamp}.${ext}`, {
						type: blob.type
					});
					imageFiles.push(namedFile);
				}
			}
		}

		if (imageFiles.length > 0) {
			addFiles(imageFiles);
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
			addFiles(event.dataTransfer.files);
		}
	}

	function removePendingFile(index: number) {
		pendingFiles = pendingFiles.filter((_, i) => i !== index);
	}

	function createObjectUrl(file: File): string {
		return URL.createObjectURL(file);
	}

	$: canSave =
		!notesLoading &&
		(Boolean(newNote.trim()) || Boolean(outlookLink.trim()) || pendingFiles.length > 0);
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
			class="relative w-full max-w-2xl rounded-2xl border border-[#262a30] bg-[#141619] p-6 text-left shadow-2xl transition-all"
			on:dragover|preventDefault={() => (isDragging = true)}
			on:dragleave={() => (isDragging = false)}
			on:drop={handleDrop}
		>
			<div>
				<div class="flex items-start justify-between gap-4">
					<div>
						<h3 class="text-lg font-bold text-white" id="modal-title">
							Notes for Invoice {selectedOrder.invoice}
						</h3>
						<p class="mt-1 text-sm text-gray-400">
							Customer: <span class="text-gray-200 font-medium">{selectedOrder.customer}</span>
						</p>
					</div>
					<button
						type="button"
						on:click={() => dispatch('close')}
						class="rounded-lg p-1.5 text-gray-400 transition hover:bg-[#23272e] hover:text-gray-200"
						aria-label="Close modal"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				<!-- Existing Notes -->
				<div class="mt-4 mb-4 max-h-64 overflow-y-auto space-y-2.5 pr-1">
					<h4 class="text-xs font-semibold uppercase tracking-wider text-gray-400">
						Past Notes:
					</h4>
					{#if notesLoading && selectedOrder.notes.length === 0}
						<p class="text-sm text-gray-400">Loading notes...</p>
					{:else if selectedOrder.notes.length === 0}
						<p class="text-sm italic text-gray-500">No notes yet</p>
					{:else}
						<div class="space-y-2.5">
							{#each selectedOrder.notes as note, index}
								{@const parsed = parseNoteContent(note.note)}
								{@const imageAttachments = parsed.attachments.filter((a) => a.type === 'image')}
								{@const otherAttachments = parsed.attachments.filter((a) => a.type !== 'image')}
								<div class="rounded-xl border border-[#262a30] bg-[#181b20] p-3.5">
									{#if parsed.text}
										<p class="text-sm text-gray-200 whitespace-pre-wrap break-words">
											{parsed.text}
										</p>
									{/if}

									<!-- Outlook Links & Email/File Attachments -->
									{#if parsed.outlookLinks.length > 0 || otherAttachments.length > 0}
										<div class="mt-2.5 flex flex-wrap items-center gap-2">
											{#each parsed.outlookLinks as link, linkIdx}
												<a
													href={link}
													target="_blank"
													rel="noopener noreferrer"
													class="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-950/40 px-2.5 py-1 text-xs font-medium text-sky-300 transition hover:border-sky-400/50 hover:bg-sky-900/50 hover:text-sky-200"
												>
													<svg
														class="h-3.5 w-3.5"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
														/>
													</svg>
													Open in Outlook{parsed.outlookLinks.length > 1
														? ` #${linkIdx + 1}`
														: ''}
												</a>
											{/each}

											{#each otherAttachments as att}
												<a
													href={att.url}
													target="_blank"
													rel="noopener noreferrer"
													download={att.name}
													class="inline-flex items-center gap-1.5 rounded-lg border border-[#2f3540] bg-[#20242c] px-2.5 py-1 text-xs font-medium text-gray-200 transition hover:border-lime-500/40 hover:text-lime-300"
												>
													{#if att.type === 'email'}
														<svg
															class="h-3.5 w-3.5 text-amber-400"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
															/>
														</svg>
													{:else}
														<svg
															class="h-3.5 w-3.5 text-gray-400"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
															/>
														</svg>
													{/if}
													<span class="max-w-[200px] truncate">{att.name}</span>
												</a>
											{/each}
										</div>
									{/if}

									<!-- Image Attachments -->
									{#if imageAttachments.length > 0}
										<div class="mt-2.5 flex flex-wrap gap-2">
											{#each imageAttachments as img}
												<button
													type="button"
													on:click={() => (previewImageUrl = img.url)}
													class="group relative overflow-hidden rounded-lg border border-[#2c313a] bg-[#111316] transition hover:border-lime-400/60"
													title="Click to enlarge {img.name}"
												>
													<img
														src={img.url}
														alt={img.name}
														class="h-20 w-28 object-cover transition group-hover:scale-105"
													/>
												</button>
											{/each}
										</div>
									{/if}

									<div class="mt-2.5 flex items-center justify-between text-xs text-gray-400">
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
				<div class="mt-4 space-y-3">
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label for="new-note" class="block text-sm font-medium text-gray-300">
								Add New Note:
							</label>
							<span class="text-xs text-gray-400">
								Tip: You can paste images (<kbd class="rounded bg-[#22262c] px-1.5 py-0.5 text-[11px] text-gray-300">Ctrl+V</kbd>) directly
							</span>
						</div>
						<textarea
							id="new-note"
							rows="3"
							class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] p-3 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
							placeholder="Enter your note, paste an Outlook link, or paste an image (Ctrl+V)..."
							bind:value={newNote}
							on:paste={handlePaste}
							disabled={notesLoading}
							autofocus
						></textarea>
					</div>

					<!-- Outlook Web Link Input & File Upload Controls -->
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div>
							<label
								for="outlook-link"
								class="block text-xs font-medium text-gray-400 mb-1"
							>
								Outlook Email Link (optional)
							</label>
							<div class="relative">
								<input
									id="outlook-link"
									type="url"
									bind:value={outlookLink}
									disabled={notesLoading}
									placeholder="https://outlook.office.com/mail/..."
									class="w-full rounded-lg border border-[#262a30] bg-[#0e1012] px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
								/>
							</div>
						</div>

						<div>
							<span class="block text-xs font-medium text-gray-400 mb-1">
								Upload Email (.eml / .msg) or Image
							</span>
							<input
								bind:this={fileInput}
								type="file"
								multiple
								accept="image/*,.eml,.msg,message/rfc822,application/vnd.ms-outlook"
								on:change={handleFileChange}
								class="hidden"
							/>
							<button
								type="button"
								disabled={notesLoading}
								on:click={() => fileInput?.click()}
								class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition {isDragging
									? 'border-lime-400 bg-lime-950/20 text-lime-300'
									: 'border-[#323842] bg-[#111316] text-gray-300 hover:border-lime-500/50 hover:bg-[#181b20] hover:text-white'}"
							>
								<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
									/>
								</svg>
								<span>Choose or drop files (.eml, .msg, images)</span>
							</button>
						</div>
					</div>

					<!-- Pending Files Preview -->
					{#if pendingFiles.length > 0}
						<div class="rounded-xl border border-[#262a30] bg-[#111316] p-3">
							<div class="mb-2 text-xs font-medium text-gray-400">
								Attachments to upload ({pendingFiles.length}):
							</div>
							<div class="flex flex-wrap gap-2">
								{#each pendingFiles as file, idx}
									{@const kind = classifyFile(file)}
									<div
										class="flex items-center gap-2 rounded-lg border border-[#2c313a] bg-[#181b20] px-2.5 py-1.5 text-xs text-gray-200"
									>
										{#if kind === 'image'}
											<img
												src={createObjectUrl(file)}
												alt={file.name}
												class="h-7 w-7 rounded object-cover"
											/>
										{:else if kind === 'email'}
											<svg
												class="h-4 w-4 text-amber-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
												/>
											</svg>
										{:else}
											<svg
												class="h-4 w-4 text-gray-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
												/>
											</svg>
										{/if}
										<span class="max-w-[160px] truncate">{file.name}</span>
										<button
											type="button"
											on:click={() => removePendingFile(idx)}
											class="ml-1 rounded p-0.5 text-gray-400 transition hover:bg-[#262a30] hover:text-red-400"
											title="Remove attachment"
										>
											<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M6 18L18 6M6 6l12 12"
												/>
											</svg>
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if uploadError}
						<p class="text-xs text-red-400">{uploadError}</p>
					{/if}
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
					disabled={!canSave}
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

	{#if previewImageUrl}
		<div
			class="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
			on:click={() => (previewImageUrl = null)}
			on:keydown={(e) => e.key === 'Escape' && (previewImageUrl = null)}
			role="button"
			tabindex="0"
		>
			<img
				src={previewImageUrl}
				alt="Enlarged note attachment"
				class="max-h-[90vh] max-w-[90vw] rounded-xl border border-[#262a30] object-contain shadow-2xl"
			/>
		</div>
	{/if}
{/if}

