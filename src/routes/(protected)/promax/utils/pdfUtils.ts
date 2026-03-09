import { jsPDF } from 'jspdf';
import type { Shape, TemplateConfig } from './types';
import {
	getRectRadii,
	toPx,
	toRadiusPx,
	minBorderWidth,
	maxBorderWidth
} from './shapeUtils';

/** Build path for a rounded rectangle with per-corner radii in mm (cubic Bezier arcs, k ≈ 0.552). */
function getRoundedRectPath(
	x: number,
	y: number,
	w: number,
	h: number,
	tl: number,
	tr: number,
	br: number,
	bl: number
): { op: string; c: number[] }[] {
	const k = 0.5522847498;
	const path: { op: string; c: number[] }[] = [];
	path.push({ op: 'm', c: [x + tl, y] });
	path.push({ op: 'l', c: [x + w - tr, y] });
	if (tr > 0) {
		path.push({
			op: 'c',
			c: [x + w - tr + tr * k, y, x + w, y + tr - tr * k, x + w, y + tr]
		});
	} else {
		path.push({ op: 'l', c: [x + w, y] });
	}
	path.push({ op: 'l', c: [x + w, y + h - br] });
	if (br > 0) {
		path.push({
			op: 'c',
			c: [x + w, y + h - br + br * k, x + w - br + br * k, y + h, x + w - br, y + h]
		});
	} else {
		path.push({ op: 'l', c: [x + w, y + h] });
	}
	path.push({ op: 'l', c: [x + bl, y + h] });
	if (bl > 0) {
		path.push({
			op: 'c',
			c: [x + bl - bl * k, y + h, x, y + h - bl + bl * k, x, y + h - bl]
		});
	} else {
		path.push({ op: 'l', c: [x, y + h] });
	}
	path.push({ op: 'l', c: [x, y + tl] });
	if (tl > 0) {
		path.push({
			op: 'c',
			c: [x, y + tl - tl * k, x + tl - tl * k, y, x + tl, y]
		});
	} else {
		path.push({ op: 'l', c: [x, y] });
	}
	path.push({ op: 'h', c: [] });
	return path;
}

/** Draw a rounded rectangle with per-corner radii in mm. Uses cubic Bezier arcs (k ≈ 0.552). */
export function drawRoundedRectPath(
	doc: jsPDF,
	x: number,
	y: number,
	w: number,
	h: number,
	tl: number,
	tr: number,
	br: number,
	bl: number,
	style: 'FD' | 'F' | 'S'
) {
	const path = getRoundedRectPath(x, y, w, h, tl, tr, br, bl);
	doc.path(path, style);
}

export function exportPdf(
	templateConfig: TemplateConfig,
	templateContents: Shape[]
) {
	const w = toPx(templateConfig.width);
	const h = toPx(templateConfig.height);
	const br = toRadiusPx(templateConfig.borderRadius);
	const pxToMm = 25.4 / 96;
	const wMm = w * pxToMm;
	const hMm = h * pxToMm;
	const brMm = br * pxToMm;
	const doc = new jsPDF({ unit: 'mm', format: 'a4' });
	// No page fill — exported PDF has transparent background
	const offsetX = (210 - wMm) / 2;
	const offsetY = (297 - hMm) / 2;
	doc.saveGraphicsState();
	// Clip to the same rounded rect as the template border so only one border is visible
	const clipPath = getRoundedRectPath(offsetX, offsetY, wMm, hMm, brMm, brMm, brMm, brMm);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- path with null = add path for clipping only, no stroke/fill
	doc.path(clipPath, null as any);
	doc.clip();
	// No fill — template background is transparent
	const sorted = [...templateContents].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	const shapeFill = [229, 231, 235] as [number, number, number];
	const shapeStroke = [156, 163, 175] as [number, number, number];
	for (const shape of sorted) {
		const sx = shape.x * pxToMm + offsetX;
		const sy = shape.y * pxToMm + offsetY;
		const sw = shape.width * pxToMm;
		const sh = shape.height * pxToMm;
		if (shape.type === 'image' && shape.src) {
			const format = shape.src.startsWith('data:image/png') ? 'PNG' : 'JPEG';
			doc.addImage(shape.src, format, sx, sy, sw, sh);
		} else {
			doc.setFillColor(...shapeFill);
			doc.setDrawColor(...shapeStroke);
			doc.setLineWidth(1 * pxToMm);
			if (shape.type === 'circle') {
				const cx = sx + sw / 2;
				const cy = sy + sh / 2;
				const rx = sw / 2;
				const ry = sh / 2;
				doc.ellipse(cx, cy, rx, ry, 'FD');
			} else {
				const [tl, tr, brR, bl] = getRectRadii(shape);
				const tlMm = tl * pxToMm;
				const trMm = tr * pxToMm;
				const brMmShape = brR * pxToMm;
				const blMm = bl * pxToMm;
				const hasAnyRadius = tlMm > 0 || trMm > 0 || brMmShape > 0 || blMm > 0;
				if (hasAnyRadius) {
					drawRoundedRectPath(doc, sx, sy, sw, sh, tlMm, trMm, brMmShape, blMm, 'FD');
				} else {
					doc.rect(sx, sy, sw, sh, 'FD');
				}
			}
		}
	}
	doc.restoreGraphicsState();
	const borderWidthPx = Math.max(
		minBorderWidth,
		Math.min(maxBorderWidth, Number(templateConfig.borderWidth) ?? 0)
	);
	if (borderWidthPx > 0) {
		doc.setDrawColor(156, 163, 175);
		doc.setLineWidth(borderWidthPx * pxToMm);
		doc.setLineJoin('round');
		doc.roundedRect(offsetX, offsetY, wMm, hMm, brMm, brMm, 'S');
	}
	doc.save('promax-template.pdf');
}
