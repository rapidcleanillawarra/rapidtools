/** One-time localStorage keys for `/assets/print-tags?slot=…` (shared across tabs; sessionStorage is not). */
const SLOT_PREFIX = 'rapidtools:asset-print-tags:';

export function assetPrintTagStorageKey(slot: string): string {
	return `${SLOT_PREFIX}${slot}`;
}
