const RCI_TAG_PATTERN = /^(\d{2})-(\d{4})$/;

export function getRciTagYearPrefix(date = new Date()): string {
	return String(date.getFullYear() % 100).padStart(2, '0');
}

export function formatRciTag(yearPrefix: string, sequence: number): string {
	return `${yearPrefix}-${String(sequence).padStart(4, '0')}`;
}

export function parseRciTag(rciTag: string): { yearPrefix: string; sequence: number } | null {
	const match = rciTag.trim().match(RCI_TAG_PATTERN);
	if (!match) return null;

	return {
		yearPrefix: match[1],
		sequence: Number.parseInt(match[2], 10)
	};
}

export function getMaxRciTagSequence(rciTags: Iterable<string>, yearPrefix?: string): number {
	const prefix = yearPrefix ?? getRciTagYearPrefix();
	let max = 0;

	for (const tag of rciTags) {
		const parsed = parseRciTag(tag);
		if (parsed?.yearPrefix === prefix) {
			max = Math.max(max, parsed.sequence);
		}
	}

	return max;
}

export function getNextRciTag(occupiedRciTags: Iterable<string>, yearPrefix?: string): string {
	const prefix = yearPrefix ?? getRciTagYearPrefix();
	const nextSequence = getMaxRciTagSequence(occupiedRciTags, prefix) + 1;
	return formatRciTag(prefix, nextSequence);
}
