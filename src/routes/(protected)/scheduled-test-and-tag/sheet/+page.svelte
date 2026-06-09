<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { get } from 'svelte/store';
	import { currentUser } from '$lib/firebase';
	import { schedulesStore } from '../stores';
	import { getCompanyById, loadCompanies } from '../companies/utils';
	import { sheetHeader, sheetRows, isLoading } from './stores';
	import { loadSheetRowsForCompany, persistSheet } from './persistence';
	import {
		applyCompanyToHeader,
		applyCompanyNameToHeader,
		createEmptyRow,
		formatServiceDate,
		getClipboardText,
		getPasteToastMessage,
		getSortIcon,
		normalizeSheetRow,
		parsePasteGrid,
		processSheetPaste,
		sortRows
	} from './utils';
	import {
		FREQUENCY_OPTIONS,
		MACHINE_TYPE_OPTIONS,
		SHEET_COLUMNS,
		SIZE_OPTIONS,
		TEXT_PASTE_COLUMNS,
		type SheetColumnKey,
		type TextPasteColumnKey
	} from './types';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
	import MachineTypeDropdown from './MachineTypeDropdown.svelte';
	import ResultSelect from './ResultSelect.svelte';
	import { toastError, toastInfo, toastSuccess } from '$lib/utils/toast';

	const LOGO_URL = `${base}/company_logo_white.webp`;

	let sortField: SheetColumnKey | '' = '';
	let sortDirection: 'asc' | 'desc' = 'asc';
	let isTableLoading = false;
	let isSaving = false;

	const textPasteColumnSet = new Set<string>(TEXT_PASTE_COLUMNS);

	function isTextPasteColumn(key: SheetColumnKey): key is TextPasteColumnKey {
		return textPasteColumnSet.has(key);
	}

	$: technicianName =
		$currentUser?.displayName?.trim() || ($currentUser?.email?.split('@')[0] ?? '');

	$: companyOptions = [...new Set($schedulesStore.map((s) => s.company))].sort((a, b) =>
		a.localeCompare(b)
	);

	$: activeCompany = $sheetHeader.companyId
		? $schedulesStore.find((s) => s.id === $sheetHeader.companyId)
		: $sheetHeader.company
			? $schedulesStore.find((s) => s.company === $sheetHeader.company)
			: undefined;

	$: locationOptions = activeCompany
		? activeCompany.information
				.map((info) => info.location)
				.filter((location, index, arr) => location && arr.indexOf(location) === index)
				.sort((a, b) => a.localeCompare(b))
		: [];

	$: displayedRows = (sortField === '' ? $sheetRows : sortRows($sheetRows, sortField, sortDirection)).map(
		normalizeSheetRow
	);

	$: formattedServiceDate = formatServiceDate($sheetHeader.serviceDate);

	function resolveActiveCompany() {
		const header = get(sheetHeader);
		return header.companyId
			? get(schedulesStore).find((s) => s.id === header.companyId)
			: header.company
				? get(schedulesStore).find((s) => s.company === header.company)
				: undefined;
	}

	async function loadSheetData() {
		const company = resolveActiveCompany();
		if (!company) return;

		try {
			isTableLoading = true;
			const header = get(sheetHeader);
			const sheetId = get(page).url.searchParams.get('sheet') ?? header.sheetId;
			const { header: loadedHeader, rows } = await loadSheetRowsForCompany(
				company,
				header.location,
				sheetId ?? undefined
			);

			sheetHeader.update((current) => ({
				...current,
				...loadedHeader,
				location: current.location,
				frequency: current.frequency || loadedHeader.frequency || ''
			}));
			sheetRows.set(rows);
		} catch (error) {
			console.error('Failed to load sheet data:', error);
			toastError('Failed to load sheet data', 'Error');
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
			toastError('Failed to load companies for sheet', 'Error');
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
					toastError('Failed to load company for sheet', 'Error');
				}
			}

			if (company) {
				sheetHeader.update((header) => applyCompanyToHeader(header, company!));
				await loadSheetData();
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
		sheetHeader.update((header) => applyCompanyNameToHeader(header, get(schedulesStore), value));
		sheetRows.set([]);
		await loadSheetData();
	}

	async function handleLocationChange(event: Event) {
		const value = (event.target as HTMLSelectElement).value;
		sheetHeader.update((header) => ({ ...header, location: value }));
		await loadSheetData();
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

	async function handleSave() {
		const company = resolveActiveCompany();
		if (!company) {
			toastError('Select a company before saving.', 'Error');
			return;
		}

		try {
			isSaving = true;
			const sheetId = await persistSheet({
				header: get(sheetHeader),
				rows: get(sheetRows),
				company,
				userUid: get(currentUser)?.uid,
				userEmail: get(currentUser)?.email ?? undefined
			});

			sheetHeader.update((header) => ({ ...header, sheetId }));
			toastSuccess('Sheet saved successfully.', 'Saved');
		} catch (error) {
			console.error('Failed to save sheet:', error);
			toastError(error instanceof Error ? error.message : 'Failed to save sheet', 'Error');
		} finally {
			isSaving = false;
		}
	}

	function handlePrint() {
		window.print();
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
			const result = processSheetPaste(get(sheetRows), rowId, column, grid);
			if (!result) return;

			sheetRows.set(result.rows);
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
			<button type="button" class="sheet-toolbar-btn" on:click={addMachine}>Add Machine</button>
			<button type="button" class="sheet-toolbar-btn" on:click={handlePrint}>Print</button>
			<button
				type="button"
				class="sheet-toolbar-btn sheet-toolbar-btn--primary"
				on:click={handleSave}
				disabled={isSaving}
			>
				{isSaving ? 'Saving…' : 'Save Sheet'}
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
				</div>

				<div class="sheet-header-tech">
					<span class="sheet-tech-name">{technicianName || 'Technician'}</span>
				</div>
			</div>

			<div class="sheet-meta">
				<label class="sheet-meta-row" for="sheet-location">
					<span class="sheet-meta-label">Location</span>
					<select
						id="sheet-location"
						value={$sheetHeader.location}
						on:change={handleLocationChange}
						disabled={!$sheetHeader.company}
						class="sheet-meta-input sheet-header-select"
						title={$sheetHeader.location || 'Select location'}
					>
						<option value="">Select location…</option>
						{#each locationOptions as location (location)}
							<option value={location}>{location}</option>
						{/each}
					</select>
				</label>
				<div class="sheet-meta-row-pair">
					<label class="sheet-meta-row" for="sheet-service-date">
						<span class="sheet-meta-label">Date</span>
						<div class="sheet-date-field">
							<span class="sheet-date-display">{formattedServiceDate}</span>
							<input
								id="sheet-service-date"
								type="date"
								bind:value={$sheetHeader.serviceDate}
								class="sheet-date-input"
								aria-label="Service date"
							/>
						</div>
					</label>
					<label class="sheet-meta-row" for="sheet-frequency">
						<span class="sheet-meta-label">Frequency</span>
						<select
							id="sheet-frequency"
							bind:value={$sheetHeader.frequency}
							class="sheet-meta-input sheet-header-select"
							title={$sheetHeader.frequency || 'Select frequency'}
						>
							<option value="">Select frequency…</option>
							{#each FREQUENCY_OPTIONS as frequency (frequency)}
								<option value={frequency}>{frequency}</option>
							{/each}
						</select>
					</label>
				</div>
			</div>
		</header>

		<div
			class="sheet-table-wrap"
			on:paste={(e) => {
				if ($sheetRows.length === 0) handlePaste(e, null, 'tag');
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
													on:paste={(e) => handlePaste(e, row.id, 'notes')}
													rows="2"
													class="sheet-cell-input sheet-cell-textarea"
													placeholder="Notes"
												></textarea>
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
											{:else if col.key === 'results'}
												<ResultSelect
													value={row.results}
													on:change={(e) => updateRow(row.id, 'results', e.detail)}
												/>
											{:else if isTextPasteColumn(col.key)}
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

	.sheet-meta-input[type='date'],
	.sheet-meta-input--date {
		color-scheme: light;
	}

	.sheet-date-field {
		position: relative;
		width: 100%;
		min-width: 0;
	}

	.sheet-date-display {
		display: block;
		width: 100%;
		padding: 0.375rem 0;
		border-bottom: 1px solid #9ca3af;
		font-size: 0.875rem;
		color: #111;
		text-align: left;
	}

	.sheet-date-input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		border: none;
		background: transparent;
		opacity: 0;
		cursor: pointer;
		color-scheme: light;
	}

	.sheet-date-field:focus-within .sheet-date-display {
		border-bottom-color: #111;
	}

	.sheet-subtitle {
		margin: 0.125rem 0 0;
		font-size: 0.9375rem;
		color: #d1d5db;
	}

	.sheet-meta {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		width: 100%;
		background: #fff;
		padding: 0.875rem 2.5rem 0;
	}

	.sheet-meta-row-pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		width: 100%;
	}

	.sheet-meta-row {
		display: grid;
		grid-template-columns: 6.5rem minmax(0, 1fr);
		align-items: center;
		gap: 1rem;
		width: 100%;
		font-size: 0.875rem;
		color: #374151;
	}

	.sheet-meta-label {
		font-weight: 600;
		white-space: nowrap;
	}

	.sheet-meta-input {
		width: 100%;
		min-width: 0;
		border: none;
		border-bottom: 1px solid #9ca3af;
		background: transparent;
		font-size: 0.875rem;
		color: #111;
		padding: 0.375rem 0;
		text-align: left;
	}

	.sheet-meta-input:focus {
		outline: none;
		border-bottom-color: #111;
	}

	.sheet-meta-input:disabled {
		color: #6b7280;
		cursor: not-allowed;
	}

	.sheet-header-tech {
		text-align: right;
		padding-top: 0.5rem;
	}

	.sheet-tech-name {
		font-size: 1rem;
		font-weight: 700;
		color: #fff;
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
			margin: -1.25rem -1rem 1.25rem;
		}

		.sheet-header-main {
			padding: 1.25rem 1rem;
		}

		.sheet-meta {
			padding: 0.875rem 1rem 0;
		}

		.sheet-header-main {
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

		.sheet-meta-row-pair {
			grid-template-columns: 1fr;
		}

		.sheet-meta-row {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}
	}

	@media print {
		:global(aside),
		:global(.sticky.top-0.z-50),
		:global(.toast-container),
		:global(.no-print) {
			display: none !important;
		}

		:global(main) {
			margin-left: 0 !important;
		}

		:global(body) {
			background: #fff;
		}

		.sheet-page {
			min-height: auto;
			background: #fff;
			padding: 0;
		}

		.sheet-document {
			max-width: none;
			margin: 0;
			padding: 0;
			box-shadow: none;
		}

		.sheet-header {
			margin: 0 0 1rem;
		}

		.sheet-header-main {
			padding: 1rem 0;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		.sheet-meta {
			padding: 0.875rem 0 0;
		}

		.sheet-table-wrap {
			overflow: visible;
		}

		.sheet-actions-col,
		.sheet-add-row,
		.sheet-sort-icon,
		.sheet-date-input {
			display: none !important;
		}

		.sheet-empty :global(button) {
			display: none !important;
		}

		.sheet-sort-btn {
			cursor: default;
			pointer-events: none;
		}

		.sheet-cell-input:focus,
		:global(.machine-type-input:focus),
		:global(.result-select:focus) {
			background: transparent !important;
			box-shadow: none !important;
		}

		:global(.machine-type-options) {
			display: none !important;
		}

		:global(.result-select--pass) {
			color: #16a34a !important;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		:global(.result-select--fail) {
			color: #dc2626 !important;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		.sheet-checkbox {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
</style>
