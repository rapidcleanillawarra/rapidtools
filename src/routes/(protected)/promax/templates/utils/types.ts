export type ShapeType = 'rectangle' | 'circle' | 'image' | 'text';

export type Shape = {
	id: string;
	type: ShapeType;
	x: number;
	y: number;
	width: number;
	height: number;
	/** Image data URL (data:image/...). Only for type === 'image'. */
	src?: string;
	/** Text content. Only for type === 'text'. */
	text?: string;
	fontSize?: number;
	fontWeight?: string;
	fontStyle?: string;
	color?: string;
	/** @deprecated use borderRadiusTL/TR/BR/BL for rectangles */
	borderRadius?: number;
	borderRadiusTL?: number;
	borderRadiusTR?: number;
	borderRadiusBR?: number;
	borderRadiusBL?: number;
	/** Border width in px (rectangle/circle). Default 1. */
	borderWidth?: number;
	padding?: number;
	backgroundColor?: string;
	function?: 'regular' | 'dial';
	functionLink?: string;
	functionName?: string;
	order: number;
	/** Local file object before upload. Not stored in DB. */
	file?: File;
	backgroundImage?: string;
};

export type TemplateConfig = {
	width: number;
	height: number;
	borderRadius: number;
	borderWidth: number;
	backgroundColor?: string;
};
