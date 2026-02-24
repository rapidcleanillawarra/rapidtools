<script lang="ts">
	type ShapeType = 'rectangle' | 'circle';
	type Shape = {
		id: string;
		type: ShapeType;
		x: number;
		y: number;
		width: number;
		height: number;
		borderRadius: number;
	};

	let template_config = $state({
		width: 340,
		height: 813.13,
		borderRadius: 25
	});

	let template_contents = $state<Shape[]>([]);

	let templateEl = $state<HTMLDivElement | null>(null);
	let dragging = $state<{ shapeId: string; offsetX: number; offsetY: number; hasMoved: boolean } | null>(null);
	let selectedShapeId = $state<string | null>(null);

	// Local edit values for shape inputs (applied on blur)
	let editX = $state(0);
	let editY = $state(0);
	let editWidth = $state(0);
	let editHeight = $state(0);
	let editBorderRadius = $state(0);

	const selectedShape = $derived(template_contents.find((s) => s.id === selectedShapeId) ?? null);

	const defaultRectWidth = 120;
	const defaultRectHeight = 80;
	const defaultRectBorderRadius = 8;
	const defaultCircleSize = 60;

	const minDim = 20;
	const maxDim = 800;
	const minRadius = 0;
	const maxRadius = 999;
	const defaultShapeOffset = 24;

	function toPx(n: number | string): number {
		const v = Number(n);
		if (Number.isNaN(v)) return minDim;
		const c = Math.max(minDim, Math.min(maxDim, v));
		return Math.round(c * 100) / 100;
	}

	function toRadiusPx(n: number | string): number {
		const v = Number(n);
		if (Number.isNaN(v)) return minRadius;
		const c = Math.max(minRadius, Math.min(maxRadius, v));
		return Math.round(c * 100) / 100;
	}

	function addRectangle() {
		console.log('[promax] addRectangle called', { countBefore: template_contents.length });
		const w = defaultRectWidth;
		const h = defaultRectHeight;
		const br = defaultRectBorderRadius;
		const [x, y] = centerPosition(w, h);
		const newShape = {
			id: crypto.randomUUID(),
			type: 'rectangle' as const,
			x,
			y,
			width: w,
			height: h,
			borderRadius: br
		};
		template_contents = [...template_contents, newShape];
		console.log('[promax] rectangle added', { id: newShape.id, x, y, countAfter: template_contents.length });
	}

	function addCircle() {
		console.log('[promax] addCircle called', { countBefore: template_contents.length });
		const size = defaultCircleSize;
		const [x, y] = centerPosition(size, size);
		const newShape = {
			id: crypto.randomUUID(),
			type: 'circle' as const,
			x,
			y,
			width: size,
			height: size,
			borderRadius: 0
		};
		template_contents = [...template_contents, newShape];
		console.log('[promax] circle added', { id: newShape.id, x, y, countAfter: template_contents.length });
	}

	function centerPosition(w: number, h: number): [number, number] {
		const templateW = toPx(template_config.width);
		const templateH = toPx(template_config.height);
		const x = Math.max(0, Math.round((templateW - w) / 2));
		const y = Math.max(0, Math.round((templateH - h) / 2));
		return [x, y];
	}

	function removeShape(id: string) {
		if (id === selectedShapeId) selectedShapeId = null;
		template_contents = template_contents.filter((s) => s.id !== id);
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

	function updateSelectedShape(updates: Partial<Pick<Shape, 'width' | 'height' | 'borderRadius' | 'x' | 'y'>>) {
		console.log('[promax] updateSelectedShape called', { selectedShapeId, updates, count: template_contents.length });
		if (!selectedShapeId) return;
		const templateW = toPx(template_config.width);
		const templateH = toPx(template_config.height);
		const nextContents = template_contents.map((s) => {
			if (s.id !== selectedShapeId) return s;
			const next = { ...s, ...updates };
			next.width = toPx(next.width);
			next.height = toPx(next.height);
			if (next.borderRadius !== undefined) next.borderRadius = toRadiusPx(next.borderRadius);
			next.x = Math.max(0, Math.min(templateW - next.width, next.x));
			next.y = Math.max(0, Math.min(templateH - next.height, next.y));
			return next;
		});
		template_contents = nextContents;
		console.log('[promax] updateSelectedShape done', { count: template_contents.length });
	}

	function deselectShape() {
		selectedShapeId = null;
	}

	$effect(() => {
		const shape = selectedShape;
		if (shape) {
			editX = shape.x;
			editY = shape.y;
			editWidth = shape.width;
			editHeight = shape.height;
			editBorderRadius = shape.borderRadius;
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
	<aside class="sidebar">
		<div class="controls">
			<h3 class="control-heading">Template</h3>
			<label>
				<span>Width (px)</span>
				<input
					type="number"
					min={minDim}
					max={maxDim}
					step="0.01"
					bind:value={template_config.width}
				/>
			</label>
			<label>
				<span>Height (px)</span>
				<input
					type="number"
					min={minDim}
					max={maxDim}
					step="0.01"
					bind:value={template_config.height}
				/>
			</label>
			<label>
				<span>Border radius (px)</span>
				<input
					type="number"
					min={minRadius}
					max={maxRadius}
					step="0.01"
					bind:value={template_config.borderRadius}
				/>
			</label>
		</div>
		<div class="controls">
			<h3 class="control-heading">Add shape</h3>
			<button type="button" class="btn btn-add" onclick={addRectangle}>Add rectangle</button>
			<button type="button" class="btn btn-add" onclick={addCircle}>Add circle</button>
		</div>
		{#if selectedShape}
			<div class="controls edit-shape">
				<div class="edit-shape-header">
					<h3 class="control-heading">Edit shape</h3>
					<button type="button" class="btn btn-icon" onclick={deselectShape} title="Deselect" aria-label="Deselect">×</button>
				</div>
				<label>
					<span>X (px)</span>
					<input
						type="number"
						min="0"
						step="0.01"
						bind:value={editX}
						onblur={() => {
							const v = Number(editX);
							if (!Number.isNaN(v)) updateSelectedShape({ x: v });
						}}
					/>
				</label>
				<label>
					<span>Y (px)</span>
					<input
						type="number"
						min="0"
						step="0.01"
						bind:value={editY}
						onblur={() => {
							const v = Number(editY);
							if (!Number.isNaN(v)) updateSelectedShape({ y: v });
						}}
					/>
				</label>
				{#if selectedShape.type === 'rectangle'}
					<label>
						<span>Width (px)</span>
						<input
							type="number"
							min={minDim}
							max={maxDim}
							step="0.01"
							bind:value={editWidth}
							onblur={() => updateSelectedShape({ width: toPx(editWidth) })}
						/>
					</label>
					<label>
						<span>Height (px)</span>
						<input
							type="number"
							min={minDim}
							max={maxDim}
							step="0.01"
							bind:value={editHeight}
							onblur={() => updateSelectedShape({ height: toPx(editHeight) })}
						/>
					</label>
					<label>
						<span>Border radius (px)</span>
						<input
							type="number"
							min={minRadius}
							max={maxRadius}
							step="0.01"
							bind:value={editBorderRadius}
							onblur={() => updateSelectedShape({ borderRadius: toRadiusPx(editBorderRadius) })}
						/>
					</label>
				{:else}
					<label>
						<span>Size (px)</span>
						<input
							type="number"
							min={minDim}
							max={maxDim}
							step="0.01"
							bind:value={editWidth}
							onblur={() => {
								const size = toPx(editWidth);
								updateSelectedShape({ width: size, height: size });
							}}
						/>
					</label>
				{/if}
				<button
					type="button"
					class="btn btn-delete"
					onclick={() => selectedShapeId && removeShape(selectedShapeId)}
					title="Delete shape"
				>Delete shape</button>
			</div>
		{/if}
	</aside>
	<main class="preview">
		<div
			bind:this={templateEl}
			class="template"
			style:width="{toPx(template_config.width)}px"
			style:height="{toPx(template_config.height)}px"
			style:border-radius="{toRadiusPx(template_config.borderRadius)}px"
		>
			{#each template_contents as shape (shape.id)}
				<div
					class="shape-wrap"
					class:dragging={dragging?.shapeId === shape.id}
					class:selected={selectedShapeId === shape.id}
					style:left="{shape.x}px"
					style:top="{shape.y}px"
				>
					<div
						class="shape"
						class:rectangle={shape.type === 'rectangle'}
						class:circle={shape.type === 'circle'}
						style:width="{shape.width}px"
						style:height="{shape.height}px"
						style:border-radius={shape.type === 'circle' ? '50%' : `${shape.borderRadius}px`}
						onmousedown={(e) => startDrag(e, shape)}
						ontouchstart={(e) => startDrag(e, shape)}
						role="button"
						tabindex="0"
						title="Drag to move"
					></div>
				</div>
			{/each}
		</div>
	</main>
</div>

<style>
	.promax-page {
		margin: 0;
		padding: 0;
		min-height: 100vh;
		display: grid;
		grid-template-columns: minmax(0, 220px) 1fr;
		gap: 1.5rem;
		align-items: start;
		padding: 1.5rem;
	}

	.sidebar {
		position: sticky;
		top: 1.5rem;
	}

	.control-heading {
		margin: 0 0 0.25rem 0;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #1f2937;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.controls + .controls {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e5e7eb;
	}

	.btn {
		cursor: pointer;
		font-size: 0.875rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		border: 1px solid #9ca3af;
		background: #f9fafb;
		color: #374151;
	}

	.btn:hover {
		background: #f3f4f6;
		border-color: #6b7280;
	}

	.btn-add {
		align-self: flex-start;
	}

	.btn-delete {
		align-self: flex-start;
		background: #fef2f2;
		border-color: #f87171;
		color: #b91c1c;
	}

	.btn-delete:hover {
		background: #fee2e2;
		border-color: #ef4444;
		color: #991b1b;
	}

	.edit-shape {
		background: #eff6ff;
		border: 1px solid #93c5fd;
		border-radius: 0.375rem;
		padding: 1rem;
		margin-top: 0.5rem;
	}

	.edit-shape-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.btn-icon {
		padding: 0.25rem 0.5rem;
		min-width: 1.75rem;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.875rem;
		color: #374151;
	}

	.controls input {
		width: 100%;
		max-width: 10rem;
		padding: 0.375rem 0.5rem;
		border: 1px solid #9ca3af;
		border-radius: 0.25rem;
		font-size: 0.875rem;
	}

	.controls input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgb(59 130 246 / 0.2);
	}

	.preview {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 80vh;
		padding: 1rem;
	}

	.template {
		position: relative;
		overflow: hidden;
		background: #f9fafb;
		border: 2px dashed #9ca3af;
		flex-shrink: 0;
	}

	.shape-wrap {
		position: absolute;
	}

	.shape-wrap.dragging {
		z-index: 1;
	}

	.shape-wrap.selected .shape {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.shape {
		background: #e5e7eb;
		border: 1px solid #9ca3af;
		cursor: grab;
		user-select: none;
	}

	.shape-wrap.dragging .shape {
		cursor: grabbing;
	}
</style>
