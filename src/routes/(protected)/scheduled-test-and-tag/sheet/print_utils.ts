import { jsPDF } from 'jspdf';
import type { SheetHeader, SheetRow } from './types';

/** A4 landscape (mm). */
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 8;
const HEADER_H = 22;
const META_H = 12;
const COL_HEADER_H = 9;
const ROW_H = 18;
const FOOTER_H = 8;

const CONTENT_TOP = MARGIN + HEADER_H + META_H;
const CONTENT_BOTTOM = PAGE_H - MARGIN - FOOTER_H;
const TABLE_BODY_H = CONTENT_BOTTOM - CONTENT_TOP - COL_HEADER_H;
const ROWS_PER_PAGE = Math.max(1, Math.floor(TABLE_BODY_H / ROW_H));

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
};

/** Column x positions and widths (mm) for the landscape writing form. */
const COLS = {
	num: { x: MARGIN, w: 8, label: '#' },
	equipment: { x: MARGIN + 8, w: 72, label: 'Equipment' },
	result: { x: MARGIN + 80, w: 28, label: 'Result' },
	service: { x: MARGIN + 108, w: 36, label: 'Service' },
	workshop: { x: MARGIN + 144, w: 28, label: 'Workshop ID' },
	parts: { x: MARGIN + 172, w: 48, label: 'Parts / materials' },
	notes: { x: MARGIN + 220, w: PAGE_W - MARGIN - (MARGIN + 220), label: 'Notes' }
} as const;

export type PrintSheetOptions = {
	printTitle?: string;
	logoUrl?: string;
};

async function fetchImageDataUrl(url: string): Promise<string | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const blob = await res.blob();
		return await new Promise<string>((resolve, reject) => {
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
		location: row.location?.trim() || ''
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

function drawCheckbox(doc: jsPDF, x: number, y: number, size = 3.2): void {
	doc.setDrawColor(55, 65, 81);
	doc.setLineWidth(0.25);
	doc.rect(x, y, size, size);
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

function fitText(
	doc: jsPDF,
	text: string,
	maxWidth: number,
	fontSize: number
): string {
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

	doc.setTextColor(107, 114, 128);
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(6.5);
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

function drawResultCell(doc: jsPDF, x: number, y: number, w: number): void {
	const box = 3.2;
	const midY = y + ROW_H / 2 - box / 2;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(7);
	doc.setTextColor(55, 65, 81);

	drawCheckbox(doc, x + 3, midY, box);
	doc.text('Pass', x + 7.5, midY + 2.5);

	drawCheckbox(doc, x + 15.5, midY, box);
	doc.text('Fail', x + 20, midY + 2.5);

	void w;
}

function drawServiceCell(doc: jsPDF, x: number, y: number): void {
	const options = ['Service', 'Test & Tag', 'Tag'];
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(6.5);
	doc.setTextColor(55, 65, 81);

	options.forEach((label, i) => {
		const ly = y + 3.8 + i * 4.5;
		drawCheckbox(doc, x + 2, ly - 2.2, 2.8);
		doc.text(label, x + 6.5, ly);
	});
}

function drawDataRow(
	doc: jsPDF,
	row: PrintRow | null,
	rowIndex: number,
	y: number,
	zebra: boolean
): void {
	if (zebra) {
		doc.setFillColor(249, 250, 251);
		doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, ROW_H, 'F');
	}

	doc.setDrawColor(209, 213, 219);
	doc.setLineWidth(0.25);
	doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, ROW_H);

	(Object.keys(COLS) as (keyof typeof COLS)[]).forEach((key) => {
		const col = COLS[key];
		doc.line(col.x, y, col.x, y + ROW_H);
	});
	doc.line(PAGE_W - MARGIN, y, PAGE_W - MARGIN, y + ROW_H);

	// Row number
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(8);
	doc.setTextColor(107, 114, 128);
	doc.text(String(rowIndex + 1), COLS.num.x + COLS.num.w / 2, y + ROW_H / 2 + 1, {
		align: 'center'
	});

	if (row) {
		drawEquipmentCell(doc, row, COLS.equipment.x, y, COLS.equipment.w);
	} else {
		drawWritingLines(doc, COLS.equipment.x, y, COLS.equipment.w, ROW_H, 2);
	}

	drawResultCell(doc, COLS.result.x, y, COLS.result.w);
	drawServiceCell(doc, COLS.service.x, y);
	drawWritingLines(doc, COLS.workshop.x, y, COLS.workshop.w, ROW_H, 1);
	drawWritingLines(doc, COLS.parts.x, y, COLS.parts.w, ROW_H, 2);
	drawWritingLines(doc, COLS.notes.x, y, COLS.notes.w, ROW_H, 2);
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

/**
 * Build a landscape A4 fillable sheet with equipment pre-filled and blank
 * writing space for results, service, parts, workshop ID, and notes.
 */
export async function printFillableSheet(
	header: SheetHeader,
	rows: SheetRow[],
	options?: PrintSheetOptions
): Promise<void> {
	const printTitle =
		options?.printTitle ||
		[header.company, header.sheetName].filter(Boolean).join(' — ') ||
		'Service Test & Tag Sheet';

	const meta = toPrintMeta(header);
	const printRows = toPrintRows(rows);
	const logoDataUrl = options?.logoUrl ? await loadLogoPngDataUrl(options.logoUrl) : null;

	const pageCount = Math.max(1, Math.ceil(Math.max(printRows.length, 1) / ROWS_PER_PAGE));

	const doc = new jsPDF({
		orientation: 'landscape',
		unit: 'mm',
		format: 'a4',
		compress: true
	});

	for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
		if (pageIndex > 0) doc.addPage();

		drawHeader(doc, meta, logoDataUrl);
		drawMeta(doc, meta, pageIndex, pageCount);

		const colHeaderY = CONTENT_TOP;
		drawColumnHeaders(doc, colHeaderY);

		const start = pageIndex * ROWS_PER_PAGE;
		for (let i = 0; i < ROWS_PER_PAGE; i++) {
			const dataIndex = start + i;
			const row = dataIndex < printRows.length ? printRows[dataIndex] : null;
			const y = colHeaderY + COL_HEADER_H + i * ROW_H;
			drawDataRow(doc, row, dataIndex, y, i % 2 === 1);
		}

		drawFooter(doc);
	}

	openPdfForPrint(doc, printTitle);
}
