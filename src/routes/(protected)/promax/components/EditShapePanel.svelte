<script lang="ts">
	import type { Shape } from '../utils/types';
	import { toPx, toRadiusPx, minDim, maxDim, minRadius, maxRadius } from '../utils/shapeUtils';

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
		editOrder = $bindable(),
		onUpdateShape,
		onDeselect,
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
		editOrder: number;
		onUpdateShape: (updates: Partial<Pick<Shape, 'width' | 'height' | 'borderRadiusTL' | 'borderRadiusTR' | 'borderRadiusBR' | 'borderRadiusBL' | 'x' | 'y' | 'order'>>) => void;
		onDeselect: () => void;
		onDelete: () => void;
	} = $props();
</script>

<div class="controls edit-shape">
	<div class="edit-shape-header">
		<h3 class="control-heading">Edit shape</h3>
		<button type="button" class="btn btn-icon" onclick={onDeselect} title="Deselect" aria-label="Deselect">×</button>
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
			<span>Border radius — Top-left (px)</span>
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
			<span>Border radius — Top-right (px)</span>
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
			<span>Border radius — Bottom-right (px)</span>
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
			<span>Border radius — Bottom-left (px)</span>
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
		font-size: 0.8125rem;
		font-weight: 600;
		color: #1f2937;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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

	.btn-icon {
		padding: 0.25rem 0.5rem;
		min-width: 1.75rem;
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
</style>
