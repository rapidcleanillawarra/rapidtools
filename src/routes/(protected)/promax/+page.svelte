<script lang="ts">
	let width = $state(200);
	let height = $state(120);

	const minDim = 20;
	const maxDim = 800;

	function toPx(n: number | string): number {
		const v = Number(n);
		if (Number.isNaN(v)) return minDim;
		const c = Math.max(minDim, Math.min(maxDim, v));
		return Math.round(c * 100) / 100;
	}

	const widthPx = $derived(toPx(width));
	const heightPx = $derived(toPx(height));
</script>

<div class="promax-page">
	<div class="controls">
		<label>
			<span>Width (px)</span>
			<input
				type="number"
				min={minDim}
				max={maxDim}
				step="0.01"
				bind:value={width}
			/>
		</label>
		<label>
			<span>Height (px)</span>
			<input
				type="number"
				min={minDim}
				max={maxDim}
				step="0.01"
				bind:value={height}
			/>
		</label>
	</div>
	<div
		class="rectangle"
		style:width="{widthPx}px"
		style:height="{heightPx}px"
	></div>
</div>

<style>
	.promax-page {
		margin: 0;
		padding: 0;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
	}

	.controls {
		display: flex;
		gap: 1.5rem;
		align-items: flex-end;
	}

	.controls label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.875rem;
		color: #374151;
	}

	.controls input {
		width: 6rem;
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

	.rectangle {
		background: #e5e7eb;
		border: 1px solid #9ca3af;
	}
</style>
