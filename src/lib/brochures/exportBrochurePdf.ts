import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const CAPTURE_SCALE = 2;
const A4_W_MM = 210;
const A4_H_MM = 297;

/**
 * Render an SVG `<img>` (data URI or .svg URL) to a PNG data URL.
 * html2canvas does not reliably rasterize SVG images, so we pre-convert them.
 */
async function svgSrcToPng(src: string, width: number, height: number): Promise<string> {
	const img = new Image();
	img.crossOrigin = 'anonymous';
	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve();
		img.onerror = () => reject(new Error('Failed to load SVG image'));
		img.src = src;
	});

	const scale = 3;
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not get canvas 2d context');
	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL('image/png');
}

/** Replace any SVG `<img>` elements in the tree with rasterized PNGs. */
async function rasterizeSvgImages(root: HTMLElement): Promise<void> {
	const targets = Array.from(root.querySelectorAll<HTMLImageElement>('img')).filter((img) => {
		const src = img.getAttribute('src') ?? '';
		return src.includes('image/svg') || src.toLowerCase().includes('.svg');
	});

	await Promise.all(
		targets.map(async (img) => {
			const src = img.getAttribute('src');
			if (!src) return;
			const width = img.offsetWidth || 120;
			const height = img.offsetHeight || 120;
			try {
				const dataUrl = await svgSrcToPng(src, width, height);
				img.setAttribute('src', dataUrl);
				img.removeAttribute('srcset');
			} catch (error) {
				console.warn('Brochure PDF: could not rasterize SVG image', src, error);
			}
		})
	);
}

/**
 * Export a brochure (a `.brochure` root containing `.page` sections) to a
 * multi-page A4 PDF that matches the on-screen design page-for-page.
 */
export async function exportBrochurePdf(brochureEl: HTMLElement, filename: string): Promise<void> {
	// Work on an off-screen clone so we never mutate the live UI.
	const clone = brochureEl.cloneNode(true) as HTMLElement;
	clone.style.position = 'fixed';
	clone.style.left = '-99999px';
	clone.style.top = '0';
	clone.style.margin = '0';
	clone.style.padding = '0';
	clone.style.background = '#ffffff';
	document.body.appendChild(clone);

	try {
		await rasterizeSvgImages(clone);

		const pages = Array.from(clone.querySelectorAll<HTMLElement>('.page'));
		if (pages.length === 0) {
			throw new Error('No brochure pages found to export');
		}

		const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

		for (let i = 0; i < pages.length; i++) {
			const canvas = await html2canvas(pages[i], {
				scale: CAPTURE_SCALE,
				useCORS: true,
				backgroundColor: '#ffffff',
				logging: false
			});
			const imgData = canvas.toDataURL('image/jpeg', 0.92);
			if (i > 0) doc.addPage();
			doc.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, A4_H_MM);
		}

		doc.save(filename);
	} finally {
		clone.remove();
	}
}
