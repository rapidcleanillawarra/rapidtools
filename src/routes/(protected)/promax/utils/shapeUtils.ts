import type { Shape } from './types';

export const defaultRectWidth = 170;
export const defaultRectHeight = 173.33;
export const defaultRectBorderRadius = 0;
export const defaultCircleSize = 60;
export const defaultCircleWidth = 186.53;
export const defaultCircleHeight = 191.73;

export const minDim = 20;
export const maxDim = 800;
export const minRadius = 0;
export const maxRadius = 999;
export const minBorderWidth = 0;
export const maxBorderWidth = 20;
export const defaultShapeOffset = 24;

export function toPx(n: number | string): number {
	const v = Number(n);
	if (Number.isNaN(v)) return minDim;
	const c = Math.max(minDim, Math.min(maxDim, v));
	return Math.round(c * 100) / 100;
}

export function toRadiusPx(n: number | string): number {
	const v = Number(n);
	if (Number.isNaN(v)) return minRadius;
	const c = Math.max(minRadius, Math.min(maxRadius, v));
	return Math.round(c * 100) / 100;
}

export function getRectRadii(shape: Shape): [number, number, number, number] {
	if (shape.type !== 'rectangle') return [0, 0, 0, 0];
	const fallback = shape.borderRadius ?? 0;
	return [
		toRadiusPx(shape.borderRadiusTL ?? fallback),
		toRadiusPx(shape.borderRadiusTR ?? fallback),
		toRadiusPx(shape.borderRadiusBR ?? fallback),
		toRadiusPx(shape.borderRadiusBL ?? fallback)
	];
}

export function rectBorderRadiusCss(shape: Shape): string {
	if (shape.type === 'circle') return '50%';
	const [tl, tr, br, bl] = getRectRadii(shape);
	return `${tl}px ${tr}px ${br}px ${bl}px`;
}

export function centerPosition(
	templateWidth: number,
	templateHeight: number,
	w: number,
	h: number
): [number, number] {
	const x = Math.max(0, Math.round((templateWidth - w) / 2));
	const y = Math.max(0, Math.round((templateHeight - h) / 2));
	return [x, y];
}

export function nextLayerOrder(shapes: { order?: number }[]): number {
	if (shapes.length === 0) return 1;
	const max = Math.max(...shapes.map((s) => s.order ?? 0));
	return max + 1;
}
