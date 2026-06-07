<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { get } from 'svelte/store';
	import { currentUser } from '$lib/firebase';
	import { schedulesStore } from '../stores';
	import { loadSchedulesFromFirestore } from '../companies/utils';
	import { sheetHeader, sheetRows, isLoading } from './stores';
	import {
		applyPasteToRows,
		createEmptyRow,
		getSortIcon,
		isMultiCellPaste,
		normalizeSheetRow,
		parsePasteGrid,
		sortRows
	} from './utils';
	import {
		FREQUENCY_OPTIONS,
		PASTEABLE_COLUMNS,
		SHEET_COLUMNS,
		type PasteableColumnKey,
		type SheetColumnKey
	} from './types';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
	import { toastError, toastInfo } from '$lib/utils/toast';

	const LOGO_URL = `${base}/images/rapidsupplies-company-logo.png`;

	let sortField: SheetColumnKey | '' = '';
	let sortDirection: 'asc' | 'desc' = 'asc';
	let isTableLoading = false;

	const pasteableColumnSet = new Set<string>(PASTEABLE_COLUMNS);

	function isPasteableColumn(key: SheetColumnKey): key is PasteableColumnKey {
		return pasteableColumnSet.has(key);
	}

	$: technicianName =
		$currentUser?.displayName?.trim() || ($currentUser?.email?.split('@')[0] ?? '');

	$: companyOptions = [...new Set($schedulesStore.map((s) => s.company))].sort((a, b) =>
		a.localeCompare(b)
	);

	$: locationOptions = $sheetHeader.company
		? $schedulesStore
				.filter((s) => s.company === $sheetHeader.company)
				.flatMap((s) => s.information.map((info) => info.location))
				.filter((location, index, arr) => location && arr.indexOf(location) === index)
				.sort((a, b) => a.localeCompare(b))
		: [];

	$: displayedRows = (sortField === '' ? $sheetRows : sortRows($sheetRows, sortField, sortDirection)).map(
		normalizeSheetRow
	);

	onMount(async () => {
		try {
			isLoading.set(true);
			isTableLoading = true;
			if (get(schedulesStore).length === 0) {
				await loadSchedulesFromFirestore();
			}
		} catch (error) {
			console.error('Failed to load companies:', error);
			toastError('Failed to load companies for sheet', 'Error');
		} finally {
			isLoading.set(false);
			isTableLoading = false;
		}

		const company = get(page).url.searchParams.get('company');
		if (company) {
			sheetHeader.update((header) => ({
				...header,
				company,
				location: ''
			}));
		}
	});

	function handleCompanyChange(event: Event) {
		const value = (event.target as HTMLSelectElement).value;
		sheetHeader.update((header) => ({
			...header,
			company: value,
			location: ''
		}));
	}

	function handleSort(field: SheetColumnKey) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	function addMachine() {
		sheetRows.update((rows) => [...rows, createEmptyRow()]);
	}

	function removeMachine(id: string) {
		sheetRows.update((rows) => rows.filter((row) => row.id !== id));
	}

	function updateRow(id: string, field: SheetColumnKey, value: string | boolean) {
		sheetRows.update((rows) =>
			rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
		);
	}

	function handleSave() {
		toastInfo('Sheet saved locally. Persistence will be added in a future update.', 'Saved');
	}

	function handlePaste(event: ClipboardEvent, rowId: string | null, column: PasteableColumnKey) {
		const text = event.clipboardData?.getData('text/plain') ?? '';
		if (!text) return;

		const grid = parsePasteGrid(text);
		if (grid.length === 0) return;

		if (!isMultiCellPaste(grid)) return;

		event.preventDefault();
		event.stopPropagation();
		sheetRows.update((rows) => applyPasteToRows(rows, rowId, column, grid));
		toastInfo(
			`Pasted ${grid.length} machine${grid.length === 1 ? '' : 's'} into the table`,
			'Pasted'
		);
	}
</script>

<ToastContainer />

<div class="sheet-page">
	<div class="sheet-toolbar">
		<a href="{base}/scheduled-test-and-tag/companies" class="sheet-toolbar-link">← Back to Companies</a>
		<div class="sheet-toolbar-actions">
			<button type="button" class="sheet-toolbar-btn" on:click={addMachine}>Add Machine</button>
			<button type="button" class="sheet-toolbar-btn sheet-toolbar-btn--primary" on:click={handleSave}>
				Save Sheet
			</button>
		</div>
	</div>

	<div class="sheet-document">
		<header class="sheet-header">
			<div class="sheet-header-logo">
				<img src={LOGO_URL} alt="RapidClean" class="sheet-logo" />
			</div>

			<div class="sheet-header-center">
				<select
					id="sheet-company"
					value={$sheetHeader.company}
					on:change={handleCompanyChange}
					class="sheet-company-select"
					aria-label="Company"
				>
					<option value="">Select company…</option>
					{#each companyOptions as company (company)}
						<option value={company}>{company}</option>
					{/each}
				</select>
				<p class="sheet-subtitle">Service, Test Tag run</p>
				<div class="sheet-meta">
					<label class="sheet-meta-field">
						<span class="sheet-meta-label">Location</span>
						<select
							id="sheet-location"
							bind:value={$sheetHeader.location}
							disabled={!$sheetHeader.company}
							class="sheet-meta-input"
						>
							<option value="">—</option>
							{#each locationOptions as location (location)}
								<option value={location}>{location}</option>
							{/each}
						</select>
					</label>
					<label class="sheet-meta-field">
						<span class="sheet-meta-label">Date</span>
						<input
							id="sheet-service-date"
							type="date"
							bind:value={$sheetHeader.serviceDate}
							class="sheet-meta-input"
						/>
					</label>
					<label class="sheet-meta-field">
						<span class="sheet-meta-label">Frequency</span>
						<select id="sheet-frequency" bind:value={$sheetHeader.frequency} class="sheet-meta-input">
							<option value="">—</option>
							{#each FREQUENCY_OPTIONS as frequency (frequency)}
								<option value={frequency}>{frequency}</option>
							{/each}
						</select>
					</label>
				</div>
			</div>

			<div class="sheet-header-tech">
				<span class="sheet-tech-name">{technicianName || 'Technician'}</span>
			</div>
		</header>

		<div
			class="sheet-table-wrap"
			on:paste={(e) => {
				if ($sheetRows.length === 0) handlePaste(e, null, 'machines');
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
							{#each SHEET_COLUMNS as col (col.key)}
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
								<td colspan={SHEET_COLUMNS.length + 1} class="sheet-empty">
									<p>No machines recorded yet.</p>
									<button type="button" class="sheet-toolbar-btn sheet-toolbar-btn--primary" on:click={addMachine}>
										Add Machine
									</button>
								</td>
							</tr>
						{:else}
							{#each displayedRows as row, index (row.id)}
								<tr>
									{#each SHEET_COLUMNS as col (col.key)}
										<td class="sheet-cell">
											{#if col.key === 'active'}
												<input
													type="checkbox"
													checked={row.active !== false}
													on:change={(e) =>
														updateRow(row.id, 'active', (e.target as HTMLInputElement).checked)}
													class="sheet-checkbox"
													aria-label="Active for machine {index + 1}"
												/>
											{:else if col.key === 'notes'}
												<textarea
													value={row[col.key]}
													on:input={(e) =>
														updateRow(row.id, col.key, (e.target as HTMLTextAreaElement).value)}
													rows="2"
													class="sheet-cell-input sheet-cell-textarea"
													placeholder="Notes"
												></textarea>
											{:else if isPasteableColumn(col.key)}
												<input
													type="text"
													value={row[col.key]}
													on:input={(e) =>
														updateRow(row.id, col.key, (e.target as HTMLInputElement).value)}
													on:paste={(e) => handlePaste(e, row.id, col.key)}
													class="sheet-cell-input"
													class:sheet-cell-input--link={col.key === 'sku'}
													placeholder={col.label}
												/>
											{:else}
												<input
													type="text"
													value={row[col.key]}
													on:input={(e) =>
														updateRow(row.id, col.key, (e.target as HTMLInputElement).value)}
													class="sheet-cell-input"
													placeholder={col.label}
												/>
											{/if}
										</td>
									{/each}
									<td class="sheet-actions-col">
										<button
											type="button"
											on:click={() => removeMachine(row.id)}
											class="sheet-remove-btn"
											title="Remove machine"
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
								<td colspan={SHEET_COLUMNS.length + 1} class="sheet-add-row">
									<button type="button" class="sheet-add-btn" on:click={addMachine}>
										+ Add machine
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
		max-width: 72rem;
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
		max-width: 72rem;
		margin: 0 auto;
		background: #fff;
		padding: 2rem 2.5rem 2.5rem;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
	}

	.sheet-header {
		display: grid;
		grid-template-columns: 9rem 1fr 9rem;
		align-items: start;
		gap: 1rem;
		margin-bottom: 1.25rem;
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

	.sheet-company-select {
		display: block;
		width: 100%;
		border: none;
		background: transparent;
		font-size: 1.375rem;
		font-weight: 700;
		color: #111;
		text-align: center;
		cursor: pointer;
		appearance: none;
		padding: 0;
		margin: 0 auto;
	}

	.sheet-company-select:focus {
		outline: none;
		box-shadow: 0 1px 0 #111;
	}

	.sheet-subtitle {
		margin: 0.125rem 0 0.75rem;
		font-size: 0.9375rem;
		color: #333;
	}

	.sheet-meta {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1rem 1.5rem;
	}

	.sheet-meta-field {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.8125rem;
		color: #444;
	}

	.sheet-meta-label {
		font-weight: 600;
	}

	.sheet-meta-input {
		border: none;
		border-bottom: 1px solid #ccc;
		background: transparent;
		font-size: 0.8125rem;
		color: #111;
		padding: 0.125rem 0;
		min-width: 5rem;
	}

	.sheet-meta-input:focus {
		outline: none;
		border-bottom-color: #111;
	}

	.sheet-meta-input:disabled {
		color: #999;
		cursor: not-allowed;
	}

	.sheet-header-tech {
		text-align: right;
		padding-top: 0.5rem;
	}

	.sheet-tech-name {
		font-size: 1rem;
		font-weight: 700;
		color: #111;
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

	.sheet-table tbody tr:last-child {
		border-bottom: 2px solid #111;
	}

	.sheet-cell {
		padding: 0.75rem;
		vertical-align: top;
		border: none;
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

	.sheet-cell-input--link {
		color: #2563eb;
		font-weight: 500;
	}

	.sheet-cell-textarea {
		min-height: 2.5rem;
		line-height: 1.35;
	}

	.sheet-checkbox {
		width: 1rem;
		height: 1rem;
		accent-color: #111;
		cursor: pointer;
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
		margin: 0 0 1rem;
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
			grid-template-columns: 1fr;
			text-align: center;
		}

		.sheet-header-logo,
		.sheet-header-tech {
			justify-content: center;
			text-align: center;
		}

		.sheet-header-logo {
			display: flex;
		}

		.sheet-logo {
			margin: 0 auto;
		}
	}
</style>
