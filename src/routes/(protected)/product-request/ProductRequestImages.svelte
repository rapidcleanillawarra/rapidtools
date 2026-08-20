<script lang="ts">
	import {
		MAX_PRODUCT_IMAGE_BYTES,
		MAX_PRODUCT_IMAGES,
		type ProductImageDraft
	} from '$lib/product-request/imageUpload';

	let {
		images = $bindable(),
		onPreview = () => {},
		onError = () => {}
	}: {
		images: ProductImageDraft[];
		onPreview?: (url: string) => void;
		onError?: (message: string) => void;
	} = $props();

	function handleImageSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const remaining = MAX_PRODUCT_IMAGES - images.length;
		if (remaining <= 0) {
			onError(`Maximum ${MAX_PRODUCT_IMAGES} images per product`);
			input.value = '';
			return;
		}

		const accepted: ProductImageDraft[] = [];
		for (const file of Array.from(input.files).slice(0, remaining)) {
			if (!file.type.startsWith('image/')) {
				onError('Only image files are allowed');
				continue;
			}
			if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
				onError(`${file.name} is larger than 5MB`);
				continue;
			}
			accepted.push({
				id: crypto.randomUUID(),
				file,
				previewUrl: URL.createObjectURL(file)
			});
		}

		input.value = '';
		if (accepted.length === 0) return;
		images = [...images, ...accepted];
	}

	function removeImage(imageIndex: number) {
		const removed = images[imageIndex];
		if (removed) URL.revokeObjectURL(removed.previewUrl);
		images = images.filter((_, index) => index !== imageIndex);
	}
</script>

<div class="flex flex-wrap items-center gap-1.5">
	{#each images as image, imageIndex (image.id)}
		<div class="group relative">
			<button
				type="button"
				class="block overflow-hidden rounded-md border border-gray-200"
				title="View image"
				onclick={() => onPreview(image.previewUrl)}
			>
				<img src={image.previewUrl} alt="Product image {imageIndex + 1}" class="h-12 w-12 object-cover" />
			</button>
			<button
				type="button"
				class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-90 hover:bg-red-700"
				title="Remove image"
				onclick={() => removeImage(imageIndex)}
			>
				×
			</button>
		</div>
	{/each}

	{#if images.length < MAX_PRODUCT_IMAGES}
		<label
			class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 text-lg text-gray-400 hover:border-blue-400 hover:text-blue-600"
			title="Upload images"
		>
			<input
				type="file"
				accept="image/*"
				multiple
				class="sr-only"
				onchange={handleImageSelect}
			/>
			<span aria-hidden="true">+</span>
			<span class="sr-only">Upload images</span>
		</label>
	{/if}
</div>
