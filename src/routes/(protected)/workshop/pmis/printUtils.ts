import html2canvas from 'html2canvas';

const CAPTURE_SCALE = 2;
/** Approx. printable height on A4 with 8mm margins (CSS px at 96dpi). */
const MAX_BLOCK_HEIGHT_PX = 1000;

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

/** Replace external <img> sources in the clone so html2canvas can paint them. */
async function inlineImagesForCapture(clone: HTMLElement, logoFallbackUrl: string): Promise<void> {
	const cloneImgs = [...clone.querySelectorAll<HTMLImageElement>('img')];

	await Promise.all(
		cloneImgs.map(async (cloneImg) => {
			const src = cloneImg.getAttribute('src') ?? '';
			let dataUrl = src.startsWith('data:') ? src : await fetchImageDataUrl(src);

			if (!dataUrl && cloneImg.closest('.logo-cell') && logoFallbackUrl) {
				dataUrl = await fetchImageDataUrl(logoFallbackUrl);
			}

			if (dataUrl) {
				cloneImg.src = dataUrl;
				cloneImg.removeAttribute('srcset');
			}
		})
	);
}

/** Replace form controls with static text so html2canvas matches on-screen values. */
function prepareCloneForCapture(root: HTMLElement): void {
	root.querySelectorAll<HTMLInputElement>('input[type="text"]').forEach((input) => {
		const span = document.createElement('span');
		span.textContent = input.value;
		span.className = input.className;
		span.style.display = 'block';
		span.style.width = '100%';
		span.style.padding = '2px 0';
		span.style.font = 'inherit';
		span.style.color = 'inherit';
		span.style.whiteSpace = 'pre-wrap';
		span.style.minHeight = `${input.offsetHeight}px`;
		input.replaceWith(span);
	});

	root.querySelectorAll<HTMLTextAreaElement>('textarea').forEach((textarea) => {
		const div = document.createElement('div');
		div.textContent = textarea.value;
		div.className = textarea.className;
		div.style.whiteSpace = 'pre-wrap';
		div.style.width = '100%';
		div.style.padding = '2px 0';
		div.style.font = 'inherit';
		div.style.color = 'inherit';
		div.style.minHeight = `${textarea.offsetHeight}px`;
		textarea.replaceWith(div);
	});

	root.querySelectorAll<HTMLInputElement>('.status-checkbox input[type="checkbox"]').forEach((input) => {
		input.style.display = 'none';
	});

	root.querySelectorAll<HTMLElement>('.status-checkbox .status-pass').forEach((el) => {
		el.style.color = '#16a34a';
		el.style.fontWeight = '700';
	});

	root.querySelectorAll<HTMLElement>('.status-checkbox .status-fail').forEach((el) => {
		el.style.color = '#dc2626';
		el.style.fontWeight = '700';
	});

	root.querySelectorAll<HTMLInputElement>('.checkbox-row input[type="checkbox"]').forEach((input) => {
		input.style.width = '14px';
		input.style.height = '14px';
		input.style.flexShrink = '0';
	});
}

type BlockStyles = {
	width: number;
	fontFamily: string;
	fontSize: string;
	color: string;
};

function buildTableFromRows(source: HTMLTableElement, rows: HTMLTableRowElement[]): HTMLTableElement {
	const table = document.createElement('table');
	table.className = source.className;
	if (source.getAttribute('aria-label')) {
		table.setAttribute('aria-label', source.getAttribute('aria-label')!);
	}
	const tbody = document.createElement('tbody');
	for (const row of rows) {
		tbody.appendChild(row.cloneNode(true));
	}
	table.appendChild(tbody);
	return table;
}

/** Split a tall table into row groups that fit roughly one printed page each. */
function splitTableIntoRowBlocks(table: HTMLTableElement): HTMLTableElement[] {
	const tbody = table.querySelector('tbody');
	if (!tbody) return [table];

	const rows = [...tbody.querySelectorAll<HTMLTableRowElement>(':scope > tr')];
	if (rows.length === 0) return [table];

	if (table.offsetHeight <= MAX_BLOCK_HEIGHT_PX) return [table];

	const blocks: HTMLTableElement[] = [];
	let batch: HTMLTableRowElement[] = [];
	let batchHeight = 0;

	for (const row of rows) {
		const rowHeight = row.offsetHeight || 24;
		if (batch.length > 0 && batchHeight + rowHeight > MAX_BLOCK_HEIGHT_PX) {
			blocks.push(buildTableFromRows(table, batch));
			batch = [];
			batchHeight = 0;
		}
		batch.push(row);
		batchHeight += rowHeight;
	}

	if (batch.length > 0) blocks.push(buildTableFromRows(table, batch));
	return blocks.length > 0 ? blocks : [table];
}

function collectPrintBlocks(clone: HTMLElement): HTMLTableElement[] {
	const tables = [...clone.querySelectorAll<HTMLTableElement>('table.form-table')];
	const blocks: HTMLTableElement[] = [];

	for (const table of tables) {
		blocks.push(...splitTableIntoRowBlocks(table));
	}

	return blocks;
}

function createCaptureWrapper(styles: BlockStyles): HTMLDivElement {
	const wrapper = document.createElement('div');
	wrapper.className = 'pmis-page';
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

async function captureBlock(
	table: HTMLTableElement,
	styles: BlockStyles
): Promise<string> {
	const wrapper = createCaptureWrapper(styles);
	wrapper.appendChild(table.cloneNode(true));
	document.body.appendChild(wrapper);

	try {
		const canvas = await html2canvas(wrapper, {
			scale: CAPTURE_SCALE,
			useCORS: true,
			backgroundColor: '#ffffff',
			logging: false
		});
		return canvas.toDataURL('image/png');
	} finally {
		wrapper.remove();
	}
}

function openPrintWindow(imageDataUrls: string[]): void {
	const printWindow = window.open('', '_blank');
	if (!printWindow) {
		throw new Error('Please allow pop-ups to print the form');
	}

	const blocksHtml = imageDataUrls
		.map(
			(src) =>
				`<div class="print-block"><img src="${src}" alt="" /></div>`
		)
		.join('\n');

	printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>PMIS — Print</title>
  <style>
    @page { margin: 8mm; size: A4; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .print-block {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .print-block img {
      display: block;
      width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  ${blocksHtml}
  <script>
    window.onload = function () {
      window.print();
      window.onafterprint = function () { window.close(); };
    };
  <\/script>
</body>
</html>`);
	printWindow.document.close();
}

export async function printSheetElement(
	sheetEl: HTMLElement,
	logoFallbackUrl: string
): Promise<void> {
	const pageEl = sheetEl.closest('.pmis-page') ?? sheetEl;
	const pageStyles = window.getComputedStyle(pageEl);

	const styles: BlockStyles = {
		width: sheetEl.offsetWidth,
		fontFamily: pageStyles.fontFamily,
		fontSize: pageStyles.fontSize,
		color: pageStyles.color
	};

	const wrapper = createCaptureWrapper(styles);
	const clone = sheetEl.cloneNode(true) as HTMLElement;
	wrapper.appendChild(clone);
	document.body.appendChild(wrapper);

	try {
		prepareCloneForCapture(clone);
		await inlineImagesForCapture(clone, logoFallbackUrl);

		const printTables = collectPrintBlocks(clone);
		const imageDataUrls: string[] = [];

		for (const table of printTables) {
			imageDataUrls.push(await captureBlock(table, styles));
		}

		if (imageDataUrls.length === 0) {
			throw new Error('Nothing to print');
		}

		openPrintWindow(imageDataUrls);
	} finally {
		wrapper.remove();
	}
}
