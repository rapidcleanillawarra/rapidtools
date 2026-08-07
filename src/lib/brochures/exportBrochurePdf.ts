import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const CAPTURE_SCALE = 2;
const A4_W_MM = 210;
const A4_H_MM = 297;

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error ?? new Error('Failed to read image blob'));
		reader.readAsDataURL(blob);
	});
}

/** Fetch an image URL as a data URL, using the brochure proxy when direct CORS fetch fails. */
async function fetchImageDataUrl(url: string): Promise<string | null> {
	if (!url || url.startsWith('data:')) return url || null;

	const tryFetch = async (target: string): Promise<string | null> => {
		try {
			const res = await fetch(target);
			if (!res.ok) return null;
			const blob = await res.blob();
			if (!blob.type.startsWith('image/') && !blob.type.includes('svg')) {
				// Some hosts omit content-type; still try to read as data URL.
			}
			return await blobToDataUrl(blob);
		} catch {
			return null;
		}
	};

	const direct = await tryFetch(url);
	if (direct) return direct;

	const proxyUrl = `/api/brochures/proxy-image?url=${encodeURIComponent(url)}`;
	return tryFetch(proxyUrl);
}

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

function extractBackgroundUrl(style: string): string | null {
	const match = style.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i);
	return match?.[1]?.trim() || null;
}

/** Replace external <img> sources and CSS background-images with data URLs. */
async function inlineImagesForCapture(root: HTMLElement): Promise<void> {
	const imgTasks = Array.from(root.querySelectorAll<HTMLImageElement>('img')).map(async (img) => {
		const src = img.getAttribute('src') ?? img.src ?? '';
		if (!src || src.startsWith('data:')) return;

		const dataUrl = await fetchImageDataUrl(src);
		if (!dataUrl) {
			console.warn('Brochure PDF: could not inline image', src);
			return;
		}

		const isSvg = dataUrl.includes('image/svg') || src.toLowerCase().includes('.svg');
		if (isSvg) {
			const width = img.offsetWidth || img.naturalWidth || 120;
			const height = img.offsetHeight || img.naturalHeight || 120;
			try {
				img.src = await svgSrcToPng(dataUrl, width, height);
			} catch (error) {
				console.warn('Brochure PDF: could not rasterize SVG image', src, error);
				img.src = dataUrl;
			}
		} else {
			img.src = dataUrl;
		}
		img.removeAttribute('srcset');
	});

	const bgTasks = Array.from(root.querySelectorAll<HTMLElement>('[style*="background-image"]')).map(
		async (el) => {
			const style = el.getAttribute('style') ?? '';
			const url = extractBackgroundUrl(style);
			if (!url || url.startsWith('data:')) return;

			const dataUrl = await fetchImageDataUrl(url);
			if (!dataUrl) {
				console.warn('Brochure PDF: could not inline background image', url);
				return;
			}

			el.style.backgroundImage = `url("${dataUrl}")`;
		}
	);

	await Promise.all([...imgTasks, ...bgTasks]);
}

async function waitForImages(root: HTMLElement): Promise<void> {
	const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
	await Promise.all(
		imgs.map(
			(img) =>
				new Promise<void>((resolve) => {
					if (img.complete) {
						resolve();
						return;
					}
					img.onload = () => resolve();
					img.onerror = () => resolve();
				})
		)
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
		await inlineImagesForCapture(clone);
		await waitForImages(clone);

		const pages = Array.from(clone.querySelectorAll<HTMLElement>('.page'));
		if (pages.length === 0) {
			throw new Error('No brochure pages found to export');
		}

		const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

		for (let i = 0; i < pages.length; i++) {
			const canvas = await html2canvas(pages[i], {
				scale: CAPTURE_SCALE,
				useCORS: true,
				allowTaint: false,
				backgroundColor: '#ffffff',
				logging: false,
				imageTimeout: 15000
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
