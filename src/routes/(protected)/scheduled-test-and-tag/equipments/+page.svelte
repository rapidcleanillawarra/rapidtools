<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { get } from 'svelte/store';
	import { schedulesStore } from '../stores';
	import { getCompanyById, loadCompanies } from '../companies/utils';
	import { equipmentHeader, equipmentRows, isLoading } from './stores';
	import { loadEquipmentsForCompany, persistEquipments } from './persistence';
	import { loadAllRciTags } from '../services/equipments';
	import {
		applyCompanyToHeader,
		applyCompanyNameToHeader,
		collectOccupiedRciTags,
		createEmptyRow,
		getClipboardText,
		getPasteToastMessage,
		getSortIcon,
		normalizeEquipmentRow,
		parsePasteGrid,
		processEquipmentPaste,
		sortRows
	} from './utils';
	import {
		EQUIPMENT_COLUMNS,
		FREQUENCY_MONTH_OPTIONS,
		MACHINE_TYPE_OPTIONS,
		MONTH_OPTIONS,
		SIZE_OPTIONS,
		TEXT_PASTE_COLUMNS,
		type EquipmentColumnKey,
		type TextPasteColumnKey
	} from './types';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
	import MachineTypeDropdown from '../sheet/MachineTypeDropdown.svelte';
	import { toastError, toastInfo, toastSuccess } from '$lib/utils/toast';

	const LOGO_URL = `${base}/company_logo_white.webp`;

	let sortField: EquipmentColumnKey | '' = '';
	let sortDirection: 'asc' | 'desc' = 'asc';
	let isTableLoading = false;
	let isSaving = false;
	let selectedRowIds = new Set<string>();
	let massApplyType = '';
	let massApplyStartMonth: number | '' = '';
	let massApplyFrequency: number | '' = '';
	let globalRciTags: string[] = [];

	const TABLE_EXTRA_COLS = 3;

	const textPasteColumnSet = new Set<string>(TEXT_PASTE_COLUMNS);

	function isTextPasteColumn(key: EquipmentColumnKey): key is TextPasteColumnKey {
		return textPasteColumnSet.has(key);
	}

	$: companyOptions = [...new Set($schedulesStore.map((s) => s.company))].sort((a, b) =>
		a.localeCompare(b)
	);

	$: activeCompany = $equipmentHeader.companyId
		? $schedulesStore.find((s) => s.id === $equipmentHeader.companyId)
		: $equipmentHeader.company
			? $schedulesStore.find((s) => s.company === $equipmentHeader.company)
			: undefined;

	$: displayedRows = (
		sortField === '' ? $equipmentRows : sortRows($equipmentRows, sortField, sortDirection)
	).map(normalizeEquipmentRow);

	$: allDisplayedSelected =
		displayedRows.length > 0 && displayedRows.every((row) => selectedRowIds.has(row.id));

	$: canMassApply =
		selectedRowIds.size > 0 &&
		(massApplyType !== '' || massApplyStartMonth !== '' || massApplyFrequency !== '');

	function clearSelection() {
		selectedRowIds = new Set();
	}

	function toggleRowSelected(id: string, checked: boolean) {
		if (checked) selectedRowIds.add(id);
		else selectedRowIds.delete(id);
		selectedRowIds = selectedRowIds;
	}

	function toggleSelectAllDisplayed() {
		if (allDisplayedSelected) {
			for (const row of displayedRows) selectedRowIds.delete(row.id);
		} else {
			for (const row of displayedRows) selectedRowIds.add(row.id);
		}
		selectedRowIds = selectedRowIds;
	}

	function applyMassValues() {
		if (selectedRowIds.size === 0) {
			toastError('Select at least one row.', 'Error');
			return;
		}

		const hasType = massApplyType !== '';
		const hasStartMonth = massApplyStartMonth !== '';
		const hasFrequency = massApplyFrequency !== '';

		if (!hasType && !hasStartMonth && !hasFrequency) {
			toastError('Set at least one value to apply.', 'Error');
			return;
		}

		const selectedCount = selectedRowIds.size;

		equipmentRows.update((rows) =>
			rows.map((row) => {
				if (!selectedRowIds.has(row.id)) return row;
				return {
					...row,
					...(hasType ? { typeOfMachine: massApplyType } : {}),
					...(hasStartMonth ? { startMonth: massApplyStartMonth as number } : {}),
					...(hasFrequency ? { frequency: massApplyFrequency as number } : {})
				};
			})
		);

		toastSuccess(`Applied to ${selectedCount} row${selectedCount === 1 ? '' : 's'}.`, 'Applied');
	}

	function resolveActiveCompany() {
		const header = get(equipmentHeader);
		return header.companyId
			? get(schedulesStore).find((s) => s.id === header.companyId)
			: header.company
				? get(schedulesStore).find((s) => s.company === header.company)
				: undefined;
	}

	function getRowDefaults() {
		const company = resolveActiveCompany();
		return {
			startMonth: company?.start_month ?? 1,
			frequency: company?.occurence ?? 12
		};
	}

	function getOccupiedRciTags(rows = get(equipmentRows)): string[] {
		return collectOccupiedRciTags(rows, globalRciTags);
	}

	async function refreshGlobalRciTags() {
		globalRciTags = await loadAllRciTags();
	}

	async function loadEquipmentData() {
		const company = resolveActiveCompany();
		if (!company) return;

		try {
			isTableLoading = true;
			const [rows] = await Promise.all([
				loadEquipmentsForCompany(company),
				refreshGlobalRciTags()
			]);
			equipmentRows.set(rows);
			clearSelection();
		} catch (error) {
			console.error('Failed to load equipments:', error);
			toastError('Failed to load equipments', 'Error');
		} finally {
			isTableLoading = false;
		}
	}

	onMount(async () => {
		try {
			isLoading.set(true);
			isTableLoading = true;
			if (get(schedulesStore).length === 0) {
				await loadCompanies();
			}
		} catch (error) {
			console.error('Failed to load companies:', error);
			toastError('Failed to load companies', 'Error');
		} finally {
			isLoading.set(false);
		}

		const companyId = get(page).url.searchParams.get('id');
		if (companyId) {
			let company = get(schedulesStore).find((s) => s.id === companyId);
			if (!company) {
				try {
					company = await getCompanyById(companyId);
				} catch (error) {
					console.error('Failed to load company:', error);
					toastError('Failed to load company', 'Error');
				}
			}

			if (company) {
				equipmentHeader.update((header) => applyCompanyToHeader(header, company!));
				await loadEquipmentData();
			} else {
				toastError('Company not found', 'Error');
				isTableLoading = false;
			}
		} else {
			isTableLoading = false;
		}
	});

	async function handleCompanyChange(event: Event) {
		const value = (event.target as HTMLSelectElement).value;
		equipmentHeader.update((header) =>
			applyCompanyNameToHeader(header, get(schedulesStore), value)
		);
		equipmentRows.set([]);
		clearSelection();
		await loadEquipmentData();
	}

	function handleSort(field: EquipmentColumnKey) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	function addEquipment() {
		equipmentRows.update((rows) => [
			...rows,
			createEmptyRow(getRowDefaults(), getOccupiedRciTags(rows))
		]);
	}

	function removeEquipment(id: string) {
		selectedRowIds.delete(id);
		selectedRowIds = selectedRowIds;
		equipmentRows.update((rows) => rows.filter((row) => row.id !== id));
	}

	function updateRow(id: string, field: EquipmentColumnKey, value: string | boolean | number) {
		equipmentRows.update((rows) =>
			rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
		);
	}

	async function handleSave() {
		const company = resolveActiveCompany();
		if (!company) {
			toastError('Select a company before saving.', 'Error');
			return;
		}

		try {
			isSaving = true;
			await persistEquipments(company, get(equipmentRows));
			await loadEquipmentData();
			toastSuccess('Equipments saved successfully.', 'Saved');
		} catch (error) {
			console.error('Failed to save equipments:', error);
			toastError(error instanceof Error ? error.message : 'Failed to save equipments', 'Error');
		} finally {
			isSaving = false;
		}
	}

	async function handlePaste(
		event: ClipboardEvent,
		rowId: string | null,
		column: TextPasteColumnKey
	) {
		event.preventDefault();
		event.stopPropagation();

		try {
			const text = await getClipboardText(event);
			if (!text) return;

			const grid = parsePasteGrid(text);
			const defaults = getRowDefaults();
			const result = processEquipmentPaste(
				get(equipmentRows),
				rowId,
				column,
				grid,
				globalRciTags
			);
			if (!result) return;

			const rowsWithDefaults = result.rows.map((row) =>
				row.startMonth && row.frequency
					? row
					: {
							...row,
							startMonth: row.startMonth || defaults.startMonth,
							frequency: row.frequency || defaults.frequency
						}
			);

			equipmentRows.set(rowsWithDefaults);
			toastInfo(getPasteToastMessage(column, result.pastedCount, result.mode), 'Pasted');
		} catch (error) {
			console.error('Error in handlePaste:', error);
			toastError('Failed to paste data', 'Error');
		}
	}
</script>

<div class="no-print">
	<ToastContainer />
</div>

<div class="sheet-page">
	<div class="sheet-toolbar no-print">
		<a href="{base}/scheduled-test-and-tag/companies" class="sheet-toolbar-link">← Back to Companies</a>
		<div class="sheet-toolbar-actions">
			<button type="button" class="sheet-toolbar-btn" on:click={addEquipment}>Add Equipment</button>
			<button
				type="button"
				class="sheet-toolbar-btn sheet-toolbar-btn--primary"
				on:click={handleSave}
				disabled={isSaving}
			>
				{isSaving ? 'Saving…' : 'Save Equipments'}
			</button>
		</div>
	</div>

	<div class="sheet-document">
		<header class="sheet-header">
			<div class="sheet-header-main">
				<div class="sheet-header-logo">
					<img src={LOGO_URL} alt="RapidClean" class="sheet-logo" />
				</div>

				<div class="sheet-header-center">
					<select
						id="equipment-company"
						value={$equipmentHeader.company}
						on:change={handleCompanyChange}
						class="sheet-company-select"
						aria-label="Company"
					>
						<option value="">Select company…</option>
						{#each companyOptions as company (company)}
							<option value={company}>{company}</option>
						{/each}
					</select>
					<p class="sheet-subtitle">Equipment master list</p>
				</div>

				<div class="sheet-header-spacer" aria-hidden="true"></div>
			</div>
		</header>

		{#if displayedRows.length > 0}
			<div class="sheet-bulk-apply no-print">
				<span class="sheet-bulk-apply-label">
					Apply to selected ({selectedRowIds.size}):
				</span>
				<label class="sheet-bulk-apply-field">
					<span class="sheet-bulk-apply-field-label">Type</span>
					<select
						bind:value={massApplyType}
						class="sheet-bulk-apply-select"
						aria-label="Mass apply type"
					>
						<option value="">—</option>
						{#each MACHINE_TYPE_OPTIONS as option (option)}
							<option value={option}>{option}</option>
						{/each}
					</select>
				</label>
				<label class="sheet-bulk-apply-field">
					<span class="sheet-bulk-apply-field-label">Start Month</span>
					<select
						bind:value={massApplyStartMonth}
						class="sheet-bulk-apply-select"
						aria-label="Mass apply start month"
					>
						<option value="">—</option>
						{#each MONTH_OPTIONS as month (month.value)}
							<option value={month.value}>{month.label}</option>
						{/each}
					</select>
				</label>
				<label class="sheet-bulk-apply-field">
					<span class="sheet-bulk-apply-field-label">Frequency</span>
					<select
						bind:value={massApplyFrequency}
						class="sheet-bulk-apply-select"
						aria-label="Mass apply frequency"
					>
						<option value="">—</option>
						{#each FREQUENCY_MONTH_OPTIONS as months (months)}
							<option value={months}>{months} monthly</option>
						{/each}
					</select>
				</label>
				<button
					type="button"
					class="sheet-toolbar-btn sheet-toolbar-btn--primary"
					on:click={applyMassValues}
					disabled={!canMassApply}
				>
					Apply
				</button>
			</div>
		{/if}

		<div
			class="sheet-table-wrap"
			on:paste={(e) => {
				if ($equipmentRows.length === 0) handlePaste(e, null, 'rciTag');
			}}
		>
			{#if isTableLoading}
				<div class="sheet-loading">
					<SkeletonLoader type="text" height="2rem" />
					<SkeletonLoader type="text" height="2rem" />
					<SkeletonLoader type="text" height="2rem" />
				</div>
			{:else}
				<table class="sheet-table">
					<thead>
						<tr>
							<th scope="col" class="sheet-select-col">
								<input
									type="checkbox"
									checked={allDisplayedSelected}
									on:change={toggleSelectAllDisplayed}
									class="sheet-checkbox"
									aria-label="Select all equipment rows"
								/>
							</th>
							<th scope="col" class="sheet-row-num-col">#</th>
							{#each EQUIPMENT_COLUMNS as col (col.key)}
								<th scope="col">
									<button type="button" class="sheet-sort-btn" on:click={() => handleSort(col.key)}>
										{col.label}
										<span class="sheet-sort-icon"
											>{getSortIcon(col.key, sortField, sortDirection)}</span
										>
									</button>
								</th>
							{/each}
							<th scope="col" class="sheet-actions-col"></th>
						</tr>
					</thead>
					<tbody>
						{#if displayedRows.length === 0}
							<tr>
								<td colspan={EQUIPMENT_COLUMNS.length + TABLE_EXTRA_COLS} class="sheet-empty">
									<p>No equipment recorded yet.</p>
									<p class="sheet-empty-hint">
										Select a company, then add rows or paste from Excel.
									</p>
									<button
										type="button"
										class="sheet-toolbar-btn sheet-toolbar-btn--primary"
										on:click={addEquipment}
									>
										Add Equipment
									</button>
								</td>
							</tr>
						{:else}
							{#each displayedRows as row, index (row.id)}
								<tr>
									<td class="sheet-select-col">
										<input
											type="checkbox"
											checked={selectedRowIds.has(row.id)}
											on:change={(e) =>
												toggleRowSelected(row.id, (e.target as HTMLInputElement).checked)}
											class="sheet-checkbox"
											aria-label="Select equipment row {index + 1}"
										/>
									</td>
									<td class="sheet-row-num-col">{index + 1}</td>
									{#each EQUIPMENT_COLUMNS as col (col.key)}
										<td class="sheet-cell">
											{#if col.key === 'active'}
												<input
													type="checkbox"
													checked={row.active !== false}
													on:change={(e) =>
														updateRow(row.id, 'active', (e.target as HTMLInputElement).checked)}
													class="sheet-checkbox"
													aria-label="Active for equipment {index + 1}"
												/>
											{:else if col.key === 'startMonth'}
												<select
													value={row.startMonth}
													on:change={(e) =>
														updateRow(
															row.id,
															'startMonth',
															Number.parseInt((e.target as HTMLSelectElement).value, 10)
														)}
													class="sheet-cell-select sheet-header-select"
													aria-label="Start month for equipment {index + 1}"
												>
													{#each MONTH_OPTIONS as month (month.value)}
														<option value={month.value}>{month.label}</option>
													{/each}
												</select>
											{:else if col.key === 'frequency'}
												<select
													value={row.frequency}
													on:change={(e) =>
														updateRow(
															row.id,
															'frequency',
															Number.parseInt((e.target as HTMLSelectElement).value, 10)
														)}
													class="sheet-cell-select sheet-header-select"
													aria-label="Frequency for equipment {index + 1}"
												>
													{#each FREQUENCY_MONTH_OPTIONS as months (months)}
														<option value={months}>{months} monthly</option>
													{/each}
												</select>
											{:else if col.key === 'typeOfMachine'}
												<MachineTypeDropdown
													value={row.typeOfMachine}
													options={MACHINE_TYPE_OPTIONS}
													placeholder="Select type…"
													on:change={(e) => updateRow(row.id, 'typeOfMachine', e.detail)}
													on:paste={(e) => handlePaste(e.detail, row.id, 'typeOfMachine')}
												/>
											{:else if col.key === 'size'}
												<MachineTypeDropdown
													value={row.size}
													options={SIZE_OPTIONS}
													placeholder="Select size…"
													on:change={(e) => updateRow(row.id, 'size', e.detail)}
													on:paste={(e) => handlePaste(e.detail, row.id, 'size')}
												/>
											{:else if isTextPasteColumn(col.key)}
												<input
													type="text"
													value={row[col.key]}
													on:input={(e) =>
														updateRow(row.id, col.key, (e.target as HTMLInputElement).value)}
													on:paste={(e) => handlePaste(e, row.id, col.key)}
													class="sheet-cell-input"
													class:sheet-cell-input--rci={col.key === 'rciTag'}
													class:sheet-cell-input--customer-tag={col.key === 'tag'}
													class:sheet-cell-input--link={col.key === 'sku'}
													placeholder={col.label}
												/>
											{/if}
										</td>
									{/each}
									<td class="sheet-actions-col">
										<button
											type="button"
											on:click={() => removeEquipment(row.id)}
											class="sheet-remove-btn"
											title="Remove equipment"
										>
											×
										</button>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
					{#if displayedRows.length > 0}
						<tfoot>
							<tr>
								<td colspan={EQUIPMENT_COLUMNS.length + TABLE_EXTRA_COLS} class="sheet-add-row">
									<button type="button" class="sheet-add-btn" on:click={addEquipment}>
										+ Add equipment
									</button>
								</td>
							</tr>
						</tfoot>
					{/if}
				</table>
			{/if}
		</div>
	</div>
</div>

<style>
	.sheet-page {
		min-height: 100vh;
		background: #e8e8e8;
		padding: 1.5rem 1rem 2.5rem;
		font-family: Arial, Helvetica, sans-serif;
	}

	.sheet-toolbar {
		max-width: 80rem;
		margin: 0 auto 1rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.sheet-toolbar-link {
		font-size: 0.875rem;
		color: #374151;
		text-decoration: none;
	}

	.sheet-toolbar-link:hover {
		color: #111827;
		text-decoration: underline;
	}

	.sheet-toolbar-actions {
		display: flex;
		gap: 0.5rem;
	}

	.sheet-toolbar-btn {
		border: 1px solid #d1d5db;
		background: #fff;
		color: #374151;
		border-radius: 0.25rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.sheet-toolbar-btn:hover {
		background: #f9fafb;
	}

	.sheet-toolbar-btn--primary {
		background: #1a1a1a;
		border-color: #1a1a1a;
		color: #fff;
	}

	.sheet-toolbar-btn--primary:hover {
		background: #333;
	}

	.sheet-document {
		max-width: 80rem;
		margin: 0 auto;
		min-width: 0;
		background: #fff;
		padding: 2rem 2.5rem 2.5rem;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
	}

	.sheet-header {
		display: flex;
		flex-direction: column;
		gap: 0;
		margin: -2rem -2.5rem 1.25rem;
		padding: 0;
	}

	.sheet-header-main {
		display: grid;
		grid-template-columns: 9rem 1fr 9rem;
		align-items: start;
		gap: 1rem;
		padding: 1.5rem 2.5rem;
		background: rgb(40, 40, 40);
		color: #fff;
	}

	.sheet-header-logo {
		display: flex;
		align-items: flex-start;
	}

	.sheet-logo {
		max-width: 8.5rem;
		height: auto;
	}

	.sheet-header-center {
		text-align: center;
		padding-top: 0.25rem;
	}

	.sheet-header-spacer {
		width: 9rem;
	}

	.sheet-company-select {
		display: block;
		width: 100%;
		border: none;
		background: transparent;
		font-size: 1.375rem;
		font-weight: 700;
		color: #fff;
		text-align: center;
		cursor: pointer;
		appearance: none;
		padding: 0;
		margin: 0 auto;
	}

	.sheet-company-select:focus {
		outline: none;
		box-shadow: 0 1px 0 #fff;
	}

	.sheet-company-select option,
	.sheet-header-select option {
		color: #111;
		background-color: #fff;
	}

	.sheet-header-select {
		color-scheme: light;
		cursor: pointer;
	}

	.sheet-subtitle {
		margin: 0.125rem 0 0;
		font-size: 0.9375rem;
		color: #d1d5db;
	}

	.sheet-table-wrap {
		border-top: 3px solid #2d6a2d;
		overflow-x: auto;
	}

	.sheet-loading {
		padding: 2rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.sheet-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
		color: #111;
	}

	.sheet-table thead tr {
		background: #ececec;
	}

	.sheet-table th {
		padding: 0.625rem 0.75rem;
		text-align: left;
		font-weight: 700;
		font-size: 0.875rem;
		color: #111;
		border: none;
		white-space: nowrap;
	}

	.sheet-sort-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		border: none;
		background: transparent;
		padding: 0;
		font: inherit;
		font-weight: 700;
		color: inherit;
		cursor: pointer;
	}

	.sheet-sort-btn:hover {
		color: #000;
	}

	.sheet-sort-icon {
		font-size: 0.6875rem;
		color: #666;
		font-weight: 400;
	}

	.sheet-table tbody tr {
		border-bottom: 2px solid #111;
	}

	.sheet-cell {
		padding: 0.75rem;
		vertical-align: top;
		border: none;
		position: relative;
	}

	.sheet-cell-input {
		display: block;
		width: 100%;
		min-width: 4rem;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
		font: inherit;
		color: inherit;
		resize: none;
	}

	.sheet-cell-input:focus {
		outline: none;
		background: #fafafa;
		box-shadow: inset 0 -1px 0 #111;
	}

	.sheet-cell-select {
		display: block;
		width: 100%;
		min-width: 6rem;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}

	.sheet-cell-select:focus {
		outline: none;
		background: #fafafa;
		box-shadow: inset 0 -1px 0 #111;
	}

	.sheet-cell-input--rci {
		font-family: 'Consolas', 'Courier New', monospace;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.sheet-cell-input--customer-tag {
		font-style: italic;
	}

	.sheet-cell-input--link {
		color: #2563eb;
		font-weight: 500;
	}

	.sheet-checkbox {
		width: 1rem;
		height: 1rem;
		accent-color: #111;
		cursor: pointer;
	}

	.sheet-bulk-apply {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.75rem 1rem;
		padding: 0.875rem 0;
		margin-bottom: 0.25rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.sheet-bulk-apply-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #374151;
		white-space: nowrap;
	}

	.sheet-bulk-apply-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 7rem;
	}

	.sheet-bulk-apply-field-label {
		font-size: 0.6875rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.sheet-bulk-apply-select {
		border: 1px solid #d1d5db;
		border-radius: 0.25rem;
		padding: 0.375rem 0.5rem;
		font-size: 0.8125rem;
		color: #111;
		background: #fff;
		min-width: 8rem;
	}

	.sheet-bulk-apply-select:focus {
		outline: none;
		border-color: #111;
	}

	.sheet-select-col {
		width: 2.25rem;
		padding: 0.75rem 0.375rem;
		text-align: center;
		vertical-align: top;
	}

	.sheet-row-num-col {
		width: 2.5rem;
		padding: 0.75rem 0.5rem;
		text-align: center;
		color: #666;
		font-weight: 600;
		vertical-align: top;
		white-space: nowrap;
	}

	.sheet-actions-col {
		width: 2rem;
		padding: 0.75rem 0.25rem;
		vertical-align: top;
	}

	.sheet-remove-btn {
		border: none;
		background: transparent;
		color: #999;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		padding: 0;
	}

	.sheet-remove-btn:hover {
		color: #dc2626;
	}

	.sheet-empty {
		padding: 2.5rem 1rem;
		text-align: center;
		color: #666;
		border-bottom: 2px solid #111;
	}

	.sheet-empty p {
		margin: 0 0 0.5rem;
	}

	.sheet-empty-hint {
		font-size: 0.8125rem;
		color: #9ca3af;
		margin-bottom: 1rem !important;
	}

	.sheet-add-row {
		padding: 0.5rem 0.75rem;
		border-bottom: none;
	}

	.sheet-add-btn {
		border: none;
		background: transparent;
		color: #666;
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0;
	}

	.sheet-add-btn:hover {
		color: #111;
		text-decoration: underline;
	}

	@media (max-width: 768px) {
		.sheet-document {
			padding: 1.25rem 1rem 1.5rem;
		}

		.sheet-header {
			margin: -1.25rem -1rem 1.25rem;
		}

		.sheet-header-main {
			padding: 1.25rem 1rem;
			grid-template-columns: 1fr;
			text-align: center;
		}

		.sheet-header-logo {
			display: flex;
			justify-content: center;
		}

		.sheet-logo {
			margin: 0 auto;
		}

		.sheet-header-spacer {
			display: none;
		}
	}
</style>
