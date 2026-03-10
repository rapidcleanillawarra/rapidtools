<script lang="ts">
	import type { Shape, TemplateConfig } from '../utils/types';
	import { rectBorderRadiusCss, toPx, toRadiusPx, toBorderWidthPx } from '../utils/shapeUtils';

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

	const sortedContents = $derived(
		[...templateContents].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
	);
</script>

<div
	bind:this={templateEl}
	class="template"
	style:width="{toPx(templateConfig.width)}px"
	style:height="{toPx(templateConfig.height)}px"
	style:border-radius="{toRadiusPx(templateConfig.borderRadius)}px"
	style:background-color={templateConfig.backgroundColor ?? 'white'}
>
	{#each sortedContents as shape (shape.id)}
		<div
			class="shape-wrap"
			class:dragging={dragging?.shapeId === shape.id}
			class:selected={selectedShapeId === shape.id}
			style:left="{shape.x}px"
			style:top="{shape.y}px"
			style:z-index={dragging?.shapeId === shape.id ? 9999 : (shape.order ?? 0)}
		>
			{#if shape.type === 'image' && shape.src}
				<span
					class="shape shape-image-wrap"
					style:width="{shape.width}px"
					style:height="{shape.height}px"
					style:border-radius={rectBorderRadiusCss(shape)}
					style:overflow="hidden"
					role="button"
					tabindex="0"
					title="Drag to move"
					onmousedown={(e) => onStartDrag(e, shape)}
					ontouchstart={(e) => onStartDrag(e, shape)}
				>
					<img
						class="shape-image"
						src={shape.src}
						alt=""
						style:width="{shape.width}px"
						style:height="{shape.height}px"
						draggable="false"
					/>
				</span>
			{:else}
				<div
					class="shape"
					class:rectangle={shape.type === 'rectangle'}
					class:circle={shape.type === 'circle'}
					style:width="{shape.width}px"
					style:height="{shape.height}px"
					style:border-radius={rectBorderRadiusCss(shape)}
					style:border-width="{toBorderWidthPx(shape.borderWidth)}px"
					style:background-color={shape.backgroundColor ?? 'transparent'}
					onmousedown={(e) => onStartDrag(e, shape)}
					ontouchstart={(e) => onStartDrag(e, shape)}
					role="button"
					tabindex="0"
					title="Drag to move"
				></div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.template {
		position: relative;
		overflow: hidden;
		background: transparent;
		border: 2px dashed #9ca3af;
		flex-shrink: 0;
	}

	:global(.exporting-pdf).template {
		border: none;
	}

	:global(.exporting-pdf) .shape-wrap.selected .shape,
	:global(.exporting-pdf) .shape-wrap.selected .shape-image-wrap {
		outline: none;
	}

	.shape-wrap {
		position: absolute;
	}

	.shape-wrap.dragging {
		z-index: 1;
	}

	.shape-wrap.selected .shape,
	.shape-wrap.selected .shape-image-wrap {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.shape {
		background: transparent;
		border: 1px solid #9ca3af;
		cursor: grab;
		user-select: none;
	}

	.shape-image-wrap {
		display: block;
		cursor: grab;
		position: relative;
		background: transparent;
		border: none;
	}

	.shape-wrap.dragging .shape-image-wrap {
		cursor: grabbing;
	}

	.shape-image {
		display: block;
		object-fit: fill;
		pointer-events: none;
	}
</style>
