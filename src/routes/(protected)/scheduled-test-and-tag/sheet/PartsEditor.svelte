<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';
	import type { SheetPart } from './types';
	import {
		createEmptyPart,
		formatParts,
		formatPartsSummary,
		parseParts
	} from './utils';

	type DraftPart = SheetPart & { draftId: string };

	export let value = '';

	const dispatch = createEventDispatcher<{ change: string }>();

	let showModal = false;
	let draftParts: DraftPart[] = [];

	function toDraftParts(parts: SheetPart[]): DraftPart[] {
		return parts.map((part) => ({ ...part, draftId: crypto.randomUUID() }));
	}

	$: parts = parseParts(value);
	$: summary = formatPartsSummary(value);

	function formatPartLabel(part: SheetPart): string {
		const sku = part.sku.trim();
		const name = part.name.trim();
		if (sku && name) return `${sku} — ${name}`;
		return sku || name;
	}

	function openModal() {
		const parsed = parseParts(value);
		draftParts =
			parsed.length > 0 ? toDraftParts(parsed) : toDraftParts([createEmptyPart()]);
		showModal = true;
	}

	function closeModal() {
		showModal = false;
	}

	function addPart() {
		draftParts = [...draftParts, { ...createEmptyPart(), draftId: crypto.randomUUID() }];
	}

	function removePart(draftId: string) {
		draftParts = draftParts.filter((part) => part.draftId !== draftId);
		if (draftParts.length === 0) {
			draftParts = toDraftParts([createEmptyPart()]);
		}
	}

	function updatePart(draftId: string, field: keyof SheetPart, nextValue: string) {
		draftParts = draftParts.map((part) =>
			part.draftId === draftId ? { ...part, [field]: nextValue } : part
		);
	}

	function saveParts() {
		dispatch(
			'change',
			formatParts(draftParts.map(({ sku, name }) => ({ sku, name })))
		);
		closeModal();
	}
</script>

<button
	type="button"
	class="parts-editor-trigger"
	class:parts-editor-trigger--empty={parts.length === 0}
	on:click={openModal}
	title={summary || 'Add parts'}
	aria-label={summary ? `Edit parts: ${summary}` : 'Add parts'}
>
	{#if parts.length > 0}
		<ul class="parts-editor-trigger-list">
			{#each parts as part, index (formatPartLabel(part) + index)}
				<li class="parts-editor-trigger-row">
					{#if part.sku.trim()}
						<span class="parts-editor-trigger-sku">{part.sku.trim()}</span>
					{/if}
					{#if part.name.trim()}
						<span class="parts-editor-trigger-name">{part.name.trim()}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<span class="parts-editor-trigger-empty">Add parts…</span>
	{/if}
</button>

{#if showModal}
	<Modal show={showModal} on:close={closeModal} size="lg">
		<span slot="header">Parts</span>
		<div slot="body" class="parts-editor-modal">
			<p class="parts-editor-modal-copy">Add one or more parts with SKU and part name.</p>

			<div class="parts-editor-list" role="list">
				{#each draftParts as part (part.draftId)}
					<div class="parts-editor-row" role="listitem">
						<label class="parts-editor-field">
							<span class="parts-editor-label">SKU</span>
							<input
								type="text"
								class="parts-editor-input"
								value={part.sku}
								on:input={(e) =>
									updatePart(part.draftId, 'sku', (e.target as HTMLInputElement).value)}
								placeholder="SKU"
								autocomplete="off"
							/>
						</label>
						<label class="parts-editor-field parts-editor-field--grow">
							<span class="parts-editor-label">Part name</span>
							<input
								type="text"
								class="parts-editor-input"
								value={part.name}
								on:input={(e) =>
									updatePart(part.draftId, 'name', (e.target as HTMLInputElement).value)}
								placeholder="Part name"
								autocomplete="off"
							/>
						</label>
						<button
							type="button"
							class="parts-editor-remove"
							on:click={() => removePart(part.draftId)}
							aria-label="Remove part"
							title="Remove part"
						>
							×
						</button>
					</div>
				{/each}
			</div>

			<button type="button" class="parts-editor-add" on:click={addPart}>+ Add part</button>
		</div>
		<div slot="footer" class="parts-editor-footer">
			<button type="button" class="parts-editor-btn" on:click={closeModal}>Cancel</button>
			<button type="button" class="parts-editor-btn parts-editor-btn--primary" on:click={saveParts}>
				Save parts
			</button>
		</div>
	</Modal>
{/if}

<style>
	.parts-editor-trigger {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.125rem;
		width: 100%;
		min-width: 6rem;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.parts-editor-trigger:focus {
		outline: none;
		background: #fafafa;
		box-shadow: inset 0 -1px 0 #111;
	}

	.parts-editor-trigger-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.parts-editor-trigger-row {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.parts-editor-trigger-row:last-child {
		padding-bottom: 0;
		border-bottom: none;
	}

	.parts-editor-trigger-sku {
		font-size: 0.75rem;
		font-weight: 600;
		font-family: 'Consolas', 'Courier New', monospace;
		color: #1d4ed8;
		word-break: break-word;
	}

	.parts-editor-trigger-name {
		font-size: 0.8125rem;
		color: #111;
		word-break: break-word;
	}

	.parts-editor-trigger-empty {
		color: #9ca3af;
	}

	.parts-editor-modal-copy {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		color: #4b5563;
	}

	.parts-editor-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.parts-editor-row {
		display: flex;
		align-items: flex-end;
		gap: 0.75rem;
	}

	.parts-editor-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.parts-editor-field--grow {
		flex: 1;
	}

	.parts-editor-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #374151;
	}

	.parts-editor-input {
		width: 100%;
		min-width: 0;
		border: 1px solid #d1d5db;
		border-radius: 0.25rem;
		padding: 0.5rem 0.625rem;
		font-size: 0.875rem;
		color: #111;
	}

	.parts-editor-input:focus {
		outline: none;
		border-color: #111;
		box-shadow: 0 0 0 1px #111;
	}

	.parts-editor-remove {
		flex-shrink: 0;
		width: 2rem;
		height: 2.375rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.25rem;
		background: #fff;
		color: #6b7280;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
	}

	.parts-editor-remove:hover {
		color: #dc2626;
		border-color: #fecaca;
		background: #fef2f2;
	}

	.parts-editor-add {
		margin-top: 0.75rem;
		border: none;
		background: transparent;
		padding: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #2d6a2d;
		cursor: pointer;
	}

	.parts-editor-add:hover {
		text-decoration: underline;
	}

	.parts-editor-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.parts-editor-btn {
		border: 1px solid #d1d5db;
		border-radius: 0.25rem;
		background: #fff;
		padding: 0.5rem 0.875rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #111;
		cursor: pointer;
	}

	.parts-editor-btn:hover {
		background: #f9fafb;
	}

	.parts-editor-btn--primary {
		border-color: #2d6a2d;
		background: #2d6a2d;
		color: #fff;
	}

	.parts-editor-btn--primary:hover {
		background: #245a24;
	}
</style>
