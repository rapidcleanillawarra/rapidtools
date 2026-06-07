<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import { schedulesStore } from '../stores';
	import { loadSchedulesFromFirestore } from '../companies/utils';
	import { sheetHeader, sheetRows, isLoading } from './stores';
	import {
		applyPasteToRows,
		createEmptyRow,
		getSortIcon,
		isMultiCellPaste,
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

	let sortField: SheetColumnKey | '' = '';
	let sortDirection: 'asc' | 'desc' = 'asc';
	let isTableLoading = false;

	const pasteableColumnSet = new Set<string>(PASTEABLE_COLUMNS);

	function isPasteableColumn(key: SheetColumnKey): key is PasteableColumnKey {
		return pasteableColumnSet.has(key);
	}

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

	$: displayedRows =
		sortField === '' ? $sheetRows : sortRows($sheetRows, sortField, sortDirection);

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

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-lg font-semibold text-gray-900">Service Sheet</h2>
			<p class="text-sm text-gray-600">Record machines and service details for a test &amp; tag visit.</p>
		</div>
		<div class="flex gap-2">
			<button
				type="button"
				on:click={addMachine}
				class="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Add Machine
			</button>
			<button
				type="button"
				on:click={handleSave}
				class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
			>
				Save Sheet
			</button>
		</div>
	</div>

	<!-- Header fields -->
	<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<label for="sheet-company" class="mb-1 block text-sm font-medium text-gray-700">Company</label>
				<select
					id="sheet-company"
					value={$sheetHeader.company}
					on:change={handleCompanyChange}
					class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				>
					<option value="">Select company…</option>
					{#each companyOptions as company (company)}
						<option value={company}>{company}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="sheet-location" class="mb-1 block text-sm font-medium text-gray-700">Location</label>
				<select
					id="sheet-location"
					bind:value={$sheetHeader.location}
					disabled={!$sheetHeader.company}
					class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
				>
					<option value="">Select location…</option>
					{#each locationOptions as location (location)}
						<option value={location}>{location}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="sheet-service-date" class="mb-1 block text-sm font-medium text-gray-700"
					>Service Date</label
				>
				<input
					id="sheet-service-date"
					type="date"
					bind:value={$sheetHeader.serviceDate}
					class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="sheet-frequency" class="mb-1 block text-sm font-medium text-gray-700"
					>Frequency</label
				>
				<select
					id="sheet-frequency"
					bind:value={$sheetHeader.frequency}
					class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				>
					<option value="">Select frequency…</option>
					{#each FREQUENCY_OPTIONS as frequency (frequency)}
						<option value={frequency}>{frequency}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Machine table -->
	<p class="text-xs text-gray-500">
		Tip: Copy rows from Excel or Google Sheets and paste into Machines, Type of Machine, Serial #,
		SKU, or Size to fill multiple rows at once.
	</p>
	<div
		class="overflow-hidden rounded-lg border border-gray-200"
		on:paste={(e) => {
			if ($sheetRows.length === 0) handlePaste(e, null, 'machines');
		}}
	>
		<div class="overflow-x-auto">
			{#if isTableLoading}
				<div class="space-y-2 p-6">
					<SkeletonLoader type="text" height="2rem" />
					<SkeletonLoader type="text" height="2rem" />
					<SkeletonLoader type="text" height="2rem" />
				</div>
			{:else}
				<table class="min-w-full divide-y divide-gray-200 text-sm">
					<thead class="bg-gray-50">
						<tr>
							<th
								scope="col"
								class="w-10 px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
							>
								#
							</th>
							{#each SHEET_COLUMNS as col (col.key)}
								<th
									scope="col"
									class="min-w-[7rem] px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
								>
									<button
										type="button"
										class="flex items-center gap-1 text-left hover:text-gray-900"
										on:click={() => handleSort(col.key)}
									>
										{col.label}
										<span class="text-gray-400">{getSortIcon(col.key, sortField, sortDirection)}</span>
									</button>
								</th>
							{/each}
							<th
								scope="col"
								class="w-16 px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
							>
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white">
						{#if displayedRows.length === 0}
							<tr>
								<td
									colspan={SHEET_COLUMNS.length + 2}
									class="px-4 py-10 text-center text-sm text-gray-500"
								>
									<p class="mb-3">No machines recorded yet.</p>
									<button
										type="button"
										on:click={addMachine}
										class="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
									>
										<svg
											class="h-4 w-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 4v16m8-8H4"
											/>
										</svg>
										Add Machine
									</button>
								</td>
							</tr>
						{:else}
							{#each displayedRows as row, index (row.id)}
								<tr class="hover:bg-gray-50">
									<td class="whitespace-nowrap px-2 py-2 text-gray-500">{index + 1}</td>
									{#each SHEET_COLUMNS as col (col.key)}
										<td class="px-2 py-2 align-top">
											{#if col.key === 'active'}
												<div class="flex justify-center">
													<input
														type="checkbox"
														checked={row.active}
														on:change={(e) =>
															updateRow(row.id, 'active', (e.target as HTMLInputElement).checked)}
														class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
														aria-label="Active for machine {index + 1}"
													/>
												</div>
											{:else if col.key === 'notes'}
												<textarea
													value={row[col.key]}
													on:input={(e) =>
														updateRow(row.id, col.key, (e.target as HTMLTextAreaElement).value)}
													rows="2"
													class="w-full min-w-[8rem] rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
													placeholder={col.label}
												></textarea>
											{:else if isPasteableColumn(col.key)}
												<input
													type="text"
													value={row[col.key]}
													on:input={(e) =>
														updateRow(row.id, col.key, (e.target as HTMLInputElement).value)}
													on:paste={(e) => handlePaste(e, row.id, col.key)}
													class="w-full min-w-[6rem] rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
													placeholder={col.label}
												/>
											{:else}
												<input
													type="text"
													value={row[col.key]}
													on:input={(e) =>
														updateRow(row.id, col.key, (e.target as HTMLInputElement).value)}
													class="w-full min-w-[6rem] rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
													placeholder={col.label}
												/>
											{/if}
										</td>
									{/each}
									<td class="whitespace-nowrap px-2 py-2">
										<button
											type="button"
											on:click={() => removeMachine(row.id)}
											class="text-sm text-red-600 hover:text-red-800"
											title="Remove machine"
										>
											Remove
										</button>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
					{#if displayedRows.length > 0}
						<tfoot class="bg-gray-50">
							<tr>
								<td colspan={SHEET_COLUMNS.length + 2} class="px-2 py-2">
									<button
										type="button"
										on:click={addMachine}
										class="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-blue-400 hover:bg-white hover:text-blue-600"
									>
										<svg
											class="h-4 w-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 4v16m8-8H4"
											/>
										</svg>
										Add another machine
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
