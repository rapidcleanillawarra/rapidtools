<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import {
		IMS_COMBUSTION_ENGINE_NOTE,
		IMS_INTERVAL_LEGEND,
		IMS_INTERVAL_SYMBOLS,
		createImsChecklistSections,
		intervalDisplay,
		mergeChecklistSections
	} from './imsData';
	import {
		loadImsDraft,
		saveImsDraft,
		clearImsDraft,
		createEmptyOperatingHoursTotal,
		createEmptyOperatingHoursSinceMaintenance,
		createEmptyImsSignatures,
		type ImsDraft,
		type ImsChecklistSectionState,
		type ImsChecklistStatus,
		type OperatingHoursTotal,
		type OperatingHoursSinceMaintenance,
		type ImsSignatures
	} from './imsStorage';
	import { printSheetElement } from './printUtils';
	import WorkshopOrderCombobox, {
		type WorkshopOrderOption
	} from './WorkshopOrderCombobox.svelte';
	import { supabase } from '$lib/supabase';
	import { currentUser } from '$lib/firebase';
	import { get } from 'svelte/store';

	const LOGO_URL = `${base}/company_logo_white.webp`;
	const LOGO_PRINT_FALLBACK = LOGO_URL;

	type SavedRecord = {
		id: string;
		workshop_order_id: string | null;
		inspection_date: string;
		order_no: string | null;
		customer_no: string | null;
		machine_type: string | null;
		type_no: string | null;
		serial_number: string | null;
		year_of_manufacture: string | null;
		purchase_date: string | null;
		tester_name: string;
		customer_name: string | null;
		operating_hours_total: OperatingHoursTotal | null;
		operating_hours_since_maintenance: OperatingHoursSinceMaintenance | null;
		checklist_data: ImsChecklistSectionState[] | null;
		signatures: ImsSignatures | null;
		created_at: string;
	};

	let checklistSections = $state(createImsChecklistSections());

	function checklistRowId(sectionIdx: number, subIdx: number, rowIdx: number): string {
		return `ims-${sectionIdx}-${subIdx}-${rowIdx}`;
	}

	function setRowStatus(
		row: { kind: 'item'; status: ImsChecklistStatus },
		status: ImsChecklistStatus
	) {
		row.status = status;
		persistDraft();
	}

	let workshopOrderId = $state('');
	let inspectionDate = $state('');
	let orderNo = $state('');
	let customerNo = $state('');
	let machineType = $state('');
	let typeNo = $state('');
	let serialNumber = $state('');
	let yearOfManufacture = $state('');
	let purchaseDate = $state('');
	let testerName = $state('');
	let customerName = $state('');
	let operatingHoursTotal = $state(createEmptyOperatingHoursTotal());
	let operatingHoursSinceMaintenance = $state(createEmptyOperatingHoursSinceMaintenance());
	let signatures = $state(createEmptyImsSignatures());

	let sheetEl: HTMLFormElement | undefined = $state();
	let printing = $state(false);
	let printError = $state('');
	let saving = $state(false);
	let saveError = $state('');
	let saveSuccess = $state(false);
	let savedId = $state<string | null>(null);

	let savedRecords = $state<SavedRecord[]>([]);
	let recordsLoading = $state(false);
	let recordsError = $state('');
	let deletingId = $state<string | null>(null);
	let sidebarOpen = $state(true);

	function formatInspectionDate(d: Date): string {
		const day = String(d.getDate()).padStart(2, '0');
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const year = d.getFullYear();
		return `${day} / ${month} / ${year}`;
	}

	function isoToDisplay(iso: string): string {
		const parts = iso.split('-');
		if (parts.length === 3) return `${parts[2]} / ${parts[1]} / ${parts[0]}`;
		return iso;
	}

	function parseDisplayDate(raw: string): string | null {
		const parts = raw.replace(/\s/g, '').split('/');
		if (parts.length === 3) {
			const [dd, mm, yyyy] = parts;
			if (dd && mm && yyyy) return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
		}
		return null;
	}

	function parseInspectionDate(raw: string): string {
		return parseDisplayDate(raw) ?? new Date().toISOString().slice(0, 10);
	}

	function buildDraft(): ImsDraft {
		return {
			workshopOrderId,
			inspectionDate,
			orderNo,
			customerNo,
			machineType,
			typeNo,
			serialNumber,
			yearOfManufacture,
			purchaseDate,
			testerName,
			customerName,
			operatingHoursTotal: { ...operatingHoursTotal },
			operatingHoursSinceMaintenance: { ...operatingHoursSinceMaintenance },
			checklistSections: serializeChecklist(),
			signatures: { ...signatures }
		};
	}

	function serializeChecklist(): ImsChecklistSectionState[] {
		return checklistSections.map((section) => ({
			sectionTitle: section.sectionTitle,
			subsections: section.subsections.map((sub) => ({
				title: sub.title,
				rows: sub.rows.map((row) => ({ ...row }))
			}))
		}));
	}

	function applyDraft(draft: ImsDraft) {
		workshopOrderId = draft.workshopOrderId ?? '';
		inspectionDate = draft.inspectionDate ?? '';
		orderNo = draft.orderNo ?? '';
		customerNo = draft.customerNo ?? '';
		machineType = draft.machineType ?? '';
		typeNo = draft.typeNo ?? '';
		serialNumber = draft.serialNumber ?? '';
		yearOfManufacture = draft.yearOfManufacture ?? '';
		purchaseDate = draft.purchaseDate ?? '';
		testerName = draft.testerName ?? '';
		customerName = draft.customerName ?? '';
		operatingHoursTotal = {
			...createEmptyOperatingHoursTotal(),
			...draft.operatingHoursTotal
		};
		operatingHoursSinceMaintenance = {
			...createEmptyOperatingHoursSinceMaintenance(),
			...draft.operatingHoursSinceMaintenance
		};
		signatures = {
			...createEmptyImsSignatures(),
			...draft.signatures
		};
		checklistSections = mergeChecklistSections(draft.checklistSections);
	}

	function persistDraft() {
		saveImsDraft(buildDraft());
	}

	function applyWorkshopOrder(option: WorkshopOrderOption) {
		if (option.clientsWorkOrder) orderNo = option.clientsWorkOrder;
		if (option.makeModel) machineType = option.makeModel;
		if (option.serialNumber) serialNumber = option.serialNumber;
		if (option.customerName) customerName = option.customerName;
		persistDraft();
	}

	function buildPayload() {
		const purchaseIso = purchaseDate.trim() ? parseDisplayDate(purchaseDate) : null;
		return {
			workshop_order_id: workshopOrderId || null,
			inspection_date: parseInspectionDate(inspectionDate),
			order_no: orderNo || null,
			customer_no: customerNo || null,
			machine_type: machineType || null,
			type_no: typeNo || null,
			serial_number: serialNumber || null,
			year_of_manufacture: yearOfManufacture || null,
			purchase_date: purchaseIso,
			tester_name: testerName || 'Unknown',
			customer_name: customerName || null,
			operating_hours_total: { ...operatingHoursTotal },
			operating_hours_since_maintenance: { ...operatingHoursSinceMaintenance },
			checklist_data: serializeChecklist(),
			signatures: { ...signatures },
			status: 'completed' as const,
			created_by: get(currentUser)?.email ?? null
		};
	}

	async function fetchSavedRecords() {
		recordsLoading = true;
		recordsError = '';
		try {
			const { data, error } = await supabase
				.from('workshop_ims_inspections')
				.select(
					'id, workshop_order_id, inspection_date, order_no, customer_no, machine_type, type_no, serial_number, year_of_manufacture, purchase_date, tester_name, customer_name, operating_hours_total, operating_hours_since_maintenance, checklist_data, signatures, created_at'
				)
				.order('created_at', { ascending: false })
				.limit(50);
			if (error) throw error;
			savedRecords = (data ?? []) as SavedRecord[];
		} catch (err) {
			recordsError = err instanceof Error ? err.message : 'Failed to load records';
		} finally {
			recordsLoading = false;
		}
	}

	function loadRecord(rec: SavedRecord) {
		applyDraft({
			workshopOrderId: rec.workshop_order_id ?? '',
			inspectionDate: isoToDisplay(rec.inspection_date ?? ''),
			orderNo: rec.order_no ?? '',
			customerNo: rec.customer_no ?? '',
			machineType: rec.machine_type ?? '',
			typeNo: rec.type_no ?? '',
			serialNumber: rec.serial_number ?? '',
			yearOfManufacture: rec.year_of_manufacture ?? '',
			purchaseDate: rec.purchase_date ? isoToDisplay(rec.purchase_date) : '',
			testerName: rec.tester_name ?? '',
			customerName: rec.customer_name ?? '',
			operatingHoursTotal: rec.operating_hours_total ?? createEmptyOperatingHoursTotal(),
			operatingHoursSinceMaintenance:
				rec.operating_hours_since_maintenance ?? createEmptyOperatingHoursSinceMaintenance(),
			checklistSections: rec.checklist_data ?? [],
			signatures: rec.signatures ?? createEmptyImsSignatures()
		});
		savedId = rec.id;
	}

	async function deleteRecord(id: string) {
		if (!confirm('Delete this saved record? This cannot be undone.')) return;
		deletingId = id;
		try {
			const { error } = await supabase.from('workshop_ims_inspections').delete().eq('id', id);
			if (error) throw error;
			savedRecords = savedRecords.filter((r) => r.id !== id);
			if (savedId === id) savedId = null;
		} catch (err) {
			recordsError = err instanceof Error ? err.message : 'Failed to delete record';
		} finally {
			deletingId = null;
		}
	}

	function formatRecordDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString('en-AU', {
				day: '2-digit',
				month: 'short',
				year: 'numeric'
			});
		} catch {
			return iso;
		}
	}

	async function printForm() {
		if (!sheetEl || printing) return;
		printing = true;
		printError = '';
		try {
			await printSheetElement(sheetEl, LOGO_PRINT_FALLBACK, {
				pageClassName: 'ims-page',
				printTitle: 'IMS HD/HDS — Print'
			});
		} catch (err) {
			printError = err instanceof Error ? err.message : 'Failed to print form';
		} finally {
			printing = false;
		}
	}

	async function saveForm() {
		if (saving) return;
		saving = true;
		saveError = '';
		saveSuccess = false;
		try {
			const payload = buildPayload();
			let result;
			if (savedId) {
				result = await supabase
					.from('workshop_ims_inspections')
					.update(payload)
					.eq('id', savedId)
					.select('id')
					.single();
			} else {
				result = await supabase
					.from('workshop_ims_inspections')
					.insert(payload)
					.select('id')
					.single();
			}
			if (result.error) throw result.error;
			savedId = result.data?.id ?? savedId;
			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 3000);
			await fetchSavedRecords();
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Failed to save. Please try again.';
		} finally {
			saving = false;
		}
	}

	function clearForm() {
		workshopOrderId = '';
		inspectionDate = formatInspectionDate(new Date());
		orderNo = '';
		customerNo = '';
		machineType = '';
		typeNo = '';
		serialNumber = '';
		yearOfManufacture = '';
		purchaseDate = '';
		testerName = '';
		customerName = '';
		operatingHoursTotal = createEmptyOperatingHoursTotal();
		operatingHoursSinceMaintenance = createEmptyOperatingHoursSinceMaintenance();
		checklistSections = createImsChecklistSections();
		signatures = createEmptyImsSignatures();
		savedId = null;
		clearImsDraft();
	}

	onMount(() => {
		const draft = loadImsDraft();
		if (draft) applyDraft(draft);
		if (!inspectionDate) inspectionDate = formatInspectionDate(new Date());
		fetchSavedRecords();
	});
</script>

<svelte:head>
	<title>IMS — HD / HDS Inspection &amp; Maintenance</title>
</svelte:head>

<div class="ims-page">
	<div class="screen-toolbar no-print">
		<h1 class="screen-title">IMS — HD / HDS Inspection &amp; Maintenance Checklist</h1>
		<div class="screen-actions">
			{#if printError}
				<p class="print-error" role="alert">{printError}</p>
			{/if}
			{#if saveError}
				<p class="print-error" role="alert">{saveError}</p>
			{/if}
			{#if saveSuccess}
				<p class="save-success" role="status">✓ Saved successfully</p>
			{/if}
			<button type="button" class="btn-secondary" onclick={clearForm} disabled={printing || saving}>
				Clear form
			</button>
			<button type="button" class="btn-save" onclick={saveForm} disabled={saving || printing}>
				{saving ? 'Saving…' : savedId ? 'Update' : 'Save'}
			</button>
			<button type="button" class="btn-primary" onclick={printForm} disabled={printing || saving}>
				{printing ? 'Preparing…' : 'Print'}
			</button>
			<button
				type="button"
				class="btn-sidebar-toggle"
				onclick={() => (sidebarOpen = !sidebarOpen)}
				aria-label={sidebarOpen ? 'Hide saved records' : 'Show saved records'}
			>
				{sidebarOpen ? '▶ Hide Records' : '◀ Saved Records'}
			</button>
		</div>
	</div>

	<div class="page-layout">
		<form
			bind:this={sheetEl}
			class="sheet"
			onsubmit={(e) => e.preventDefault()}
			onfocusout={persistDraft}
			onchange={(e) => {
				if (
					e.target instanceof HTMLInputElement &&
					(e.target.type === 'checkbox' || e.target.type === 'radio')
				) {
					persistDraft();
				}
			}}
		>
			<table class="form-table" aria-label="Form header">
				<tbody>
					<tr>
						<td class="logo-cell" rowspan="2">
							<img src={LOGO_URL} alt="Rapid Supplies" width="140" height="56" />
						</td>
						<td class="header-title">Inspection and maintenance checklist</td>
					</tr>
					<tr>
						<td class="header-sub">HD / HDS</td>
					</tr>
				</tbody>
			</table>

			<table class="form-table cell-stack" aria-label="Machine and order details">
				<tbody>
					<tr>
						<td class="label-cell">Workshop Order ID:</td>
						<td class="field-cell" colspan="3">
							<WorkshopOrderCombobox
								id="ims-workshop-order-id"
								bind:value={workshopOrderId}
								onselect={applyWorkshopOrder}
							/>
						</td>
					</tr>
					<tr>
						<td class="label-cell">Date:</td>
						<td class="field-cell">
							<input
								class="field"
								type="text"
								bind:value={inspectionDate}
								placeholder="DD / MM / YYYY"
							/>
						</td>
						<td class="label-cell">Order No.:</td>
						<td class="field-cell">
							<input class="field" type="text" bind:value={orderNo} />
						</td>
					</tr>
					<tr>
						<td class="label-cell">Customer No.:</td>
						<td class="field-cell">
							<input class="field" type="text" bind:value={customerNo} />
						</td>
						<td class="label-cell">Machine type:</td>
						<td class="field-cell">
							<input class="field" type="text" bind:value={machineType} />
						</td>
					</tr>
					<tr>
						<td class="label-cell">Type No.:</td>
						<td class="field-cell">
							<input class="field" type="text" bind:value={typeNo} />
						</td>
						<td class="label-cell">Serial no.:</td>
						<td class="field-cell">
							<input class="field" type="text" bind:value={serialNumber} />
						</td>
					</tr>
					<tr>
						<td class="label-cell">Year of manufacture:</td>
						<td class="field-cell">
							<input class="field" type="text" bind:value={yearOfManufacture} />
						</td>
						<td class="label-cell">Purchase date:</td>
						<td class="field-cell">
							<input
								class="field"
								type="text"
								bind:value={purchaseDate}
								placeholder="DD / MM / YYYY"
							/>
						</td>
					</tr>
				</tbody>
			</table>

			<table class="form-table cell-stack" aria-label="Personnel">
				<tbody>
					<tr>
						<td class="label-cell">Name of tester:</td>
						<td class="field-cell">
							<input class="field" type="text" bind:value={testerName} autocomplete="name" />
						</td>
						<td class="label-cell">Signature:</td>
						<td class="field-cell sign-field">
							<input class="field" type="text" bind:value={signatures.testerSignature} />
						</td>
					</tr>
					<tr>
						<td class="label-cell">Name of customer:</td>
						<td class="field-cell">
							<input class="field" type="text" bind:value={customerName} autocomplete="name" />
						</td>
						<td class="label-cell">Signature:</td>
						<td class="field-cell sign-field">
							<input class="field" type="text" bind:value={signatures.customerSignature} />
						</td>
					</tr>
				</tbody>
			</table>

			<table class="form-table operating-hours-table" aria-label="Operating data">
				<tbody>
					<tr class="section-bar">
						<th colspan="2">Operating hours total</th>
						<th colspan="2">Operating hours since the last maintenance</th>
					</tr>
					<tr>
						<td class="label-cell oh-label">Control &quot;On&quot;</td>
						<td class="field-cell oh-field">
							<input class="field" type="text" bind:value={operatingHoursTotal.controlOn} />
							<span class="oh-unit">Hours</span>
						</td>
						<td class="label-cell oh-label">Number of gun switchings</td>
						<td class="field-cell oh-field">
							<input
								class="field"
								type="text"
								bind:value={operatingHoursSinceMaintenance.gunSwitchings}
							/>
						</td>
					</tr>
					<tr>
						<td class="label-cell oh-label">Number of detergent bottles</td>
						<td class="field-cell oh-field">
							<input class="field" type="text" bind:value={operatingHoursTotal.detergentBottles} />
						</td>
						<td class="label-cell oh-label">Burner</td>
						<td class="field-cell oh-field">
							<input class="field" type="text" bind:value={operatingHoursSinceMaintenance.burner} />
							<span class="oh-unit">Hours</span>
						</td>
					</tr>
					<tr>
						<td class="label-cell oh-label">Number of gun switchings</td>
						<td class="field-cell oh-field">
							<input class="field" type="text" bind:value={operatingHoursTotal.gunSwitchings} />
						</td>
						<td class="label-cell oh-label">Pump</td>
						<td class="field-cell oh-field">
							<input class="field" type="text" bind:value={operatingHoursSinceMaintenance.pump} />
							<span class="oh-unit">Hours</span>
						</td>
					</tr>
					<tr>
						<td class="label-cell oh-label">Burner</td>
						<td class="field-cell oh-field">
							<input class="field" type="text" bind:value={operatingHoursTotal.burner} />
							<span class="oh-unit">Hours</span>
						</td>
						<td class="oh-spacer" colspan="2"></td>
					</tr>
					<tr>
						<td class="label-cell oh-label">Pump</td>
						<td class="field-cell oh-field">
							<input class="field" type="text" bind:value={operatingHoursTotal.pump} />
							<span class="oh-unit">Hours</span>
						</td>
						<td class="oh-spacer" colspan="2"></td>
					</tr>
				</tbody>
			</table>

			<div class="checklist-wrap" aria-label="Inspection checklist">
				<table class="form-table checklist-legend-table">
					<tbody>
						<tr>
							<td class="legend-cell" colspan="9">
								<p class="legend-title">
									Key test interval as per operating hours or at least:
								</p>
								<ul class="interval-legend">
									{#each IMS_INTERVAL_LEGEND as entry (entry.label)}
										<li>
											<span class="interval-symbol" aria-hidden="true">{entry.symbol}</span>
											{entry.label}
										</li>
									{/each}
								</ul>
							</td>
						</tr>
					</tbody>
				</table>

				{#each checklistSections as section, sectionIdx (section.sectionTitle)}
					<table class="form-table ims-checklist-table" aria-label={section.sectionTitle}>
						<tbody>
							<tr class="section-bar-grey">
								<th colspan="9">{section.sectionTitle}</th>
							</tr>
							<tr class="checklist-head">
								<th class="col-task" rowspan="2">Check</th>
								<th class="col-measured" rowspan="2">Measured values</th>
								<th class="col-unit" rowspan="2">Measuring unit</th>
								<th class="col-interval" rowspan="2">
									Inspection interval after operating hours or display or see key*
								</th>
								<th class="col-preventive" rowspan="2">
									Recommended preventive exchange according to operating hours
								</th>
								<th class="col-status-group" colspan="3">Status</th>
								<th class="col-repair" rowspan="2">Repair</th>
							</tr>
							<tr class="checklist-head checklist-head-sub">
								<th class="col-status">Not required / available</th>
								<th class="col-status">OK</th>
								<th class="col-status">Not OK</th>
							</tr>

							{#each section.subsections as sub, subIdx (sub.title ?? `sub-${subIdx}`)}
								{#if sub.title}
									<tr class="subsection-bar">
										<th colspan="9">{sub.title}</th>
									</tr>
								{/if}
								{#each sub.rows as row, rowIdx (`${sectionIdx}-${subIdx}-${rowIdx}`)}
									{#if row.kind === 'spacer'}
										<tr class="spacer-row">
											<td colspan="9">
												<input
													class="field"
													type="text"
													bind:value={row.notes}
													aria-label="Notes"
												/>
											</td>
										</tr>
									{:else}
										<tr>
											<td class="task-cell">{row.task}</td>
											<td>
												<input
													class="field"
													type="text"
													bind:value={row.measuredValue}
												/>
											</td>
											<td>
												<input
													class="field"
													type="text"
													bind:value={row.measuringUnit}
												/>
											</td>
											<td class="interval-cell">
												{intervalDisplay(row.intervalHours, row.intervalKey)}
												{#if row.intervalKey}
													<span class="sr-only"
														>({IMS_INTERVAL_SYMBOLS[row.intervalKey]})</span
													>
												{/if}
											</td>
											<td>
												<input
													class="field"
													type="text"
													bind:value={row.preventiveExchange}
												/>
											</td>
											<td class="status-radio-cell">
												<input
													type="radio"
													name={checklistRowId(sectionIdx, subIdx, rowIdx)}
													checked={row.status === 'not_required'}
													onchange={() => setRowStatus(row, 'not_required')}
													aria-label="Not required / available"
												/>
											</td>
											<td class="status-radio-cell">
												<input
													type="radio"
													name={checklistRowId(sectionIdx, subIdx, rowIdx)}
													checked={row.status === 'ok'}
													onchange={() => setRowStatus(row, 'ok')}
													aria-label="OK"
												/>
											</td>
											<td class="status-radio-cell">
												<input
													type="radio"
													name={checklistRowId(sectionIdx, subIdx, rowIdx)}
													checked={row.status === 'not_ok'}
													onchange={() => setRowStatus(row, 'not_ok')}
													aria-label="Not OK"
												/>
											</td>
											<td class="repair-cell">
												<label class="repair-checkbox">
													<input type="checkbox" bind:checked={row.repair} />
													<span class="sr-only">Repair required</span>
												</label>
											</td>
										</tr>
									{/if}
								{/each}
							{/each}
						</tbody>
					</table>
				{/each}

				<table class="form-table checklist-footnote-table" aria-label="Combustion engine note">
					<tbody>
						<tr>
							<td class="checklist-footnote">{IMS_COMBUSTION_ENGINE_NOTE}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</form>

		{#if sidebarOpen}
			<aside class="saved-sidebar no-print">
				<div class="sidebar-header">
					<span class="sidebar-title">Saved Records</span>
					<button
						type="button"
						class="sidebar-refresh"
						onclick={fetchSavedRecords}
						disabled={recordsLoading}
						aria-label="Refresh records"
					>↻</button>
				</div>

				{#if recordsError}
					<p class="sidebar-error">{recordsError}</p>
				{/if}

				{#if recordsLoading}
					<p class="sidebar-loading">Loading…</p>
				{:else if savedRecords.length === 0}
					<p class="sidebar-empty">No saved records yet.</p>
				{:else}
					<ul class="sidebar-list">
						{#each savedRecords as rec (rec.id)}
							<li class="sidebar-item" class:sidebar-item--active={savedId === rec.id}>
								<button
									type="button"
									class="sidebar-load-btn"
									onclick={() => loadRecord(rec)}
									title="Load this record into the form"
								>
									<span class="sidebar-customer">{rec.customer_name || rec.tester_name || '—'}</span>
									<span class="sidebar-meta"
										>{rec.machine_type || '—'} · {rec.serial_number || '—'}</span
									>
									<span class="sidebar-date">{formatRecordDate(rec.inspection_date)}</span>
									{#if rec.order_no}
										<span class="sidebar-tech">Order: {rec.order_no}</span>
									{/if}
								</button>
								<button
									type="button"
									class="sidebar-delete-btn"
									onclick={() => deleteRecord(rec.id)}
									disabled={deletingId === rec.id}
									aria-label="Delete record"
									title="Delete this record"
								>
									{deletingId === rec.id ? '…' : '🗑'}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</aside>
		{/if}
	</div>
</div>

<style>
	.ims-page {
		box-sizing: border-box;
		padding: 16px;
		font-family: Arial, Helvetica, sans-serif;
		font-size: 11pt;
		color: #000;
		background: #fff;
	}

	.ims-page *,
	.ims-page *::before,
	.ims-page *::after {
		box-sizing: border-box;
	}

	.page-layout {
		display: flex;
		align-items: flex-start;
		gap: 20px;
	}

	.page-layout .sheet {
		flex: 1 1 0;
		min-width: 0;
		max-width: 1100px;
		margin: 0 auto;
	}

	.checklist-wrap {
		overflow-x: auto;
		margin-top: 0;
	}

	.legend-cell {
		font-size: 8.5pt;
		vertical-align: top;
		padding: 8px;
	}

	.legend-title {
		margin: 0 0 6px;
		font-weight: bold;
	}

	.interval-legend {
		margin: 0;
		padding: 0 0 0 1.2em;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		gap: 2px 12px;
		list-style: none;
	}

	.interval-legend li {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.interval-symbol {
		font-size: 12pt;
		line-height: 1;
		min-width: 1em;
		text-align: center;
	}

	.section-bar-grey th {
		background: #9ca3af;
		color: #000;
		font-weight: bold;
		text-align: left;
		padding: 6px 8px;
		font-size: 9pt;
		border: 1px solid #000;
	}

	.subsection-bar th {
		background: #fef08a;
		color: #000;
		font-weight: bold;
		text-align: left;
		padding: 5px 8px;
		font-size: 9pt;
		border: 1px solid #000;
	}

	.ims-checklist-table {
		font-size: 8pt;
		min-width: 980px;
	}

	.checklist-head th {
		background: #f5f5f5;
		font-weight: bold;
		text-align: center;
		font-size: 7.5pt;
		vertical-align: middle;
		padding: 4px;
	}

	.checklist-head-sub th {
		font-size: 7pt;
	}

	.ims-checklist-table .col-task {
		width: 28%;
		text-align: left;
	}

	.ims-checklist-table .col-measured,
	.ims-checklist-table .col-unit {
		width: 8%;
	}

	.ims-checklist-table .col-interval {
		width: 10%;
		text-align: center;
	}

	.ims-checklist-table .col-preventive {
		width: 12%;
	}

	.ims-checklist-table .col-status {
		width: 6%;
	}

	.ims-checklist-table .col-repair {
		width: 5%;
	}

	.task-cell {
		font-size: 8pt;
		vertical-align: top;
	}

	.interval-cell {
		text-align: center;
		font-size: 9pt;
		white-space: nowrap;
	}

	.status-radio-cell,
	.repair-cell {
		text-align: center;
		vertical-align: middle;
	}

	.repair-checkbox {
		display: inline-flex;
		margin: 0;
		cursor: pointer;
	}

	.spacer-row td {
		height: 1.75em;
		background: #fff;
	}

	.checklist-footnote-table {
		margin-top: 0;
	}

	.checklist-footnote {
		font-size: 8pt;
		font-style: italic;
		padding: 8px;
		vertical-align: top;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.saved-sidebar {
		flex: 0 0 260px;
		width: 260px;
		position: sticky;
		top: 16px;
		max-height: calc(100vh - 48px);
		overflow-y: auto;
		border: 1px solid #d1d5db;
		border-radius: 10px;
		background: #f9fafb;
		font-family: system-ui, sans-serif;
		color: #111;
		font-size: 0.8125rem;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		border-bottom: 1px solid #e5e7eb;
		font-weight: 600;
	}

	.sidebar-refresh {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1.1rem;
		color: #6b7280;
		padding: 2px 6px;
		border-radius: 4px;
	}

	.sidebar-refresh:hover:not(:disabled) {
		background: #e5e7eb;
		color: #111;
	}

	.sidebar-error {
		margin: 8px 12px;
		color: #b91c1c;
		font-size: 0.75rem;
	}

	.sidebar-loading,
	.sidebar-empty {
		margin: 12px;
		color: #6b7280;
		font-size: 0.8125rem;
	}

	.sidebar-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.sidebar-item {
		display: flex;
		align-items: stretch;
		border-bottom: 1px solid #e5e7eb;
	}

	.sidebar-item--active {
		background: #eff6ff;
	}

	.sidebar-load-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 10px 12px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: inherit;
	}

	.sidebar-load-btn:hover {
		background: #f3f4f6;
	}

	.sidebar-customer {
		font-weight: 600;
		font-size: 0.8125rem;
	}

	.sidebar-meta {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.sidebar-date {
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.sidebar-tech {
		font-size: 0.7rem;
		color: #9ca3af;
		font-style: italic;
	}

	.sidebar-delete-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0 10px;
		color: #9ca3af;
		font-size: 1rem;
	}

	.sidebar-delete-btn:hover:not(:disabled) {
		color: #dc2626;
		background: #fef2f2;
	}

	.screen-toolbar {
		margin: 0 0 16px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.screen-title {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #111;
	}

	.screen-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.print-error {
		margin: 0;
		width: 100%;
		font-size: 0.8125rem;
		color: #b91c1c;
	}

	.btn-primary,
	.btn-secondary,
	.btn-save,
	.btn-sidebar-toggle {
		padding: 8px 16px;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 6px;
		cursor: pointer;
		border: 1px solid transparent;
	}

	.btn-primary {
		background: #000;
		color: #fff;
	}

	.btn-primary:hover {
		background: #333;
	}

	.btn-secondary {
		background: #fff;
		color: #000;
		border-color: #ccc;
	}

	.btn-secondary:hover {
		background: #f5f5f5;
	}

	.btn-save {
		background: #16a34a;
		color: #fff;
	}

	.btn-save:hover:not(:disabled) {
		background: #15803d;
	}

	.btn-save:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-sidebar-toggle {
		border: 1px solid #d1d5db;
		background: #f9fafb;
		color: #374151;
	}

	.save-success {
		margin: 0;
		font-size: 0.8125rem;
		color: #16a34a;
		font-weight: 500;
	}

	table.form-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		margin-bottom: 0;
	}

	table.form-table td,
	table.form-table th {
		border: 1px solid #000;
		vertical-align: middle;
		padding: 4px 6px;
	}

	.section-bar th {
		background: #000;
		color: #fff;
		font-weight: bold;
		text-transform: uppercase;
		padding: 6px 8px;
		font-size: 10pt;
		text-align: center;
	}

	.header-title {
		text-align: center;
		font-size: 16pt;
		font-weight: bold;
		padding: 10px 8px;
	}

	.header-sub {
		text-align: center;
		font-size: 12pt;
		font-weight: bold;
		padding: 6px 8px;
	}

	.logo-cell {
		width: 160px;
		text-align: center;
		vertical-align: middle;
		padding: 8px;
		background: #000;
	}

	.logo-cell img {
		display: block;
		margin: 0 auto;
		width: 140px;
		height: 56px;
		object-fit: contain;
	}

	.label-cell {
		font-size: 9pt;
		width: 22%;
	}

	.field-cell {
		width: 28%;
	}

	.ims-page .label-cell {
		width: 24%;
	}

	input.field {
		width: 100%;
		border: none;
		outline: none;
		font: inherit;
		background: transparent;
		padding: 2px 0;
	}

	.sign-field .field {
		border-bottom: 1px solid #000;
		min-height: 1.75em;
	}

	.operating-hours-table .oh-label {
		width: 25%;
		font-size: 9pt;
	}

	.operating-hours-table .oh-field {
		width: 25%;
		white-space: nowrap;
	}

	.operating-hours-table .oh-field .field {
		display: inline-block;
		width: calc(100% - 3.5em);
		vertical-align: middle;
	}

	.oh-unit {
		display: inline-block;
		font-size: 9pt;
		margin-left: 4px;
		vertical-align: middle;
	}

	.oh-spacer {
		background: #fafafa;
	}

	.cell-stack .label-cell,
	.cell-stack .field-cell {
		padding-top: 4px;
	}

	@media print {
		:global(.no-print) {
			display: none !important;
		}

		.ims-page {
			padding: 0;
		}

		.page-layout {
			display: block;
		}

		.page-layout .sheet {
			max-width: none;
		}

		input.field {
			border: none !important;
		}

		input[type='radio'],
		input[type='checkbox'] {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
</style>
