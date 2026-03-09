<script lang="ts">
	import type { TemplateConfig } from '../utils/types';
	import { minDim, maxDim, minRadius, maxRadius, minBorderWidth, maxBorderWidth } from '../utils/shapeUtils';

	let {
		templateConfig = $bindable()
	}: {
		templateConfig: TemplateConfig;
	} = $props();
</script>

<div class="controls">
	<h3 class="control-heading">Template</h3>
	<div class="fields-grid">
		<label>
			<span>Width (px)</span>
			<input
				type="number"
				min={minDim}
				max={maxDim}
				step="0.01"
				bind:value={templateConfig.width}
			/>
		</label>
		<label>
			<span>Height (px)</span>
			<input
				type="number"
				min={minDim}
				max={maxDim}
				step="0.01"
				bind:value={templateConfig.height}
			/>
		</label>
		<label>
			<span>Border radius (px)</span>
			<input
				type="number"
				min={minRadius}
				max={maxRadius}
				step="0.01"
				bind:value={templateConfig.borderRadius}
			/>
		</label>
		<label>
			<span>Template border (px)</span>
			<input
				type="number"
				min={minBorderWidth}
				max={maxBorderWidth}
				step="0.5"
				bind:value={templateConfig.borderWidth}
			/>
		</label>
	</div>
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
