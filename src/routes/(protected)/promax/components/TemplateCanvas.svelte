<script lang="ts">
	import type { Shape, TemplateConfig } from '../utils/types';
	import { rectBorderRadiusCss, toPx, toRadiusPx } from '../utils/shapeUtils';

	let {
		templateEl = $bindable(),
		templateConfig,
		templateContents,
		selectedShapeId,
		dragging,
		onStartDrag
	}: {
		templateEl: HTMLDivElement | null;
		templateConfig: TemplateConfig;
		templateContents: Shape[];
		selectedShapeId: string | null;
		dragging: { shapeId: string; offsetX: number; offsetY: number; hasMoved: boolean } | null;
		onStartDrag: (e: MouseEvent | TouchEvent, shape: Shape) => void;
	} = $props();
</script>

<div
	bind:this={templateEl}
	class="template"
	style:width="{toPx(templateConfig.width)}px"
	style:height="{toPx(templateConfig.height)}px"
	style:border-radius="{toRadiusPx(templateConfig.borderRadius)}px"
>
	{#each templateContents as shape (shape.id)}
		<div
			class="shape-wrap"
			class:dragging={dragging?.shapeId === shape.id}
			class:selected={selectedShapeId === shape.id}
			style:left="{shape.x}px"
			style:top="{shape.y}px"
			style:z-index={dragging?.shapeId === shape.id ? 9999 : (shape.order ?? 0)}
		>
			<div
				class="shape"
				class:rectangle={shape.type === 'rectangle'}
				class:circle={shape.type === 'circle'}
				style:width="{shape.width}px"
				style:height="{shape.height}px"
				style:border-radius={rectBorderRadiusCss(shape)}
				onmousedown={(e) => onStartDrag(e, shape)}
				ontouchstart={(e) => onStartDrag(e, shape)}
				role="button"
				tabindex="0"
				title="Drag to move"
			></div>
		</div>
	{/each}
</div>

<style>
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
