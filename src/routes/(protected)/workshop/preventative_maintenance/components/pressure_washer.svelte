<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { IMS_COMBUSTION_ENGINE_NOTE, createImsChecklistSections, mergeChecklistSections } from './pressure_washer_data';
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
		type ImsInspectionInterval,
		type OperatingHoursTotal,
		type OperatingHoursSinceMaintenance,
		type ImsSignatures
	} from './pressure_washer_storage';
	import { printSheetElement } from './print_utils';
	import { type WorkshopOrderOption } from './WorkshopOrderCombobox.svelte';
	import CustomerInformationSection from './CustomerInformationSection.svelte';
	import MachineInformationSection from './MachineInformationSection.svelte';
	import {
		createEmptyCustomerInfoFields,
		createEmptyMachineHourMeterFields
	} from './shared_storage';
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
		equipment_details: Record<string, unknown> | null;
		created_at: string;
	};

	let checklistSections = $state(createImsChecklistSections());

	function checklistRowId(sectionIdx: number, subIdx: number, rowIdx: number): string {
		return `ims-${sectionIdx}-${subIdx}-${rowIdx}`;
	}

	function intervalRowId(sectionIdx: number, subIdx: number, rowIdx: number): string {
		return `ims-interval-${sectionIdx}-${subIdx}-${rowIdx}`;
	}

	function setRowStatus(
		row: { kind: 'item'; status: ImsChecklistStatus },
		status: ImsChecklistStatus
	) {
		row.status = status;
		persistDraft();
	}

	function setRowInterval(
		row: { kind: 'item'; inspectionInterval: ImsInspectionInterval },
		interval: ImsInspectionInterval
	) {
		row.inspectionInterval = interval;
		persistDraft();
	}

	let workshopOrderId = $state('');
	let companyName = $state('');
	let location = $state('');
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
	let email = $state('');
	let address = $state('');
	let phone = $state('');
	let city = $state('');
	let imsState = $state('');
	let zip = $state('');
	let contact = $state('');
	let hourMeterKey = $state('');
	let hourMeterTraction = $state('');
	let hourMeterScrub = $state('');
	let hourMeterVacuum = $state('');
	let rechargeNumber = $state('');
	let workOrderNumber = $state('');
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
			companyName,
			location,
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
			email,
			address,
			phone,
			city,
			state: imsState,
			zip,
			contact,
			hourMeterKey,
			hourMeterTraction,
			hourMeterScrub,
			hourMeterVacuum,
			rechargeNumber,
			workOrderNumber,
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
		const customerDefaults = createEmptyCustomerInfoFields();
		const machineDefaults = createEmptyMachineHourMeterFields();

		workshopOrderId = draft.workshopOrderId ?? '';
		companyName = draft.companyName ?? '';
		location = draft.location ?? '';
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
		email = draft.email ?? customerDefaults.email;
		address = draft.address ?? customerDefaults.address;
		phone = draft.phone ?? customerDefaults.phone;
		city = draft.city ?? customerDefaults.city;
		imsState = draft.state ?? customerDefaults.state;
		zip = draft.zip ?? customerDefaults.zip;
		contact = draft.contact ?? customerDefaults.contact;
		hourMeterKey = draft.hourMeterKey ?? machineDefaults.hourMeterKey;
		hourMeterTraction = draft.hourMeterTraction ?? machineDefaults.hourMeterTraction;
		hourMeterScrub = draft.hourMeterScrub ?? machineDefaults.hourMeterScrub;
		hourMeterVacuum = draft.hourMeterVacuum ?? machineDefaults.hourMeterVacuum;
		rechargeNumber = draft.rechargeNumber ?? machineDefaults.rechargeNumber;
		workOrderNumber = draft.workOrderNumber ?? machineDefaults.workOrderNumber;
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

	function applyEquipmentDetails(eq: Record<string, unknown> | null | undefined) {
		if (!eq) return;
		const ci = eq.customerInfo as Record<string, string> | undefined;
		if (ci?.email) email = ci.email;
		if (ci?.phone) phone = ci.phone;
		if (ci?.city) city = ci.city;
		if (ci?.state) imsState = ci.state;
		if (ci?.zip) zip = ci.zip;
		if (ci?.contact) contact = ci.contact;
		if (typeof eq.address === 'string' && eq.address) address = eq.address;
		if (typeof eq.hourMeterKey === 'string') hourMeterKey = eq.hourMeterKey;
		if (typeof eq.hourMeterTraction === 'string') hourMeterTraction = eq.hourMeterTraction;
		if (typeof eq.hourMeterScrub === 'string') hourMeterScrub = eq.hourMeterScrub;
		if (typeof eq.hourMeterVacuum === 'string') hourMeterVacuum = eq.hourMeterVacuum;
		if (typeof eq.rechargeNumber === 'string') rechargeNumber = eq.rechargeNumber;
		if (typeof eq.workOrderNumber === 'string') workOrderNumber = eq.workOrderNumber;
	}

	function persistDraft() {
		saveImsDraft(buildDraft());
	}

	function applyWorkshopOrder(option: WorkshopOrderOption) {
		if (option.companyName) companyName = option.companyName;
		if (option.clientsWorkOrder) {
			if (!orderNo) orderNo = option.clientsWorkOrder;
			if (!workOrderNumber) workOrderNumber = option.clientsWorkOrder;
		}
		if (option.makeModel) machineType = option.makeModel;
		if (option.serialNumber) serialNumber = option.serialNumber;
		if (option.customerName) customerName = option.customerName;
		if (option.siteLocation) {
			location = option.siteLocation;
			if (!address) address = option.siteLocation;
		}
		persistDraft();
	}

	function buildEquipmentDetails() {
		return {
			address: address || null,
			customerInfo: { email, phone, city, state: imsState, zip, contact },
			hourMeterKey,
			hourMeterTraction,
			hourMeterScrub,
			hourMeterVacuum,
			rechargeNumber,
			workOrderNumber
		};
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
			equipment_details: buildEquipmentDetails(),
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
					'id, workshop_order_id, inspection_date, order_no, customer_no, machine_type, type_no, serial_number, year_of_manufacture, purchase_date, tester_name, customer_name, operating_hours_total, operating_hours_since_maintenance, checklist_data, signatures, equipment_details, created_at'
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
			companyName: '',
			location: '',
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
			...createEmptyCustomerInfoFields(),
			...createEmptyMachineHourMeterFields(),
			operatingHoursTotal: rec.operating_hours_total ?? createEmptyOperatingHoursTotal(),
			operatingHoursSinceMaintenance:
				rec.operating_hours_since_maintenance ?? createEmptyOperatingHoursSinceMaintenance(),
			checklistSections: rec.checklist_data ?? [],
			signatures: rec.signatures ?? createEmptyImsSignatures()
		});
		applyEquipmentDetails(rec.equipment_details);
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
		companyName = '';
		location = '';
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
		email = '';
		address = '';
		phone = '';
		city = '';
		imsState = '';
		zip = '';
		contact = '';
		hourMeterKey = '';
		hourMeterTraction = '';
		hourMeterScrub = '';
		hourMeterVacuum = '';
		rechargeNumber = '';
		workOrderNumber = '';
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
	<title>Preventive Maintenance (PM) Inspection Sheet</title>
</svelte:head>

<div class="ims-page">
	<div class="screen-toolbar no-print">
		<h1 class="screen-title">Preventive Maintenance (PM) Inspection Sheet</h1>
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
						<td class="header-title">Preventive Maintenance (PM) Inspection Sheet</td>
					</tr>
					<tr>
						<td class="header-sub">Pressure Washer</td>
					</tr>
				</tbody>
			</table>

			<CustomerInformationSection
				comboboxId="ims-workshop-order-id"
				bind:workshopOrderId
				bind:companyName
				bind:location
				bind:customer={customerName}
				bind:email
				bind:address
				bind:phone
				bind:city
				bind:state={imsState}
				bind:zip
				bind:contact
				onWorkshopOrderSelect={applyWorkshopOrder}
			/>

			<MachineInformationSection
				bind:serialNumber
				bind:modelNumber={machineType}
				bind:hourMeterKey
				bind:hourMeterTraction
				bind:workOrderNumber
				bind:hourMeterScrub
				bind:rechargeNumber
				bind:hourMeterVacuum
			/>

			<table class="form-table cell-stack" aria-label="IMS order and machine details">
				<tbody>
					<tr class="section-bar"><th colspan="4">Order &amp; Machine Details</th></tr>
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
						<td class="label-cell">Type No.:</td>
						<td class="field-cell">
							<input class="field" type="text" bind:value={typeNo} />
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
				{#each checklistSections as section, sectionIdx (section.sectionTitle)}
					<table class="form-table ims-checklist-table" aria-label={section.sectionTitle}>
						<colgroup>
							<col class="col-task" />
							<col class="col-interval" />
							<col class="col-status" />
							<col class="col-status" />
							<col class="col-status" />
							<col class="col-repair" />
						</colgroup>
						<tbody>
							<tr class="section-bar-grey">
								<th colspan="6">{section.sectionTitle}</th>
							</tr>
							<tr class="checklist-head">
								<th class="col-task" rowspan="2">Check</th>
								<th class="col-interval" rowspan="2">Inspection interval</th>
								<th class="col-status-group" colspan="3">Status</th>
								<th class="col-repair" rowspan="2">Repair</th>
							</tr>
							<tr class="checklist-head checklist-head-sub">
								<th class="col-status" title="Not required / available">N/R</th>
								<th class="col-status">OK</th>
								<th class="col-status" title="Not OK">NOK</th>
							</tr>

							{#each section.subsections as sub, subIdx (sub.title ?? `sub-${subIdx}`)}
								{#if sub.title}
									<tr class="subsection-bar">
										<th colspan="6">{sub.title}</th>
									</tr>
								{/if}
								{#each sub.rows as row, rowIdx (`${sectionIdx}-${subIdx}-${rowIdx}`)}
									{#if row.kind === 'spacer'}
										<tr class="spacer-row">
											<td colspan="6">
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
											<td class="interval-cell">
												<fieldset class="interval-fieldset">
													<legend class="sr-only">Inspection interval</legend>
													<label class="interval-radio">
														<input
															type="radio"
															name={intervalRowId(sectionIdx, subIdx, rowIdx)}
															checked={row.inspectionInterval === 'six_monthly'}
															onchange={() =>
																setRowInterval(row, 'six_monthly')}
														/>
														6 Monthly
													</label>
													<label class="interval-radio">
														<input
															type="radio"
															name={intervalRowId(sectionIdx, subIdx, rowIdx)}
															checked={row.inspectionInterval === 'twelve_monthly'}
															onchange={() =>
																setRowInterval(row, 'twelve_monthly')}
														/>
														12 Monthly
													</label>
												</fieldset>
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
												<div class="repair-cell-inner">
													<label class="repair-checkbox">
														<input type="checkbox" bind:checked={row.repair} />
														<span class="sr-only">Repair required</span>
													</label>
													<textarea
														class="field repair-notes-field"
														bind:value={row.repairNotes}
														rows="2"
														aria-label="Repair notes"
													></textarea>
												</div>
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
		min-width: 720px;
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

	.ims-checklist-table col.col-task,
	.ims-checklist-table .col-task {
		width: 20%;
		text-align: left;
	}

	.ims-checklist-table col.col-interval,
	.ims-checklist-table .col-interval {
		width: 10%;
		text-align: center;
	}

	.ims-checklist-table .col-status-group {
		width: 15%;
	}

	.ims-checklist-table col.col-status,
	.ims-checklist-table .col-status {
		width: 5%;
		padding: 1px 2px;
		font-size: 6.5pt;
		line-height: 1.15;
	}

	.ims-checklist-table col.col-repair,
	.ims-checklist-table .col-repair {
		width: auto;
	}

	.task-cell {
		font-size: 8pt;
		vertical-align: top;
	}

	.interval-cell {
		vertical-align: middle;
		padding: 4px;
	}

	.interval-fieldset {
		margin: 0;
		padding: 0;
		border: none;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}

	.interval-radio {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 7.5pt;
		line-height: 1.2;
		cursor: pointer;
		white-space: nowrap;
	}

	.status-radio-cell {
		text-align: center;
		vertical-align: middle;
		padding: 1px 2px;
	}

	.repair-cell {
		vertical-align: top;
		padding: 4px;
	}

	.repair-cell-inner {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 4px;
	}

	.repair-checkbox {
		display: inline-flex;
		align-self: center;
		margin: 0;
		cursor: pointer;
	}

	.repair-notes-field {
		width: 100%;
		min-height: 2.5em;
		resize: vertical;
		font-size: 8pt;
		line-height: 1.3;
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

	input.field,
	textarea.field {
		width: 100%;
		border: none;
		outline: none;
		font: inherit;
		background: transparent;
		padding: 2px 0;
		margin: 0;
	}

	textarea.field {
		resize: vertical;
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
