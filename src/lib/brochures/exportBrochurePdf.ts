import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { base } from '$app/paths';

const CAPTURE_SCALE = 2;
const A4_W_MM = 210;
const A4_H_MM = 297;

/** Map of legacy external URLs that lacked CORS to bundled local assets. */
export const LEGACY_BROCHURE_URL_MAP: Record<string, string> = {
	'https://www.rapidsupplies.com.au/assets/images/company_logo_white.png': `${base}/brochures/shared/company_logo_white.png`,
	'https://www.rapidsupplies.com.au/assets/images/Company%20Logo%20New%20Black.png': `${base}/brochures/shared/company_logo_black.png`,
	'https://www.rapidsupplies.com.au/assets/images/Company Logo New Black.png': `${base}/brochures/shared/company_logo_black.png`,
	'https://www.rapidsupplies.com.au/assets/images/industries_industrial_and_warehousing.png': `${base}/brochures/preventative_maintenance/cover_hero.png`,
	'https://www.rapidsupplies.com.au/assets/images/preventative_maintenance_1.png': `${base}/brochures/preventative_maintenance/intro_image.png`,
	'https://www.rapidsupplies.com.au/assets/images/third_brochure.png': `${base}/brochures/preventative_maintenance/approach_image.png`,
	'https://www.rapidsupplies.com.au/assets/images/rapidclean.jpg': `${base}/brochures/preventative_maintenance/brands/rapidclean.jpg`,
	'https://rapidclean.com.au/wp-content/uploads/PoliVac.png': `${base}/brochures/preventative_maintenance/brands/polivac.png`,
	'https://rapidclean.com.au/wp-content/uploads/Nilfisk_wordmark_CMYK_Dark.png': `${base}/brochures/preventative_maintenance/brands/nilfisk.png`,
	'https://s1.kaercher-media.com/versions/2026.3.0/static/img/kaercher_logo.svg': `${base}/brochures/preventative_maintenance/brands/kaercher.svg`,
	'https://rapidclean.com.au/wp-content/uploads/Pacvac.png': `${base}/brochures/preventative_maintenance/brands/pacvac.png`,
	'https://rapidclean.com.au/wp-content/uploads/Numatic.png': `${base}/brochures/preventative_maintenance/brands/numatic.png`,
	'https://madeblue.org/wp-content/uploads/2021/09/Logo.i-team.Blue_.Pantone312C.print_.svg': `${base}/brochures/preventative_maintenance/brands/iteam.svg`,
	'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Hako-Logo.svg/500px-Hako-Logo.svg.png?_=20120116174703': `${base}/brochures/preventative_maintenance/brands/hako.png`,
	'https://www.kranzle.co.uk/files/Logo.svg': `${base}/brochures/preventative_maintenance/brands/kranzle.svg`,
	'https://www.ramcarbatteries.com/wp-content/uploads/2023/04/Ramcar-logo.png': `${base}/brochures/preventative_maintenance/brands/ramcar.png`,
	'https://www.ritarpower.com/uploads/image/20251212/ritar-power-logo.webp': `${base}/brochures/preventative_maintenance/brands/ritar.webp`
};

export function resolveBrochureImageUrl(url: string): string {
	if (!url) return url;
	return LEGACY_BROCHURE_URL_MAP[url] || url;
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error ?? new Error('Failed to read image blob'));
		reader.readAsDataURL(blob);
	});
}

/** Fetch an image URL as a data URL, using proxies when direct CORS fetch fails. */
async function fetchImageDataUrl(url: string): Promise<string | null> {
	if (!url || url.startsWith('data:')) return url || null;

	const targetUrl = resolveBrochureImageUrl(url);

	const tryFetch = async (target: string): Promise<string | null> => {
		try {
			const res = await fetch(target);
			if (!res.ok) return null;
			const blob = await res.blob();
			return await blobToDataUrl(blob);
		} catch {
			return null;
		}
	};

	// 1. Direct fetch (same origin, local assets, Supabase storage, or CORS-enabled URLs)
	const direct = await tryFetch(targetUrl);
	if (direct) return direct;

	// If relative or non-HTTP, proxy won't help
	if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
		return null;
	}

	// 2. Local dev server SvelteKit proxy route (if running in dev mode)
	const localProxy = `${base}/api/brochures/proxy-image?url=${encodeURIComponent(targetUrl)}`;
	const fromLocalProxy = await tryFetch(localProxy);
	if (fromLocalProxy) return fromLocalProxy;

	// 3. Fallback CORS-clearing image proxy for static/GitHub Pages deployment
	const externalProxy = `https://images.weserv.nl/?url=${encodeURIComponent(targetUrl)}`;
	return tryFetch(externalProxy);
}

/**
 * Render an SVG `<img>` (data URI or .svg URL) to a PNG data URL.
 * html2canvas does not reliably rasterize SVG images, so we pre-convert them.
 */
async function svgSrcToPng(src: string, width: number, height: number): Promise<string> {
	const img = new Image();
	if (src.startsWith('http://') || src.startsWith('https://')) {
		img.crossOrigin = 'anonymous';
	}
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
async function inlineImagesForCapture(root: HTMLElement, liveRoot?: HTMLElement): Promise<void> {
	const liveImgs = liveRoot ? Array.from(liveRoot.querySelectorAll<HTMLImageElement>('img')) : [];

	const imgTasks = Array.from(root.querySelectorAll<HTMLImageElement>('img')).map(async (img, idx) => {
		const src = img.getAttribute('src') ?? img.src ?? '';
		if (!src || src.startsWith('data:')) return;

		const dataUrl = await fetchImageDataUrl(src);
		if (!dataUrl) {
			console.warn('Brochure PDF: could not inline image', src);
			return;
		}

		const isSvg = dataUrl.includes('image/svg') || src.toLowerCase().includes('.svg');
		if (isSvg) {
			const liveImg = liveImgs[idx];
			const width = liveImg?.offsetWidth || img.offsetWidth || img.naturalWidth || 120;
			const height = liveImg?.offsetHeight || img.offsetHeight || img.naturalHeight || 120;
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

			// Pre-decode the data URL so the browser has decoded the background before capture
			const preloader = new Image();
			preloader.src = dataUrl;
			if ('decode' in preloader) {
				await preloader.decode().catch(() => {});
			} else {
				await new Promise<void>((resolve) => {
					preloader.onload = () => resolve();
					preloader.onerror = () => resolve();
				});
			}
		}
	);

	await Promise.all([...imgTasks, ...bgTasks]);
}

async function waitForImages(root: HTMLElement): Promise<void> {
	const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
	await Promise.all(
		imgs.map(async (img) => {
			if (img.complete && img.naturalWidth > 0) {
				return;
			}
			if ('decode' in img) {
				try {
					await img.decode();
					return;
				} catch {
					// Fall through to onload/onerror
				}
			}
			await new Promise<void>((resolve) => {
				if (img.complete && img.naturalWidth > 0) {
					resolve();
					return;
				}
				img.onload = () => resolve();
				img.onerror = () => resolve();
			});
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
	clone.style.left = '0';
	clone.style.top = '0';
	clone.style.zIndex = '-9999';
	clone.style.pointerEvents = 'none';
	clone.style.margin = '0';
	clone.style.padding = '0';
	clone.style.background = '#ffffff';
	if (brochureEl.offsetWidth) {
		clone.style.width = `${brochureEl.offsetWidth}px`;
	}
	document.body.appendChild(clone);

	try {
		await inlineImagesForCapture(clone, brochureEl);
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
