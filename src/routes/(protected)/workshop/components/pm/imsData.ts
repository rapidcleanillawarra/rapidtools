import type { ImsChecklistRowState, ImsIntervalKey } from './imsStorage';

export type ImsChecklistItemDef = {
	task: string;
	intervalHours?: string;
	intervalKey?: ImsIntervalKey;
	isSpacer?: boolean;
};

export type ImsChecklistSubsectionDef = {
	title: string | null;
	items: ImsChecklistItemDef[];
};

export type ImsChecklistBlockDef = {
	sectionTitle: string;
	subsections: ImsChecklistSubsectionDef[];
};

export const IMS_INTERVAL_SYMBOLS: Record<ImsIntervalKey, string> = {
	yearly: '●',
	nine_months: '◕',
	six_months: '◐',
	quarterly: '◔',
	winter: '*'
};

export const IMS_INTERVAL_LEGEND: { symbol: string; label: string }[] = [
	{ symbol: IMS_INTERVAL_SYMBOLS.yearly, label: 'Yearly' },
	{ symbol: IMS_INTERVAL_SYMBOLS.nine_months, label: 'Every 9 months' },
	{ symbol: IMS_INTERVAL_SYMBOLS.six_months, label: 'Every six months' },
	{ symbol: IMS_INTERVAL_SYMBOLS.quarterly, label: 'Quarterly' },
	{ symbol: IMS_INTERVAL_SYMBOLS.winter, label: 'Always before the winter season' }
];

export const IMS_CHECKLIST_BLOCKS: ImsChecklistBlockDef[] = [
	{
		sectionTitle: 'Safety check according to national specifications',
		subsections: [
			{
				title: null,
				items: [
					{
						task: 'Safety check according to national specifications',
						intervalHours: '500',
						intervalKey: 'yearly'
					},
					{ isSpacer: true }
				]
			}
		]
	},
	{
		sectionTitle: 'Electrical installation and control panel',
		subsections: [
			{
				title: 'General',
				items: [
					{
						task: 'Electrical safety Danger for person, object and environment Shut machine down.',
						intervalHours: '500',
						intervalKey: 'yearly'
					},
					{ isSpacer: true }
				]
			},
			{
				title: 'Electronics/control cabinets',
				items: [
					{
						task: 'Tight seating of screw and plug connections',
						intervalHours: '500',
						intervalKey: 'yearly'
					},
					{
						task: 'Check connection of protective earth conductor',
						intervalHours: '500',
						intervalKey: 'yearly'
					},
					{
						task: 'Oxidation and damages in current conducting cables /contacts',
						intervalHours: '500',
						intervalKey: 'yearly'
					},
					{
						task: 'Damage on the appliance plug / power cable',
						intervalHours: '500',
						intervalKey: 'yearly'
					},
					{
						task: 'Check cable connections and plugs on the control electronics',
						intervalHours: '500',
						intervalKey: 'yearly'
					},
					{ isSpacer: true }
				]
			},
			{
				title: 'Control and display elements',
				items: [
					{
						task: 'Check the function of the programme selector switch',
						intervalHours: '500',
						intervalKey: 'yearly'
					},
					{
						task: 'Check temperature setting for proper function',
						intervalHours: '500',
						intervalKey: 'yearly'
					},
					{
						task: 'Check detergent dosing',
						intervalHours: '500',
						intervalKey: 'yearly'
					},
					{
						task: 'Check pressure gauge for proper function',
						intervalHours: '500',
						intervalKey: 'yearly'
					},
					{
						task: 'Check indicator lamps for proper function',
						intervalHours: '500',
						intervalKey: 'yearly'
					},
					{
						task: 'Check display for proper function',
						intervalHours: '500',
						intervalKey: 'yearly'
					}
				]
			}
		]
	}
];

function createItemRow(def: ImsChecklistItemDef): ImsChecklistRowState {
	return {
		kind: 'item',
		task: def.task,
		intervalHours: def.intervalHours ?? '500',
		intervalKey: def.intervalKey ?? 'yearly',
		measuredValue: '',
		measuringUnit: '',
		preventiveExchange: '',
		status: '',
		repair: false
	};
}

function createSpacerRow(): ImsChecklistRowState {
	return { kind: 'spacer', notes: '' };
}

export function createImsChecklistSections(): {
	sectionTitle: string;
	subsections: { title: string | null; rows: ImsChecklistRowState[] }[];
}[] {
	return IMS_CHECKLIST_BLOCKS.map((block) => ({
		sectionTitle: block.sectionTitle,
		subsections: block.subsections.map((sub) => ({
			title: sub.title,
			rows: sub.items.map((item) => (item.isSpacer ? createSpacerRow() : createItemRow(item)))
		}))
	}));
}

export function intervalDisplay(hours: string, key: ImsIntervalKey): string {
	return `${hours} ${IMS_INTERVAL_SYMBOLS[key] ?? ''}`.trim();
}

function isValidStatus(value: unknown): value is import('./imsStorage').ImsChecklistStatus {
	return value === '' || value === 'not_required' || value === 'ok' || value === 'not_ok';
}

export function mergeChecklistSections(
	saved: import('./imsStorage').ImsChecklistSectionState[] | undefined
): ReturnType<typeof createImsChecklistSections> {
	const defaults = createImsChecklistSections();
	if (!saved?.length) return defaults;

	return defaults.map((section) => {
		const savedSection = saved.find((s) => s.sectionTitle === section.sectionTitle);
		return {
			...section,
			subsections: section.subsections.map((sub) => {
				const savedSub = savedSection?.subsections?.find((s) => s.title === sub.title);
				let spacerIndex = 0;
				return {
					...sub,
					rows: sub.rows.map((row) => {
						if (row.kind === 'spacer') {
							const savedSpacers =
								savedSub?.rows.filter((r) => r.kind === 'spacer') ?? [];
							const saved = savedSpacers[spacerIndex++];
							return saved?.kind === 'spacer'
								? { ...row, notes: saved.notes ?? '' }
								: row;
						}
						const savedItem = savedSub?.rows.find(
							(r) => r.kind === 'item' && r.task === row.task
						);
						if (savedItem?.kind !== 'item') return row;
						return {
							...row,
							measuredValue: savedItem.measuredValue ?? '',
							measuringUnit: savedItem.measuringUnit ?? '',
							preventiveExchange: savedItem.preventiveExchange ?? '',
							status: isValidStatus(savedItem.status) ? savedItem.status : '',
							repair: !!savedItem.repair
						};
					})
				};
			})
		};
	});
}
