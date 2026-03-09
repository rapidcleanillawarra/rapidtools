<script lang="ts">
	import type { Shape, TemplateConfig } from './utils/types';
	import {
		getRectRadii,
		toPx,
		toRadiusPx,
		centerPosition,
		nextLayerOrder,
		defaultRectWidth,
		defaultRectHeight,
		defaultRectBorderRadius,
		defaultCircleWidth,
		defaultCircleHeight,
		defaultImageWidth,
		defaultImageHeight,
		minDim
	} from './utils/shapeUtils';
	import { exportPdf as doExportPdf } from './utils/pdfUtils';
	import TemplateControls from './components/TemplateControls.svelte';
	import AddShapeControls from './components/AddShapeControls.svelte';
	import EditShapePanel from './components/EditShapePanel.svelte';
	import PreviewToolbar from './components/PreviewToolbar.svelte';
	import TemplateCanvas from './components/TemplateCanvas.svelte';

	let template_config = $state<TemplateConfig>({
		width: 358.9,
		height: 850.93,
		borderRadius: 25,
		borderWidth: 0
	});

	let template_contents = $state<Shape[]>([]);

	let templateEl = $state<HTMLDivElement | null>(null);
	let dragging = $state<{ shapeId: string; offsetX: number; offsetY: number; hasMoved: boolean } | null>(null);
	let selectedShapeId = $state<string | null>(null);

	let editX = $state(0);
	let editY = $state(0);
	let editWidth = $state(0);
	let editHeight = $state(0);
	let editBorderRadiusTL = $state(0);
	let editBorderRadiusTR = $state(0);
	let editBorderRadiusBR = $state(0);
	let editBorderRadiusBL = $state(0);
	let editOrder = $state(0);

	const selectedShape = $derived(template_contents.find((s) => s.id === selectedShapeId) ?? null);

	function addRectangle() {
		const templateW = toPx(template_config.width);
		const templateH = toPx(template_config.height);
		const w = defaultRectWidth;
		const h = defaultRectHeight;
		const br = defaultRectBorderRadius;
		const [x, y] = centerPosition(templateW, templateH, w, h);
		const nextOrder = nextLayerOrder(template_contents);
		const newShape: Shape = {
			id: crypto.randomUUID(),
			type: 'rectangle',
			x,
			y,
			width: w,
			height: h,
			borderRadiusTL: br,
			borderRadiusTR: br,
			borderRadiusBR: br,
			borderRadiusBL: br,
			order: nextOrder
		};
		template_contents = [...template_contents, newShape];
	}

	function addCircle() {
		const templateW = toPx(template_config.width);
		const templateH = toPx(template_config.height);
		const w = defaultCircleWidth;
		const h = defaultCircleHeight;
		const [x, y] = centerPosition(templateW, templateH, w, h);
		const nextOrder = nextLayerOrder(template_contents);
		const newShape: Shape = {
			id: crypto.randomUUID(),
			type: 'circle',
			x,
			y,
			width: w,
			height: h,
			borderRadius: 0,
			order: nextOrder
		};
		template_contents = [...template_contents, newShape];
	}

	function addImage(dataUrl: string, naturalWidth: number, naturalHeight: number) {
		const templateW = toPx(template_config.width);
		const templateH = toPx(template_config.height);
		const w = Math.min(defaultImageWidth, naturalWidth, templateW - 40);
		const h = Math.min(defaultImageHeight, naturalHeight, templateH - 40);
		const [x, y] = centerPosition(templateW, templateH, w, h);
		const nextOrder = nextLayerOrder(template_contents);
		const newShape: Shape = {
			id: crypto.randomUUID(),
			type: 'image',
			x,
			y,
			width: Math.max(minDim, w),
			height: Math.max(minDim, h),
			src: dataUrl,
			order: nextOrder
		};
		template_contents = [...template_contents, newShape];
	}

	function removeShape(id: string) {
		if (id === selectedShapeId) selectedShapeId = null;
		template_contents = template_contents.filter((s) => s.id !== id);
	}

	function duplicateShape(id: string) {
		const source = template_contents.find((s) => s.id === id);
		if (!source) return;
		const templateW = toPx(template_config.width);
		const templateH = toPx(template_config.height);
		const offset = 20;
		let newX = source.x + offset;
		let newY = source.y + offset;
		newX = Math.max(0, Math.min(templateW - source.width, newX));
		newY = Math.max(0, Math.min(templateH - source.height, newY));
		const nextOrder = nextLayerOrder(template_contents);
		const copy: Shape = {
			...source,
			id: crypto.randomUUID(),
			x: Math.round(newX * 100) / 100,
			y: Math.round(newY * 100) / 100,
			order: nextOrder
		};
		template_contents = [...template_contents, copy];
		selectedShapeId = copy.id;
	}

	function startDrag(e: MouseEvent | TouchEvent, shape: Shape) {
		e.preventDefault();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		if (!templateEl) return;
		const rect = templateEl.getBoundingClientRect();
		dragging = {
			shapeId: shape.id,
			offsetX: clientX - rect.left - shape.x,
			offsetY: clientY - rect.top - shape.y,
			hasMoved: false
		};
	}

	function onDragMove(e: MouseEvent | TouchEvent) {
		const d = dragging;
		if (!d || !templateEl) return;
		if ('touches' in e) e.preventDefault();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		const rect = templateEl.getBoundingClientRect();
		const templateW = toPx(template_config.width);
		const templateH = toPx(template_config.height);
		const shape = template_contents.find((s) => s.id === d.shapeId);
		if (!shape) return;
		let newX = clientX - rect.left - d.offsetX;
		let newY = clientY - rect.top - d.offsetY;
		newX = Math.max(0, Math.min(templateW - shape.width, newX));
		newY = Math.max(0, Math.min(templateH - shape.height, newY));
		template_contents = template_contents.map((s) =>
			s.id === d.shapeId
				? { ...s, x: Math.round(newX * 100) / 100, y: Math.round(newY * 100) / 100 }
				: s
		);
		dragging = { ...d, hasMoved: true };
	}

	function endDrag() {
		const d = dragging;
		if (d && !d.hasMoved) selectedShapeId = d.shapeId;
		dragging = null;
	}

	function updateSelectedShape(
		updates: Partial<
			Pick<
				Shape,
				| 'width'
				| 'height'
				| 'borderRadiusTL'
				| 'borderRadiusTR'
				| 'borderRadiusBR'
				| 'borderRadiusBL'
				| 'x'
				| 'y'
				| 'order'
			>
		>
	) {
		if (!selectedShapeId) return;
		const templateW = toPx(template_config.width);
		const templateH = toPx(template_config.height);
		const nextContents = template_contents.map((s) => {
			if (s.id !== selectedShapeId) return s;
			const next = { ...s, ...updates };
			next.width = toPx(next.width);
			next.height = toPx(next.height);
			if (next.borderRadiusTL !== undefined) next.borderRadiusTL = toRadiusPx(next.borderRadiusTL);
			if (next.borderRadiusTR !== undefined) next.borderRadiusTR = toRadiusPx(next.borderRadiusTR);
			if (next.borderRadiusBR !== undefined) next.borderRadiusBR = toRadiusPx(next.borderRadiusBR);
			if (next.borderRadiusBL !== undefined) next.borderRadiusBL = toRadiusPx(next.borderRadiusBL);
			next.x = Math.max(0, Math.min(templateW - next.width, next.x));
			next.y = Math.max(0, Math.min(templateH - next.height, next.y));
			if (next.order !== undefined) next.order = Math.round(Number(next.order)) || 0;
			return next;
		});
		template_contents = nextContents;
	}

	function deselectShape() {
		selectedShapeId = null;
	}

	function exportPdf() {
		doExportPdf(template_config, template_contents);
	}

	$effect(() => {
		const shape = selectedShape;
		if (shape) {
			editX = shape.x;
			editY = shape.y;
			editWidth = shape.width;
			editHeight = shape.height;
			const [tl, tr, br, bl] = getRectRadii(shape);
			editBorderRadiusTL = tl;
			editBorderRadiusTR = tr;
			editBorderRadiusBR = br;
			editBorderRadiusBL = bl;
			editOrder = shape.order ?? 0;
		}
	});

	$effect(() => {
		if (!dragging) return;
		const onMove = (e: MouseEvent | TouchEvent) => onDragMove(e);
		const onEnd = () => endDrag();
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onEnd);
		window.addEventListener('touchmove', onMove, { passive: false });
		window.addEventListener('touchend', onEnd);
		return () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onEnd);
			window.removeEventListener('touchmove', onMove);
			window.removeEventListener('touchend', onEnd);
		};
	});
</script>

<div class="promax-page">
	<aside class="sidebar sidebar-left">
		<TemplateControls bind:templateConfig={template_config} />
		<AddShapeControls
			onAddRectangle={addRectangle}
			onAddCircle={addCircle}
			onAddImage={addImage}
		/>
	</aside>
	<main class="preview">
		<PreviewToolbar onExport={exportPdf} />
		<TemplateCanvas
			bind:templateEl
			templateConfig={template_config}
			templateContents={template_contents}
			selectedShapeId={selectedShapeId}
			dragging={dragging}
			onStartDrag={startDrag}
		/>
	</main>
	<aside class="sidebar sidebar-right">
		{#if selectedShape}
			<EditShapePanel
				selectedShape={selectedShape}
				bind:editX
				bind:editY
				bind:editWidth
				bind:editHeight
				bind:editBorderRadiusTL
				bind:editBorderRadiusTR
				bind:editBorderRadiusBR
				bind:editBorderRadiusBL
				bind:editOrder
				onUpdateShape={updateSelectedShape}
				onDeselect={deselectShape}
				onDuplicate={() => selectedShapeId && duplicateShape(selectedShapeId)}
				onDelete={() => selectedShapeId && removeShape(selectedShapeId)}
			/>
		{:else}
			<div class="edit-panel-placeholder">Select a shape to edit</div>
		{/if}
	</aside>
</div>

<style>
	.promax-page {
		margin: 0;
		padding: 0;
		min-height: 100vh;
		display: grid;
		grid-template-columns: minmax(0, 220px) 1fr minmax(0, 220px);
		gap: 1.5rem;
		align-items: start;
		padding: 1.5rem;
	}

	.sidebar {
		position: sticky;
		top: 1.5rem;
	}

	.sidebar-right {
		grid-column: 3;
	}

	.edit-panel-placeholder {
		color: #6b7280;
		font-size: 0.875rem;
		padding: 1rem;
		text-align: center;
	}

	.sidebar :global(.controls + .controls) {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e5e7eb;
	}

	.preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 80vh;
		padding: 1rem;
		gap: 1rem;
	}
</style>