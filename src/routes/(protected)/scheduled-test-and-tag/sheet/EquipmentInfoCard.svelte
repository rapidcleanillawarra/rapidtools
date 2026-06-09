<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import MachineTypeDropdown from './MachineTypeDropdown.svelte';
	import {
		MACHINE_TYPE_OPTIONS,
		SIZE_OPTIONS,
		type SheetRow,
		type TextPasteColumnKey
	} from './types';

	export let row: SheetRow;
	export let rowIndex = 0;
	export let locationOptions: string[] = [];
	export let companySelected = false;

	const dispatch = createEventDispatcher<{
		update: { field: keyof SheetRow; value: string | boolean };
		paste: { event: ClipboardEvent; field: TextPasteColumnKey };
	}>();

	function update(field: keyof SheetRow, value: string | boolean) {
		dispatch('update', { field, value });
	}

	function handlePaste(event: ClipboardEvent, field: TextPasteColumnKey) {
		dispatch('paste', { event, field });
	}
</script>

<div class="equipment-info-card">
	<div class="equipment-info-card-top">
		<label class="equipment-info-card-field">
			<span class="equipment-info-card-label">Tag</span>
			<input
				type="text"
				value={row.tag}
				on:input={(e) => update('tag', (e.target as HTMLInputElement).value)}
				on:paste={(e) => handlePaste(e, 'tag')}
				class="equipment-info-card-input"
				placeholder="Customer tag"
			/>
		</label>
		<label class="equipment-info-card-active">
			<input
				type="checkbox"
				checked={row.active !== false}
				on:change={(e) => update('active', (e.target as HTMLInputElement).checked)}
				aria-label="Active for equipment {rowIndex + 1}"
			/>
			<span class="equipment-info-card-label">Active</span>
		</label>
	</div>

	<label class="equipment-info-card-field equipment-info-card-field--full">
		<span class="equipment-info-card-label">Name</span>
		<input
			type="text"
			value={row.machines}
			on:input={(e) => update('machines', (e.target as HTMLInputElement).value)}
			on:paste={(e) => handlePaste(e, 'machines')}
			class="equipment-info-card-input equipment-info-card-input--name"
			placeholder="Equipment name"
		/>
	</label>

	<div class="equipment-info-card-grid">
		<label class="equipment-info-card-field">
			<span class="equipment-info-card-label">Type</span>
			<MachineTypeDropdown
				value={row.typeOfMachine}
				options={MACHINE_TYPE_OPTIONS}
				placeholder="Select type…"
				on:change={(e) => update('typeOfMachine', e.detail)}
				on:paste={(e) => handlePaste(e.detail, 'typeOfMachine')}
			/>
		</label>

		<label class="equipment-info-card-field">
			<span class="equipment-info-card-label">Serial #</span>
			<input
				type="text"
				value={row.serialNumber}
				on:input={(e) => update('serialNumber', (e.target as HTMLInputElement).value)}
				on:paste={(e) => handlePaste(e, 'serialNumber')}
				class="equipment-info-card-input"
				placeholder="Serial #"
			/>
		</label>

		<label class="equipment-info-card-field">
			<span class="equipment-info-card-label">SKU</span>
			<input
				type="text"
				value={row.sku}
				on:input={(e) => update('sku', (e.target as HTMLInputElement).value)}
				on:paste={(e) => handlePaste(e, 'sku')}
				class="equipment-info-card-input equipment-info-card-input--link"
				placeholder="SKU"
			/>
		</label>

		<label class="equipment-info-card-field">
			<span class="equipment-info-card-label">Size</span>
			<MachineTypeDropdown
				value={row.size}
				options={SIZE_OPTIONS}
				placeholder="Select size…"
				on:change={(e) => update('size', e.detail)}
				on:paste={(e) => handlePaste(e.detail, 'size')}
			/>
		</label>
	</div>

	<label class="equipment-info-card-field equipment-info-card-field--full">
		<span class="equipment-info-card-label">Location</span>
		<select
			value={row.location}
			on:change={(e) => update('location', (e.target as HTMLSelectElement).value)}
			class="equipment-info-card-select sheet-header-select"
			disabled={!companySelected}
			title={row.location || 'Select location'}
		>
			<option value="">Select location…</option>
			{#each locationOptions as location (location)}
				<option value={location}>{location}</option>
			{/each}
		</select>
	</label>
</div>

<style>
	.equipment-info-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 14rem;
		padding: 0.625rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		background: #f9fafb;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	.equipment-info-card-top {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.equipment-info-card-field {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.equipment-info-card-field--full {
		width: 100%;
	}

	.equipment-info-card-active {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
		padding-bottom: 0.125rem;
	}

	.equipment-info-card-active input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
		accent-color: #2d6a2d;
	}

	.equipment-info-card-label {
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #6b7280;
	}

	.equipment-info-card-input {
		width: 100%;
		min-width: 0;
		border: none;
		border-bottom: 1px solid #d1d5db;
		background: transparent;
		font-size: 0.8125rem;
		color: #111;
		padding: 0.25rem 0;
	}

	.equipment-info-card-input--name {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.equipment-info-card-input--link {
		color: #1d4ed8;
	}

	.equipment-info-card-input:focus {
		outline: none;
		border-bottom-color: #111;
	}

	.equipment-info-card-select {
		width: 100%;
		border: none;
		border-bottom: 1px solid #d1d5db;
		background: transparent;
		font-size: 0.8125rem;
		color: #111;
		padding: 0.25rem 0;
		cursor: pointer;
	}

	.equipment-info-card-select:disabled {
		color: #9ca3af;
		cursor: not-allowed;
	}

	.equipment-info-card-select:focus {
		outline: none;
		border-bottom-color: #111;
	}

	.equipment-info-card-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem 0.75rem;
	}

	.equipment-info-card :global(.machine-type-input) {
		font-size: 0.8125rem;
		font-weight: 500;
		text-align: left;
		padding: 0.25rem 0;
		border-bottom: 1px solid #d1d5db;
		box-shadow: none;
	}

	.equipment-info-card :global(.machine-type-input:focus) {
		box-shadow: none;
		border-bottom-color: #111;
	}
</style>
