<script>
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { publicUrlForPath, isImageType } from '$lib/assets/assetStorage';

	/** @typedef {import('$lib/assets/assetStorage').AssetFileRow} AssetFileRow */

	/** @type {AssetFileRow[]} */
	export let existing = [];
	/**
	 * Pending uploads: object URLs for preview (revoked on remove/destroy).
	 * @type {{ key: string; file: File; preview: string }[]}
	 */
	export let staged = [];
	export let disabled = false;
	/**
	 * @param {AssetFileRow} row
	 * @returns {void | Promise<void>}
	 */
	export let onDeleteExisting = () => {};
	export let showHeading = true;

	/** @type {HTMLInputElement | null} */
	let fileInput = null;

	/** @type {string | null} */
	let deletingId = null;

	// @ts-ignore — Svelte/strict: $: is valid
	$: existingWithUrl = (existing || []).map((row) => ({
		row,
		publicUrl: publicUrlForPath(row.storage_path)
	}));

	const dispatch = createEventDispatcher();

	function setStaged(/** @type {typeof staged} */ next) {
		dispatch('change', { staged: next });
	}

	function onFilesSelected(/** @type {Event} */ e) {
		const input = /** @type {HTMLInputElement} */ (e.currentTarget);
		if (!input.files?.length) {
			return;
		}
		/** @type {typeof staged} */
		/** @type {typeof staged} */
		const next = [...staged];
		for (const file of input.files) {
			const key = crypto.randomUUID();
			const isImg = file.type.startsWith('image/');
			const preview = isImg ? URL.createObjectURL(file) : '';
			next.push({ key, file, preview });
		}
		setStaged(next);
		input.value = '';
	}

	function removeStaged(/** @type {string} */ key) {
		const i = staged.findIndex((s) => s.key === key);
		if (i < 0) {
			return;
		}
		const item = staged[i];
		if (item.preview) {
			URL.revokeObjectURL(item.preview);
		}
		const next = staged.filter((s) => s.key !== key);
		setStaged(next);
	}

	async function handleDeleteExisting(/** @type {AssetFileRow} */ row) {
		if (deletingId) {
			return;
		}
		deletingId = row.id;
		try {
			await onDeleteExisting(row);
		} finally {
			deletingId = null;
		}
	}

	function triggerFilePick() {
		fileInput?.click();
	}

	onDestroy(() => {
		for (const s of staged) {
			if (s.preview) {
				URL.revokeObjectURL(s.preview);
			}
		}
	});
</script>

<section>
	{#if showHeading}
		<h2 class="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">Photos & files</h2>
		<p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
			Upload images or other files. Files are stored in the public <code class="rounded bg-gray-100 px-1 dark:bg-gray-800">assets</code> bucket and linked to
			this record.
		</p>
	{/if}
	<div class="mb-3 flex flex-wrap items-center gap-2">
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*,.pdf,application/pdf,.heic"
			multiple
			class="hidden"
			{disabled}
			on:change={onFilesSelected}
		/>
		<button
			type="button"
			{disabled}
			class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
			on:click={triggerFilePick}
		>
			Add files
		</button>
	</div>

	{#if existingWithUrl.length > 0}
		<p class="mb-2 text-xs font-medium uppercase text-gray-500">Saved</p>
		<ul class="mb-6 flex flex-wrap gap-3" role="list">
			{#each existingWithUrl as { row, publicUrl } (row.id)}
				<li
					class="group relative w-full max-w-[8rem] rounded-md border border-gray-200 p-0 dark:border-gray-600"
				>
					{#if isImageType(row.content_type ?? null)}
						<a
							href={publicUrl}
							target="_blank"
							rel="noreferrer"
							class="block aspect-square overflow-hidden rounded"
						>
							<img src={publicUrl} alt={row.file_name} class="h-full w-full object-cover" />
						</a>
					{:else}
						<a
							href={publicUrl}
							target="_blank"
							rel="noreferrer"
							class="flex aspect-square flex-col items-center justify-center gap-1 p-2 text-center text-xs text-gray-600 dark:text-gray-300"
						>
							<span class="line-clamp-2 font-medium" title={row.file_name}>{row.file_name}</span>
							<span class="text-[10px] text-gray-500">Open</span>
						</a>
					{/if}
					<button
						type="button"
						class="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white shadow hover:bg-red-700"
						aria-label="Delete file {row.file_name}"
						disabled={disabled || deletingId === row.id}
						on:click|stopPropagation={() => void handleDeleteExisting(row)}
					>
						×
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if staged.length > 0}
		<p class="mb-2 text-xs font-medium uppercase text-amber-700 dark:text-amber-400">Not yet uploaded</p>
		<ul class="flex flex-wrap gap-3" role="list">
			{#each staged as s (s.key)}
				<li
					class="group relative w-full max-w-[8rem] overflow-hidden rounded-md border-2 border-dashed border-amber-300 dark:border-amber-700/80"
				>
					{#if s.preview}
						<div class="aspect-square">
							<img src={s.preview} alt={s.file.name} class="h-full w-full object-cover" />
						</div>
					{:else}
						<div
							class="flex aspect-square flex-col items-center justify-center gap-1 p-2 text-center text-xs text-gray-600 dark:text-gray-300"
						>
							<span class="line-clamp-3" title={s.file.name}>{s.file.name}</span>
						</div>
					{/if}
					<button
						type="button"
						class="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white shadow hover:bg-red-700"
						aria-label="Remove from upload queue"
						{disabled}
						on:click={() => removeStaged(s.key)}
					>
						×
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if !existingWithUrl.length && !staged.length}
		<p class="text-sm text-gray-500 dark:text-gray-400">No files yet.</p>
	{/if}
</section>
