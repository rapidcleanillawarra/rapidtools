<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { CHECKLIST_SECTIONS } from './checklist-data';
	import {
		createBatteryCells,
		createBrushCondition,
		type BatteryCellRow,
		type BrushConditionState,
		type BrushPartStatus,
		type WaterClarity,
		type WaterLevel,
		type YesNo
	} from './battery-brush-data';
	import {
		createOperationFooter,
		FILL_SOLUTION_TANK_NOTE,
		OPERATION_CHECK_POST_TASKS,
		OPERATION_CHECK_PRE_TASKS,
		type OperationFooterState
	} from './operation-checklist-data';
	import {
		clearFloorScrubberDraft,
		loadFloorScrubberDraft,
		saveFloorScrubberDraft,
		type FloorScrubberChecklistRowDraft,
		type FloorScrubberDraft
	} from './pmFloorScrubberDraftStorage';
	import { printSheetElement } from '../pmis/printUtils';

	const LOGO_URL = `${base}/company_logo_white.webp`;
	const LOGO_PRINT_FALLBACK = LOGO_URL;
	const BATTERY_LAYOUT_IMAGE_URL = `${base}/pm_floor_scrubber_battery_layout.svg`;

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

	let battery1 = createBatteryCells();
	let battery2 = createBatteryCells();
	let brushCondition = createBrushCondition();
	let operationCheckPre = createChecklistRows([...OPERATION_CHECK_PRE_TASKS]);
	let operationCheckPost = createChecklistRows([...OPERATION_CHECK_POST_TASKS]);
	let operationFooter = createOperationFooter();

	let sheetEl: HTMLFormElement | undefined;
	let printing = false;
	let printError = '';

	async function printForm() {
		if (!sheetEl || printing) return;
		printing = true;
		printError = '';
		try {
			await printSheetElement(sheetEl, LOGO_PRINT_FALLBACK, {
				pageClassName: 'pm-floor-scrubber-page',
				printTitle: 'Floor Scrubber PM — Print'
			});
		} catch (err) {
			printError = err instanceof Error ? err.message : 'Failed to print form';
		} finally {
			printing = false;
		}
	}

	function buildDraft(): FloorScrubberDraft {
		return {
			customer,
			email,
			address,
			phone,
			city,
			state,
			zip,
			contact,
			serialNumber,
			hourMeterKey,
			modelNumber,
			hourMeterTraction,
			workOrderNumber,
			hourMeterScrub,
			rechargeNumber,
			hourMeterVacuum,
			checklistSections: checklistSections.map((section) => ({
				title: section.title,
				rows: section.rows.map((row) => ({
					task: row.task,
					inSpec: row.inSpec,
					repair: row.repair,
					problem: row.problem
				}))
			})),
			battery1: battery1.map((cell) => ({ ...cell })),
			battery2: battery2.map((cell) => ({ ...cell })),
			brushCondition: { ...brushCondition },
			operationCheckPre: operationCheckPre.map((row) => ({ ...row })),
			operationCheckPost: operationCheckPost.map((row) => ({ ...row })),
			operationFooter: { ...operationFooter }
		};
	}

	function mergeChecklistRows(
		tasks: readonly string[],
		saved: FloorScrubberChecklistRowDraft[] | undefined
	): ChecklistRow[] {
		return createChecklistRows([...tasks]).map((row) => {
			const savedRow = saved?.find((r) => r.task === row.task);
			if (!savedRow) return row;
			return {
				...row,
				inSpec: !!savedRow.inSpec,
				repair: !!savedRow.repair,
				problem: savedRow.problem ?? ''
			};
		});
	}

	function mergeOperationFooter(saved: OperationFooterState | undefined): OperationFooterState {
		const defaults = createOperationFooter();
		if (!saved) return defaults;
		return {
			comments: saved.comments ?? '',
			testTag3Month: saved.testTag3Month ?? '',
			testTag6Month: saved.testTag6Month ?? '',
			testTag12Month: saved.testTag12Month ?? '',
			technicianName: saved.technicianName ?? '',
			technicianDate: saved.technicianDate ?? '',
			technicianSignature: saved.technicianSignature ?? '',
			customerName: saved.customerName ?? '',
			customerDate: saved.customerDate ?? '',
			customerSignature: saved.customerSignature ?? ''
		};
	}

	function mergeBatteryCells(saved: BatteryCellRow[] | undefined): BatteryCellRow[] {
		const defaults = createBatteryCells();
		if (!saved?.length) return defaults;
		return defaults.map((cell) => {
			const match = saved.find((s) => s.label === cell.label);
			if (!match) return cell;
			return {
				label: cell.label,
				hydrometerReading: match.hydrometerReading ?? '',
				waterClarity: match.waterClarity ?? '',
				waterLevel: match.waterLevel ?? ''
			};
		});
	}

	function mergeBrushCondition(saved: BrushConditionState | undefined): BrushConditionState {
		const defaults = createBrushCondition();
		if (!saved) return defaults;
		return {
			brush1Length: saved.brush1Length ?? '',
			rotatedBrushes: saved.rotatedBrushes ?? '',
			femaleBrushSocket: saved.femaleBrushSocket ?? '',
			maleHub: saved.maleHub ?? '',
			diskPadDriver: saved.diskPadDriver ?? ''
		};
	}

	function persistDraft() {
		saveFloorScrubberDraft(buildDraft());
	}

	function applyDraft(draft: FloorScrubberDraft) {
		customer = draft.customer ?? '';
		email = draft.email ?? '';
		address = draft.address ?? '';
		phone = draft.phone ?? '';
		city = draft.city ?? '';
		state = draft.state ?? '';
		zip = draft.zip ?? '';
		contact = draft.contact ?? '';
		serialNumber = draft.serialNumber ?? '';
		hourMeterKey = draft.hourMeterKey ?? '';
		modelNumber = draft.modelNumber ?? '';
		hourMeterTraction = draft.hourMeterTraction ?? '';
		workOrderNumber = draft.workOrderNumber ?? '';
		hourMeterScrub = draft.hourMeterScrub ?? '';
		rechargeNumber = draft.rechargeNumber ?? '';
		hourMeterVacuum = draft.hourMeterVacuum ?? '';

		checklistSections = CHECKLIST_SECTIONS.map((section) => {
			const saved = draft.checklistSections?.find((s) => s.title === section.title);
			const rows = createChecklistRows(section.tasks).map((row) => {
				const savedRow = saved?.rows?.find((r) => r.task === row.task);
				if (!savedRow) return row;
				return {
					...row,
					inSpec: !!savedRow.inSpec,
					repair: !!savedRow.repair,
					problem: savedRow.problem ?? ''
				};
			});
			return { ...section, rows };
		});

		battery1 = mergeBatteryCells(draft.battery1);
		battery2 = mergeBatteryCells(draft.battery2);
		brushCondition = mergeBrushCondition(draft.brushCondition);
		operationCheckPre = mergeChecklistRows(OPERATION_CHECK_PRE_TASKS, draft.operationCheckPre);
		operationCheckPost = mergeChecklistRows(
			OPERATION_CHECK_POST_TASKS,
			draft.operationCheckPost
		);
		operationFooter = mergeOperationFooter(draft.operationFooter);
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
		battery1 = createBatteryCells();
		battery2 = createBatteryCells();
		brushCondition = createBrushCondition();
		operationCheckPre = createChecklistRows([...OPERATION_CHECK_PRE_TASKS]);
		operationCheckPost = createChecklistRows([...OPERATION_CHECK_POST_TASKS]);
		operationFooter = createOperationFooter();
		clearFloorScrubberDraft();
	}

	onMount(() => {
		const draft = loadFloorScrubberDraft();
		if (draft) applyDraft(draft);
	});
</script>

<svelte:head>
	<title>Floor Scrubber PM Sheet</title>
</svelte:head>

<div class="pm-floor-scrubber-page">
	<div class="screen-toolbar no-print">
		<h1 class="screen-title">Floor Scrubber PM Sheet</h1>
		<div class="screen-actions">
			{#if printError}
				<p class="print-error" role="alert">{printError}</p>
			{/if}
			<button type="button" class="btn-secondary" onclick={clearForm} disabled={printing}>Clear form</button>
			<button type="button" class="btn-primary" onclick={printForm} disabled={printing}>
				{printing ? 'Preparing…' : 'Print'}
			</button>
		</div>
	</div>

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
					<td class="header-title" colspan="3">Floor Scrubber PM Sheet</td>
				</tr>
				<tr>
					<td class="header-sub" colspan="3">RapidClean Illawarra — Commercial Floor Scrubbers</td>
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
						<th class="col-inspec">In Spec (✓ / ✗)</th>
						<th class="col-repair">Repair (✓ / ✗)</th>
						<th class="col-problem">Problem</th>
					</tr>
					{#each section.rows as row, i (i)}
						<tr>
							<td>{row.task}</td>
							<td class="status-cell">
								<label class="status-checkbox" title={row.inSpec ? 'In spec' : 'Out of spec'}>
									<input type="checkbox" bind:checked={row.inSpec} />
									<span
										class:status-pass={row.inSpec}
										class:status-fail={!row.inSpec}
										aria-hidden="true">{row.inSpec ? '✓' : '✗'}</span
									>
								</label>
							</td>
							<td class="status-cell">
								<label class="status-checkbox" title={row.repair ? 'Repair needed' : 'No repair'}>
									<input type="checkbox" bind:checked={row.repair} />
									<span
										class:status-pass={row.repair}
										class:status-fail={!row.repair}
										aria-hidden="true">{row.repair ? '✓' : '✗'}</span
									>
								</label>
							</td>
							<td><input class="field" type="text" bind:value={row.problem} /></td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if section.title === 'Clean & Lubricate'}
				<div class="battery-brush-block" aria-label="Battery maintenance and brush condition">
					<div class="battery-layout-row">
						<div class="battery-tables">
							{#each [{ title: 'BATTERY #1', cells: battery1 }, { title: 'BATTERY #2', cells: battery2 }] as battery (battery.title)}
								<table class="form-table battery-table" aria-label={battery.title}>
									<tbody>
										<tr class="section-bar">
											<th colspan="4">{battery.title}</th>
										</tr>
										<tr>
											<th class="battery-col-cell"></th>
											<th class="battery-col-reading">Hydrometer Reading</th>
											<th class="battery-col-clarity">Water Clarity (Circle One)</th>
											<th class="battery-col-level">Water Level (Circle One)</th>
										</tr>
										{#each battery.cells as cell, cellIndex (cell.label)}
											<tr>
												<td class="battery-cell-label">{cell.label}</td>
												<td>
													<input
														class="field"
														type="text"
														bind:value={cell.hydrometerReading}
													/>
												</td>
												<td class="circle-one-cell">
													<fieldset class="circle-one-group">
														<legend class="sr-only">{cell.label} water clarity</legend>
														{#each ['Clear', 'Dark'] as option (option)}
															<label class="circle-one-option">
																<input
																	type="radio"
																	name="{battery.title}-clarity-{cellIndex}"
																	value={option}
																	checked={cell.waterClarity === option}
																	onchange={() => {
																		cell.waterClarity = option as WaterClarity;
																	}}
																/>
																<span>{option}</span>
															</label>
														{/each}
													</fieldset>
												</td>
												<td class="circle-one-cell">
													<fieldset class="circle-one-group">
														<legend class="sr-only">{cell.label} water level</legend>
														{#each ['Overfilled', 'Full', 'Low'] as option (option)}
															<label class="circle-one-option">
																<input
																	type="radio"
																	name="{battery.title}-level-{cellIndex}"
																	value={option}
																	checked={cell.waterLevel === option}
																	onchange={() => {
																		cell.waterLevel = option as WaterLevel;
																	}}
																/>
																<span>{option}</span>
															</label>
														{/each}
													</fieldset>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/each}
						</div>
						<div class="battery-diagram" aria-label="Battery cell layout diagram">
							<img
								src={BATTERY_LAYOUT_IMAGE_URL}
								alt="Battery cell layout — replace static/pm_floor_scrubber_battery_layout.svg"
								width="280"
								height="360"
							/>
						</div>
					</div>

					<table class="form-table brush-table" aria-label="Brush condition">
						<tbody>
							<tr class="section-bar"><th colspan="4">Brush Condition</th></tr>
							<tr class="brush-meta-row">
								<td colspan="2">Scrub Brush Fiber Length</td>
								<td>
									<span class="brush-inline-label">Brush 1 Length:</span>
									<input class="field brush-length-field" type="text" bind:value={brushCondition.brush1Length} />
								</td>
								<td class="circle-one-cell">
									<span class="brush-inline-label">Rotated Brushes:</span>
									<fieldset class="circle-one-group inline">
										<legend class="sr-only">Rotated brushes</legend>
										{#each ['Y', 'N'] as option (option)}
											<label class="circle-one-option">
												<input
													type="radio"
													name="rotated-brushes"
													value={option}
													checked={brushCondition.rotatedBrushes === option}
													onchange={() => {
														brushCondition.rotatedBrushes = option as YesNo;
													}}
												/>
												<span>{option}</span>
											</label>
										{/each}
									</fieldset>
								</td>
							</tr>
							{#each [{ label: 'Female Brush Socket', key: 'femaleBrushSocket' }, { label: 'Male Hub', key: 'maleHub' }, { label: 'Disk Pad Driver', key: 'diskPadDriver' }] as part (part.key)}
								<tr>
									<td class="brush-part-label" colspan="1">{part.label}</td>
									<td colspan="3" class="circle-one-cell">
										<fieldset class="circle-one-group brush-status">
											<legend class="sr-only">{part.label} condition</legend>
											{#each ['Good', 'Worn', 'Needs Replacement'] as option (option)}
												<label class="circle-one-option">
													<input
														type="radio"
														name="brush-{part.key}"
														value={option}
														checked={brushCondition[part.key as keyof BrushConditionState] === option}
														onchange={() => {
															brushCondition[part.key as keyof BrushConditionState] =
																option as BrushPartStatus;
														}}
													/>
													<span>{option}</span>
												</label>
											{/each}
										</fieldset>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>

					{#each [{ rows: operationCheckPre, label: 'Operation check before solution tank' }, { rows: operationCheckPost, label: 'Operation check after solution tank' }] as block, blockIndex (block.label)}
						{#if blockIndex === 1}
							<p class="solution-tank-note" role="note">{FILL_SOLUTION_TANK_NOTE}</p>
						{/if}
						<table class="form-table checklist operation-checklist" aria-label={block.label}>
							<tbody>
								<tr class="section-bar">
									<th colspan="4">Check Operation &amp; Condition Of</th>
								</tr>
								<tr>
									<th class="col-task">Check Operation &amp; Condition Of</th>
									<th class="col-inspec">In Spec (✓ / ✗)</th>
									<th class="col-repair">Repair (✓ / ✗)</th>
									<th class="col-problem">Problem</th>
								</tr>
								{#each block.rows as row, i (i)}
									<tr>
										<td>{row.task}</td>
										<td class="status-cell">
											<label class="status-checkbox" title={row.inSpec ? 'In spec' : 'Out of spec'}>
												<input type="checkbox" bind:checked={row.inSpec} />
												<span
													class:status-pass={row.inSpec}
													class:status-fail={!row.inSpec}
													aria-hidden="true">{row.inSpec ? '✓' : '✗'}</span
												>
											</label>
										</td>
										<td class="status-cell">
											<label class="status-checkbox" title={row.repair ? 'Repair needed' : 'No repair'}>
												<input type="checkbox" bind:checked={row.repair} />
												<span
													class:status-pass={row.repair}
													class:status-fail={!row.repair}
													aria-hidden="true">{row.repair ? '✓' : '✗'}</span
												>
											</label>
										</td>
										<td><input class="field" type="text" bind:value={row.problem} /></td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/each}

					<table class="form-table comments-table" aria-label="Comments">
						<tbody>
							<tr class="section-bar"><th colspan="1">Comments</th></tr>
							<tr>
								<td class="comments-cell">
									<textarea
										class="field comments-field"
										bind:value={operationFooter.comments}
										rows="5"
										aria-label="Comments"
									></textarea>
								</td>
							</tr>
						</tbody>
					</table>

					<table class="form-table test-tag-table" aria-label="Electrical test and tag">
						<tbody>
							<tr class="section-bar"><th colspan="3">Electrical Test &amp; Tag</th></tr>
							<tr class="test-tag-row">
								<td>
									<span class="test-tag-label">3 Monthly Date:</span>
									<input class="field" type="text" bind:value={operationFooter.testTag3Month} />
								</td>
								<td>
									<span class="test-tag-label">6 Monthly Date:</span>
									<input class="field" type="text" bind:value={operationFooter.testTag6Month} />
								</td>
								<td>
									<span class="test-tag-label">12 Monthly Date:</span>
									<input class="field" type="text" bind:value={operationFooter.testTag12Month} />
								</td>
							</tr>
						</tbody>
					</table>

					<table class="form-table signoff-table" aria-label="Technician and customer sign-off">
						<tbody>
							<tr>
								<td class="sign-label">Technician&apos;s Name</td>
								<td class="sign-field">
									<input class="field" type="text" bind:value={operationFooter.technicianName} />
								</td>
								<td class="sign-label">Date</td>
								<td class="sign-field">
									<input class="field" type="text" bind:value={operationFooter.technicianDate} />
								</td>
								<td class="sign-label">Signature</td>
								<td class="sign-field">
									<input
										class="field"
										type="text"
										bind:value={operationFooter.technicianSignature}
									/>
								</td>
							</tr>
							<tr>
								<td class="sign-label">Customer&apos;s Name</td>
								<td class="sign-field">
									<input class="field" type="text" bind:value={operationFooter.customerName} />
								</td>
								<td class="sign-label">Date</td>
								<td class="sign-field">
									<input class="field" type="text" bind:value={operationFooter.customerDate} />
								</td>
								<td class="sign-label">Signature</td>
								<td class="sign-field">
									<input
										class="field"
										type="text"
										bind:value={operationFooter.customerSignature}
									/>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			{/if}
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

	.status-checkbox .status-pass {
		color: #16a34a;
		font-weight: 700;
	}

	.status-checkbox .status-fail {
		color: #dc2626;
		font-weight: 700;
	}

	.checklist input.field {
		min-height: 1.5em;
	}

	.battery-brush-block {
		margin-top: 0;
	}

	.battery-layout-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0;
	}

	.battery-tables {
		flex: 1 1 520px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.battery-table {
		margin-bottom: 0;
	}

	.battery-table tr:not(.section-bar) th {
		font-weight: bold;
		font-size: 8pt;
		text-align: center;
		background: #f5f5f5;
		vertical-align: middle;
	}

	.battery-col-cell {
		width: 14%;
	}

	.battery-col-reading {
		width: 22%;
	}

	.battery-col-clarity,
	.battery-col-level {
		width: 32%;
	}

	.battery-cell-label {
		font-weight: bold;
		font-size: 9pt;
		white-space: nowrap;
	}

	.battery-diagram {
		flex: 0 0 200px;
		border: 1px solid #000;
		border-left: none;
		padding: 4px;
		text-align: center;
		background: #fff;
		align-self: stretch;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.battery-diagram img {
		max-width: 100%;
		height: auto;
		display: block;
	}

	.brush-table {
		margin-top: 0;
	}

	.brush-meta-row td {
		font-size: 9pt;
		vertical-align: middle;
	}

	.brush-inline-label {
		font-weight: bold;
		margin-right: 4px;
		white-space: nowrap;
	}

	.brush-length-field {
		display: inline-block;
		width: auto;
		min-width: 4em;
		max-width: 100%;
		vertical-align: baseline;
		border-bottom: 1px solid #ccc;
	}

	.brush-part-label {
		font-weight: bold;
		font-size: 9pt;
		width: 28%;
	}

	.circle-one-cell {
		font-size: 8pt;
		vertical-align: middle;
	}

	.circle-one-group {
		border: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 6px 10px;
	}

	.circle-one-group.inline {
		display: inline-flex;
		vertical-align: middle;
	}

	.circle-one-group.brush-status {
		justify-content: flex-start;
		padding-left: 4px;
	}

	.circle-one-option {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		cursor: pointer;
		margin: 0;
		white-space: nowrap;
	}

	.circle-one-option input[type='radio'] {
		margin: 0;
		flex-shrink: 0;
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

	.operation-checklist {
		margin-top: 0;
	}

	.solution-tank-note {
		margin: 0;
		padding: 8px 10px;
		font-weight: bold;
		font-size: 10pt;
		text-align: center;
		text-transform: uppercase;
		background: #d9d9d9;
		border: 1px solid #000;
		border-top: none;
	}

	.comments-table .section-bar th {
		text-align: left;
	}

	.comments-cell {
		padding: 6px 8px;
		vertical-align: top;
	}

	.comments-field {
		width: 100%;
		min-height: 6em;
		resize: vertical;
		border: none;
		outline: none;
		font: inherit;
		background: transparent;
		padding: 4px;
		margin: 0;
	}

	.test-tag-table .test-tag-row td {
		width: 33.33%;
		vertical-align: top;
		font-size: 9pt;
	}

	.test-tag-label {
		display: block;
		font-weight: bold;
		margin-bottom: 4px;
	}

	.signoff-table {
		table-layout: fixed;
	}

	.sign-label {
		width: 14%;
		font-size: 9pt;
		font-weight: bold;
		white-space: nowrap;
		vertical-align: bottom;
		padding-bottom: 2px;
	}

	.sign-field {
		width: 19%;
		vertical-align: bottom;
		padding-bottom: 2px;
	}

	.sign-field .field {
		border-bottom: 1px solid #000;
		min-height: 1.75em;
	}

	@media (max-width: 720px) {
		.battery-diagram {
			flex: 1 1 100%;
			border-left: 1px solid #000;
			border-top: none;
		}
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

		input.field,
		textarea.comments-field {
			border: none !important;
		}

		.status-checkbox input[type='checkbox'],
		.status-checkbox .status-pass,
		.status-checkbox .status-fail {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		.battery-layout-row {
			display: table;
			width: 100%;
		}

		.battery-tables,
		.battery-diagram {
			display: table-cell;
			vertical-align: top;
		}

		.battery-diagram {
			width: 200px;
		}

		.circle-one-option input[type='radio'] {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
</style>
