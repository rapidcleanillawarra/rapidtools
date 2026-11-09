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
		background: #1f2329;
		box-shadow: inset 0 -1px 0 #84cc16;
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
		border-bottom: 1px solid #262a30;
	}

	.parts-editor-trigger-row:last-child {
		padding-bottom: 0;
		border-bottom: none;
	}

	.parts-editor-trigger-sku {
		font-size: 0.75rem;
		font-weight: 600;
		font-family: 'Consolas', 'Courier New', monospace;
		color: #a3e635;
		word-break: break-word;
	}

	.parts-editor-trigger-name {
		font-size: 0.8125rem;
		color: #e5e7eb;
		word-break: break-word;
	}

	.parts-editor-trigger-empty {
		color: #6b7280;
	}

	.parts-editor-modal-copy {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		color: #9ca3af;
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
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: #9ca3af;
	}

	.parts-editor-input {
		width: 100%;
		min-width: 0;
		background: #0e1012;
		border: 1px solid #262a30;
		border-radius: 0.5rem;
		padding: 0.5rem 0.625rem;
		font-size: 0.875rem;
		color: #e5e7eb;
		transition: border-color 150ms, box-shadow 150ms;
	}

	.parts-editor-input:focus {
		outline: none;
		border-color: #84cc16;
		box-shadow: 0 0 0 1px #84cc16;
	}

	.parts-editor-remove {
		flex-shrink: 0;
		width: 2rem;
		height: 2.375rem;
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 0.5rem;
		background: rgba(127, 29, 29, 0.2);
		color: #f87171;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		transition: background 150ms, color 150ms;
	}

	.parts-editor-remove:hover {
		color: #fca5a5;
		background: rgba(127, 29, 29, 0.4);
	}

	.parts-editor-add {
		margin-top: 0.75rem;
		border: none;
		background: transparent;
		padding: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #a3e635;
		cursor: pointer;
		transition: color 150ms;
	}

	.parts-editor-add:hover {
		color: #bef264;
		text-decoration: underline;
	}

	.parts-editor-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.parts-editor-btn {
		border: 1px solid #333842;
		border-radius: 0.5rem;
		background: #1f2329;
		padding: 0.5rem 0.875rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #e5e7eb;
		cursor: pointer;
		transition: all 150ms;
	}

	.parts-editor-btn:hover {
		background: #262a30;
		color: #a3e635;
		border-color: #84cc16;
	}

	.parts-editor-btn--primary {
		border-color: #84cc16;
		background: #84cc16;
		color: #090a0b;
		font-weight: 700;
	}

	.parts-editor-btn--primary:hover {
		background: #a3e635;
		border-color: #a3e635;
		color: #090a0b;
	}
</style>
