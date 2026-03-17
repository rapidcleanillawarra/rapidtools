import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const CAPTURE_SCALE = 3;
const EXPORT_CLASS = 'exporting-pdf';

const A4_W_MM = 210;
const A4_H_MM = 297;

/** Convert an SVG URL to a PNG data URL so html2canvas can render it. Optional fillColor for mask-style icons (e.g. product_icon). */
async function svgToPngDataUrl(
	svgUrl: string,
	width: number,
	height: number,
	fillColor?: string
): Promise<string> {
	const res = await fetch(svgUrl, { mode: 'cors' });
	if (!res.ok) throw new Error(`Failed to fetch SVG: ${res.status}`);
	const svgText = await res.text();
	const blob = new Blob([svgText], { type: 'image/svg+xml' });
	const url = URL.createObjectURL(blob);
	const img = new Image();
	img.crossOrigin = 'anonymous';
	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve();
		img.onerror = () => reject(new Error('Failed to load SVG'));
		img.src = url;
	});
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(width));
	canvas.height = Math.max(1, Math.round(height));
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		URL.revokeObjectURL(url);
		throw new Error('Could not get canvas 2d context');
	}
	if (fillColor) {
		ctx.fillStyle = fillColor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.globalCompositeOperation = 'destination-in';
	}
	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
	URL.revokeObjectURL(url);
	return canvas.toDataURL('image/png');
}

/** Replace SVG images and mask-based SVG icons in the given element tree with PNG data URLs. */
async function replaceSvgsInElement(root: HTMLElement): Promise<void> {
	const tasks: Promise<void>[] = [];

	// <img> with .svg src
	root.querySelectorAll<HTMLImageElement>('img[src*=".svg"]').forEach((img) => {
		const src = img.src || img.getAttribute('src');
		if (!src) return;
		let w = img.offsetWidth || img.width;
		let h = img.offsetHeight || img.height;
		if (!w || !h) {
			const style = img.getAttribute('style') || '';
			const wMatch = style.match(/width:\s*(\d+(?:\.\d+)?)px/);
			const hMatch = style.match(/height:\s*(\d+(?:\.\d+)?)px/);
			w = w || (wMatch ? Number(wMatch[1]) : 100);
			h = h || (hMatch ? Number(hMatch[1]) : 100);
		}
		tasks.push(
			svgToPngDataUrl(src, w || 100, h || 100)
				.then((dataUrl) => {
					img.src = dataUrl;
					img.removeAttribute('srcset');
				})
				.catch((e) => console.warn('PDF export: could not rasterize SVG image', src, e))
		);
	});

	// Div with mask-image (product_icon): background-color + mask SVG → rasterize as colored shape
	root.querySelectorAll<HTMLElement>('.shape-image').forEach((el) => {
		const style = el.getAttribute('style') || '';
		const maskMatch = style.match(/mask-image:\s*url\(["']?([^"')]+)["']?\)/) ||
			style.match(/webkit-mask-image:\s*url\(["']?([^"')]+)["']?\)/);
		const svgUrl = maskMatch?.[1]?.trim();
		if (!svgUrl || !svgUrl.includes('.svg')) return;
		const wrap = el.parentElement;
		let width = wrap?.offsetWidth || el.offsetWidth;
		let height = wrap?.offsetHeight || el.offsetHeight;
		if (!width || !height) {
			const wMatch = style.match(/width:\s*(\d+(?:\.\d+)?)px/);
			const hMatch = style.match(/height:\s*(\d+(?:\.\d+)?)px/);
			width = width || (wMatch ? Number(wMatch[1]) : 100);
			height = height || (hMatch ? Number(hMatch[1]) : 100);
		}
		const fillColorMatch = style.match(/background-color:\s*([^;]+)/);
		const fillColor = (fillColorMatch?.[1]?.trim()) || '#000000';
		tasks.push(
			svgToPngDataUrl(svgUrl, width, height, fillColor)
				.then((dataUrl) => {
					const newImg = document.createElement('img');
					newImg.setAttribute('src', dataUrl);
					newImg.setAttribute('alt', '');
					newImg.className = el.className;
					newImg.style.cssText = `width:${width}px;height:${height}px;display:block;object-fit:fill;pointer-events:none`;
					el.parentElement?.replaceChild(newImg, el);
				})
				.catch((e) => console.warn('PDF export: could not rasterize SVG mask', svgUrl, e))
		);
	});

	// background-image with .svg (e.g. dial background)
	root.querySelectorAll<HTMLElement>('[style*="background-image"]').forEach((el) => {
		const style = el.getAttribute('style') || '';
		const bgMatch = style.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/);
		const url = bgMatch?.[1]?.trim();
		if (!url || !url.includes('.svg')) return;
		const width = el.offsetWidth || 100;
		const height = el.offsetHeight || 100;
		tasks.push(
			svgToPngDataUrl(url, width, height)
				.then((dataUrl) => {
					el.style.backgroundImage = `url(${dataUrl})`;
				})
				.catch((e) => console.warn('PDF export: could not rasterize SVG background', url, e))
		);
	});

	await Promise.all(tasks);
}

export async function exportPdf(templateEl: HTMLDivElement) {
	templateEl.classList.add(EXPORT_CLASS);

	try {
		// Clone so we can replace SVGs with PNGs without touching the live UI. html2canvas does not draw SVG images/masks.
		const clone = templateEl.cloneNode(true) as HTMLDivElement;
		clone.style.position = 'fixed';
		clone.style.left = '-9999px';
		clone.style.top = '0';
		document.body.appendChild(clone);
		try {
			await replaceSvgsInElement(clone);
			const canvas = await html2canvas(clone, {
				scale: CAPTURE_SCALE,
				useCORS: true,
				backgroundColor: null
			});

			const imgData = canvas.toDataURL('image/png');
			const pxToMm = 25.4 / 96;
			const templateWMm = (canvas.width / CAPTURE_SCALE) * pxToMm;
			const templateHMm = (canvas.height / CAPTURE_SCALE) * pxToMm;

			const scale = Math.min(A4_W_MM / templateWMm, A4_H_MM / templateHMm, 1);
			const imgW = templateWMm * scale;
			const imgH = templateHMm * scale;
			const offsetX = (A4_W_MM - imgW) / 2;
			const offsetY = (A4_H_MM - imgH) / 2;

			const doc = new jsPDF({ unit: 'mm', format: 'a4' });
			doc.addImage(imgData, 'PNG', offsetX, offsetY, imgW, imgH);
			doc.save('promax-template.pdf');
		} finally {
			clone.remove();
		}
	} finally {
		templateEl.classList.remove(EXPORT_CLASS);
	}
}
