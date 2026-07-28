import { jsPDF } from 'jspdf';
import type { SheetHeader, SheetRow } from './types';
import { formatPartsSummary, parseServiceValues } from './utils';

/** A4 landscape (mm). */
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 8;
const HEADER_H = 22;
const META_H = 12;
const COL_HEADER_H = 9;
/** Minimum row height for blank writing space. */
const ROW_H_MIN = 20;
const FOOTER_H = 8;
const NOTES_FONT_SIZE = 6.5;

const CONTENT_TOP = MARGIN + HEADER_H + META_H;
const CONTENT_BOTTOM = PAGE_H - MARGIN - FOOTER_H;
const TABLE_BODY_H = CONTENT_BOTTOM - CONTENT_TOP - COL_HEADER_H;

type PrintMeta = {
	company: string;
	sheetName: string;
	frequency: string;
	location: string;
	serviceDate: string;
};

type PrintRow = {
	rciTag: string;
	tag: string;
	machines: string;
	typeOfMachine: string;
	serialNumber: string;
	sku: string;
	size: string;
	location: string;
	results: string;
	service: string;
	notes: string;
	workshopId: string;
	parts: string;
};

type PrintMode = 'fillable' | 'completed';

/** Column x positions and widths (mm) for the landscape writing form. */
const COLS = {
	num: { x: MARGIN, w: 8, label: '#' },
	equipment: { x: MARGIN + 8, w: 64, label: 'Equipment' },
	result: { x: MARGIN + 72, w: 26, label: 'Result' },
	service: { x: MARGIN + 98, w: 32, label: 'Service' },
	workshop: { x: MARGIN + 130, w: 24, label: 'Workshop ID' },
	parts: { x: MARGIN + 154, w: 40, label: 'Parts / materials' },
	notes: { x: MARGIN + 194, w: PAGE_W - MARGIN - (MARGIN + 194), label: 'Notes' }
} as const;

const SERVICE_PRINT_OPTIONS = [
	{ label: 'Service', value: 'Service' },
	{ label: 'Test & Tag', value: 'Test and Tag' },
	{ label: 'Tag', value: 'Tag' }
] as const;

export type PrintSheetOptions = {
	printTitle?: string;
	logoUrl?: string;
};

async function fetchImageDataUrl(url: string): Promise<string | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const blob = await res.blob();
		return await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
}

/** jsPDF is most reliable with PNG/JPEG — rasterize whatever we fetch. */
async function loadLogoPngDataUrl(url: string): Promise<string | null> {
	const raw = await fetchImageDataUrl(url);
	if (!raw) return null;

	return await new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			try {
				const canvas = document.createElement('canvas');
				canvas.width = img.naturalWidth || 320;
				canvas.height = img.naturalHeight || 160;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					resolve(null);
					return;
				}
				ctx.drawImage(img, 0, 0);
				resolve(canvas.toDataURL('image/png'));
			} catch {
				resolve(null);
			}
		};
		img.onerror = () => resolve(null);
		img.src = raw;
	});
}

function formatServiceDate(isoDate: string): string {
	if (!isoDate) return '';
	const [year, month, day] = isoDate.split('-').map(Number);
	if (!year || !month || !day) return isoDate;
	return new Date(year, month - 1, day).toLocaleDateString('en-AU', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	});
}

function toPrintRows(rows: SheetRow[]): PrintRow[] {
	return rows.map((row) => ({
		rciTag: row.rciTag?.trim() || '',
		tag: row.tag?.trim() || '',
		machines: row.machines?.trim() || '',
		typeOfMachine: row.typeOfMachine?.trim() || '',
		serialNumber: row.serialNumber?.trim() || '',
		sku: row.sku?.trim() || '',
		size: row.size?.trim() || '',
		location: row.location?.trim() || '',
		results: row.results?.trim().toLowerCase() || '',
		service: row.service?.trim() || '',
		notes: row.notes?.trim() || '',
		workshopId: row.workshopId?.trim() || '',
		parts: formatPartsSummary(row.parts ?? '')
	}));
}

function toPrintMeta(header: SheetHeader): PrintMeta {
	return {
		company: header.company?.trim() || '',
		sheetName: header.sheetName?.trim() || '',
		frequency: header.frequency?.trim() || '',
		location: header.location?.trim() || '',
		serviceDate: formatServiceDate(header.serviceDate)
	};
}

function drawCheckbox(doc: jsPDF, x: number, y: number, size = 3.2, checked = false): void {
	doc.setDrawColor(55, 65, 81);
	doc.setLineWidth(0.25);
	doc.rect(x, y, size, size);

	if (checked) {
		doc.setLineWidth(0.45);
		doc.setDrawColor(17, 24, 39);
		doc.line(x + 0.6, y + size * 0.55, x + size * 0.4, y + size - 0.6);
		doc.line(x + size * 0.4, y + size - 0.6, x + size - 0.5, y + 0.5);
	}
}

function drawWritingLines(
	doc: jsPDF,
	x: number,
	y: number,
	w: number,
	h: number,
	lineCount = 2
): void {
	doc.setDrawColor(209, 213, 219);
	doc.setLineWidth(0.2);
	const top = y + h * 0.42;
	const gap = lineCount > 1 ? (h * 0.4) / (lineCount - 1) : 0;
	for (let i = 0; i < lineCount; i++) {
		const ly = top + i * gap;
		doc.line(x + 1.5, ly, x + w - 1.5, ly);
	}
}

function fitText(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string {
	if (!text) return '';
	doc.setFontSize(fontSize);
	if (doc.getTextWidth(text) <= maxWidth) return text;
	let clipped = text;
	while (clipped.length > 1 && doc.getTextWidth(`${clipped}…`) > maxWidth) {
		clipped = clipped.slice(0, -1);
	}
	return `${clipped}…`;
}

function drawHeader(doc: jsPDF, meta: PrintMeta, logoDataUrl: string | null): void {
	doc.setFillColor(40, 40, 40);
	doc.rect(MARGIN, MARGIN, PAGE_W - MARGIN * 2, HEADER_H, 'F');

	if (logoDataUrl) {
		try {
			doc.addImage(logoDataUrl, 'PNG', MARGIN + 3, MARGIN + 3.5, 28, 15);
		} catch {
			// Logo optional — continue without it.
		}
	}

	doc.setTextColor(255, 255, 255);
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(14);
	const company = fitText(doc, meta.company || 'Service, Test & Tag', 150, 14);
	doc.text(company, PAGE_W / 2, MARGIN + 9, { align: 'center' });

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	doc.setTextColor(209, 213, 219);
	doc.text('Service, Test & Tag run', PAGE_W / 2, MARGIN + 15, { align: 'center' });

	doc.setTextColor(255, 255, 255);
	doc.setFontSize(9);
	doc.setFont('helvetica', 'bold');
	doc.text(meta.serviceDate || 'Date ________', PAGE_W - MARGIN - 4, MARGIN + 12, {
		align: 'right'
	});
}

function drawMeta(doc: jsPDF, meta: PrintMeta, pageIndex: number, pageCount: number): void {
	const y = MARGIN + HEADER_H;
	doc.setFillColor(249, 250, 251);
	doc.setDrawColor(229, 231, 235);
	doc.setLineWidth(0.2);
	doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, META_H, 'FD');

	const fields = [
		{ label: 'SHEET', value: meta.sheetName || '—' },
		{ label: 'FREQUENCY', value: meta.frequency || '—' },
		{ label: 'LOCATION', value: meta.location || 'All locations' },
		{ label: 'PAGE', value: `${pageIndex + 1} / ${pageCount}` }
	];

	const fieldW = (PAGE_W - MARGIN * 2) / fields.length;
	fields.forEach((field, i) => {
		const x = MARGIN + 3 + i * fieldW;
		doc.setFont('helvetica', 'bold');
		doc.setTextColor(107, 114, 128);
		doc.setFontSize(6);
		doc.text(field.label, x, y + 4);
		doc.setFont('helvetica', 'normal');
		doc.setTextColor(17, 24, 39);
		doc.setFontSize(8);
		doc.text(fitText(doc, field.value, fieldW - 8, 8), x, y + 9);
	});
}

function drawColumnHeaders(doc: jsPDF, y: number): void {
	doc.setFillColor(243, 244, 246);
	doc.setDrawColor(156, 163, 175);
	doc.setLineWidth(0.3);
	doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, COL_HEADER_H, 'FD');

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(7);
	doc.setTextColor(55, 65, 81);

	(Object.keys(COLS) as (keyof typeof COLS)[]).forEach((key) => {
		const col = COLS[key];
		doc.line(col.x, y, col.x, y + COL_HEADER_H);
		doc.text(col.label, col.x + col.w / 2, y + 5.8, { align: 'center' });
	});
	doc.line(PAGE_W - MARGIN, y, PAGE_W - MARGIN, y + COL_HEADER_H);
}

function drawEquipmentCell(doc: jsPDF, row: PrintRow, x: number, y: number, w: number): void {
	const padX = 1.5;
	const maxW = w - padX * 2;

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(7.5);
	doc.setTextColor(29, 78, 216);
	const rci = fitText(doc, row.rciTag || '—', maxW * 0.45, 7.5);
	doc.text(rci, x + padX, y + 4.2);

	doc.setTextColor(17, 24, 39);
	const nameX = x + padX + maxW * 0.45;
	const nameMaxW = maxW * 0.55;
	if (row.machines) {
		doc.text(fitText(doc, row.machines, nameMaxW, 7.5), nameX, y + 4.2);
	} else {
		doc.setDrawColor(209, 213, 219);
		doc.setLineWidth(0.25);
		doc.line(nameX, y + 4.5, nameX + nameMaxW - 1, y + 4.5);
	}

	if (row.tag) {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(6.5);
		doc.setTextColor(75, 85, 99);
		doc.text(fitText(doc, `Tag: ${row.tag}`, maxW, 6.5), x + padX, y + 8);
	}

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(6.2);
	doc.setTextColor(75, 85, 99);
	const details = [row.typeOfMachine, row.serialNumber && `S/N ${row.serialNumber}`, row.size, row.sku]
		.filter(Boolean)
		.join('  ·  ');
	if (details) {
		doc.text(fitText(doc, details, maxW, 6.2), x + padX, y + 11.5);
	}

	if (row.location) {
		doc.setFontSize(6);
		doc.setTextColor(107, 114, 128);
		doc.text(fitText(doc, row.location, maxW, 6), x + padX, y + 15.2);
	}
}

function drawResultCell(
	doc: jsPDF,
	x: number,
	y: number,
	w: number,
	rowH: number,
	result: string,
	mode: PrintMode
): void {
	const box = 3.2;
	const midY = y + rowH / 2 - box / 2;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(7);
	doc.setTextColor(55, 65, 81);

	const fill = mode === 'completed';
	drawCheckbox(doc, x + 3, midY, box, fill && result === 'pass');
	doc.text('Pass', x + 7.5, midY + 2.5);

	drawCheckbox(doc, x + 15.5, midY, box, fill && result === 'fail');
	doc.text('Fail', x + 20, midY + 2.5);

	void w;
}

function drawServiceCell(
	doc: jsPDF,
	x: number,
	y: number,
	service: string,
	mode: PrintMode
): void {
	const selected = new Set(parseServiceValues(service));
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(6.5);
	doc.setTextColor(55, 65, 81);

	SERVICE_PRINT_OPTIONS.forEach((option, i) => {
		const ly = y + 3.8 + i * 4.5;
		const checked = mode === 'completed' && selected.has(option.value);
		drawCheckbox(doc, x + 2, ly - 2.2, 2.8, checked);
		doc.text(option.label, x + 6.5, ly);
	});
}

function notesLineHeight(fontSize = NOTES_FONT_SIZE): number {
	return fontSize * 0.42;
}

/** Height needed to show full notes / parts text. */
function measureRowHeight(doc: jsPDF, row: PrintRow | null): number {
	if (!row) return ROW_H_MIN;

	const padX = 1.5;
	const padY = 2.5;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(NOTES_FONT_SIZE);

	let textH = ROW_H_MIN;
	if (row.notes) {
		const lines = doc.splitTextToSize(row.notes, COLS.notes.w - padX * 2) as string[];
		textH = Math.max(textH, padY * 2 + lines.length * notesLineHeight());
	}
	if (row.parts) {
		const lines = doc.splitTextToSize(row.parts, COLS.parts.w - padX * 2) as string[];
		textH = Math.max(textH, padY * 2 + lines.length * notesLineHeight());
	}

	return Math.max(ROW_H_MIN, Math.min(TABLE_BODY_H, textH + 1));
}

function drawWrappedText(
	doc: jsPDF,
	text: string,
	x: number,
	y: number,
	w: number,
	h: number,
	fontSize = NOTES_FONT_SIZE
): void {
	if (!text) return;

	const padX = 1.5;
	const padY = 2.5;
	const maxW = w - padX * 2;
	const maxH = h - padY * 2;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(fontSize);
	doc.setTextColor(17, 24, 39);

	const lines = doc.splitTextToSize(text, maxW) as string[];
	const lineHeight = notesLineHeight(fontSize);
	const maxLines = Math.max(1, Math.floor(maxH / lineHeight));
	const visible = lines.slice(0, maxLines);

	visible.forEach((line, i) => {
		doc.text(line, x + padX, y + padY + (i + 1) * lineHeight);
	});
}

function drawDataRow(
	doc: jsPDF,
	row: PrintRow | null,
	rowIndex: number,
	y: number,
	rowH: number,
	zebra: boolean,
	mode: PrintMode
): void {
	if (zebra) {
		doc.setFillColor(249, 250, 251);
		doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, rowH, 'F');
	}

	doc.setDrawColor(209, 213, 219);
	doc.setLineWidth(0.25);
	doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, rowH);

	(Object.keys(COLS) as (keyof typeof COLS)[]).forEach((key) => {
		const col = COLS[key];
		doc.line(col.x, y, col.x, y + rowH);
	});
	doc.line(PAGE_W - MARGIN, y, PAGE_W - MARGIN, y + rowH);

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(8);
	doc.setTextColor(107, 114, 128);
	doc.text(String(rowIndex + 1), COLS.num.x + COLS.num.w / 2, y + rowH / 2 + 1, {
		align: 'center'
	});

	if (row) {
		drawEquipmentCell(doc, row, COLS.equipment.x, y, COLS.equipment.w);
	} else {
		drawWritingLines(doc, COLS.equipment.x, y, COLS.equipment.w, rowH, 2);
	}

	drawResultCell(doc, COLS.result.x, y, COLS.result.w, rowH, row?.results ?? '', mode);
	drawServiceCell(doc, COLS.service.x, y, row?.service ?? '', mode);

	if (row?.workshopId) {
		drawWrappedText(doc, row.workshopId, COLS.workshop.x, y, COLS.workshop.w, rowH, 7);
	} else if (mode === 'fillable') {
		drawWritingLines(doc, COLS.workshop.x, y, COLS.workshop.w, rowH, 1);
	}

	if (row?.parts) {
		drawWrappedText(doc, row.parts, COLS.parts.x, y, COLS.parts.w, rowH, 6.5);
	} else if (mode === 'fillable') {
		drawWritingLines(doc, COLS.parts.x, y, COLS.parts.w, rowH, 2);
	}

	if (row?.notes) {
		drawWrappedText(doc, row.notes, COLS.notes.x, y, COLS.notes.w, rowH, NOTES_FONT_SIZE);
	} else if (mode === 'fillable') {
		drawWritingLines(doc, COLS.notes.x, y, COLS.notes.w, rowH, 3);
	}
}

/** Paginate rows with variable heights so long notes stay on one page when possible. */
function paginateRows(
	doc: jsPDF,
	rows: PrintRow[],
	mode: PrintMode
): { row: PrintRow | null; index: number; height: number }[][] {
	const pages: { row: PrintRow | null; index: number; height: number }[][] = [];
	let current: { row: PrintRow | null; index: number; height: number }[] = [];
	let used = 0;

	const pushPage = () => {
		if (current.length === 0) return;
		pages.push(current);
		current = [];
		used = 0;
	};

	const items =
		rows.length > 0
			? rows.map((row, index) => ({ row, index, height: measureRowHeight(doc, row) }))
			: mode === 'fillable'
				? [{ row: null as PrintRow | null, index: 0, height: ROW_H_MIN }]
				: [];

	for (const item of items) {
		const height = Math.min(item.height, TABLE_BODY_H);
		if (used > 0 && used + height > TABLE_BODY_H) {
			pushPage();
		}
		current.push({ ...item, height });
		used += height;
	}

	// Fill remaining space on fillable sheets with blank writing rows.
	if (mode === 'fillable') {
		let blankIndex = items.length;
		while (TABLE_BODY_H - used >= ROW_H_MIN && (current.length > 0 || blankIndex === 0)) {
			if (current.length === 0 && blankIndex === 0 && items.length === 0) {
				current.push({ row: null, index: 0, height: ROW_H_MIN });
				used += ROW_H_MIN;
				blankIndex = 1;
				continue;
			}
			current.push({ row: null, index: blankIndex, height: ROW_H_MIN });
			blankIndex += 1;
			used += ROW_H_MIN;
		}
	}

	pushPage();
	if (pages.length === 0) {
		pages.push([{ row: null, index: 0, height: ROW_H_MIN }]);
	}
	return pages;
}

function drawFooter(doc: jsPDF): void {
	const y = PAGE_H - MARGIN - 2;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(6.5);
	doc.setTextColor(107, 114, 128);
	doc.text(
		'Technician: ________________________    Signature: ________________________    Time in/out: ________ / ________',
		MARGIN,
		y
	);
}

function openPdfForPrint(doc: jsPDF, printTitle: string): void {
	doc.setProperties({ title: printTitle });
	doc.autoPrint();

	const blob = doc.output('blob');
	const url = URL.createObjectURL(blob);
	const printWindow = window.open(url, '_blank');

	if (!printWindow) {
		URL.revokeObjectURL(url);
		doc.save(`${printTitle.replace(/[^\w\- ]+/g, '').trim() || 'sheet'}.pdf`);
		return;
	}

	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function printLandscapeSheet(
	header: SheetHeader,
	rows: SheetRow[],
	mode: PrintMode,
	options?: PrintSheetOptions
): Promise<void> {
	const printTitle =
		options?.printTitle ||
		[header.company, header.sheetName].filter(Boolean).join(' — ') ||
		'Service Test & Tag Sheet';

	const meta = toPrintMeta(header);
	const printRows = toPrintRows(rows);
	const logoDataUrl = options?.logoUrl ? await loadLogoPngDataUrl(options.logoUrl) : null;

	const doc = new jsPDF({
		orientation: 'landscape',
		unit: 'mm',
		format: 'a4',
		compress: true
	});

	const pages = paginateRows(doc, printRows, mode);
	const pageCount = pages.length;

	for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
		if (pageIndex > 0) doc.addPage();

		drawHeader(doc, meta, logoDataUrl);
		drawMeta(doc, meta, pageIndex, pageCount);

		const colHeaderY = CONTENT_TOP;
		drawColumnHeaders(doc, colHeaderY);

		let y = colHeaderY + COL_HEADER_H;
		pages[pageIndex].forEach((item, i) => {
			drawDataRow(doc, item.row, item.index, y, item.height, i % 2 === 1, mode);
			y += item.height;
		});

		drawFooter(doc);
	}

	openPdfForPrint(doc, printTitle);
}

/**
 * Landscape A4 sheet with equipment pre-filled and blank writing space
 * for results, service, parts, workshop ID, and notes.
 */
export async function printFillableSheet(
	header: SheetHeader,
	rows: SheetRow[],
	options?: PrintSheetOptions
): Promise<void> {
	await printLandscapeSheet(header, rows, 'fillable', options);
}

/**
 * Same landscape layout as the fillable sheet, with results / service / parts /
 * workshop ID / notes filled from the current page values.
 */
export async function printCompletedSheet(
	header: SheetHeader,
	rows: SheetRow[],
	options?: PrintSheetOptions
): Promise<void> {
	await printLandscapeSheet(header, rows, 'completed', options);
}
