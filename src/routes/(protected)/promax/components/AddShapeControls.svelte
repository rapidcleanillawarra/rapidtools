<script lang="ts">
	let {
		onAddRectangle,
		onAddCircle,
		onAddImage
	}: {
		onAddRectangle: () => void;
		onAddCircle: () => void;
		onAddImage: (dataUrl: string, width: number, height: number) => void;
	} = $props();

	let fileInputEl = $state<HTMLInputElement | null>(null);

	function handleImageUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !file.type.startsWith('image/')) return;
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = reader.result as string;
			const img = new Image();
			img.onload = () => {
				onAddImage(dataUrl, img.naturalWidth, img.naturalHeight);
			};
			img.onerror = () => {
				onAddImage(dataUrl, 200, 200);
			};
			img.src = dataUrl;
		};
		reader.readAsDataURL(file);
		input.value = '';
	}
</script>

<div class="controls">
	<h3 class="control-heading">Add shape</h3>
	<button type="button" class="btn btn-add" onclick={onAddRectangle}>Add rectangle</button>
	<button type="button" class="btn btn-add" onclick={onAddCircle}>Add circle</button>
	<input
		type="file"
		accept="image/*"
		class="file-input"
		bind:this={fileInputEl}
		onchange={handleImageUpload}
		aria-label="Upload image"
	/>
	<button
		type="button"
		class="btn btn-add"
		onclick={() => fileInputEl?.click()}
	>Add image</button>
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

	.file-input {
		position: absolute;
		width: 0.1px;
		height: 0.1px;
		opacity: 0;
		overflow: hidden;
		z-index: -1;
	}
</style>
