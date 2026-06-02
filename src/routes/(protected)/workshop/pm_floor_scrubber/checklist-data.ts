export type ChecklistSectionDef = {
	ariaLabel: string;
	title: string;
	taskHeader: string;
	tasks: string[];
};

export const CHECKLIST_SECTIONS: ChecklistSectionDef[] = [
	{
		ariaLabel: 'Clean and inspect',
		title: 'Clean & Inspect',
		taskHeader: 'Clean & Inspect',
		tasks: [
			'Drain / Rinse Recovery Tank',
			'Drain Hose & Plug',
			'Drain / Flush Solution Tank',
			'White Vacuum Box Filter',
			'Vacuum Float Ball Screen',
			'Drain Saver Basket',
			'Recovery Tank Lid & Gasket',
			'Solution Filter',
			'Squeegee Blades / Flip To New Edge',
			'Squeegee Wheels',
			'Blade Retainers & Hardware',
			'Vacuum Hoses',
			'Wheel Condition',
			'Brush Deck Skirts'
		]
	},
	{
		ariaLabel: 'Clean and lubricate',
		title: 'Clean & Lubricate',
		taskHeader: 'Clean & Lubricate',
		tasks: [
			'Squeegee Pivot Points & Knobs',
			'Scrub Deck Linkage',
			'Grease Caster Swivel'
		]
	}
];
