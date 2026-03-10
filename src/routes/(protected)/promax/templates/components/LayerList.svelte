<script lang="ts">
	import type { Shape } from '../utils/types';

	export let shapes: Shape[] = [];
	export let selectedShapeId: string | null = null;
	export let onSelect: (id: string) => void;
	export let onReorder: (newShapes: Shape[]) => void;

	let draggedIndex: number | null = null;

	function handleDragStart(e: DragEvent, index: number) {
		draggedIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.dropEffect = 'move';
			// Set drag image if needed, or leave default
		}
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDrop(e: DragEvent, index: number) {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === index) {
			draggedIndex = null;
			return;
		}

		// Reorder
		const newShapes = [...shapes];
		const [draggedShape] = newShapes.splice(draggedIndex, 1);
		newShapes.splice(index, 0, draggedShape);

		// Update order properties based on new array index
		// Typically, higher index in array = higher z-index (rendered later)
		// Or we can just emit the new sorted array and let the parent reassign `order` values
		const reorderedShapes = newShapes.map((shape, i) => ({
			...shape,
			order: i + 1
		}));

		onReorder(reorderedShapes);
		draggedIndex = null;
	}

	function handleDragEnd() {
		draggedIndex = null;
	}

	function getShapeName(shape: Shape, index: number): string {
		const prefix = shape.type.charAt(0).toUpperCase() + shape.type.slice(1);
		return `${prefix} ${index + 1}`;
	}

	function getIconForShape(type: string) {
		if (type === 'rectangle') {
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
		} else if (type === 'circle') {
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>`;
		} else if (type === 'image') {
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
		}
		return '';
	}
</script>

<div class="layer-list-container">
	<h3 class="controls-heading">Layers</h3>
	<div class="layer-list">
		{#if shapes.length === 0}
			<div class="empty-state">No layers yet</div>
		{:else}
			{#each [...shapes].sort((a, b) => (b.order ?? 0) - (a.order ?? 0)) as shape, i (shape.id)}
				{@const actualIndex = shapes.findIndex(s => s.id === shape.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="layer-item"
					class:selected={selectedShapeId === shape.id}
					class:dragging={draggedIndex === actualIndex}
					draggable="true"
					on:dragstart={(e) => handleDragStart(e, actualIndex)}
					on:dragover={(e) => handleDragOver(e, actualIndex)}
					on:drop={(e) => handleDrop(e, actualIndex)}
					on:dragend={handleDragEnd}
					on:click={() => onSelect(shape.id)}
				>
					<div class="layer-drag-handle">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
					</div>
					<div class="layer-icon">
						{@html getIconForShape(shape.type)}
					</div>
					<div class="layer-name">
						{getShapeName(shape, actualIndex)}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.layer-list-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e5e7eb;
	}

	.controls-heading {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #111827;
	}

	.layer-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 300px;
		overflow-y: auto;
	}

	.empty-state {
		font-size: 0.75rem;
		color: #6b7280;
		text-align: center;
		padding: 1rem 0;
		background: #f9fafb;
		border-radius: 0.375rem;
		border: 1px dashed #d1d5db;
	}

	.layer-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 0.375rem;
		cursor: pointer;
		user-select: none;
		transition: all 0.15s ease;
	}

	.layer-item:hover {
		background: #f9fafb;
		border-color: #d1d5db;
	}

	.layer-item.selected {
		background: #eff6ff;
		border-color: #3b82f6;
		color: #1d4ed8;
	}

	.layer-item.dragging {
		opacity: 0.5;
		background: #f3f4f6;
	}

	.layer-drag-handle {
		color: #9ca3af;
		display: flex;
		align-items: center;
		cursor: grab;
	}

	.layer-drag-handle:active {
		cursor: grabbing;
	}
	
	.layer-item.selected .layer-drag-handle {
		color: #60a5fa;
	}

	.layer-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: #6b7280;
	}

	.layer-item.selected .layer-icon {
		color: #2563eb;
	}

	.layer-name {
		font-size: 0.75rem;
		font-weight: 500;
		flex-grow: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
