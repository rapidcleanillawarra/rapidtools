<script lang="ts">
	import { onMount } from 'svelte';
	import { CHECKLIST_SECTIONS } from './checklist-data';

	const LOGO_URL = 'https://www.rapidsupplies.com.au/assets/images/company_logo_white.png';

	type ChecklistStatus = '' | 'pass' | 'fail';
	type ChecklistRow = { task: string; status: ChecklistStatus; notes: string };
	type PartRow = { part: string; qty: string; notes: string };

	function createChecklistRows(tasks: string[]): ChecklistRow[] {
		return tasks.map((task) => ({ task, status: 'fail', notes: '' }));
	}

	function formatInspectionDate(d: Date): string {
		const day = String(d.getDate()).padStart(2, '0');
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const year = d.getFullYear();
		return `${day} / ${month} / ${year}`;
	}

	function emptyPartRows(): PartRow[] {
		return [
			{ part: '', qty: '', notes: '' },
			{ part: '', qty: '', notes: '' },
			{ part: '', qty: '', notes: '' }
		];
	}

	let customerName = '';
	let siteLocation = '';
	let contactPerson = '';
	let technicianName = '';
	let inspectionDate = '';
	let machineModel = '';
	let serialNumber = '';
	let assetId = '';
	let hoursRun = '';

	let checklistSections = CHECKLIST_SECTIONS.map((section) => ({
		...section,
		rows: createChecklistRows(section.tasks)
	}));

	let parts = emptyPartRows();

	let recNone = false;
	let recMinor = false;
	let recMajor = false;
	let recReplace = false;
	let recDetails = '';

	let outcomeCompleted = false;
	let outcomePartial = false;
	let outcomeUnsafe = false;

	let techSignature = '';
	let customerRep = '';

	function printForm() {
		if (typeof window !== 'undefined') window.print();
	}

	function clearForm() {
		customerName = '';
		siteLocation = '';
		contactPerson = '';
		technicianName = '';
		inspectionDate = formatInspectionDate(new Date());
		machineModel = '';
		serialNumber = '';
		assetId = '';
		hoursRun = '';
		checklistSections = CHECKLIST_SECTIONS.map((section) => ({
			...section,
			rows: createChecklistRows(section.tasks)
		}));
		parts = emptyPartRows();
		recNone = false;
		recMinor = false;
		recMajor = false;
		recReplace = false;
		recDetails = '';
		outcomeCompleted = false;
		outcomePartial = false;
		outcomeUnsafe = false;
		techSignature = '';
		customerRep = '';
	}

	onMount(() => {
		if (!inspectionDate) inspectionDate = formatInspectionDate(new Date());
	});
</script>

<svelte:head>
	<title>PMIS — Carpet Extractor PM Inspection</title>
</svelte:head>

<div class="pmis-page">
	<div class="screen-toolbar no-print">
		<h1 class="screen-title">PMIS — Preventive Maintenance Inspection</h1>
		<div class="screen-actions">
			<button type="button" class="btn-secondary" onclick={clearForm}>Clear form</button>
			<button type="button" class="btn-primary" onclick={printForm}>Print</button>
		</div>
	</div>

	<form class="sheet" onsubmit={(e) => e.preventDefault()}>
		<table class="form-table" aria-label="Form header">
			<tbody>
				<tr>
					<td class="logo-cell" rowspan="2">
						<img src={LOGO_URL} alt="Rapid Supplies" width="140" height="56" />
					</td>
					<td class="header-title">Preventive Maintenance (PM) Inspection Sheet</td>
				</tr>
				<tr>
					<td class="header-sub">RapidClean Illawarra — Commercial Walk-Behind Carpet Extractors</td>
				</tr>
			</tbody>
		</table>

		<table class="form-table cell-stack" aria-label="Section 1">
			<tbody>
			<tr class="section-bar"><th colspan="4">1. Job &amp; Asset Details</th></tr>
			<tr>
				<td class="label-cell" colspan="1">Customer Name:</td>
				<td class="field-cell" colspan="3">
					<input class="field" type="text" bind:value={customerName} autocomplete="organization" />
				</td>
			</tr>
			<tr>
				<td class="label-cell" colspan="1">Site Location:</td>
				<td class="field-cell" colspan="3">
					<input class="field" type="text" bind:value={siteLocation} autocomplete="street-address" />
				</td>
			</tr>
			<tr>
				<td class="label-cell">Contact Person:</td>
				<td class="field-cell">
					<input class="field" type="text" bind:value={contactPerson} autocomplete="name" />
				</td>
				<td class="label-cell">Technician Name:</td>
				<td class="field-cell">
					<input class="field" type="text" bind:value={technicianName} autocomplete="name" />
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
				<td class="label-cell">Machine Brand/Model:</td>
				<td class="field-cell">
					<input class="field" type="text" bind:value={machineModel} />
				</td>
			</tr>
			<tr>
				<td class="label-cell">Serial Number:</td>
				<td class="field-cell">
					<input class="field" type="text" bind:value={serialNumber} />
				</td>
				<td class="label-cell">Asset ID (if applicable):</td>
				<td class="field-cell">
					<input class="field" type="text" bind:value={assetId} />
				</td>
			</tr>
			<tr>
				<td class="label-cell">Hours Run (if available):</td>
				<td class="field-cell" colspan="3">
					<input class="field" type="text" bind:value={hoursRun} />
				</td>
			</tr>
			</tbody>
		</table>

		{#each checklistSections as section (section.title)}
			<table class="form-table checklist" aria-label={section.ariaLabel}>
				<tbody>
				<tr class="section-bar"><th colspan="3">{section.title}</th></tr>
				<tr>
					<th class="col-task">{section.taskHeader ?? 'Check'}</th>
					<th class="col-status">Status (✓ / ✗)</th>
					<th class="col-notes">Notes</th>
				</tr>
				{#each section.rows as row, i (i)}
					<tr>
						<td>{row.task}</td>
						<td class="status-cell">
							<label class="status-checkbox" title={row.status === 'pass' ? 'Pass' : 'Fail'}>
								<input
									type="checkbox"
									checked={row.status === 'pass'}
									onchange={(e) => (row.status = e.currentTarget.checked ? 'pass' : 'fail')}
								/>
								<span aria-hidden="true">{row.status === 'pass' ? '✓' : '✗'}</span>
							</label>
						</td>
						<td><input class="field" type="text" bind:value={row.notes} /></td>
					</tr>
				{/each}
				</tbody>
			</table>
		{/each}

		<table class="form-table parts-table" aria-label="Section 11">
			<tbody>
			<tr class="section-bar"><th colspan="3">11. Consumables / Parts Replaced</th></tr>
			<tr>
				<th class="col-part">Part</th>
				<th class="col-qty">Qty</th>
				<th class="col-pnotes">Notes</th>
			</tr>
			{#each parts as row, i (i)}
				<tr>
					<td><input class="field" type="text" bind:value={row.part} /></td>
					<td><input class="field" type="text" bind:value={row.qty} /></td>
					<td><input class="field" type="text" bind:value={row.notes} /></td>
				</tr>
			{/each}
			</tbody>
		</table>

		<table class="form-table" aria-label="Section 12">
			<tbody>
			<tr class="section-bar"><th colspan="1">12. Recommendations / Further Repairs</th></tr>
			<tr class="checkbox-row">
				<td
					><label
						><input type="checkbox" bind:checked={recNone} /> No further action required</label
					></td
				>
			</tr>
			<tr class="checkbox-row">
				<td
					><label
						><input type="checkbox" bind:checked={recMinor} /> Minor repairs recommended</label
					></td
				>
			</tr>
			<tr class="checkbox-row">
				<td
					><label
						><input type="checkbox" bind:checked={recMajor} /> Major repairs required (quote to
						follow)</label
					></td
				>
			</tr>
			<tr class="checkbox-row">
				<td
					><label
						><input type="checkbox" bind:checked={recReplace} /> Replacement recommended</label
					></td
				>
			</tr>
			<tr><td class="details-label"><strong>Details:</strong></td></tr>
			<tr
				><td class="details-field"
					><textarea class="field" bind:value={recDetails} rows="4"></textarea></td
				></tr
			>
			</tbody>
		</table>

		<table class="form-table" aria-label="Section 13">
			<tbody>
			<tr class="section-bar"><th colspan="1">13. Service Outcome</th></tr>
			<tr class="checkbox-row">
				<td><label><input type="checkbox" bind:checked={outcomeCompleted} /> Service Completed</label></td>
			</tr>
			<tr class="checkbox-row">
				<td
					><label
						><input type="checkbox" bind:checked={outcomePartial} /> Service Partially Completed</label
					></td
				>
			</tr>
			<tr class="checkbox-row">
				<td
					><label
						><input type="checkbox" bind:checked={outcomeUnsafe} /> Machine Unsafe – Do Not Use</label
					></td
				>
			</tr>
			</tbody>
		</table>

		<table class="form-table" aria-label="Section 14">
			<tbody>
			<tr class="section-bar"><th colspan="2">14. Sign-Off</th></tr>
			<tr class="sign-row">
				<td class="sign-cell">
					<div class="sign-line">
						<input
							class="field"
							type="text"
							bind:value={techSignature}
							aria-label="Technician signature"
						/>
					</div>
					<div class="sign-caption">Technician Signature</div>
				</td>
				<td class="sign-cell">
					<div class="sign-line">
						<input
							class="field"
							type="text"
							bind:value={customerRep}
							aria-label="Customer representative"
						/>
					</div>
					<div class="sign-caption">Customer Representative</div>
				</td>
			</tr>
			</tbody>
		</table>
	</form>
</div>

<style>
	.pmis-page {
		box-sizing: border-box;
		padding: 16px;
		font-family: Arial, Helvetica, sans-serif;
		font-size: 11pt;
		color: #000;
		background: #fff;
	}

	.pmis-page *,
	.pmis-page *::before,
	.pmis-page *::after {
		box-sizing: border-box;
	}

	.screen-toolbar {
		max-width: 900px;
		margin: 0 auto 16px;
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
		gap: 8px;
	}

	.btn-primary,
	.btn-secondary {
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

	.sheet {
		max-width: 900px;
		margin: 0 auto;
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
		vertical-align: top;
		padding: 4px 6px;
	}

	.section-bar th {
		background: #000;
		color: #fff;
		font-weight: bold;
		text-transform: uppercase;
		padding: 6px 8px;
		border: 1px solid #000;
		font-size: 10pt;
		letter-spacing: 0.02em;
	}

	.header-title {
		text-align: center;
		font-size: 18pt;
		font-weight: bold;
		padding: 10px 8px;
		border: 1px solid #000;
	}

	.header-sub {
		text-align: center;
		font-size: 11pt;
		font-weight: bold;
		padding: 6px 8px;
		border: 1px solid #000;
	}

	.logo-cell {
		width: 160px;
		text-align: center;
		vertical-align: middle;
		padding: 8px;
		border: 1px solid #000;
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
		width: 28%;
		padding: 2px 6px 6px;
	}

	.field-cell {
		padding: 2px 6px 6px;
	}

	.cell-stack .label-cell,
	.cell-stack .field-cell {
		padding-top: 4px;
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
		min-height: 2.4em;
	}

	.checklist tr:not(.section-bar) th {
		font-weight: bold;
		font-size: 9pt;
		text-align: center;
		background: #f5f5f5;
		color: #000;
	}

	.checklist .col-task {
		text-align: left;
		width: 52%;
	}

	.checklist .col-status {
		width: 16%;
		text-align: center;
	}

	.checklist .status-cell {
		text-align: center;
		vertical-align: middle;
		padding: 4px 6px;
	}

	.status-checkbox {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
		margin: 0;
		font-size: 11pt;
	}

	.status-checkbox input[type='checkbox'] {
		margin: 0;
		flex-shrink: 0;
	}

	.checklist .col-notes {
		width: 32%;
	}

	.checklist input.field {
		min-height: 1.5em;
	}

	.parts-table .col-part {
		width: 38%;
	}

	.parts-table .col-qty {
		width: 12%;
		text-align: center;
	}

	.parts-table .col-pnotes {
		width: 50%;
	}

	.checkbox-row td {
		padding: 6px 8px;
		border: 1px solid #000;
	}

	.checkbox-row label {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		cursor: pointer;
		font-size: 10pt;
	}

	.checkbox-row input[type='checkbox'] {
		margin-top: 2px;
		flex-shrink: 0;
	}

	.details-label {
		font-size: 9pt;
		padding: 4px 8px 0;
		border: 1px solid #000;
	}

	.details-field {
		padding: 4px 8px 10px;
		border: 1px solid #000;
	}

	.sign-row td {
		padding: 16px 8px 8px;
		border: 1px solid #000;
		vertical-align: bottom;
	}

	.sign-cell {
		width: 50%;
	}

	.sign-line {
		border-bottom: 1px solid #000;
		min-height: 28px;
		margin-bottom: 4px;
	}

	.sign-caption {
		font-size: 9pt;
		text-align: center;
	}

	@media print {
		:global(body) {
			background: #fff;
		}

		.no-print {
			display: none !important;
		}

		.pmis-page {
			padding: 0;
		}

		.sheet {
			max-width: none;
		}

		input.field,
		textarea.field {
			border: none !important;
		}

		.checkbox-row input[type='checkbox'],
		.status-checkbox input[type='checkbox'] {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
</style>
