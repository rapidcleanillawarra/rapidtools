<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import {
		PMIS_CHECKLIST_SECTIONS,
		FLOOR_SCRUBBER_CHECKLIST_SECTIONS,
		BATTERY_CELL_LABELS,
		OPERATION_CHECK_PRE_TASKS,
		OPERATION_CHECK_POST_TASKS,
		FILL_SOLUTION_TANK_NOTE,
		createBatteryCells,
		createBrushCondition,
		createOperationFooter
	} from './pmData';
	import {
		loadPmisDraft,
		savePmisDraft,
		clearPmisDraft,
		loadFloorScrubberDraft,
		saveFloorScrubberDraft,
		clearFloorScrubberDraft,
		type ChecklistStatus,
		type PmisDraft,
		type FloorScrubberDraft,
		type WaterClarity,
		type WaterLevel,
		type YesNo,
		type BrushPartStatus,
		type BrushConditionState,
		type BatteryCellRow,
		type OperationFooterState,
		type FloorScrubberChecklistRowDraft,
		createEmptyCustomerInfoFields,
		createEmptyMachineHourMeterFields
	} from './pmStorage';
	import { printSheetElement } from './printUtils';
	import CustomerInformationSection from './CustomerInformationSection.svelte';
	import MachineInformationSection from './MachineInformationSection.svelte';
	import { type WorkshopOrderOption } from './WorkshopOrderCombobox.svelte';
	import { supabase } from '$lib/supabase';
	import { currentUser } from '$lib/firebase';
	import { get } from 'svelte/store';

	// Props
	interface Props {
		type: 'pmis' | 'floor_scrubber';
	}
	let { type }: Props = $props();

	const LOGO_URL = `${base}/company_logo_white.webp`;
	const LOGO_PRINT_FALLBACK = LOGO_URL;
	const BATTERY_LAYOUT_IMAGE_URL = `${base}/pm_floor_scrubber_battery_layout.svg`;

	type PmisChecklistRow = { task: string; status: ChecklistStatus; notes: string };
	type FsChecklistRow = { task: string; inSpec: boolean; repair: boolean; problem: string };
	type PartRow = { part: string; qty: string; notes: string };

	function createPmisChecklistRows(tasks: string[]): PmisChecklistRow[] {
		return tasks.map((task) => ({ task, status: 'fail', notes: '' }));
	}

	function createFsChecklistRows(tasks: string[]): FsChecklistRow[] {
		return tasks.map((task) => ({ task, inSpec: false, repair: false, problem: '' }));
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

	// PMIS specific states (runes)
	let workshopOrderId = $state('');
	let customerName = $state('');
	let siteLocation = $state('');
	let contactPerson = $state('');
	let technicianName = $state('');
	let inspectionDate = $state('');
	let machineModel = $state('');
	let serialNumber = $state('');
	let assetId = $state('');
	let hoursRun = $state('');
	let email = $state('');
	let address = $state('');
	let phone = $state('');
	let city = $state('');
	let pmState = $state('');
	let zip = $state('');
	let contact = $state('');
	let hourMeterKey = $state('');
	let hourMeterTraction = $state('');
	let hourMeterScrub = $state('');
	let hourMeterVacuum = $state('');
	let rechargeNumber = $state('');
	let workOrderNumber = $state('');

	let pmisChecklistSections = $state(PMIS_CHECKLIST_SECTIONS.map((section) => ({
		...section,
		rows: createPmisChecklistRows(section.tasks)
	})));

	let parts = $state(emptyPartRows());

	let recNone = $state(false);
	let recMinor = $state(false);
	let recMajor = $state(false);
	let recReplace = $state(false);
	let recDetails = $state('');

	let outcomeCompleted = $state(false);
	let outcomePartial = $state(false);
	let outcomeUnsafe = $state(false);

	let techSignature = $state('');
	let customerRep = $state('');

	// Floor Scrubber specific states (runes)
	let customer = $state('');
	let email = $state('');
	let address = $state('');
	let phone = $state('');
	let city = $state('');
	let fsState = $state('');
	let zip = $state('');
	let contact = $state('');

	let fsSerialNumber = $state('');
	let hourMeterKey = $state('');
	let modelNumber = $state('');
	let hourMeterTraction = $state('');
	let workOrderNumber = $state('');
	let hourMeterScrub = $state('');
	let rechargeNumber = $state('');
	let hourMeterVacuum = $state('');

	let fsChecklistSections = $state(FLOOR_SCRUBBER_CHECKLIST_SECTIONS.map((section) => ({
		...section,
		rows: createFsChecklistRows(section.tasks)
	})));

	let battery1 = $state(createBatteryCells());
	let battery2 = $state(createBatteryCells());
	let brushCondition = $state(createBrushCondition());
	let operationCheckPre = $state(createFsChecklistRows([...OPERATION_CHECK_PRE_TASKS]));
	let operationCheckPost = $state(createFsChecklistRows([...OPERATION_CHECK_POST_TASKS]));
	let operationFooter = $state(createOperationFooter());

	// Global form states
	let sheetEl: HTMLFormElement | undefined = $state();
	let printing = $state(false);
	let printError = $state('');

	// Save to DB states
	let saving = $state(false);
	let saveError = $state('');
	let saveSuccess = $state(false);
	let savedId = $state<string | null>(null); // track existing record for upserts

	// ── Saved Records Sidebar ────────────────────────────────────────────────
	type SavedRecord = {
		id: string;
		customer_name: string;
		site_location: string | null;
		technician_name: string;
		inspection_date: string;
		machine_model: string;
		serial_number: string;
		work_order_number: string | null;
		checklist_data: unknown;
		parts_replaced: unknown;
		equipment_details: unknown;
		recommendations: unknown;
		signatures: unknown;
		created_at: string;
	};

	let savedRecords = $state<SavedRecord[]>([]);
	let recordsLoading = $state(false);
	let recordsError = $state('');
	let deletingId = $state<string | null>(null);
	let sidebarOpen = $state(true);

	async function fetchSavedRecords() {
		recordsLoading = true;
		recordsError = '';
		try {
			const { data, error } = await supabase
				.from('workshop_pm_inspections')
				.select('id, customer_name, site_location, technician_name, inspection_date, machine_model, serial_number, work_order_number, checklist_data, parts_replaced, equipment_details, recommendations, signatures, created_at')
				.eq('type', type)
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
		if (type === 'pmis') {
			const cd = rec.checklist_data as { title: string; rows: { task: string; status: string; notes: string }[] }[];
			const pr = rec.parts_replaced as { part: string; qty: string; notes: string }[];
			const eq = rec.equipment_details as {
				hoursRun?: string;
				contactPerson?: string;
				workshopOrderId?: string;
				address?: string;
				customerInfo?: Record<string, string>;
				hourMeterKey?: string;
				hourMeterTraction?: string;
				hourMeterScrub?: string;
				hourMeterVacuum?: string;
				rechargeNumber?: string;
				workOrderNumber?: string;
			} | null;
			const recs = rec.recommendations as {
				recNone?: boolean; recMinor?: boolean; recMajor?: boolean; recReplace?: boolean;
				recDetails?: string; outcomeCompleted?: boolean; outcomePartial?: boolean; outcomeUnsafe?: boolean;
			} | null;
			const sigs = rec.signatures as { techSignature?: string; customerRep?: string } | null;

			// Convert DB date YYYY-MM-DD → DD / MM / YYYY for the form field
			function isoToDisplay(iso: string): string {
				const parts = iso.split('-');
				if (parts.length === 3) return `${parts[2]} / ${parts[1]} / ${parts[0]}`;
				return iso;
			}

			applyPmisDraft({
				workshopOrderId: eq?.workshopOrderId ?? '',
				customerName: rec.customer_name ?? '',
				siteLocation: rec.site_location ?? '',
				contactPerson: eq?.contactPerson ?? '',
				technicianName: rec.technician_name ?? '',
				inspectionDate: isoToDisplay(rec.inspection_date ?? ''),
				machineModel: rec.machine_model ?? '',
				serialNumber: rec.serial_number ?? '',
				assetId: rec.work_order_number ?? '',
				hoursRun: eq?.hoursRun ?? '',
				email: eq?.customerInfo?.email ?? '',
				address: eq?.address ?? rec.site_location ?? '',
				phone: eq?.customerInfo?.phone ?? '',
				city: eq?.customerInfo?.city ?? '',
				state: eq?.customerInfo?.state ?? '',
				zip: eq?.customerInfo?.zip ?? '',
				contact: eq?.customerInfo?.contact ?? '',
				hourMeterKey: eq?.hourMeterKey ?? '',
				hourMeterTraction: eq?.hourMeterTraction ?? '',
				hourMeterScrub: eq?.hourMeterScrub ?? '',
				hourMeterVacuum: eq?.hourMeterVacuum ?? '',
				rechargeNumber: eq?.rechargeNumber ?? '',
				workOrderNumber: eq?.workOrderNumber ?? '',
				checklistSections: Array.isArray(cd) ? cd.map((s) => ({
					title: s.title,
					rows: s.rows.map((r) => ({ task: r.task, status: r.status as import('./pmStorage').ChecklistStatus, notes: r.notes }))
				})) : [],
				parts: Array.isArray(pr) ? pr : [],
				recNone: !!recs?.recNone,
				recMinor: !!recs?.recMinor,
				recMajor: !!recs?.recMajor,
				recReplace: !!recs?.recReplace,
				recDetails: recs?.recDetails ?? '',
				outcomeCompleted: !!recs?.outcomeCompleted,
				outcomePartial: !!recs?.outcomePartial,
				outcomeUnsafe: !!recs?.outcomeUnsafe,
				techSignature: sigs?.techSignature ?? '',
				customerRep: sigs?.customerRep ?? ''
			});
		} else {
			const eq = rec.equipment_details as Record<string, unknown> | null;
			const ci = eq?.customerInfo as Record<string, string> | undefined;
			const sigs = rec.signatures as Record<string, string> | null;

			applyFsDraft({
				workshopOrderId: (eq?.workshopOrderId as string) ?? '',
				customer: rec.customer_name ?? '',
				email: ci?.email ?? '',
				address: rec.site_location ?? '',
				phone: ci?.phone ?? '',
				city: ci?.city ?? '',
				state: ci?.state ?? '',
				zip: ci?.zip ?? '',
				contact: ci?.contact ?? '',
				serialNumber: rec.serial_number ?? '',
				hourMeterKey: (eq?.hourMeterKey as string) ?? '',
				modelNumber: rec.machine_model ?? '',
				hourMeterTraction: (eq?.hourMeterTraction as string) ?? '',
				workOrderNumber: rec.work_order_number ?? '',
				hourMeterScrub: (eq?.hourMeterScrub as string) ?? '',
				rechargeNumber: (eq?.rechargeNumber as string) ?? '',
				hourMeterVacuum: (eq?.hourMeterVacuum as string) ?? '',
				checklistSections: Array.isArray(rec.checklist_data) ? (rec.checklist_data as import('./pmStorage').FloorScrubberChecklistSectionDraft[]) : [],
				battery1: eq?.battery1 as import('./pmStorage').BatteryCellRow[] | undefined,
				battery2: eq?.battery2 as import('./pmStorage').BatteryCellRow[] | undefined,
				brushCondition: eq?.brushCondition as import('./pmStorage').BrushConditionState | undefined,
				operationCheckPre: eq?.operationCheckPre as import('./pmStorage').FloorScrubberChecklistRowDraft[] | undefined,
				operationCheckPost: eq?.operationCheckPost as import('./pmStorage').FloorScrubberChecklistRowDraft[] | undefined,
				operationFooter: sigs ? {
					comments: (eq?.operationFooter as Record<string, string>)?.comments ?? '',
					testTag3Month: (eq?.operationFooter as Record<string, string>)?.testTag3Month ?? '',
					testTag6Month: (eq?.operationFooter as Record<string, string>)?.testTag6Month ?? '',
					testTag12Month: (eq?.operationFooter as Record<string, string>)?.testTag12Month ?? '',
					technicianName: sigs.technicianName ?? '',
					technicianDate: sigs.technicianDate ?? '',
					technicianSignature: sigs.technicianSignature ?? '',
					customerName: sigs.customerName ?? '',
					customerDate: sigs.customerDate ?? '',
					customerSignature: sigs.customerSignature ?? ''
				} : undefined
			});
		}
		savedId = rec.id;
	}

	async function deleteRecord(id: string) {
		if (!confirm('Delete this saved record? This cannot be undone.')) return;
		deletingId = id;
		try {
			const { error } = await supabase
				.from('workshop_pm_inspections')
				.delete()
				.eq('id', id);
			if (error) throw error;
			savedRecords = savedRecords.filter((r) => r.id !== id);
			if (savedId === id) {
				savedId = null;
			}
		} catch (err) {
			recordsError = err instanceof Error ? err.message : 'Failed to delete record';
		} finally {
			deletingId = null;
		}
	}

	function formatRecordDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
		} catch {
			return iso;
		}
	}

	async function printForm() {
		if (!sheetEl || printing) return;
		printing = true;
		printError = '';
		try {
			if (type === 'pmis') {
				await printSheetElement(sheetEl, LOGO_PRINT_FALLBACK, {
					pageClassName: 'pmis-page',
					printTitle: 'PMIS — Print'
				});
			} else {
				await printSheetElement(sheetEl, LOGO_PRINT_FALLBACK, {
					pageClassName: 'pm-floor-scrubber-page',
					printTitle: 'Floor Scrubber PM — Print'
				});
			}
		} catch (err) {
			printError = err instanceof Error ? err.message : 'Failed to print form';
		} finally {
			printing = false;
		}
	}

	// ── Save to Supabase ────────────────────────────────────────────────────

	/** Convert "DD / MM / YYYY" → ISO "YYYY-MM-DD", falling back to today */
	function parseInspectionDate(raw: string): string {
		const parts = raw.replace(/\s/g, '').split('/');
		if (parts.length === 3) {
			const [dd, mm, yyyy] = parts;
			if (dd && mm && yyyy) return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
		}
		return new Date().toISOString().slice(0, 10);
	}

	function buildPmisPayload() {
		return {
			type: 'pmis' as const,
			customer_name: customerName || 'Unknown',
			site_location: siteLocation || null,
			technician_name: technicianName || 'Unknown',
			inspection_date: parseInspectionDate(inspectionDate),
			machine_model: machineModel || 'Unknown',
			serial_number: serialNumber || '',
			work_order_number: assetId || null,
			status: 'completed' as const,
			checklist_data: pmisChecklistSections.map((s) => ({
				title: s.title,
				rows: s.rows.map((r) => ({ task: r.task, status: r.status, notes: r.notes }))
			})),
			parts_replaced: parts.filter((p) => p.part.trim()),
			equipment_details: {
				hoursRun,
				contactPerson,
				workshopOrderId: workshopOrderId || null,
				address: address || null,
				customerInfo: { email, phone, city, state: pmState, zip, contact },
				hourMeterKey,
				hourMeterTraction,
				hourMeterScrub,
				hourMeterVacuum,
				rechargeNumber,
				workOrderNumber
			},
			recommendations: {
				recNone, recMinor, recMajor, recReplace, recDetails,
				outcomeCompleted, outcomePartial, outcomeUnsafe
			},
			signatures: { techSignature, customerRep },
			created_by: get(currentUser)?.email ?? null
		};
	}

	function buildFsPayload() {
		return {
			type: 'floor_scrubber' as const,
			customer_name: customer || 'Unknown',
			site_location: address || null,
			technician_name: operationFooter.technicianName || 'Unknown',
			inspection_date: new Date().toISOString().slice(0, 10),
			machine_model: modelNumber || 'Unknown',
			serial_number: fsSerialNumber || '',
			work_order_number: workOrderNumber || null,
			status: 'completed' as const,
			checklist_data: fsChecklistSections.map((s) => ({
				title: s.title,
				rows: s.rows.map((r) => ({ task: r.task, inSpec: r.inSpec, repair: r.repair, problem: r.problem }))
			})),
			parts_replaced: [],
			equipment_details: {
				workshopOrderId: workshopOrderId || null,
				customerInfo: { email, phone, city, state: fsState, zip, contact },
				hourMeterKey, hourMeterTraction, hourMeterScrub, hourMeterVacuum, rechargeNumber,
				battery1: battery1.map((c) => ({ ...c })),
				battery2: battery2.map((c) => ({ ...c })),
				brushCondition: { ...brushCondition },
				operationCheckPre: operationCheckPre.map((r) => ({ ...r })),
				operationCheckPost: operationCheckPost.map((r) => ({ ...r })),
				operationFooter: { ...operationFooter }
			},
			recommendations: null,
			signatures: {
				technicianName: operationFooter.technicianName,
				technicianDate: operationFooter.technicianDate,
				technicianSignature: operationFooter.technicianSignature,
				customerName: operationFooter.customerName,
				customerDate: operationFooter.customerDate,
				customerSignature: operationFooter.customerSignature
			},
			created_by: get(currentUser)?.email ?? null
		};
	}

	async function saveForm() {
		if (saving) return;
		saving = true;
		saveError = '';
		saveSuccess = false;

		try {
			const payload = type === 'pmis' ? buildPmisPayload() : buildFsPayload();

			let result;
			if (savedId) {
				// Update existing record
				result = await supabase
					.from('workshop_pm_inspections')
					.update(payload)
					.eq('id', savedId)
					.select('id')
					.single();
			} else {
				// Insert new record
				result = await supabase
					.from('workshop_pm_inspections')
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

	// ── Draft builders ───────────────────────────────────────────────────────

	function applyWorkshopOrder(option: WorkshopOrderOption) {
		if (type === 'pmis') {
			if (option.customerName) customerName = option.customerName;
			if (option.siteLocation) {
				siteLocation = option.siteLocation;
				if (!address) address = option.siteLocation;
			}
			if (option.makeModel) machineModel = option.makeModel;
			if (option.serialNumber) serialNumber = option.serialNumber;
			if (option.clientsWorkOrder) {
				if (!assetId) assetId = option.clientsWorkOrder;
				if (!workOrderNumber) workOrderNumber = option.clientsWorkOrder;
			}
		} else {
			if (option.customerName) customer = option.customerName;
			if (option.siteLocation) address = option.siteLocation;
			if (option.makeModel) modelNumber = option.makeModel;
			if (option.serialNumber) fsSerialNumber = option.serialNumber;
			if (option.clientsWorkOrder && !workOrderNumber) workOrderNumber = option.clientsWorkOrder;
		}
		persistDraft();
	}

	function buildPmisDraft(): PmisDraft {
		return {
			workshopOrderId,
			customerName,
			siteLocation,
			contactPerson,
			technicianName,
			inspectionDate,
			machineModel,
			serialNumber,
			assetId,
			hoursRun,
			email,
			address,
			phone,
			city,
			state: pmState,
			zip,
			contact,
			hourMeterKey,
			hourMeterTraction,
			hourMeterScrub,
			hourMeterVacuum,
			rechargeNumber,
			workOrderNumber,
			checklistSections: pmisChecklistSections.map((section) => ({
				title: section.title,
				rows: section.rows.map((row) => ({
					task: row.task,
					status: row.status,
					notes: row.notes
				}))
			})),
			parts: parts.map((row) => ({ ...row })),
			recNone,
			recMinor,
			recMajor,
			recReplace,
			recDetails,
			outcomeCompleted,
			outcomePartial,
			outcomeUnsafe,
			techSignature,
			customerRep
		};
	}

	function buildFsDraft(): FloorScrubberDraft {
		return {
			workshopOrderId,
			customer,
			email,
			address,
			phone,
			city,
			state: fsState,
			zip,
			contact,
			serialNumber: fsSerialNumber,
			hourMeterKey,
			modelNumber,
			hourMeterTraction,
			workOrderNumber,
			hourMeterScrub,
			rechargeNumber,
			hourMeterVacuum,
			checklistSections: fsChecklistSections.map((section) => ({
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

	function persistDraft() {
		if (type === 'pmis') {
			savePmisDraft(buildPmisDraft());
		} else {
			saveFloorScrubberDraft(buildFsDraft());
		}
	}

	// Apply drafts
	function applyPmisDraft(draft: PmisDraft) {
		workshopOrderId = draft.workshopOrderId ?? '';
		customerName = draft.customerName ?? '';
		siteLocation = draft.siteLocation ?? '';
		contactPerson = draft.contactPerson ?? '';
		technicianName = draft.technicianName ?? '';
		inspectionDate = draft.inspectionDate ?? '';
		machineModel = draft.machineModel ?? '';
		serialNumber = draft.serialNumber ?? '';
		assetId = draft.assetId ?? '';
		hoursRun = draft.hoursRun ?? '';
		email = draft.email ?? '';
		address = draft.address ?? '';
		phone = draft.phone ?? '';
		city = draft.city ?? '';
		pmState = draft.state ?? '';
		zip = draft.zip ?? '';
		contact = draft.contact ?? '';
		hourMeterKey = draft.hourMeterKey ?? '';
		hourMeterTraction = draft.hourMeterTraction ?? '';
		hourMeterScrub = draft.hourMeterScrub ?? '';
		hourMeterVacuum = draft.hourMeterVacuum ?? '';
		rechargeNumber = draft.rechargeNumber ?? '';
		workOrderNumber = draft.workOrderNumber ?? '';

		pmisChecklistSections = PMIS_CHECKLIST_SECTIONS.map((section) => {
			const saved = draft.checklistSections?.find((s) => s.title === section.title);
			const rows = createPmisChecklistRows(section.tasks).map((row) => {
				const savedRow = saved?.rows?.find((r) => r.task === row.task);
				if (!savedRow) return row;
				const status: ChecklistStatus =
					savedRow.status === 'pass' || savedRow.status === 'fail' ? savedRow.status : 'fail';
				return { ...row, status, notes: savedRow.notes ?? '' };
			});
			return { ...section, rows };
		});

		const savedParts = draft.parts;
		parts =
			Array.isArray(savedParts) && savedParts.length > 0
				? savedParts.map((row) => ({
						part: row.part ?? '',
						qty: row.qty ?? '',
						notes: row.notes ?? ''
					}))
				: emptyPartRows();
		while (parts.length < 3) parts.push({ part: '', qty: '', notes: '' });

		recNone = !!draft.recNone;
		recMinor = !!draft.recMinor;
		recMajor = !!draft.recMajor;
		recReplace = !!draft.recReplace;
		recDetails = draft.recDetails ?? '';
		outcomeCompleted = !!draft.outcomeCompleted;
		outcomePartial = !!draft.outcomePartial;
		outcomeUnsafe = !!draft.outcomeUnsafe;
		techSignature = draft.techSignature ?? '';
		customerRep = draft.customerRep ?? '';
	}

	function mergeFsChecklistRows(
		tasks: readonly string[],
		saved: FloorScrubberChecklistRowDraft[] | undefined
	): FsChecklistRow[] {
		return createFsChecklistRows([...tasks]).map((row) => {
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

	function mergeFsOperationFooter(saved: OperationFooterState | undefined): OperationFooterState {
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

	function mergeFsBatteryCells(saved: BatteryCellRow[] | undefined): BatteryCellRow[] {
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

	// Correctly typecast keys for BrushConditionState
	type BrushConditionKeys = 'femaleBrushSocket' | 'maleHub' | 'diskPadDriver';

	function mergeFsBrushCondition(saved: BrushConditionState | undefined): BrushConditionState {
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

	function applyFsDraft(draft: FloorScrubberDraft) {
		workshopOrderId = draft.workshopOrderId ?? '';
		customer = draft.customer ?? '';
		email = draft.email ?? '';
		address = draft.address ?? '';
		phone = draft.phone ?? '';
		city = draft.city ?? '';
		fsState = draft.state ?? '';
		zip = draft.zip ?? '';
		contact = draft.contact ?? '';
		fsSerialNumber = draft.serialNumber ?? '';
		hourMeterKey = draft.hourMeterKey ?? '';
		modelNumber = draft.modelNumber ?? '';
		hourMeterTraction = draft.hourMeterTraction ?? '';
		workOrderNumber = draft.workOrderNumber ?? '';
		hourMeterScrub = draft.hourMeterScrub ?? '';
		rechargeNumber = draft.rechargeNumber ?? '';
		hourMeterVacuum = draft.hourMeterVacuum ?? '';

		fsChecklistSections = FLOOR_SCRUBBER_CHECKLIST_SECTIONS.map((section) => {
			const saved = draft.checklistSections?.find((s) => s.title === section.title);
			const rows = createFsChecklistRows(section.tasks).map((row) => {
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

		battery1 = mergeFsBatteryCells(draft.battery1);
		battery2 = mergeFsBatteryCells(draft.battery2);
		brushCondition = mergeFsBrushCondition(draft.brushCondition);
		operationCheckPre = mergeFsChecklistRows(OPERATION_CHECK_PRE_TASKS, draft.operationCheckPre);
		operationCheckPost = mergeFsChecklistRows(
			OPERATION_CHECK_POST_TASKS,
			draft.operationCheckPost
		);
		operationFooter = mergeFsOperationFooter(draft.operationFooter);
	}

	// Reset forms
	function clearForm() {
		if (type === 'pmis') {
			workshopOrderId = '';
			customerName = '';
			siteLocation = '';
			contactPerson = '';
			technicianName = '';
			inspectionDate = formatInspectionDate(new Date());
			machineModel = '';
			serialNumber = '';
			assetId = '';
			hoursRun = '';
			const emptyCustomer = createEmptyCustomerInfoFields();
			email = emptyCustomer.email;
			address = emptyCustomer.address;
			phone = emptyCustomer.phone;
			city = emptyCustomer.city;
			pmState = emptyCustomer.state;
			zip = emptyCustomer.zip;
			contact = emptyCustomer.contact;
			const emptyMachine = createEmptyMachineHourMeterFields();
			hourMeterKey = emptyMachine.hourMeterKey;
			hourMeterTraction = emptyMachine.hourMeterTraction;
			hourMeterScrub = emptyMachine.hourMeterScrub;
			hourMeterVacuum = emptyMachine.hourMeterVacuum;
			rechargeNumber = emptyMachine.rechargeNumber;
			workOrderNumber = emptyMachine.workOrderNumber;
			pmisChecklistSections = PMIS_CHECKLIST_SECTIONS.map((section) => ({
				...section,
				rows: createPmisChecklistRows(section.tasks)
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
			clearPmisDraft();
		} else {
			workshopOrderId = '';
			customer = '';
			email = '';
			address = '';
			phone = '';
			city = '';
			fsState = '';
			zip = '';
			contact = '';
			fsSerialNumber = '';
			hourMeterKey = '';
			modelNumber = '';
			hourMeterTraction = '';
			workOrderNumber = '';
			hourMeterScrub = '';
			rechargeNumber = '';
			hourMeterVacuum = '';
			fsChecklistSections = FLOOR_SCRUBBER_CHECKLIST_SECTIONS.map((section) => ({
				...section,
				rows: createFsChecklistRows(section.tasks)
			}));
			battery1 = createBatteryCells();
			battery2 = createBatteryCells();
			brushCondition = createBrushCondition();
			operationCheckPre = createFsChecklistRows([...OPERATION_CHECK_PRE_TASKS]);
			operationCheckPost = createFsChecklistRows([...OPERATION_CHECK_POST_TASKS]);
			operationFooter = createOperationFooter();
			clearFloorScrubberDraft();
		}
	}

	onMount(() => {
		if (type === 'pmis') {
			const draft = loadPmisDraft();
			if (draft) {
				applyPmisDraft(draft);
			}
			if (!inspectionDate) inspectionDate = formatInspectionDate(new Date());
		} else {
			const draft = loadFloorScrubberDraft();
			if (draft) applyFsDraft(draft);
		}
		fetchSavedRecords();
	});
</script>

<svelte:head>
	<title>{type === 'pmis' ? 'PMIS — Carpet Extractor PM Inspection' : 'Floor Scrubber PM Sheet'}</title>
</svelte:head>

<div class={type === 'pmis' ? 'pmis-page' : 'pm-floor-scrubber-page'}>
	<div class="screen-toolbar no-print">
		<h1 class="screen-title">
			{type === 'pmis' ? 'PMIS — Preventive Maintenance Inspection' : 'Floor Scrubber PM Sheet'}
		</h1>
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
			<button type="button" class="btn-secondary" onclick={clearForm} disabled={printing || saving}>Clear form</button>
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

	<div class="page-layout no-print-sidebar">

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
					<td class="header-title" colspan={type === 'pmis' ? 1 : 3}>
						{type === 'pmis'
							? 'Preventive Maintenance (PM) Inspection Sheet'
							: 'Floor Scrubber PM Sheet'}
					</td>
				</tr>
				<tr>
					<td class="header-sub" colspan={type === 'pmis' ? 1 : 3}>
						{type === 'pmis'
							? 'RapidClean Illawarra — Commercial Walk-Behind Carpet Extractors'
							: 'RapidClean Illawarra — Commercial Floor Scrubbers'}
					</td>
				</tr>
			</tbody>
		</table>

		{#if type === 'pmis'}
			<CustomerInformationSection
				comboboxId="pmis-workshop-order-id"
				bind:workshopOrderId
				bind:customer={customerName}
				bind:email
				bind:address
				bind:phone
				bind:city
				bind:state={pmState}
				bind:zip
				bind:contact
				onWorkshopOrderSelect={applyWorkshopOrder}
			/>

			<MachineInformationSection
				bind:serialNumber
				bind:modelNumber={machineModel}
				bind:hourMeterKey
				bind:hourMeterTraction
				bind:workOrderNumber
				bind:hourMeterScrub
				bind:rechargeNumber
				bind:hourMeterVacuum
			/>

			<table class="form-table cell-stack" aria-label="PMIS job details">
				<tbody>
					<tr class="section-bar"><th colspan="4">Job &amp; Asset Details</th></tr>
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
		{:else}
			<CustomerInformationSection
				comboboxId="fs-workshop-order-id"
				bind:workshopOrderId
				bind:customer
				bind:email
				bind:address
				bind:phone
				bind:city
				bind:state={fsState}
				bind:zip
				bind:contact
				onWorkshopOrderSelect={applyWorkshopOrder}
			/>

			<MachineInformationSection
				bind:serialNumber={fsSerialNumber}
				bind:modelNumber
				bind:hourMeterKey
				bind:hourMeterTraction
				bind:workOrderNumber
				bind:hourMeterScrub
				bind:rechargeNumber
				bind:hourMeterVacuum
			/>
		{/if}

		{#if type === 'pmis'}
			{#each pmisChecklistSections as section (section.title)}
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
											onchange={(e) => {
												row.status = e.currentTarget.checked ? 'pass' : 'fail';
												persistDraft();
											}}
										/>
										<span
											class:status-pass={row.status === 'pass'}
											class:status-fail={row.status === 'fail'}
											aria-hidden="true">{row.status === 'pass' ? '✓' : '✗'}</span
										>
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
						<td>
							<label><input type="checkbox" bind:checked={recNone} /> No further action required</label>
						</td>
					</tr>
					<tr class="checkbox-row">
						<td>
							<label><input type="checkbox" bind:checked={recMinor} /> Minor repairs recommended</label>
						</td>
					</tr>
					<tr class="checkbox-row">
						<td>
							<label>
								<input type="checkbox" bind:checked={recMajor} /> Major repairs required (quote to follow)
							</label>
						</td>
					</tr>
					<tr class="checkbox-row">
						<td>
							<label><input type="checkbox" bind:checked={recReplace} /> Replacement recommended</label>
						</td>
					</tr>
					<tr><td class="details-label"><strong>Details:</strong></td></tr>
					<tr>
						<td class="details-field">
							<textarea class="field" bind:value={recDetails} rows="4"></textarea>
						</td>
					</tr>
				</tbody>
			</table>

			<table class="form-table" aria-label="Section 13">
				<tbody>
					<tr class="section-bar"><th colspan="1">13. Service Outcome</th></tr>
					<tr class="checkbox-row">
						<td><label><input type="checkbox" bind:checked={outcomeCompleted} /> Service Completed</label></td>
					</tr>
					<tr class="checkbox-row">
						<td>
							<label>
								<input type="checkbox" bind:checked={outcomePartial} /> Service Partially Completed
							</label>
						</td>
					</tr>
					<tr class="checkbox-row">
						<td>
							<label>
								<input type="checkbox" bind:checked={outcomeUnsafe} /> Machine Unsafe – Do Not Use
							</label>
						</td>
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
		{:else}
			{#each fsChecklistSections as section (section.title)}
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
																			persistDraft();
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
																			persistDraft();
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
										<input
											class="field brush-length-field"
											type="text"
											bind:value={brushCondition.brush1Length}
										/>
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
															persistDraft();
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
															checked={brushCondition[part.key as BrushConditionKeys] === option}
															onchange={() => {
																brushCondition[part.key as BrushConditionKeys] =
																	option as BrushPartStatus;
																persistDraft();
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
		{/if}
	</form>

		<!-- Saved Records Sidebar -->
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
								<span class="sidebar-customer">{rec.customer_name}</span>
								<span class="sidebar-meta">{rec.machine_model || '—'} · {rec.serial_number || '—'}</span>
								<span class="sidebar-date">{formatRecordDate(rec.inspection_date)}</span>
								{#if rec.technician_name}
									<span class="sidebar-tech">Tech: {rec.technician_name}</span>
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
	.pmis-page,
	.pm-floor-scrubber-page {
		box-sizing: border-box;
		padding: 16px;
		font-family: Arial, Helvetica, sans-serif;
		font-size: 11pt;
		color: #000;
		background: #fff;
	}

	.pmis-page *,
	.pmis-page *::before,
	.pmis-page *::after,
	.pm-floor-scrubber-page *,
	.pm-floor-scrubber-page *::before,
	.pm-floor-scrubber-page *::after {
		box-sizing: border-box;
	}

	/* Two-column layout: form on left, sidebar on right */
	.page-layout {
		display: flex;
		align-items: flex-start;
		gap: 20px;
	}

	.page-layout .sheet {
		flex: 1 1 0;
		min-width: 0;
	}

	/* Sidebar */
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
		padding: 12px 14px 10px;
		border-bottom: 1px solid #e5e7eb;
		position: sticky;
		top: 0;
		background: #f9fafb;
		z-index: 1;
	}

	.sidebar-title {
		font-weight: 700;
		font-size: 0.875rem;
		letter-spacing: 0.01em;
		color: #111;
	}

	.sidebar-refresh {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		color: #6b7280;
		padding: 2px 4px;
		border-radius: 4px;
		transition: color 0.15s, background 0.15s;
	}

	.sidebar-refresh:hover:not(:disabled) {
		color: #111;
		background: #e5e7eb;
	}

	.sidebar-refresh:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.sidebar-loading,
	.sidebar-empty,
	.sidebar-error {
		padding: 16px 14px;
		margin: 0;
		color: #6b7280;
		font-size: 0.8125rem;
	}

	.sidebar-error {
		color: #b91c1c;
	}

	.sidebar-list {
		list-style: none;
		margin: 0;
		padding: 6px 0;
	}

	.sidebar-item {
		display: flex;
		align-items: stretch;
		border-bottom: 1px solid #e5e7eb;
	}

	.sidebar-item:last-child {
		border-bottom: none;
	}

	.sidebar-item--active .sidebar-load-btn {
		background: #eff6ff;
		border-left: 3px solid #2563eb;
	}

	.sidebar-load-btn {
		flex: 1;
		background: none;
		border: none;
		border-left: 3px solid transparent;
		text-align: left;
		cursor: pointer;
		padding: 10px 10px 10px 11px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		transition: background 0.13s;
	}

	.sidebar-load-btn:hover {
		background: #f0f4ff;
	}

	.sidebar-customer {
		font-weight: 600;
		font-size: 0.8125rem;
		color: #111;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 170px;
	}

	.sidebar-meta {
		font-size: 0.75rem;
		color: #6b7280;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 170px;
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
		transition: color 0.13s, background 0.13s;
		display: flex;
		align-items: center;
	}

	.sidebar-delete-btn:hover:not(:disabled) {
		color: #dc2626;
		background: #fef2f2;
	}

	.sidebar-delete-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-sidebar-toggle {
		padding: 8px 14px;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 6px;
		cursor: pointer;
		border: 1px solid #d1d5db;
		background: #f9fafb;
		color: #374151;
		transition: background 0.13s, border-color 0.13s;
	}

	.btn-sidebar-toggle:hover {
		background: #e5e7eb;
		border-color: #9ca3af;
	}

	.screen-toolbar {
		max-width: none;
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

	.btn-save {
		padding: 8px 16px;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 6px;
		cursor: pointer;
		border: 1px solid transparent;
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

	.save-success {
		margin: 0;
		font-size: 0.8125rem;
		color: #16a34a;
		font-weight: 500;
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

	/* PMIS field specific layout adjustments */
	.pmis-page .label-cell {
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
		width: 46%;
	}

	.pmis-page .checklist .col-task {
		width: 52%;
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

	.pmis-page .checklist .col-status {
		width: 16%;
		text-align: center;
	}

	.pmis-page .checklist .col-notes {
		width: 32%;
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

		:global(.no-print) {
			display: none !important;
		}

		.saved-sidebar {
			display: none !important;
		}

		.page-layout {
			display: block;
		}

		.pmis-page,
		.pm-floor-scrubber-page {
			padding: 0;
		}

		.sheet {
			max-width: none;
		}

		input.field,
		textarea.field,
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

		.checkbox-row input[type='checkbox'] {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
</style>
