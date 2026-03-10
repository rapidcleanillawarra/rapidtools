<script lang="ts">
	import type { Shape, TemplateConfig } from '../utils/types';
	import { rectBorderRadiusCss, toPx, toRadiusPx, toBorderWidthPx } from '../utils/shapeUtils';

	let {
		templateEl = $bindable(),
		templateConfig,
		templateContents,
		selectedShapeId,
		dragging,
		onStartDrag,
		onStartResize,
		onBackgroundClick
	}: {
		templateEl: HTMLDivElement | null;
		templateConfig: TemplateConfig;
		templateContents: Shape[];
		selectedShapeId: string | null;
		dragging: { shapeId: string; offsetX: number; offsetY: number; hasMoved: boolean } | null;
		onStartDrag: (e: MouseEvent | TouchEvent, shape: Shape) => void;
		onStartResize: (e: MouseEvent | TouchEvent, shape: Shape, handle: string) => void;
		onBackgroundClick: () => void;
	} = $props();

	const sortedContents = $derived(
		[...templateContents].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
	);
</script>

<div
	bind:this={templateEl}
	class="template"
	onclick={(e) => {
		if (e.target === e.currentTarget) onBackgroundClick();
	}}
	onkeydown={(e) => {
		if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
			onBackgroundClick();
		}
	}}
	role="button"
	tabindex="0"
	style:width="{toPx(templateConfig.width)}px"
	style:height="{toPx(templateConfig.height)}px"
	style:border-radius="{toRadiusPx(templateConfig.borderRadius)}px"
	style:border-width="{toBorderWidthPx(templateConfig.borderWidth)}px"
	style:border-color="#9ca3af"
	style:border-style="solid"
	style:background-color={templateConfig.backgroundColor ?? 'white'}
	style:box-sizing="border-box"
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
			{#if shape.type === 'text'}
				<div
					class="shape shape-text"
					style:width="{shape.width}px"
					style:height="{shape.height}px"
					style:font-size="{shape.fontSize}px"
					style:font-weight={shape.fontWeight}
					style:font-style={shape.fontStyle}
					style:color={shape.color}
					style:background-color={shape.backgroundColor ?? 'transparent'}
					style:padding="{shape.padding ?? 0}px"
					style:display="table"
					style:text-align="center"
					style:white-space="pre-wrap"
					style:overflow="hidden"
					style:line-height="{Math.round((shape.fontSize || 16) * 1.2)}px"
					style:box-sizing="border-box"
					onmousedown={(e) => onStartDrag(e, shape)}
					ontouchstart={(e) => onStartDrag(e, shape)}
					role="button"
					tabindex="0"
					title="Drag to move"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
					}}
				>
					<span class="text-content" style="display: table-cell; vertical-align: middle; width: 100%;">{shape.text}</span
					>
				</div>
			{:else if shape.type === 'image' && shape.src}
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
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
					}}
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
					style:box-sizing="border-box"
					onmousedown={(e) => onStartDrag(e, shape)}
					ontouchstart={(e) => onStartDrag(e, shape)}
					role="button"
					tabindex="0"
					title="Drag to move"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
					}}
				></div>
			{/if}

			{#if selectedShapeId === shape.id}
				<div class="resize-handles">
					<div
						class="handle tl"
						onmousedown={(e) => onStartResize(e, shape, 'tl')}
						ontouchstart={(e) => onStartResize(e, shape, 'tl')}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
						}}
						role="button"
						tabindex="0"
						title="Resize"
					></div>
					<div
						class="handle tr"
						onmousedown={(e) => onStartResize(e, shape, 'tr')}
						ontouchstart={(e) => onStartResize(e, shape, 'tr')}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
						}}
						role="button"
						tabindex="0"
						title="Resize"
					></div>
					<div
						class="handle bl"
						onmousedown={(e) => onStartResize(e, shape, 'bl')}
						ontouchstart={(e) => onStartResize(e, shape, 'bl')}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
						}}
						role="button"
						tabindex="0"
						title="Resize"
					></div>
					<div
						class="handle br"
						onmousedown={(e) => onStartResize(e, shape, 'br')}
						ontouchstart={(e) => onStartResize(e, shape, 'br')}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
						}}
						role="button"
						tabindex="0"
						title="Resize"
					></div>
					<div
						class="handle tc"
						onmousedown={(e) => onStartResize(e, shape, 'tc')}
						ontouchstart={(e) => onStartResize(e, shape, 'tc')}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
						}}
						role="button"
						tabindex="0"
						title="Resize"
					></div>
					<div
						class="handle bc"
						onmousedown={(e) => onStartResize(e, shape, 'bc')}
						ontouchstart={(e) => onStartResize(e, shape, 'bc')}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
						}}
						role="button"
						tabindex="0"
						title="Resize"
					></div>
					<div
						class="handle ml"
						onmousedown={(e) => onStartResize(e, shape, 'ml')}
						ontouchstart={(e) => onStartResize(e, shape, 'ml')}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
						}}
						role="button"
						tabindex="0"
						title="Resize"
					></div>
					<div
						class="handle mr"
						onmousedown={(e) => onStartResize(e, shape, 'mr')}
						ontouchstart={(e) => onStartResize(e, shape, 'mr')}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
						}}
						role="button"
						tabindex="0"
						title="Resize"
					></div>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.template {
		position: relative;
		overflow: hidden;
		background: transparent;
		border: 1px dashed #9ca3af;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	:global(.exporting-pdf).template {
		border-style: solid !important;
	}

	.template:not([style*='border-width: 0px']) {
		border-style: solid;
	}

	:global(.exporting-pdf) .resize-handles {
		display: none !important;
	}

	:global(.exporting-pdf) .shape-wrap.selected .shape,
	:global(.exporting-pdf) .shape-wrap.selected .shape-image-wrap {
		outline: none !important;
	}

	:global(.exporting-pdf) .shape-text .text-content {
		position: relative;
		top: -10px;
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
		box-sizing: border-box;
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

	.handle {
		position: absolute;
		width: 10px;
		height: 10px;
		background: white;
		border: 1px solid #3b82f6;
		border-radius: 50%;
		z-index: 100;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	/* Corner handles */
	.handle.tl {
		top: -5px;
		left: -5px;
		cursor: nwse-resize;
	}
	.handle.tr {
		top: -5px;
		right: -5px;
		cursor: nesw-resize;
	}
	.handle.bl {
		bottom: -5px;
		left: -5px;
		cursor: nesw-resize;
	}
	.handle.br {
		bottom: -5px;
		right: -5px;
		cursor: nwse-resize;
	}

	/* Edge handles */
	.handle.tc {
		top: -5px;
		left: 50%;
		transform: translateX(-50%);
		cursor: ns-resize;
	}
	.handle.bc {
		bottom: -5px;
		left: 50%;
		transform: translateX(-50%);
		cursor: ns-resize;
	}
	.handle.ml {
		top: 50%;
		left: -5px;
		transform: translateY(-50%);
		cursor: ew-resize;
	}
	.handle.mr {
		top: 50%;
		right: -5px;
		transform: translateY(-50%);
		cursor: ew-resize;
	}

	.handle:hover {
		background: #3b82f6;
		transform: scale(1.2);
	}

	.handle.tc {
		transform: translateX(-50%);
	}
	.handle.bc {
		transform: translateX(-50%);
	}
	.handle.ml {
		transform: translateY(-50%);
	}
	.handle.mr {
		transform: translateY(-50%);
	}

	.handle.tc:hover,
	.handle.bc:hover {
		transform: translateX(-50%) scale(1.2);
	}
	.handle.ml:hover,
	.handle.mr:hover {
		transform: translateY(-50%) scale(1.2);
	}
</style>
