<script lang="ts">
	import type { Shape } from '../utils/types';
	import { toPx, toRadiusPx, minDim, maxDim, minRadius, maxRadius, minBorderWidth, maxBorderWidth, toBorderWidthPx } from '../utils/shapeUtils';

	let {
		selectedShape,
		editX = $bindable(),
		editY = $bindable(),
		editWidth = $bindable(),
		editHeight = $bindable(),
		editBorderRadiusTL = $bindable(),
		editBorderRadiusTR = $bindable(),
		editBorderRadiusBR = $bindable(),
		editBorderRadiusBL = $bindable(),
		editBorderWidth = $bindable(),
		editOrder = $bindable(),
		onUpdateShape,
		onDeselect,
		onDuplicate,
		onDelete
	}: {
		selectedShape: Shape;
		editX: number;
		editY: number;
		editWidth: number;
		editHeight: number;
		editBorderRadiusTL: number;
		editBorderRadiusTR: number;
		editBorderRadiusBR: number;
		editBorderRadiusBL: number;
		editBorderWidth: number;
		editOrder: number;
		onUpdateShape: (updates: Partial<Pick<Shape, 'width' | 'height' | 'borderRadiusTL' | 'borderRadiusTR' | 'borderRadiusBR' | 'borderRadiusBL' | 'borderWidth' | 'x' | 'y' | 'order'>>) => void;
		onDeselect: () => void;
		onDuplicate: () => void;
		onDelete: () => void;
	} = $props();
</script>

<div class="controls edit-shape">
	<div class="edit-shape-header">
		<h3 class="control-heading">Edit shape</h3>
		<button type="button" class="btn btn-icon" onclick={onDeselect} title="Deselect" aria-label="Deselect">×</button>
	</div>
	<div class="fields-grid">
		<label>
			<span>X (px)</span>
			<input
				type="number"
				min="0"
				step="0.01"
				bind:value={editX}
				onblur={() => {
					const v = Number(editX);
					if (!Number.isNaN(v)) onUpdateShape({ x: v });
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
					if (!Number.isNaN(v)) onUpdateShape({ y: v });
				}}
			/>
		</label>
		<label>
			<span>Order (layer)</span>
			<input
				type="number"
				min="0"
				step="1"
				bind:value={editOrder}
				onblur={() => {
					const v = Math.round(Number(editOrder));
					if (!Number.isNaN(v) && v >= 0) onUpdateShape({ order: v });
				}}
			/>
		</label>
		{#if selectedShape.type !== 'image'}
			<label>
				<span>Shape border (px)</span>
				<input
					type="number"
					min={minBorderWidth}
					max={maxBorderWidth}
					step="0.5"
					bind:value={editBorderWidth}
					onblur={() => onUpdateShape({ borderWidth: toBorderWidthPx(editBorderWidth) })}
				/>
			</label>
		{/if}
		{#if selectedShape.type === 'rectangle'}
			<label>
				<span>Width (px)</span>
				<input
					type="number"
					min={minDim}
					max={maxDim}
					step="0.01"
					bind:value={editWidth}
					onblur={() => onUpdateShape({ width: toPx(editWidth) })}
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
					onblur={() => onUpdateShape({ height: toPx(editHeight) })}
				/>
			</label>
			<label>
				<span>Radius TL (px)</span>
				<input
					type="number"
					min={minRadius}
					max={maxRadius}
					step="0.01"
					bind:value={editBorderRadiusTL}
					onblur={() => onUpdateShape({ borderRadiusTL: toRadiusPx(editBorderRadiusTL) })}
				/>
			</label>
			<label>
				<span>Radius TR (px)</span>
				<input
					type="number"
					min={minRadius}
					max={maxRadius}
					step="0.01"
					bind:value={editBorderRadiusTR}
					onblur={() => onUpdateShape({ borderRadiusTR: toRadiusPx(editBorderRadiusTR) })}
				/>
			</label>
			<label>
				<span>Radius BR (px)</span>
				<input
					type="number"
					min={minRadius}
					max={maxRadius}
					step="0.01"
					bind:value={editBorderRadiusBR}
					onblur={() => onUpdateShape({ borderRadiusBR: toRadiusPx(editBorderRadiusBR) })}
				/>
			</label>
			<label>
				<span>Radius BL (px)</span>
				<input
					type="number"
					min={minRadius}
					max={maxRadius}
					step="0.01"
					bind:value={editBorderRadiusBL}
					onblur={() => onUpdateShape({ borderRadiusBL: toRadiusPx(editBorderRadiusBL) })}
				/>
			</label>
		{:else}
			<label>
				<span>Width (px)</span>
				<input
					type="number"
					min={minDim}
					max={maxDim}
					step="0.01"
					bind:value={editWidth}
					onblur={() => onUpdateShape({ width: toPx(editWidth) })}
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
					onblur={() => onUpdateShape({ height: toPx(editHeight) })}
				/>
			</label>
		{/if}
	</div>
	<button
		type="button"
		class="btn btn-secondary"
		onclick={onDuplicate}
		title="Duplicate shape"
	>Duplicate shape</button>
	<button
		type="button"
		class="btn btn-delete"
		onclick={onDelete}
		title="Delete shape"
	>Delete shape</button>
</div>

<style>
	.control-heading {
		margin: 0 0 0.25rem 0;
		font-size: 0.75rem;
		font-weight: 600;
		color: #1f2937;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.fields-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem 0.375rem;
	}

	.edit-shape {
		background: #eff6ff;
		border: 1px solid #93c5fd;
		border-radius: 0.375rem;
		padding: 0.75rem;
		margin-top: 0.5rem;
	}

	.edit-shape-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.btn {
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.375rem 0.5rem;
		border-radius: 0.375rem;
		border: 1px solid #9ca3af;
		background: #f9fafb;
		color: #374151;
	}

	.btn:hover {
		background: #f3f4f6;
		border-color: #6b7280;
	}

	.btn-icon {
		padding: 0.2rem 0.375rem;
		min-width: 1.5rem;
		font-size: 1rem;
		line-height: 1;
	}

	.btn-delete {
		align-self: flex-start;
		background: #fef2f2;
		border-color: #f87171;
		color: #b91c1c;
	}

	.btn-secondary {
		align-self: flex-start;
		background: #eff6ff;
		border-color: #93c5fd;
		color: #1d4ed8;
	}

	.btn-secondary:hover {
		background: #dbeafe;
		border-color: #3b82f6;
		color: #1e40af;
	}

	.btn-delete:hover {
		background: #fee2e2;
		border-color: #ef4444;
		color: #991b1b;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		font-size: 0.75rem;
		color: #374151;
	}

	.controls input {
		width: 100%;
		max-width: none;
		padding: 0.25rem 0.375rem;
		border: 1px solid #9ca3af;
		border-radius: 0.25rem;
		font-size: 0.75rem;
	}

	.controls input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgb(59 130 246 / 0.2);
	}
</style>
