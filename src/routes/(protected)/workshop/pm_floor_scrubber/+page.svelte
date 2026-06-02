<script lang="ts">
	import { CHECKLIST_SECTIONS } from './checklist-data';

	type ChecklistRow = { task: string; inSpec: boolean; repair: boolean; problem: string };

	function createChecklistRows(tasks: string[]): ChecklistRow[] {
		return tasks.map((task) => ({ task, inSpec: false, repair: false, problem: '' }));
	}

	let customer = '';
	let email = '';
	let address = '';
	let phone = '';
	let city = '';
	let state = '';
	let zip = '';
	let contact = '';

	let serialNumber = '';
	let hourMeterKey = '';
	let modelNumber = '';
	let hourMeterTraction = '';
	let workOrderNumber = '';
	let hourMeterScrub = '';
	let rechargeNumber = '';
	let hourMeterVacuum = '';

	let checklistSections = CHECKLIST_SECTIONS.map((section) => ({
		...section,
		rows: createChecklistRows(section.tasks)
	}));

	function printForm() {
		if (typeof window !== 'undefined') window.print();
	}

	function clearForm() {
		customer = '';
		email = '';
		address = '';
		phone = '';
		city = '';
		state = '';
		zip = '';
		contact = '';
		serialNumber = '';
		hourMeterKey = '';
		modelNumber = '';
		hourMeterTraction = '';
		workOrderNumber = '';
		hourMeterScrub = '';
		rechargeNumber = '';
		hourMeterVacuum = '';
		checklistSections = CHECKLIST_SECTIONS.map((section) => ({
			...section,
			rows: createChecklistRows(section.tasks)
		}));
	}
</script>

<svelte:head>
	<title>Floor Scrubber PM Sheet</title>
</svelte:head>

<div class="pm-floor-scrubber-page">
	<div class="screen-toolbar no-print">
		<h1 class="screen-title">Floor Scrubber PM Sheet</h1>
		<div class="screen-actions">
			<button type="button" class="btn-secondary" on:click={clearForm}>Clear form</button>
			<button type="button" class="btn-primary" on:click={printForm}>Print</button>
		</div>
	</div>

	<form class="sheet" on:submit|preventDefault>
		<table class="form-table" aria-label="Form header">
			<tbody>
				<tr>
					<td class="header-title" colspan="4">Floor Scrubber PM Sheet</td>
				</tr>
			</tbody>
		</table>

		<table class="form-table cell-stack" aria-label="Customer information">
			<tbody>
				<tr class="section-bar"><th colspan="4">Customer Information</th></tr>
				<tr>
					<td class="label-cell">Customer:</td>
					<td class="field-cell">
						<input class="field" type="text" bind:value={customer} autocomplete="organization" />
					</td>
					<td class="label-cell">Email:</td>
					<td class="field-cell">
						<input class="field" type="email" bind:value={email} autocomplete="email" />
					</td>
				</tr>
				<tr>
					<td class="label-cell">Address:</td>
					<td class="field-cell">
						<input class="field" type="text" bind:value={address} autocomplete="street-address" />
					</td>
					<td class="label-cell">Phone:</td>
					<td class="field-cell">
						<input class="field" type="tel" bind:value={phone} autocomplete="tel" />
					</td>
				</tr>
				<tr>
					<td class="label-cell city-label">City:</td>
					<td class="field-cell city-field">
						<input class="field" type="text" bind:value={city} autocomplete="address-level2" />
					</td>
					<td class="label-cell state-label">State:</td>
					<td class="field-cell state-field">
						<input class="field" type="text" bind:value={state} autocomplete="address-level1" />
					</td>
				</tr>
				<tr>
					<td class="label-cell zip-label">Zip:</td>
					<td class="field-cell zip-field">
						<input class="field" type="text" bind:value={zip} autocomplete="postal-code" />
					</td>
					<td class="label-cell">Contact:</td>
					<td class="field-cell">
						<input class="field" type="text" bind:value={contact} autocomplete="name" />
					</td>
				</tr>
			</tbody>
		</table>

		<table class="form-table cell-stack" aria-label="Machine information">
			<tbody>
				<tr class="section-bar"><th colspan="4">Machine Information</th></tr>
				<tr>
					<td class="label-cell">Serial #:</td>
					<td class="field-cell">
						<input class="field" type="text" bind:value={serialNumber} />
					</td>
					<td class="label-cell">Hour Meter (Key):</td>
					<td class="field-cell">
						<input class="field" type="text" bind:value={hourMeterKey} />
					</td>
				</tr>
				<tr>
					<td class="label-cell">Model #:</td>
					<td class="field-cell">
						<input class="field" type="text" bind:value={modelNumber} />
					</td>
					<td class="label-cell">Hour Meter (Traction):</td>
					<td class="field-cell">
						<input class="field" type="text" bind:value={hourMeterTraction} />
					</td>
				</tr>
				<tr>
					<td class="label-cell">Work Order #:</td>
					<td class="field-cell">
						<input class="field" type="text" bind:value={workOrderNumber} />
					</td>
					<td class="label-cell">Hour Meter (Scrub):</td>
					<td class="field-cell">
						<input class="field" type="text" bind:value={hourMeterScrub} />
					</td>
				</tr>
				<tr>
					<td class="label-cell">Recharge #:</td>
					<td class="field-cell">
						<input class="field" type="text" bind:value={rechargeNumber} />
					</td>
					<td class="label-cell">Hour Meter (Vacuum):</td>
					<td class="field-cell">
						<input class="field" type="text" bind:value={hourMeterVacuum} />
					</td>
				</tr>
			</tbody>
		</table>

		{#each checklistSections as section (section.title)}
			<table class="form-table checklist" aria-label={section.ariaLabel}>
				<tbody>
					<tr class="section-bar"><th colspan="4">{section.title}</th></tr>
					<tr>
						<th class="col-task">{section.taskHeader}</th>
						<th class="col-inspec">In Spec</th>
						<th class="col-repair">Repair</th>
						<th class="col-problem">Problem</th>
					</tr>
					{#each section.rows as row, i (i)}
						<tr>
							<td>{row.task}</td>
							<td class="check-cell">
								<label class="check-label" title="In spec">
									<input type="checkbox" bind:checked={row.inSpec} />
									<span class="check-mark" aria-hidden="true">/</span>
								</label>
							</td>
							<td class="check-cell">
								<label class="check-label" title="Repair">
									<input type="checkbox" bind:checked={row.repair} />
								</label>
							</td>
							<td><input class="field" type="text" bind:value={row.problem} /></td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/each}
	</form>
</div>

<style>
	.pm-floor-scrubber-page {
		box-sizing: border-box;
		padding: 16px;
		font-family: Arial, Helvetica, sans-serif;
		font-size: 11pt;
		color: #000;
		background: #fff;
	}

	.pm-floor-scrubber-page *,
	.pm-floor-scrubber-page *::before,
	.pm-floor-scrubber-page *::after {
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

	.label-cell {
		font-size: 9pt;
		width: 22%;
		padding: 2px 6px 6px;
	}

	.field-cell {
		padding: 2px 6px 6px;
		width: 28%;
	}

	.city-label,
	.state-label,
	.zip-label {
		width: 12%;
	}

	.city-field,
	.state-field,
	.zip-field {
		width: 13%;
	}

	.cell-stack .label-cell,
	.cell-stack .field-cell {
		padding-top: 4px;
	}

	input.field {
		width: 100%;
		border: none;
		outline: none;
		font: inherit;
		background: transparent;
		padding: 2px 0;
		margin: 0;
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
		width: 46%;
	}

	.checklist .col-inspec {
		width: 10%;
	}

	.checklist .col-repair {
		width: 10%;
	}

	.checklist .col-problem {
		width: 34%;
	}

	.check-cell {
		text-align: center;
		vertical-align: middle;
		padding: 4px 6px;
	}

	.check-label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		min-height: 1.25em;
		min-width: 1.25em;
		position: relative;
	}

	.check-label input[type='checkbox'] {
		margin: 0;
		width: 14px;
		height: 14px;
		cursor: pointer;
	}

	.check-mark {
		position: absolute;
		pointer-events: none;
		font-size: 14pt;
		font-weight: bold;
		color: #999;
		line-height: 1;
	}

	.check-label:has(input:checked) .check-mark {
		color: #000;
	}

	.checklist input.field {
		min-height: 1.5em;
	}

	@media print {
		:global(body) {
			background: #fff;
		}

		.no-print {
			display: none !important;
		}

		.pm-floor-scrubber-page {
			padding: 0;
		}

		.sheet {
			max-width: none;
		}

		input.field {
			border: none !important;
		}

		.check-label input[type='checkbox'] {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
</style>
