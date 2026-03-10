<script lang="ts">
	import type { Shape, TemplateConfig } from './utils/types';
	import {
		getRectRadii,
		toPx,
		toRadiusPx,
		toBorderWidthPx,
		centerPosition,
		nextLayerOrder,
		defaultRectWidth,
		defaultRectHeight,
		defaultRectBorderRadius,
		defaultCircleWidth,
		defaultCircleHeight,
		defaultImageWidth,
		defaultImageHeight,
		defaultTextWidth,
		defaultTextHeight,
		defaultTextPadding,
		defaultFontSize,
		toPaddingPx,
		defaultShapeBorderWidth,
		defaultTemplateBackgroundColor,
		defaultShapeBackgroundColor,
		minDim
	} from './utils/shapeUtils';
	import { exportPdf } from './utils/pdfUtils';
	import TemplateControls from './components/TemplateControls.svelte';
	import AddShapeControls from './components/AddShapeControls.svelte';
	import LayerList from './components/LayerList.svelte';
	import EditShapePanel from './components/EditShapePanel.svelte';
	import PreviewToolbar from './components/PreviewToolbar.svelte';
	import TemplateCanvas from './components/TemplateCanvas.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { supabase } from '$lib/supabase';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let template_config = $state<TemplateConfig>({
		width: 358.9,
		height: 850.93,
		borderRadius: 25,
		borderWidth: 0,
		backgroundColor: defaultTemplateBackgroundColor
	});

	let template_contents = $state<Shape[]>([]);

	let templateName = $state('');

	let openModalOpen = $state(false);
	type TemplateRow = {
		id: string;
		name: string;
		created_at?: string;
		template: { config: TemplateConfig; contents: Shape[] } | null;
	};
	let templatesList = $state<TemplateRow[]>([]);
	let templatesLoading = $state(false);

	const templateId = $derived($page.url.searchParams.get('id') ?? null);
	let templateLoadError = $state<string | null>(null);

	let templateEl = $state<HTMLDivElement | null>(null);
	let dragging = $state<{
		shapeId: string;
		offsetX: number;
		offsetY: number;
		hasMoved: boolean;
	} | null>(null);
	let resizing = $state<{
		shapeId: string;
		handle: string;
		startWidth: number;
		startHeight: number;
		startX: number;
		startY: number;
		mouseStartX: number;
		mouseStartY: number;
	} | null>(null);
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
	let editBorderWidth = $state(1);
	let editText = $state('');
	let editFontSize = $state(defaultFontSize);
	let editFontWeight = $state('normal');
	let editFontStyle = $state('normal');
	let editColor = $state('#000000');
	let editPadding = $state(defaultTextPadding);
	let editFunction = $state<'regular' | 'dial'>('regular');

	const selectedShape = $derived(template_contents.find((s) => s.id === selectedShapeId) ?? null);

	function addText() {
		const templateW = toPx(template_config.width);
		const templateH = toPx(template_config.height);
		const w = defaultTextWidth;
		const h = defaultTextHeight;
		const [x, y] = centerPosition(templateW, templateH, w, h);
		const nextOrder = nextLayerOrder(template_contents);
		const newShape: Shape = {
			id: crypto.randomUUID(),
			type: 'text',
			x,
			y,
			width: w,
			height: h,
			text: 'Double click to edit',
			fontSize: defaultFontSize,
			fontWeight: 'normal',
			fontStyle: 'normal',
			color: '#000000',
			padding: defaultTextPadding,
			order: nextOrder
		};
		template_contents = [...template_contents, newShape];
	}

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
			borderWidth: defaultShapeBorderWidth,
			backgroundColor: defaultShapeBackgroundColor,
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
			borderWidth: defaultShapeBorderWidth,
			backgroundColor: defaultShapeBackgroundColor,
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
			borderRadiusTL: 0,
			borderRadiusTR: 0,
			borderRadiusBR: 0,
			borderRadiusBL: 0,
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
		resizing = null;
	}

	function startResize(e: MouseEvent | TouchEvent, shape: Shape, handle: string) {
		e.preventDefault();
		e.stopPropagation();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		resizing = {
			shapeId: shape.id,
			handle,
			startWidth: shape.width,
			startHeight: shape.height,
			startX: shape.x,
			startY: shape.y,
			mouseStartX: clientX,
			mouseStartY: clientY
		};
		selectedShapeId = shape.id;
	}

	function onResizeMove(e: MouseEvent | TouchEvent) {
		const r = resizing;
		if (!r || !templateEl) return;
		if ('touches' in e) e.preventDefault();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

		const dx = clientX - r.mouseStartX;
		const dy = clientY - r.mouseStartY;

		const templateW = toPx(template_config.width);
		const templateH = toPx(template_config.height);

		template_contents = template_contents.map((s) => {
			if (s.id !== r.shapeId) return s;

			let nextX = r.startX;
			let nextY = r.startY;
			let nextW = r.startWidth;
			let nextH = r.startHeight;

			// Horizontal resizing
			if (r.handle.includes('l')) {
				const availableWidth = r.startX + r.startWidth;
				nextW = Math.max(minDim, r.startWidth - dx);
				if (nextW === minDim) {
					nextX = availableWidth - minDim;
				} else {
					nextX = r.startX + dx;
				}
			} else if (r.handle.includes('r')) {
				nextW = Math.max(minDim, r.startWidth + dx);
			}

			// Vertical resizing
			if (r.handle.includes('t')) {
				const availableHeight = r.startY + r.startHeight;
				nextH = Math.max(minDim, r.startHeight - dy);
				if (nextH === minDim) {
					nextY = availableHeight - minDim;
				} else {
					nextY = r.startY + dy;
				}
			} else if (r.handle.includes('b')) {
				nextH = Math.max(minDim, r.startHeight + dy);
			}

			// Constrain to template bounds
			if (nextX < 0) {
				nextW += nextX;
				nextX = 0;
			}
			if (nextY < 0) {
				nextH += nextY;
				nextY = 0;
			}
			if (nextX + nextW > templateW) {
				nextW = templateW - nextX;
			}
			if (nextY + nextH > templateH) {
				nextH = templateH - nextY;
			}

			return {
				...s,
				x: Math.round(nextX * 100) / 100,
				y: Math.round(nextY * 100) / 100,
				width: Math.round(nextW * 100) / 100,
				height: Math.round(nextH * 100) / 100
			};
		});
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
				| 'borderWidth'
				| 'backgroundColor'
				| 'x'
				| 'y'
				| 'order'
				| 'text'
				| 'fontSize'
				| 'fontWeight'
				| 'fontStyle'
				| 'color'
				| 'padding'
				| 'function'
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
			if (next.borderWidth !== undefined) next.borderWidth = toBorderWidthPx(next.borderWidth);
			if (next.padding !== undefined) next.padding = toPaddingPx(next.padding);
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

	function handleLayersReordered(newShapes: Shape[]) {
		template_contents = [...newShapes];
	}

	async function doExportPdf() {
		if (!templateEl) return;
		await exportPdf(templateEl);
	}

	let isSaving = $state(false);
	async function saveTemplate() {
		const name = templateName.trim() || 'Untitled template';
		isSaving = true;
		try {
			if (templateId) {
				const { error } = await supabase
					.from('promax_templates')
					.update({
						name,
						template: { config: template_config, contents: template_contents }
					})
					.eq('id', templateId);
				if (error) throw error;
				toastSuccess(`Template "${name}" updated`);
			} else {
				const { error } = await supabase.from('promax_templates').insert({
					name,
					template: { config: template_config, contents: template_contents }
				});
				if (error) throw error;
				toastSuccess(`Template "${name}" saved`);
			}
		} catch (e) {
			toastError(e instanceof Error ? e.message : 'Failed to save template');
		} finally {
			isSaving = false;
		}
	}

	async function fetchTemplates() {
		templatesLoading = true;
		try {
			const { data, error } = await supabase
				.from('promax_templates')
				.select('id, name, created_at, template')
				.is('deleted_at', null)
				.order('created_at', { ascending: false });
			if (error) throw error;
			templatesList = (data ?? []) as TemplateRow[];
		} catch (e) {
			toastError(e instanceof Error ? e.message : 'Failed to load templates');
		} finally {
			templatesLoading = false;
		}
	}

	async function openTemplatesModal() {
		await fetchTemplates();
		openModalOpen = true;
	}

	function selectTemplate(item: TemplateRow) {
		if (!item.template?.config || !item.template?.contents) {
			toastError('No template data');
			return;
		}
		openModalOpen = false;
		goto(`/promax/templates?id=${item.id}`);
	}

	let deletingId = $state<string | null>(null);
	async function softDeleteTemplate(e: Event, item: TemplateRow) {
		e.stopPropagation();
		if (deletingId) return;
		deletingId = item.id;
		try {
			const { error } = await supabase
				.from('promax_templates')
				.update({ deleted_at: new Date().toISOString() })
				.eq('id', item.id);
			if (error) throw error;
			toastSuccess(`Template "${item.name}" deleted`);
			templatesList = templatesList.filter((t) => t.id !== item.id);
		} catch (err) {
			toastError(err instanceof Error ? err.message : 'Failed to delete template');
		} finally {
			deletingId = null;
		}
	}

	function formatCreatedAt(created_at: string | undefined): string {
		if (!created_at) return '—';
		const d = new Date(created_at);
		return d.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	$effect(() => {
		const id = templateId;
		if (!id) return;
		let cancelled = false;
		templateLoadError = null;
		(async () => {
			const { data, error } = await supabase
				.from('promax_templates')
				.select('id, name, template')
				.eq('id', id)
				.is('deleted_at', null)
				.maybeSingle();
			if (cancelled) return;
			if (error) {
				templateLoadError = error.message;
				toastError(error.message);
				return;
			}
			const row = data as TemplateRow | null;
			if (!row?.template?.config || !row.template.contents) {
				templateLoadError = 'Template not found';
				toastError('Template not found');
				return;
			}
			template_config = row.template.config;
			template_contents = JSON.parse(JSON.stringify(row.template.contents)) as Shape[];
			templateName = row.name;
			toastSuccess('Template loaded');
		})();
		return () => {
			cancelled = true;
		};
	});

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
			editBorderWidth = toBorderWidthPx(shape.borderWidth);
			editText = shape.text ?? '';
			editFontSize = shape.fontSize ?? defaultFontSize;
			editFontWeight = shape.fontWeight ?? 'normal';
			editFontStyle = shape.fontStyle ?? 'normal';
			editColor = shape.color ?? '#000000';
			editPadding = shape.padding ?? defaultTextPadding;
			editFunction = shape.function ?? 'regular';
		}
	});

	$effect(() => {
		if (!dragging && !resizing) return;
		const onMove = (e: MouseEvent | TouchEvent) => {
			if (dragging) onDragMove(e);
			if (resizing) onResizeMove(e);
		};
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
		<div class="controls template-name-section">
			<label for="template-name">
				<span class="control-heading">Template name</span>
				<input
					id="template-name"
					type="text"
					placeholder="e.g. Main label"
					bind:value={templateName}
				/>
			</label>
		</div>
		<TemplateControls bind:templateConfig={template_config} />
		<AddShapeControls
			onAddRectangle={addRectangle}
			onAddCircle={addCircle}
			onAddImage={addImage}
			onAddText={addText}
		/>
		<LayerList
			shapes={template_contents}
			{selectedShapeId}
			onSelect={(id) => selectedShapeId = id}
			onReorder={handleLayersReordered}
		/>
	</aside>
	<main class="preview">
		<PreviewToolbar
			onExport={doExportPdf}
			onOpen={openTemplatesModal}
			onSave={saveTemplate}
			{isSaving}
			saveLabel={templateId ? 'Update' : 'Save'}
		/>
		<TemplateCanvas
			bind:templateEl
			templateConfig={template_config}
			templateContents={template_contents}
			{selectedShapeId}
			{dragging}
			onStartDrag={startDrag}
			onStartResize={startResize}
			onBackgroundClick={deselectShape}
		/>
	</main>
	<aside class="sidebar sidebar-right">
		{#if selectedShape}
			<EditShapePanel
				{selectedShape}
				bind:editX
				bind:editY
				bind:editWidth
				bind:editHeight
				bind:editBorderRadiusTL
				bind:editBorderRadiusTR
				bind:editBorderRadiusBR
				bind:editBorderRadiusBL
				bind:editBorderWidth
				bind:editOrder
				bind:editText
				bind:editFontSize
				bind:editFontWeight
				bind:editFontStyle
				bind:editColor
				bind:editPadding
				bind:editFunction
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

<Modal show={openModalOpen} allowClose={true} size="md" on:close={() => (openModalOpen = false)}>
	<svelte:fragment slot="header">Open template</svelte:fragment>
	<div slot="body" class="open-modal-body">
		{#if templatesLoading}
			<p class="open-modal-message">Loading…</p>
		{:else if templatesList.length === 0}
			<p class="open-modal-message">No templates saved yet.</p>
		{:else}
			<ul class="open-modal-list">
				{#each templatesList as item (item.id)}
					<li>
						<div class="open-modal-row">
							<button
								type="button"
								class="open-modal-row-main"
								onclick={() => selectTemplate(item)}
							>
								<span class="open-modal-name">{item.name}</span>
								<span class="open-modal-template">
									{item.template?.config
										? `${item.template.config.width} × ${item.template.config.height}`
										: 'No template data'}
								</span>
								{#if item.created_at}
									<span class="open-modal-created">Created {formatCreatedAt(item.created_at)}</span>
								{/if}
							</button>
							<button
								type="button"
								class="open-modal-delete"
								title="Delete template"
								aria-label="Delete template"
								disabled={deletingId === item.id}
								onclick={(e) => softDeleteTemplate(e, item)}
							>
								{#if deletingId === item.id}
									<span class="open-modal-delete-spinner" aria-hidden="true"></span>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
											d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
										/><line x1="10" x2="10" y1="11" y2="17" /><line
											x1="14"
											x2="14"
											y1="11"
											y2="17"
										/></svg
									>
								{/if}
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</Modal>

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

	.template-name-section .control-heading {
		display: block;
		margin: 0 0 0.25rem 0;
		font-size: 0.75rem;
		font-weight: 600;
		color: #1f2937;
	}

	.template-name-section label {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		font-size: 0.75rem;
		color: #374151;
	}

	.template-name-section input {
		width: 100%;
		padding: 0.25rem 0.375rem;
		border: 1px solid #9ca3af;
		border-radius: 0.25rem;
		font-size: 0.75rem;
	}

	.template-name-section input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgb(59 130 246 / 0.2);
	}

	.open-modal-body {
		min-height: 2rem;
	}

	.open-modal-message {
		color: #6b7280;
		font-size: 0.875rem;
		margin: 0;
	}

	.open-modal-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.open-modal-row {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		padding: 0;
		border: 1px solid #e5e7eb;
		border-radius: 0.375rem;
		background: #f9fafb;
		overflow: hidden;
	}

	.open-modal-row-main {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.125rem;
		flex: 1;
		min-width: 0;
		padding: 0.5rem 0.75rem;
		text-align: left;
		font-size: 0.875rem;
		border: none;
		border-radius: 0;
		background: transparent;
		color: #374151;
		cursor: pointer;
	}

	.open-modal-row-main:hover {
		background: #f3f4f6;
	}

	.open-modal-row:hover {
		border-color: #9ca3af;
	}

	.open-modal-delete {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: 0.25rem;
		background: transparent;
		color: #6b7280;
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s;
	}

	.open-modal-delete:hover:not(:disabled) {
		color: #dc2626;
		background: #fef2f2;
	}

	.open-modal-delete:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}

	.open-modal-delete-spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid #e5e7eb;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: open-modal-spin 0.6s linear infinite;
	}

	@keyframes open-modal-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.open-modal-created {
		font-size: 0.7rem;
		color: #9ca3af;
		margin-top: 0.125rem;
	}

	.open-modal-row:hover {
		background: #f3f4f6;
		border-color: #9ca3af;
	}

	.open-modal-name {
		font-weight: 600;
	}

	.open-modal-template {
		font-size: 0.75rem;
		color: #6b7280;
	}
</style>
