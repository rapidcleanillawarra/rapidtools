import { DateTime } from 'luxon';

const SYDNEY_ZONE = 'Australia/Sydney';
const OFFSET_REGEX = /(Z|[+-]\d{2}:?\d{2})$/;

function parseUtcIso(iso: string | null | undefined): DateTime | null {
	if (!iso) return null;

	const hasOffset = OFFSET_REGEX.test(iso);
	const dt = hasOffset
		? DateTime.fromISO(iso, { setZone: true })
		: DateTime.fromISO(iso, { zone: 'utc' });

	if (!dt.isValid) return null;
	return dt.toUTC();
}

export function sydneyInputToUtcIso(input: string | null | undefined): string | null {
	if (!input) return null;
	const dt = DateTime.fromISO(input, { zone: SYDNEY_ZONE });
	if (!dt.isValid) return null;
	return dt.toUTC().toISO({ suppressMilliseconds: true });
}

export function utcIsoToSydneyInput(iso: string | null | undefined): string {
	const dt = parseUtcIso(iso);
	if (!dt) return '';
	return dt.setZone(SYDNEY_ZONE).toFormat("yyyy-LL-dd'T'HH:mm");
}

export function formatSydneyDisplay(iso: string | null | undefined): string {
	if (!iso) return 'N/A';
	const dt = parseUtcIso(iso);
	if (!dt) return iso;
	return dt.setZone(SYDNEY_ZONE).toFormat('d LLL yyyy, h:mm a');
}

export function isSydneyInputInPast(input: string | null | undefined): boolean {
	const utcIso = sydneyInputToUtcIso(input);
	if (!utcIso) return false;
	const dt = DateTime.fromISO(utcIso, { zone: 'utc' });
	if (!dt.isValid) return false;
	return dt < DateTime.utc();
}

export function isUtcIsoPast(iso: string | null | undefined): boolean {
	const dt = parseUtcIso(iso);
	if (!dt) return false;
	return dt < DateTime.utc();
}
