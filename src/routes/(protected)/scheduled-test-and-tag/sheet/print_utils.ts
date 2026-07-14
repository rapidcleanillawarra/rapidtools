import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const CAPTURE_SCALE = 2;
const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 8;
/** Approx. printable content height on A4 with margins (CSS px at 96dpi). */
const MAX_BLOCK_HEIGHT_PX = 980;

type BlockStyles = {
	width: number;
	fontFamily: string;
	fontSize: string;
	color: string;
};

/** Load an image URL as a data URL (same-origin always works; remote needs CORS). */
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

async function inlineImagesForCapture(clone: HTMLElement, logoFallbackUrl: string): Promise<void> {
	const cloneImgs = [...clone.querySelectorAll<HTMLImageElement>('img')];

	await Promise.all(
		cloneImgs.map(async (cloneImg) => {
			const src = cloneImg.getAttribute('src') ?? '';
			let dataUrl = src.startsWith('data:') ? src : await fetchImageDataUrl(src);

			if (!dataUrl && cloneImg.classList.contains('sheet-logo') && logoFallbackUrl) {
				dataUrl = await fetchImageDataUrl(logoFallbackUrl);
			}

			if (dataUrl) {
				cloneImg.src = dataUrl;
				cloneImg.removeAttribute('srcset');
			}
		})
	);
}

function replaceWithText(
	el: HTMLElement,
	text: string,
	options?: { className?: string; color?: string; fontWeight?: string }
): void {
	const span = document.createElement('span');
	span.textContent = text;
	span.className = options?.className ?? el.className;
	span.style.display = 'block';
	span.style.width = '100%';
	span.style.padding = '2px 0';
	span.style.font = 'inherit';
	span.style.color = options?.color ?? 'inherit';
	span.style.fontWeight = options?.fontWeight ?? 'inherit';
	span.style.whiteSpace = 'pre-wrap';
	span.style.minHeight = `${Math.max(el.offsetHeight, 16)}px`;
	el.replaceWith(span);
}

/** Flatten interactive controls so html2canvas captures current values. */
function prepareCloneForCapture(root: HTMLElement): void {
	root
		.querySelectorAll<HTMLElement>('.no-print:not(.sheet-sidebar), .sheet-sidebar-inactive')
		.forEach((el) => el.remove());
	root
		.querySelectorAll<HTMLElement>(
			'.sheet-actions-col, .sheet-add-row, .sheet-sort-icon, .machine-type-options'
		)
		.forEach((el) => el.remove());
	root.querySelectorAll('.sheet-empty').forEach((el) => el.closest('tr')?.remove());

	root.querySelectorAll<HTMLElement>('.sheet-sort-btn').forEach((btn) => {
		const label = (btn.textContent ?? '').replace(/[↑↓↕]/g, '').trim();
		const span = document.createElement('span');
		span.textContent = label;
		span.style.font = 'inherit';
		span.style.fontWeight = '600';
		btn.replaceWith(span);
	});

	root.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"])').forEach((input) => {
		const computed = window.getComputedStyle(input);
		const value =
			input.type === 'date' && input.value
				? new Date(`${input.value}T00:00:00`).toLocaleDateString('en-AU', {
						day: '2-digit',
						month: 'short',
						year: 'numeric'
					})
				: input.value || input.placeholder || '';
		const span = document.createElement('span');
		span.textContent = value;
		span.className = input.className;
		span.style.display = 'block';
		span.style.width = '100%';
		span.style.padding = '2px 0';
		span.style.font = computed.font;
		span.style.color = computed.color;
		span.style.fontWeight = computed.fontWeight;
		span.style.textAlign = computed.textAlign;
		span.style.whiteSpace = 'pre-wrap';
		span.style.minHeight = `${Math.max(input.offsetHeight, 16)}px`;
		input.replaceWith(span);
	});

	root.querySelectorAll<HTMLTextAreaElement>('textarea').forEach((textarea) => {
		replaceWithText(textarea, textarea.value);
	});

	root.querySelectorAll<HTMLSelectElement>('select').forEach((select) => {
		const selected = select.options[select.selectedIndex];
		const label = selected?.text?.trim() || '';
		const isPlaceholder = !select.value;
		const color =
			select.classList.contains('result-select--pass')
				? '#16a34a'
				: select.classList.contains('result-select--fail')
					? '#dc2626'
					: isPlaceholder
						? '#9ca3af'
						: undefined;
		replaceWithText(select, isPlaceholder ? '—' : label, {
			color,
			fontWeight: select.classList.contains('result-select') ? '600' : undefined
		});
	});

	root.querySelectorAll<HTMLButtonElement>('button.parts-editor-trigger').forEach((btn) => {
		replaceWithText(btn, (btn.getAttribute('title') || btn.textContent || '').trim() || '—');
	});

	root.querySelectorAll<HTMLElement>('.company-combobox-list, .company-combobox-clear').forEach((el) =>
		el.remove()
	);
}

function buildTableFromRows(
	source: HTMLTableElement,
	headerRows: HTMLTableRowElement[],
	bodyRows: HTMLTableRowElement[]
): HTMLTableElement {
	const table = document.createElement('table');
	table.className = source.className;
	if (source.getAttribute('aria-label')) {
		table.setAttribute('aria-label', source.getAttribute('aria-label')!);
	}

	if (headerRows.length > 0) {
		const thead = document.createElement('thead');
		for (const row of headerRows) {
			thead.appendChild(row.cloneNode(true));
		}
		table.appendChild(thead);
	}

	const tbody = document.createElement('tbody');
	for (const row of bodyRows) {
		tbody.appendChild(row.cloneNode(true));
	}
	table.appendChild(tbody);
	return table;
}

function splitTableIntoRowBlocks(table: HTMLTableElement): HTMLTableElement[] {
	const tbody = table.querySelector('tbody');
	if (!tbody) return [table];

	const headerRows = [...table.querySelectorAll<HTMLTableRowElement>('thead > tr')];
	const rows = [...tbody.querySelectorAll<HTMLTableRowElement>(':scope > tr')];
	if (rows.length === 0) return [table];

	const headerHeight = headerRows.reduce((sum, row) => sum + (row.offsetHeight || 28), 0);
	if (table.offsetHeight <= MAX_BLOCK_HEIGHT_PX) return [table];

	const blocks: HTMLTableElement[] = [];
	let batch: HTMLTableRowElement[] = [];
	let batchHeight = headerHeight;

	for (const row of rows) {
		const rowHeight = row.offsetHeight || 48;
		if (batch.length > 0 && batchHeight + rowHeight > MAX_BLOCK_HEIGHT_PX) {
			blocks.push(buildTableFromRows(table, headerRows, batch));
			batch = [];
			batchHeight = headerHeight;
		}
		batch.push(row);
		batchHeight += rowHeight;
	}

	if (batch.length > 0) blocks.push(buildTableFromRows(table, headerRows, batch));
	return blocks.length > 0 ? blocks : [table];
}

function createCaptureWrapper(styles: BlockStyles): HTMLDivElement {
	const wrapper = document.createElement('div');
	wrapper.className = 'sheet-page sheet-print-capture';
	wrapper.style.position = 'fixed';
	wrapper.style.left = '-9999px';
	wrapper.style.top = '0';
	wrapper.style.width = `${styles.width}px`;
	wrapper.style.background = '#fff';
	wrapper.style.padding = '0';
	wrapper.style.fontFamily = styles.fontFamily;
	wrapper.style.fontSize = styles.fontSize;
	wrapper.style.color = styles.color;
	return wrapper;
}

function buildPrintPage(
	styles: BlockStyles,
	header: HTMLElement | null,
	sidebar: HTMLElement | null,
	table: HTMLTableElement,
	includeChrome: boolean
): HTMLDivElement {
	const page = document.createElement('div');
	page.className = 'sheet-document';
	page.style.width = `${styles.width}px`;
	page.style.background = '#fff';
	page.style.boxShadow = 'none';

	if (includeChrome && header) {
		page.appendChild(header.cloneNode(true));
	}

	if (includeChrome && sidebar) {
		const meta = document.createElement('div');
		meta.style.display = 'flex';
		meta.style.flexWrap = 'wrap';
		meta.style.gap = '1.25rem';
		meta.style.padding = '0.75rem 1.5rem';
		meta.style.borderBottom = '1px solid #e5e7eb';
		meta.style.fontSize = '0.8125rem';
		meta.style.color = '#374151';

		sidebar.querySelectorAll<HTMLElement>('.sheet-sidebar-field').forEach((field) => {
			const labelEl = field.querySelector('.sheet-sidebar-label');
			const label = labelEl?.textContent?.trim() ?? '';
			if (!label) return;

			const value = Array.from(field.children)
				.filter((child) => child !== labelEl)
				.map((child) => {
					if (child instanceof HTMLInputElement || child instanceof HTMLSelectElement) {
						return child.value;
					}
					return (child.textContent ?? '').trim();
				})
				.filter(Boolean)
				.join(' ');

			const item = document.createElement('div');
			const labelNode = document.createElement('strong');
			labelNode.textContent = label;
			labelNode.style.color = '#6b7280';
			labelNode.style.textTransform = 'uppercase';
			labelNode.style.fontSize = '0.7rem';
			labelNode.style.letterSpacing = '0.02em';
			labelNode.style.display = 'block';
			labelNode.style.marginBottom = '0.15rem';

			const valueNode = document.createElement('span');
			valueNode.textContent = value || '—';

			item.appendChild(labelNode);
			item.appendChild(valueNode);
			meta.appendChild(item);
		});

		if (meta.childElementCount > 0) {
			page.appendChild(meta);
		}
	}

	const wrap = document.createElement('div');
	wrap.className = 'sheet-table-wrap';
	wrap.style.overflow = 'visible';
	wrap.style.padding = includeChrome ? '0' : '0.5rem 0 0';
	wrap.appendChild(table);
	page.appendChild(wrap);

	return page;
}

async function captureElement(el: HTMLElement, styles: BlockStyles): Promise<string> {
	const wrapper = createCaptureWrapper(styles);
	wrapper.appendChild(el);
	document.body.appendChild(wrapper);

	try {
		const canvas = await html2canvas(wrapper, {
			scale: CAPTURE_SCALE,
			useCORS: true,
			backgroundColor: '#ffffff',
			logging: false
		});
		return canvas.toDataURL('image/jpeg', 0.92);
	} finally {
		wrapper.remove();
	}
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

	// Revoke after the viewer has had time to load the blob.
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Capture the scheduled test & tag sheet with html2canvas + jsPDF and open the print dialog.
 */
export async function printSheetDocument(
	layoutEl: HTMLElement,
	logoFallbackUrl: string,
	options?: { printTitle?: string }
): Promise<void> {
	const printTitle = options?.printTitle ?? 'Service Test & Tag Sheet';
	const pageStyles = window.getComputedStyle(layoutEl);
	const documentEl = layoutEl.querySelector<HTMLElement>('.sheet-document');
	const captureWidth = documentEl?.offsetWidth || layoutEl.offsetWidth;

	const styles: BlockStyles = {
		width: captureWidth,
		fontFamily: pageStyles.fontFamily,
		fontSize: pageStyles.fontSize,
		color: pageStyles.color
	};

	const wrapper = createCaptureWrapper(styles);
	const clone = layoutEl.cloneNode(true) as HTMLElement;
	wrapper.appendChild(clone);
	document.body.appendChild(wrapper);

	try {
		prepareCloneForCapture(clone);
		await inlineImagesForCapture(clone, logoFallbackUrl);

		const header = clone.querySelector<HTMLElement>('.sheet-header');
		const sidebar = clone.querySelector<HTMLElement>('.sheet-sidebar');
		const table = clone.querySelector<HTMLTableElement>('table.sheet-table');

		if (!table) {
			throw new Error('Nothing to print');
		}

		const tableBlocks = splitTableIntoRowBlocks(table);
		const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
		const printableW = A4_W_MM - MARGIN_MM * 2;
		const printableH = A4_H_MM - MARGIN_MM * 2;

		for (let i = 0; i < tableBlocks.length; i++) {
			const pageEl = buildPrintPage(styles, header, sidebar, tableBlocks[i], i === 0);
			const imgData = await captureElement(pageEl, styles);

			const img = new Image();
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('Failed to load print image'));
				img.src = imgData;
			});

			const imgWmm = printableW;
			const imgHmm = (img.height / img.width) * imgWmm;
			const scale = Math.min(1, printableH / imgHmm);
			const drawW = imgWmm * scale;
			const drawH = imgHmm * scale;

			if (i > 0) doc.addPage();
			doc.addImage(imgData, 'JPEG', MARGIN_MM, MARGIN_MM, drawW, drawH);
		}

		openPdfForPrint(doc, printTitle);
	} finally {
		wrapper.remove();
	}
}
