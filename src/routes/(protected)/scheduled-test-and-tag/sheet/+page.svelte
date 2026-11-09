<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { get } from 'svelte/store';
	import { currentUser } from '$lib/firebase';
	import { schedulesStore, type Schedule } from '../stores';
	import { getCompanyById, loadCompanies } from '../companies/utils';
	import CompanyCombobox from '../CompanyCombobox.svelte';
	import { sheetHeader, sheetRows, inactiveSheetRows, isLoading } from './stores';
	import { findSheetForCurrentMonth, type SheetSummary } from '../services/sheets';
	import { loadSheetRowsForCompany, persistSheet } from './persistence';
	import {
		applyCompanyToHeader,
		defaultSheetName,
		formatServiceDate,
		getClipboardText,
		getPasteToastMessage,
		getSortIcon,
		isDisplayedSheetRow,
		normalizeSheetRow,
		parsePasteGrid,
		processSheetPaste,
		sortRows
	} from './utils';
	import {
		FREQUENCY_OPTIONS,
		SHEET_COLUMNS,
		TEXT_PASTE_COLUMNS,
		type SheetColumnKey,
		type SheetHeader,
		type SheetRow,
		type SheetRowFieldKey,
		type TextPasteColumnKey
	} from './types';
	import Modal from '$lib/components/Modal.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
	import EquipmentInfoCard from './EquipmentInfoCard.svelte';
	import ResultSelect from './ResultSelect.svelte';
	import ServiceSelect from './ServiceSelect.svelte';
	import PartsEditor from './PartsEditor.svelte';
	import { toastError, toastInfo, toastSuccess } from '$lib/utils/toast';
	import { printCompletedSheet, printFillableSheet } from './print_utils';

	type ServiceTextColumnKey = Extract<TextPasteColumnKey, SheetColumnKey>;

	const LOGO_URL = `${base}/company_logo_white.webp`;
	const LOGO_PRINT_FALLBACK = LOGO_URL;

	const TABLE_EXTRA_COLS = 2;

	function buildSheetPath(companyId: string, sheetId?: string): string {
		const params = new URLSearchParams({ company_id: companyId });
		if (sheetId) {
			params.set('id', sheetId);
		}
		return `${base}/scheduled-test-and-tag/sheet?${params.toString()}`.replace(/\/\/+/g, '/');
	}

	let sortField: SheetColumnKey | '' = '';
	let sortDirection: 'asc' | 'desc' = 'asc';
	let isTableLoading = false;
	let isSaving = false;
	let isPrinting = false;
	let isPrintingFillable = false;

	let originalRows: SheetRow[] = [];
	let originalFrequency: SheetHeader['frequency'] = '';
	let showExistingSheetModal = false;
	let pendingExistingSheet: SheetSummary | null = null;
	let suppressExistingSheetPrompt = false;

	const textPasteColumnSet = new Set<string>(TEXT_PASTE_COLUMNS);

	function isTextPasteColumn(key: SheetColumnKey): key is ServiceTextColumnKey {
		return textPasteColumnSet.has(key);
	}

	$: activeCompany = $sheetHeader.companyId
		? $schedulesStore.find((s) => s.id === $sheetHeader.companyId)
		: $sheetHeader.company
			? $schedulesStore.find((s) => s.company === $sheetHeader.company)
			: undefined;

	$: isSheetLoaded = Boolean($sheetHeader.sheetId);
	$: sheetUrlId = $page.url.searchParams.get('id') ?? '';

	$: locationOptions = activeCompany
		? activeCompany.information
				.map((info) => info.location)
				.filter((location, index, arr) => location && arr.indexOf(location) === index)
				.sort((a, b) => a.localeCompare(b))
		: [];

	$: locationFilter = $sheetHeader.location;

	$: displayedRows = (
		sortField === '' ? $sheetRows : sortRows($sheetRows, sortField, sortDirection)
	)
		.filter(isDisplayedSheetRow)
		.filter((row) => !locationFilter || row.location === locationFilter)
		.map(normalizeSheetRow);

	$: sidebarInactiveRows = [...$inactiveSheetRows]
		.filter((row) => !$sheetRows.some((sheetRow) => sheetRow.id === row.id && isDisplayedSheetRow(sheetRow)))
		.filter((row) => !locationFilter || row.location === locationFilter)
		.sort((a, b) =>
			(a.machines || a.tag || a.rciTag).localeCompare(b.machines || b.tag || b.rciTag)
		);

	function resolveActiveCompany() {
		const header = get(sheetHeader);
		return header.companyId
			? get(schedulesStore).find((s) => s.id === header.companyId)
			: header.company
				? get(schedulesStore).find((s) => s.company === header.company)
				: undefined;
	}

	async function loadSheetData(explicitSheetId?: string) {
		const company = resolveActiveCompany();
		if (!company) return;

		try {
			isTableLoading = true;
			const header = get(sheetHeader);
			const sheetId =
				explicitSheetId ?? get(page).url.searchParams.get('id') ?? header.sheetId ?? undefined;
			const { header: loadedHeader, rows, inactiveRows } = await loadSheetRowsForCompany(
				company,
				sheetId || undefined
			);

			sheetHeader.update((current) => ({
				...current,
				...loadedHeader,
				sheetId: loadedHeader.sheetId ?? '',
				frequency: current.frequency || loadedHeader.frequency || '',
				sheetName: loadedHeader.sheetName ?? (current.sheetName || defaultSheetName())
			}));
			sheetRows.set(rows);
			inactiveSheetRows.set(inactiveRows);
			originalRows = rows.map((row) => ({ ...row }));
			originalFrequency = get(sheetHeader).frequency;
		} catch (error) {
			console.error('Failed to load sheet data:', error);
			toastError('Failed to load sheet data', 'Error');
		} finally {
			isTableLoading = false;
		}
	}

	async function prepareSheetLoad(company: Schedule, options?: { applyHeader?: boolean }) {
		if (options?.applyHeader !== false) {
			sheetHeader.update((header) => applyCompanyToHeader(header, company));
		}

		const urlId = get(page).url.searchParams.get('id');
		if (!urlId && !suppressExistingSheetPrompt) {
			try {
				isTableLoading = true;
				const existing = await findSheetForCurrentMonth(company.id);
				if (existing) {
					pendingExistingSheet = existing;
					showExistingSheetModal = true;
					isTableLoading = false;
					return;
				}
			} catch (error) {
				console.error('Failed to check for existing sheet:', error);
				toastError('Failed to check for existing sheet', 'Error');
			}
		}

		await loadSheetData();
	}

	async function loadPendingExistingSheet() {
		const company = resolveActiveCompany();
		if (!company || !pendingExistingSheet) return;

		const sheetId = pendingExistingSheet.id;
		showExistingSheetModal = false;
		pendingExistingSheet = null;

		await goto(buildSheetPath(company.id, sheetId), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
		await loadSheetData(sheetId);
	}

	async function continueWithNewSheet() {
		showExistingSheetModal = false;
		pendingExistingSheet = null;
		suppressExistingSheetPrompt = true;
		await loadSheetData();
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

		const companyId = get(page).url.searchParams.get('company_id');
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
				await prepareSheetLoad(company);
			} else {
				toastError('Company not found', 'Error');
				isTableLoading = false;
			}
		} else {
			isTableLoading = false;
		}
	});

	async function switchToCompany(company: Schedule) {
		if (company.id === get(sheetHeader).companyId) return;

		suppressExistingSheetPrompt = false;
		sheetHeader.update((header) => ({
			...applyCompanyToHeader(header, company),
			sheetId: '',
			sheetName: defaultSheetName()
		}));
		sheetRows.set([]);
		inactiveSheetRows.set([]);
		originalRows = [];
		originalFrequency = '';

		await goto(buildSheetPath(company.id), { replaceState: true, keepFocus: true, noScroll: true });
		await prepareSheetLoad(company, { applyHeader: false });
	}

	async function createNewSheet() {
		const company = resolveActiveCompany();
		if (!company) {
			toastError('Select a company before creating a new sheet.', 'Error');
			return;
		}

		suppressExistingSheetPrompt = true;
		sheetHeader.update((header) => ({
			...applyCompanyToHeader(header, company),
			sheetId: '',
			sheetName: defaultSheetName(),
			serviceDate: new Date().toISOString().split('T')[0]
		}));
		sheetRows.set([]);
		inactiveSheetRows.set([]);
		originalRows = [];
		originalFrequency = get(sheetHeader).frequency;

		await goto(buildSheetPath(company.id), { replaceState: true, keepFocus: true, noScroll: true });
		await loadSheetData();
	}

	async function handleCompanySelect(event: CustomEvent<Schedule>) {
		await switchToCompany(event.detail);
	}

	function handleSort(field: SheetColumnKey) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	function openEquipments() {
		const company = resolveActiveCompany();
		if (!company) {
			toastError('Select a company before managing equipments.', 'Error');
			return;
		}
		goto(`${base}/scheduled-test-and-tag/equipments?id=${company.id}`);
	}

	function removeMachine(id: string) {
		const row = get(sheetRows).find((item) => item.id === id);
		if (!row) return;

		sheetRows.update((rows) => rows.filter((item) => item.id !== id));

		inactiveSheetRows.update((rows) => {
			if (rows.some((item) => item.id === id)) return rows;
			return [...rows, { ...row, onSheet: false }];
		});
	}

	function restoreInactiveEquipment(row: SheetRow) {
		inactiveSheetRows.update((rows) => rows.filter((item) => item.id !== row.id));
		const restored =
			row.active === false ? { ...row, active: false, onSheet: true } : { ...row };
		sheetRows.update((rows) => [...rows, restored]);
	}

	function updateRow(id: string, field: SheetRowFieldKey, value: string | boolean) {
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
				userEmail: get(currentUser)?.email ?? undefined,
				original: { rows: originalRows, frequency: originalFrequency }
			});

			await goto(buildSheetPath(company.id, sheetId), {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});
			await loadSheetData(sheetId);
			toastSuccess(
				isSheetLoaded ? 'Sheet updated successfully.' : 'Sheet saved successfully.',
				isSheetLoaded ? 'Updated' : 'Saved'
			);
		} catch (error) {
			console.error('Failed to save sheet:', error);
			toastError(error instanceof Error ? error.message : 'Failed to save sheet', 'Error');
		} finally {
			isSaving = false;
		}
	}

	async function handlePrint() {
		if (isPrinting) return;

		isPrinting = true;
		try {
			const title =
				[$sheetHeader.company, $sheetHeader.sheetName || defaultSheetName()]
					.filter(Boolean)
					.join(' — ') || 'Service Test & Tag Sheet';
			await printCompletedSheet($sheetHeader, displayedRows, {
				printTitle: title,
				logoUrl: LOGO_PRINT_FALLBACK
			});
		} catch (error) {
			console.error('Failed to print sheet:', error);
			toastError(
				error instanceof Error ? error.message : 'Failed to prepare print',
				'Print'
			);
		} finally {
			isPrinting = false;
		}
	}

	async function handlePrintFillable() {
		if (isPrintingFillable) return;

		isPrintingFillable = true;
		try {
			const title =
				[$sheetHeader.company, $sheetHeader.sheetName || defaultSheetName()]
					.filter(Boolean)
					.join(' — ') || 'Service Test & Tag Sheet';
			await printFillableSheet($sheetHeader, displayedRows, {
				printTitle: title,
				logoUrl: LOGO_PRINT_FALLBACK
			});
		} catch (error) {
			console.error('Failed to print fillable sheet:', error);
			toastError(
				error instanceof Error ? error.message : 'Failed to prepare fillable print',
				'Print'
			);
		} finally {
			isPrintingFillable = false;
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
			const result = processSheetPaste(get(sheetRows), rowId, column, grid);
			if (!result) return;

			sheetRows.set(result.rows);
			toastInfo(getPasteToastMessage(column, result.pastedCount, result.mode), 'Pasted');
		} catch (error) {
			console.error('Error in handlePaste:', error);
			toastError('Failed to paste data', 'Error');
		}
	}

	/** Grow notes textareas so full content is visible (no internal scroll clip). */
	function autosizeNotesTextarea(node: HTMLTextAreaElement, _value: string) {
		function resize() {
			node.style.height = 'auto';
			node.style.height = `${Math.max(node.scrollHeight, 96)}px`;
		}

		resize();
		queueMicrotask(resize);
		node.addEventListener('input', resize);

		return {
			update() {
				resize();
			},
			destroy() {
				node.removeEventListener('input', resize);
			}
		};
	}
</script>

<div class="no-print">
	<ToastContainer />
</div>

{#if showExistingSheetModal && pendingExistingSheet && activeCompany}
	<Modal
		show={showExistingSheetModal}
		on:close={continueWithNewSheet}
		size="md"
		allowClose={!isTableLoading}
	>
		<span slot="header">Existing sheet found</span>
		<div slot="body" class="existing-sheet-modal-body">
			<p class="existing-sheet-modal-copy">
				A sheet for <strong class="text-white">{activeCompany.company}</strong> already exists for
				<strong class="text-white">{defaultSheetName()}</strong>:
				<strong class="text-white">{pendingExistingSheet.name || defaultSheetName()}</strong>
				(service date {formatServiceDate(pendingExistingSheet.service_date)}).
			</p>
			<p class="existing-sheet-modal-copy">Would you like to load it?</p>
		</div>
		<div slot="footer" class="existing-sheet-modal-footer">
			<button
				type="button"
				class="btn-secondary text-xs px-3 py-1.5"
				on:click={continueWithNewSheet}
				disabled={isTableLoading}
			>
				Continue with new sheet
			</button>
			<button
				type="button"
				class="btn-primary text-xs px-3 py-1.5"
				on:click={loadPendingExistingSheet}
				disabled={isTableLoading}
			>
				Load existing sheet
			</button>
		</div>
	</Modal>
{/if}

<div class="sheet-page">
	<div class="sheet-toolbar no-print">
		<a href="{base}/scheduled-test-and-tag/companies" class="sheet-toolbar-link">← Back to Companies</a>
		<div class="sheet-toolbar-actions">
			<button type="button" class="btn-secondary text-xs px-3 py-1.5" on:click={openEquipments}>
				Manage Equipments
			</button>
			{#if sheetUrlId}
				<button
					type="button"
					class="btn-secondary text-xs px-3 py-1.5"
					on:click={createNewSheet}
					disabled={!$sheetHeader.companyId || isTableLoading}
				>
					New Sheet
				</button>
			{/if}
			<button type="button" class="btn-secondary text-xs px-3 py-1.5" on:click={handlePrint} disabled={isPrinting || isTableLoading}>
				{isPrinting ? 'Preparing…' : 'Print'}
			</button>
			<button
				type="button"
				class="btn-secondary text-xs px-3 py-1.5"
				on:click={handlePrintFillable}
				disabled={isPrintingFillable || isTableLoading}
			>
				{isPrintingFillable ? 'Preparing…' : 'Print Fillable'}
			</button>
			<button
				type="button"
				class="btn-primary text-xs px-3 py-1.5"
				on:click={handleSave}
				disabled={isSaving}
			>
				{isSaving
					? isSheetLoaded
						? 'Updating…'
						: 'Saving…'
					: isSheetLoaded
						? 'Update Sheet'
						: 'Save Sheet'}
			</button>
		</div>
	</div>

	<div class="sheet-layout">
		<div class="sheet-document">
			<header class="sheet-header">
				<div class="sheet-header-main">
					<div class="sheet-header-logo">
						<img src={LOGO_URL} alt="RapidClean" class="sheet-logo" />
					</div>

					<div class="sheet-header-center">
						<CompanyCombobox
							companies={$schedulesStore}
							companyName={$sheetHeader.company}
							inputId="sheet-company"
							placeholder="Search company…"
							on:select={handleCompanySelect}
						/>
						<p class="sheet-subtitle">Service, Test Tag run</p>
					</div>

					<div class="sheet-header-date">
						<label class="sheet-header-date-label" for="sheet-service-date">Date</label>
						<input
							id="sheet-service-date"
							type="date"
							bind:value={$sheetHeader.serviceDate}
							class="sheet-header-date-input"
							aria-label="Service date"
						/>
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
							<th scope="col" class="sheet-row-num-col">#</th>
							{#each SHEET_COLUMNS as col (col.key)}
								<th scope="col" class:sheet-notes-col={col.key === 'notes'}>
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
								<td colspan={SHEET_COLUMNS.length + TABLE_EXTRA_COLS} class="sheet-empty">
									<p>No machines recorded yet.</p>
									<button type="button" class="btn-primary text-xs px-3 py-1.5" on:click={openEquipments}>
										Add Equipment
									</button>
								</td>
							</tr>
						{:else}
							{#each displayedRows as row, index (row.id)}
								<tr class:sheet-row--inactive={row.active === false}>
									<td class="sheet-row-num-col">{index + 1}</td>
									{#each SHEET_COLUMNS as col (col.key)}
										<td
											class="sheet-cell"
											class:sheet-cell--equipment-info={col.key === 'equipmentInfo'}
											class:sheet-notes-col={col.key === 'notes'}
										>
											{#if col.key === 'equipmentInfo'}
												<EquipmentInfoCard
													{row}
													frequency={$sheetHeader.frequency}
													{locationOptions}
													companySelected={Boolean($sheetHeader.company)}
													on:update={(e) => updateRow(row.id, e.detail.field, e.detail.value)}
													on:paste={(e) => handlePaste(e.detail.event, row.id, e.detail.field)}
												/>
											{:else if col.key === 'notes'}
												<div class="sheet-notes-cell">
													<textarea
														value={row.notes}
														use:autosizeNotesTextarea={row.notes}
														on:input={(e) =>
															updateRow(row.id, 'notes', (e.target as HTMLTextAreaElement).value)}
														on:paste={(e) => handlePaste(e, row.id, 'notes')}
														rows="5"
														class="sheet-cell-input sheet-cell-textarea"
														placeholder="Notes"
														aria-label="Notes"
													></textarea>
												</div>
											{:else if col.key === 'results'}
												<ResultSelect
													value={row.results}
													on:change={(e) => updateRow(row.id, 'results', e.detail)}
												/>
											{:else if col.key === 'service'}
												<ServiceSelect
													value={row.service}
													on:change={(e) => updateRow(row.id, 'service', e.detail)}
												/>
											{:else if col.key === 'parts'}
												<PartsEditor
													value={row.parts}
													on:change={(e) => updateRow(row.id, 'parts', e.detail)}
												/>
											{:else if isTextPasteColumn(col.key)}
												<input
													type="text"
													value={row[col.key]}
													on:input={(e) =>
														updateRow(row.id, col.key, (e.target as HTMLInputElement).value)}
													on:paste={(e) => handlePaste(e, row.id, col.key)}
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
								<td colspan={SHEET_COLUMNS.length + TABLE_EXTRA_COLS} class="sheet-add-row">
									<button type="button" class="sheet-add-btn" on:click={openEquipments}>
										+ Add Equipment
									</button>
								</td>
							</tr>
						</tfoot>
					{/if}
				</table>
			{/if}
		</div>
		</div>

		<aside class="sheet-sidebar">
			<label class="sheet-sidebar-field" for="sheet-name">
				<span class="sheet-sidebar-label">Sheet name</span>
				<input
					id="sheet-name"
					type="text"
					bind:value={$sheetHeader.sheetName}
					class="sheet-sidebar-input"
					placeholder={defaultSheetName()}
					aria-label="Sheet name"
				/>
			</label>

			<label class="sheet-sidebar-field" for="sheet-frequency">
				<span class="sheet-sidebar-label">Frequency</span>
				<select
					id="sheet-frequency"
					bind:value={$sheetHeader.frequency}
					class="sheet-sidebar-input sheet-header-select"
					title={$sheetHeader.frequency || 'Select frequency'}
				>
					<option value="">Select frequency…</option>
					{#each FREQUENCY_OPTIONS as frequency (frequency)}
						<option value={frequency}>{frequency}</option>
					{/each}
				</select>
			</label>

			<label class="sheet-sidebar-field" for="sheet-location-filter">
				<span class="sheet-sidebar-label">Location</span>
				<select
					id="sheet-location-filter"
					bind:value={$sheetHeader.location}
					class="sheet-sidebar-input sheet-header-select"
					title={$sheetHeader.location || 'All locations'}
					disabled={locationOptions.length === 0}
				>
					<option value="">All locations</option>
					{#each locationOptions as location (location)}
						<option value={location}>{location}</option>
					{/each}
				</select>
			</label>

			<div class="sheet-sidebar-inactive no-print">
				<span class="sheet-sidebar-label">Inactive equipment</span>
				{#if isTableLoading}
					<p class="sheet-sidebar-inactive-empty">Loading…</p>
				{:else if sidebarInactiveRows.length === 0}
					<p class="sheet-sidebar-inactive-empty">None</p>
				{:else}
					<ul class="sheet-sidebar-inactive-list">
						{#each sidebarInactiveRows as row (row.id)}
							<li class="sheet-sidebar-inactive-item">
								<div class="sheet-sidebar-inactive-info">
									<div class="sheet-sidebar-inactive-name-row">
										<span class="sheet-sidebar-inactive-name" title={row.machines || row.tag}>
											{row.machines || row.tag || 'Unnamed'}
										</span>
										{#if row.active === false}
											<span class="sheet-sidebar-inactive-badge">Inactive</span>
										{/if}
									</div>
									{#if row.tag && row.machines}
										<span class="sheet-sidebar-inactive-tag">{row.tag}</span>
									{/if}
								</div>
								<button
									type="button"
									class="sheet-sidebar-restore-btn"
									title="Add back to sheet"
									on:click={() => restoreInactiveEquipment(row)}
								>
									+
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</aside>
	</div>
</div>

<style>
	.sheet-page {
		min-height: 100vh;
		background: #0e1012;
		color: #f3f4f6;
		padding: 1.5rem 1rem 2.5rem;
		font-family: inherit;
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
		color: #9ca3af;
		text-decoration: none;
		transition: color 0.15s ease;
	}

	.sheet-toolbar-link:hover {
		color: #a3e635;
		text-decoration: underline;
	}

	.sheet-toolbar-actions {
		display: flex;
		gap: 0.5rem;
	}

	.existing-sheet-modal-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.existing-sheet-modal-copy {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: #d1d5db;
	}

	.existing-sheet-modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.sheet-layout {
		max-width: 80rem;
		margin: 0 auto;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 14rem;
		gap: 1rem;
		align-items: start;
	}

	.sheet-document {
		min-width: 0;
		background: #141619;
		border: 1px solid #262a30;
		border-radius: 1rem;
		overflow: hidden;
		padding: 0;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
	}

	.sheet-sidebar {
		background: #141619;
		border: 1px solid #262a30;
		border-radius: 1rem;
		padding: 1.25rem 1rem;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.sheet-sidebar-field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		font-size: 0.8125rem;
		color: #d1d5db;
	}

	.sheet-sidebar-label {
		font-weight: 600;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #9ca3af;
	}

	.sheet-sidebar-input {
		width: 100%;
		min-width: 0;
		border: 1px solid #262a30;
		border-radius: 0.5rem;
		background: #0e1012;
		font-size: 0.8125rem;
		color: #f3f4f6;
		padding: 0.4375rem 0.625rem;
		text-align: left;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.sheet-sidebar-input:focus {
		outline: none;
		border-color: #84cc16;
	}

	.sheet-sidebar-inactive {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border-top: 1px solid #262a30;
		padding-top: 1rem;
	}

	.sheet-sidebar-inactive-empty {
		margin: 0;
		font-size: 0.8125rem;
		color: #6b7280;
	}

	.sheet-sidebar-inactive-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		max-height: 24rem;
		overflow-y: auto;
	}

	.sheet-sidebar-inactive-item {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.375rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid #262a30;
	}

	.sheet-sidebar-inactive-item:last-child {
		border-bottom: none;
	}

	.sheet-sidebar-inactive-info {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.sheet-sidebar-inactive-name-row {
		display: flex;
		align-items: flex-start;
		gap: 0.25rem;
		min-width: 0;
	}

	.sheet-sidebar-inactive-badge {
		flex-shrink: 0;
		font-size: 0.5625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #fbbf24;
		background: rgba(120, 53, 15, 0.35);
		border: 1px solid rgba(245, 158, 11, 0.3);
		border-radius: 0.25rem;
		padding: 0.0625rem 0.25rem;
		line-height: 1.2;
	}

	.sheet-sidebar-inactive-name {
		font-size: 0.8125rem;
		color: #e5e7eb;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.sheet-sidebar-inactive-tag {
		font-size: 0.6875rem;
		color: #9ca3af;
	}

	.sheet-sidebar-restore-btn {
		flex-shrink: 0;
		border: 1px solid #262a30;
		background: #181b20;
		color: #9ca3af;
		border-radius: 0.375rem;
		width: 1.5rem;
		height: 1.5rem;
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.sheet-sidebar-restore-btn:hover {
		background: #1f2329;
		border-color: #84cc16;
		color: #a3e635;
	}

	.sheet-header {
		display: flex;
		flex-direction: column;
		gap: 0;
		margin: 0;
		padding: 0;
	}

	.sheet-header-main {
		display: grid;
		grid-template-columns: 9rem 1fr 9rem;
		align-items: start;
		gap: 1rem;
		padding: 1.5rem 2.5rem;
		background: #181b20;
		border-bottom: 1px solid #262a30;
		color: #f3f4f6;
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

	.sheet-header-select option {
		color: #f3f4f6;
		background-color: #141619;
	}

	.sheet-header-select {
		color-scheme: dark;
		cursor: pointer;
	}

	.sheet-subtitle {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: #9ca3af;
	}

	.sheet-header-date {
		text-align: right;
		padding-top: 0.25rem;
	}

	.sheet-header-date-label {
		display: block;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #9ca3af;
		margin-bottom: 0.25rem;
	}

	.sheet-header-date-input {
		display: block;
		width: 100%;
		min-width: 0;
		border: none;
		border-bottom: 1px solid #333842;
		background: transparent;
		color: #f3f4f6;
		font-size: 1rem;
		font-weight: 700;
		text-align: right;
		padding: 0.25rem 0;
		cursor: pointer;
		color-scheme: dark;
	}

	.sheet-header-date-input:focus {
		outline: none;
		border-bottom-color: #84cc16;
	}

	.sheet-header-date-input::-webkit-calendar-picker-indicator {
		filter: invert(1);
		cursor: pointer;
	}

	.sheet-table-wrap {
		border-top: 2px solid #84cc16;
		overflow-x: auto;
	}

	.sheet-loading {
		padding: 1rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.sheet-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
		color: #e5e7eb;
	}

	.sheet-table thead tr {
		background: #181b20;
	}

	.sheet-table th {
		padding: 0.625rem 0.75rem;
		text-align: left;
		font-weight: 700;
		font-size: 0.8125rem;
		color: #9ca3af;
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
		transition: color 0.15s ease;
	}

	.sheet-sort-btn:hover {
		color: #a3e635;
	}

	.sheet-sort-icon {
		font-size: 0.6875rem;
		color: #6b7280;
		font-weight: 400;
	}

	.sheet-table tbody tr {
		border-bottom: 1px solid #262a30;
		transition: background-color 0.15s ease;
	}

	.sheet-table tbody tr:hover {
		background: rgba(31, 35, 41, 0.4);
	}

	.sheet-row--inactive {
		background: rgba(24, 27, 32, 0.6);
	}

	.sheet-table tbody tr:last-child {
		border-bottom: 1px solid #262a30;
	}

	.sheet-cell {
		padding: 0.75rem;
		vertical-align: top;
		border: none;
		position: relative;
	}

	.sheet-cell--equipment-info {
		padding: 0.5rem;
		min-width: 16rem;
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
		color: #f3f4f6;
		resize: none;
	}

	.sheet-cell-input:focus {
		outline: none;
		background: #1f2329;
		box-shadow: inset 0 -1px 0 #84cc16;
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
		color: #f3f4f6;
		cursor: pointer;
	}

	.sheet-cell-select option {
		background: #141619;
		color: #f3f4f6;
	}

	.sheet-cell-select:focus {
		outline: none;
		background: #1f2329;
		box-shadow: inset 0 -1px 0 #84cc16;
	}

	.sheet-cell-select:disabled {
		color: #6b7280;
		cursor: not-allowed;
	}

	.sheet-cell-input--link {
		color: #38bdf8;
		font-weight: 500;
		transition: color 0.15s ease;
	}

	.sheet-cell-input--link:hover {
		color: #7dd3fc;
		text-decoration: underline;
	}

	.sheet-notes-col {
		min-width: 18rem;
		width: 22%;
	}

	.sheet-notes-cell {
		min-width: 18rem;
		width: 100%;
	}

	.sheet-cell-textarea {
		min-height: 6rem;
		min-width: 18rem;
		width: 100%;
		line-height: 1.45;
		overflow: hidden;
		white-space: pre-wrap;
		word-break: break-word;
		field-sizing: content;
		background: #0e1012;
		border: 1px solid #262a30;
		border-radius: 0.375rem;
		padding: 0.5rem;
		color: #f3f4f6;
		transition: border-color 0.15s ease;
	}

	.sheet-cell-textarea:focus {
		outline: none;
		border-color: #84cc16;
		background: #0e1012;
		box-shadow: none;
	}

	.sheet-checkbox {
		width: 1rem;
		height: 1rem;
		accent-color: #84cc16;
		cursor: pointer;
	}

	.sheet-row-num-col {
		width: 2.5rem;
		padding: 0.75rem 0.5rem;
		text-align: center;
		color: #6b7280;
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
		color: #6b7280;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		transition: color 0.15s ease;
	}

	.sheet-remove-btn:hover {
		color: #f87171;
	}

	.sheet-empty {
		padding: 2.5rem 1rem;
		text-align: center;
		color: #9ca3af;
		border-bottom: 1px solid #262a30;
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
		color: #9ca3af;
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0;
		transition: color 0.15s ease;
	}

	.sheet-add-btn:hover {
		color: #a3e635;
		text-decoration: underline;
	}

	@media (max-width: 768px) {
		.sheet-layout {
			grid-template-columns: 1fr;
		}

		.sheet-sidebar {
			order: -1;
		}

		.sheet-document {
			padding: 0;
		}

		.sheet-header {
			margin: 0;
		}

		.sheet-header-main {
			padding: 1.25rem 1rem;
			grid-template-columns: 1fr;
			text-align: center;
		}

		.sheet-header-logo,
		.sheet-header-date {
			justify-content: center;
			text-align: center;
		}

		.sheet-header-date-label,
		.sheet-header-date-input {
			text-align: center;
		}

		.sheet-header-logo {
			display: flex;
		}

		.sheet-logo {
			margin: 0 auto;
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

		.sheet-sidebar {
			display: none !important;
		}

		.sheet-layout {
			max-width: none;
			grid-template-columns: 1fr;
			gap: 0;
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

		.sheet-table,
		.sheet-cell {
			overflow: visible;
		}

		.sheet-notes-col,
		.sheet-notes-cell {
			min-width: 12rem;
			width: 24%;
		}

		.sheet-actions-col,
		.sheet-add-row,
		.sheet-sort-icon {
			display: none !important;
		}

		.sheet-header-date-input {
			color-scheme: light;
			color: #fff;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
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

		:global(.equipment-info-card) {
			box-shadow: none;
			break-inside: avoid;
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
