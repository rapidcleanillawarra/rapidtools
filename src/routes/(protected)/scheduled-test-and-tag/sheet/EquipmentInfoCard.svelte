<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import MachineTypeDropdown from './MachineTypeDropdown.svelte';
	import {
		MACHINE_TYPE_OPTIONS,
		SIZE_OPTIONS,
		type SheetFrequency,
		type SheetRow,
		type TextPasteColumnKey
	} from './types';

	export let row: SheetRow;
	export let frequency: SheetFrequency | '' = '';
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

	$: isRegistryInactive = row.active === false;
</script>

<div class="equipment-info-card" class:equipment-info-card--inactive={isRegistryInactive}>
	<div class="equipment-info-card-top">
		<span class="equipment-info-card-rci" title="RCI Tag">{row.rciTag || '—'}</span>
		{#if isRegistryInactive}
			<span class="equipment-info-card-inactive-badge" title="Inactive in equipment registry">
				Inactive
			</span>
		{/if}
		{#if frequency}
			<span class="equipment-info-card-frequency" title="Frequency">{frequency}</span>
		{/if}
		<input
			type="text"
			value={row.tag}
			on:input={(e) => update('tag', (e.target as HTMLInputElement).value)}
			on:paste={(e) => handlePaste(e, 'tag')}
			class="equipment-info-card-input equipment-info-card-input--tag"
			placeholder="Customer tag"
			aria-label="Customer tag"
		/>
	</div>

	<input
		type="text"
		value={row.machines}
		on:input={(e) => update('machines', (e.target as HTMLInputElement).value)}
		on:paste={(e) => handlePaste(e, 'machines')}
		class="equipment-info-card-input equipment-info-card-input--name"
		placeholder="Equipment name"
		aria-label="Equipment name"
	/>

	<div class="equipment-info-card-grid">
		<MachineTypeDropdown
			value={row.typeOfMachine}
			options={MACHINE_TYPE_OPTIONS}
			placeholder="Type"
			on:change={(e) => update('typeOfMachine', e.detail)}
			on:paste={(e) => handlePaste(e.detail, 'typeOfMachine')}
		/>

		<input
			type="text"
			value={row.serialNumber}
			on:input={(e) => update('serialNumber', (e.target as HTMLInputElement).value)}
			on:paste={(e) => handlePaste(e, 'serialNumber')}
			class="equipment-info-card-input"
			placeholder="Serial #"
			aria-label="Serial number"
		/>

		<input
			type="text"
			value={row.sku}
			on:input={(e) => update('sku', (e.target as HTMLInputElement).value)}
			on:paste={(e) => handlePaste(e, 'sku')}
			class="equipment-info-card-input equipment-info-card-input--link"
			placeholder="SKU"
			aria-label="SKU"
		/>

		<MachineTypeDropdown
			value={row.size}
			options={SIZE_OPTIONS}
			placeholder="Size"
			on:change={(e) => update('size', e.detail)}
			on:paste={(e) => handlePaste(e.detail, 'size')}
		/>
	</div>

	<select
		value={row.location}
		on:change={(e) => update('location', (e.target as HTMLSelectElement).value)}
		class="equipment-info-card-select sheet-header-select"
		disabled={!companySelected}
		title={row.location || 'Location'}
		aria-label="Location"
	>
		<option value="">Location…</option>
		{#each locationOptions as location (location)}
			<option value={location}>{location}</option>
		{/each}
	</select>
</div>

<style>
	.equipment-info-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 12rem;
		padding: 0.375rem 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background: #f9fafb;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	.equipment-info-card-top {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		padding-bottom: 0.125rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.equipment-info-card-rci {
		flex-shrink: 0;
		font-family: 'Consolas', 'Courier New', monospace;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: #1d4ed8;
	}

	.equipment-info-card--inactive {
		border-color: #d1d5db;
		background: #f3f4f6;
	}

	.equipment-info-card-inactive-badge {
		flex-shrink: 0;
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #92400e;
		background: #fef3c7;
		border: 1px solid #fcd34d;
		border-radius: 0.25rem;
		padding: 0.0625rem 0.375rem;
		white-space: nowrap;
	}

	.equipment-info-card-frequency {
		flex-shrink: 0;
		font-size: 0.6875rem;
		font-weight: 600;
		color: #4b5563;
		background: #e5e7eb;
		border-radius: 0.25rem;
		padding: 0.0625rem 0.375rem;
		white-space: nowrap;
	}

	.equipment-info-card-input {
		width: 100%;
		min-width: 0;
		border: none;
		border-bottom: 1px solid transparent;
		background: transparent;
		font-size: 0.75rem;
		color: #111;
		padding: 0.125rem 0;
	}

	.equipment-info-card-input--tag {
		flex: 1;
		min-width: 0;
	}

	.equipment-info-card-input--name {
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.equipment-info-card-input--link {
		color: #1d4ed8;
	}

	.equipment-info-card-input::placeholder {
		color: #9ca3af;
	}

	.equipment-info-card-input:focus {
		outline: none;
		border-bottom-color: #d1d5db;
	}

	.equipment-info-card-select {
		width: 100%;
		border: none;
		border-bottom: 1px solid transparent;
		background: transparent;
		font-size: 0.75rem;
		color: #111;
		padding: 0.125rem 0;
		cursor: pointer;
	}

	.equipment-info-card-select:disabled {
		color: #9ca3af;
		cursor: not-allowed;
	}

	.equipment-info-card-select:focus {
		outline: none;
		border-bottom-color: #d1d5db;
	}

	.equipment-info-card-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.125rem 0.5rem;
	}

	.equipment-info-card :global(.machine-type-input) {
		font-size: 0.75rem;
		font-weight: 500;
		text-align: left;
		padding: 0.125rem 0;
		border-bottom: 1px solid transparent;
		box-shadow: none;
	}

	.equipment-info-card :global(.machine-type-input:focus) {
		box-shadow: none;
		border-bottom-color: #d1d5db;
	}
</style>
