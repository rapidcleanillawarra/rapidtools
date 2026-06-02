export type ChecklistSectionDef = {
	ariaLabel: string;
	title: string;
	/** Column header for task column (default: Check) */
	taskHeader?: string;
	tasks: string[];
};

export const CHECKLIST_SECTIONS: ChecklistSectionDef[] = [
	{
		ariaLabel: 'Section 2',
		title: '2. Pre-Inspection Condition',
		tasks: [
			'Machine clean on arrival',
			'Visible damage (frame, tank, handles)',
			'Leaks present',
			'Customer-reported issues'
		]
	},
	{
		ariaLabel: 'Section 3',
		title: '3. Electrical System (Corded Units)',
		tasks: [
			'Power cable condition (cuts, frays, kinks)',
			'Plug integrity (pins, casing)',
			'Cable strain relief secure',
			'Switch operation (on/off)',
			'RCD / safety device (if fitted)',
			'Electrical test & tag performed',
			'Test & Tag Result (Pass/Fail)',
			'Tag applied'
		]
	},
	{
		ariaLabel: 'Section 4',
		title: '4. Battery System (Battery Units)',
		tasks: [
			'Battery condition (physical damage/swelling)',
			'Terminal connections clean/tight',
			'Charger condition & operation',
			'Charging cycle tested',
			'Battery voltage checked',
			'Runtime performance acceptable',
			'Wiring harness condition'
		]
	},
	{
		ariaLabel: 'Section 5',
		title: '5. Vacuum System',
		tasks: [
			'Vacuum motor operation',
			'Suction strength adequate',
			'Vacuum hose condition (cracks/blockages)',
			'Recovery tank lid seal/gasket',
			'Float shut-off functioning',
			'Filters clean and intact'
		]
	},
	{
		ariaLabel: 'Section 6',
		title: '6. Pump & Solution System',
		tasks: [
			'Solution pump operation',
			'Pump pressure adequate',
			'Spray jets/nozzles clear',
			'Solution lines free of leaks',
			'Trigger/spray switch operation',
			'Tank condition (cracks/contamination)'
		]
	},
	{
		ariaLabel: 'Section 7',
		title: '7. Brush / Agitation System',
		tasks: [
			'Brush motor operation',
			'Brush condition (wear, damage)',
			'Brush rotation consistent',
			'Drive belt condition (if applicable)'
		]
	},
	{
		ariaLabel: 'Section 8',
		title: '8. Recovery System',
		tasks: [
			'Recovery tank clean',
			'Drain hose condition',
			'Drain valve operation',
			'Odour or contamination present'
		]
	},
	{
		ariaLabel: 'Section 9',
		title: '9. Wheels, Frame & General Mechanics',
		tasks: [
			'Wheels/rollers condition',
			'Handle and adjustment mechanisms',
			'Fasteners secure',
			'Frame integrity'
		]
	},
	{
		ariaLabel: 'Section 10',
		title: '10. Functional Test (Post-Service)',
		taskHeader: 'Test',
		tasks: [
			'Machine powers on correctly',
			'Spray system working',
			'Vacuum recovery effective',
			'No leaks during operation',
			'Noise/vibration within normal range'
		]
	}
];
