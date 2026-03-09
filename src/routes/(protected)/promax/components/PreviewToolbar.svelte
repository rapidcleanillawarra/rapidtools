<script lang="ts">
	let {
		onExport
	}: {
		onExport: () => void;
	} = $props();
</script>

<div class="preview-actions">
	<button type="button" class="btn btn-export" onclick={onExport} title="Download template as PDF">
		Export PDF
	</button>
</div>

<style>
	.preview-actions {
		display: flex;
		gap: 0.5rem;
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

	.btn-export {
		background: #1f2937;
		border-color: #1f2937;
		color: #fff;
	}

	.btn-export:hover {
		background: #374151;
		border-color: #374151;
		color: #fff;
	}
</style>
