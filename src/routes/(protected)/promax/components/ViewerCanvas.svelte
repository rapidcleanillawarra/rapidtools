<script lang="ts">
	import type { Shape, TemplateConfig } from '../templates/utils/types';
	import { rectBorderRadiusCss, toPx, toRadiusPx, toBorderWidthPx } from '../templates/utils/shapeUtils';

	let {
		templateEl = $bindable(),
		templateConfig,
		templateContents,
		onEditDescription
	}: {
		templateEl: HTMLDivElement | null;
		templateConfig: TemplateConfig;
		templateContents: Shape[];
		onEditDescription?: (shape: Shape) => void;
	} = $props();

	const sortedContents = $derived(
		[...templateContents].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
	);

	function handleShapeClick(e: MouseEvent, shape: Shape) {
		e.stopPropagation();

		// Check for product-related specific actions
		const triggerFields = ['product_description', 'product_name', 'product_code', 'product_icon'];
		if (shape.functionName && triggerFields.includes(shape.functionName) && onEditDescription) {
			onEditDescription(shape);
			return;
		}

		if (shape.functionName && shape.functionLink) {
			const relatedShapes = templateContents.filter((s) => s.functionLink === shape.functionLink);
			const group: Record<string, string> = {
				parent_dial: shape.functionLink
			};

			relatedShapes.forEach((s) => {
				if (s.functionName) {
					group[s.functionName] = s.id;
				}
			});

			console.log('Related function items:', group);
		}
	}
</script>

<div
	bind:this={templateEl}
	class="template"
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
			class:functional-item={!!shape.functionName}
			style:left="{shape.x}px"
			style:top="{shape.y}px"
			style:z-index={shape.order ?? 0}
		>
			{#if shape.type === 'text'}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					class="shape shape-text"
					class:functional-item={!!shape.functionName}
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
					style:border-width="{toBorderWidthPx(shape.borderWidth)}px"
					style:box-sizing="border-box"
					onclick={(e) => handleShapeClick(e, shape)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.stopPropagation();
							if (shape.functionName) console.log('functionLink:', shape.functionLink);
						}
					}}
					role={shape.functionName ? 'button' : 'presentation'}
					tabindex={shape.functionName ? 0 : -1}
				>
					<span class="text-content" style="display: table-cell; vertical-align: middle; width: 100%;">{shape.text}</span>
				</div>
			{:else if shape.type === 'image' && shape.src}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<span
					class="shape shape-image-wrap"
					class:functional-item={!!shape.functionName}
					style:width="{shape.width}px"
					style:height="{shape.height}px"
					style:border-radius={rectBorderRadiusCss(shape)}
					style:overflow="hidden"
					onclick={(e) => handleShapeClick(e, shape)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.stopPropagation();
							if (shape.functionName) console.log('functionLink:', shape.functionLink);
						}
					}}
					role={shape.functionName ? 'button' : 'presentation'}
					tabindex={shape.functionName ? 0 : -1}
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
					style:background-image={shape.backgroundImage ? `url(${shape.backgroundImage})` : 'none'}
					style:background-size="cover"
					style:background-position="center"
					style:background-repeat="no-repeat"
					style:box-sizing="border-box"
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

	:global(.exporting-pdf) .shape-text .text-content {
		position: relative;
		top: -10px;
	}

	.shape-wrap {
		position: absolute;
	}

	.shape {
		background: transparent;
		border: 1px solid #9ca3af;
		user-select: none;
		box-sizing: border-box;
	}

	.shape-image-wrap {
		display: block;
		position: relative;
		background: transparent;
		border: none;
	}

	.shape-image {
		display: block;
		object-fit: fill;
		pointer-events: none;
	}

	/* Functional item hover styles */
	.functional-item {
		cursor: pointer;
		transition: outline 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
	}

	.shape-wrap.functional-item:hover .shape,
	.shape-wrap.functional-item:hover .shape-image-wrap {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
		box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
	}

	.shape.functional-item:hover,
	.shape-image-wrap.functional-item:hover {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
		box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
	}
</style>
