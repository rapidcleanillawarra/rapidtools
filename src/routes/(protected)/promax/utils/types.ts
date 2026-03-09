export type ShapeType = 'rectangle' | 'circle';

export type Shape = {
	id: string;
	type: ShapeType;
	x: number;
	y: number;
	width: number;
	height: number;
	/** @deprecated use borderRadiusTL/TR/BR/BL for rectangles */
	borderRadius?: number;
	borderRadiusTL?: number;
	borderRadiusTR?: number;
	borderRadiusBR?: number;
	borderRadiusBL?: number;
	order: number;
};

export type TemplateConfig = {
	width: number;
	height: number;
	borderRadius: number;
	borderWidth: number;
};
