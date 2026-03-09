<script lang="ts">
	let {
		onAddRectangle,
		onAddCircle
	}: {
		onAddRectangle: () => void;
		onAddCircle: () => void;
	} = $props();
</script>

<div class="controls">
	<h3 class="control-heading">Add shape</h3>
	<button type="button" class="btn btn-add" onclick={onAddRectangle}>Add rectangle</button>
	<button type="button" class="btn btn-add" onclick={onAddCircle}>Add circle</button>
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
</style>
