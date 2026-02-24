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
	let dragging = $state<{ shapeId: string; offsetX: number; offsetY: number } | null>(null);

	// Defaults used when adding new shapes (not part of template_config)
	let newShapeDefaults = $state({
		rectWidth: 120,
		rectHeight: 80,
		rectBorderRadius: 8,
		circleSize: 60
	});

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
		const w = toPx(newShapeDefaults.rectWidth);
		const h = toPx(newShapeDefaults.rectHeight);
		const br = toRadiusPx(newShapeDefaults.rectBorderRadius);
		const [x, y] = nextPosition(w, h);
		template_contents = [
			...template_contents,
			{
				id: crypto.randomUUID(),
				type: 'rectangle',
				x,
				y,
				width: w,
				height: h,
				borderRadius: br
			}
		];
	}

	function addCircle() {
		const size = toPx(newShapeDefaults.circleSize);
		const [x, y] = nextPosition(size, size);
		template_contents = [
			...template_contents,
			{
				id: crypto.randomUUID(),
				type: 'circle',
				x,
				y,
				width: size,
				height: size,
				borderRadius: 0
			}
		];
	}

	function nextPosition(w: number, h: number): [number, number] {
		if (template_contents.length === 0) return [defaultShapeOffset, defaultShapeOffset];
		const last = template_contents[template_contents.length - 1];
		const nextX = last.x + last.width + defaultShapeOffset;
		const templateW = toPx(template_config.width);
		if (nextX + w <= templateW - defaultShapeOffset) return [nextX, last.y];
		return [defaultShapeOffset, last.y + last.height + defaultShapeOffset];
	}

	function removeShape(id: string) {
		template_contents = template_contents.filter((s) => s.id !== id);
	}

	function startDrag(e: MouseEvent | TouchEvent, shape: Shape) {
		if ((e.target as HTMLElement).closest('.btn-remove')) return;
		e.preventDefault();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		if (!templateEl) return;
		const rect = templateEl.getBoundingClientRect();
		dragging = {
			shapeId: shape.id,
			offsetX: clientX - rect.left - shape.x,
			offsetY: clientY - rect.top - shape.y
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
			s.id === d.shapeId ? { ...s, x: Math.round(newX * 100) / 100, y: Math.round(newY * 100) / 100 } : s
		);
	}

	function endDrag() {
		dragging = null;
	}

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
			<h3 class="control-heading">Add rectangle</h3>
			<label>
				<span>Width (px)</span>
				<input
					type="number"
					min={minDim}
					max={maxDim}
					step="0.01"
					bind:value={newShapeDefaults.rectWidth}
				/>
			</label>
			<label>
				<span>Height (px)</span>
				<input
					type="number"
					min={minDim}
					max={maxDim}
					step="0.01"
					bind:value={newShapeDefaults.rectHeight}
				/>
			</label>
			<label>
				<span>Border radius (px)</span>
				<input
					type="number"
					min={minRadius}
					max={maxRadius}
					step="0.01"
					bind:value={newShapeDefaults.rectBorderRadius}
				/>
			</label>
			<button type="button" class="btn btn-add" onclick={addRectangle}>Add rectangle</button>
		</div>
		<div class="controls">
			<h3 class="control-heading">Add circle</h3>
			<label>
				<span>Size (px)</span>
				<input
					type="number"
					min={minDim}
					max={maxDim}
					step="0.01"
					bind:value={newShapeDefaults.circleSize}
				/>
			</label>
			<button type="button" class="btn btn-add" onclick={addCircle}>Add circle</button>
		</div>
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
					<button
						type="button"
						class="btn-remove"
						onclick={() => removeShape(shape.id)}
						title="Remove shape"
						aria-label="Remove shape"
					>×</button>
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

	.shape {
		background: #e5e7eb;
		border: 1px solid #9ca3af;
		cursor: grab;
		user-select: none;
	}

	.shape-wrap.dragging .shape {
		cursor: grabbing;
	}

	.btn-remove {
		position: absolute;
		top: -0.5rem;
		right: -0.5rem;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		line-height: 1;
		border-radius: 50%;
		border: 1px solid #9ca3af;
		background: #fff;
		color: #374151;
		cursor: pointer;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
	}

	.btn-remove:hover {
		background: #fef2f2;
		color: #b91c1c;
		border-color: #f87171;
	}
</style>
