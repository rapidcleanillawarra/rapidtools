<script lang="ts">
	let {
		onAddRectangle,
		onAddCircle,
		onAddImage,
		onAddText
	}: {
		onAddRectangle: () => void;
		onAddCircle: () => void;
		onAddImage: (file: File, width: number, height: number) => void;
		onAddText: () => void;
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
				onAddImage(file, img.naturalWidth, img.naturalHeight);
			};
			img.onerror = () => {
				onAddImage(file, 200, 200);
			};
			img.src = dataUrl;
		};

		reader.readAsDataURL(file);
		input.value = '';
	}
</script>

<div class="controls">
	<h3 class="control-heading">Add shape</h3>
	<div class="button-row">
		<button
			type="button"
			class="btn btn-add"
			onclick={onAddRectangle}
			title="Add rectangle"
			aria-label="Add rectangle"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
		</button>
		<button
			type="button"
			class="btn btn-add"
			onclick={onAddCircle}
			title="Add circle"
			aria-label="Add circle"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>
		</button>
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
			title="Add image"
			aria-label="Add image"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
		</button>
		<button
			type="button"
			class="btn btn-add"
			onclick={onAddText}
			title="Add text"
			aria-label="Add text"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
		</button>
	</div>
</div>

<style>
	.control-heading {
		margin: 0 0 0.5rem 0;
		font-size: 0.75rem;
		font-weight: 600;
		color: #1f2937;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.button-row {
		display: flex;
		flex-direction: row;
		gap: 0.5rem;
	}

	.btn {
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		width: 36px;
		height: 36px;
		padding: 0;
		border-radius: 0.5rem;
		border: 1px solid #e5e7eb;
		background: #ffffff;
		color: #4b5563;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
	}

	.btn:hover {
		background: #f9fafb;
		border-color: #3b82f6;
		color: #3b82f6;
		transform: translateY(-1px);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}

	.btn:active {
		transform: translateY(0);
		box-shadow: none;
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
