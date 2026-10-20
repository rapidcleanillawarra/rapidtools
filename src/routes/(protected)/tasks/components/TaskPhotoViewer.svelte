<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { TaskPhoto } from '../types';
	import { formatByteSize } from '../types';

	export let open: boolean = false;
	export let photos: TaskPhoto[] = [];
	export let index: number = 0;
	export let taskTitle: string = '';
	export let canDelete: boolean = false;

	const dispatch = createEventDispatcher<{
		close: void;
		indexChange: { index: number };
		delete: { photo: TaskPhoto; index: number };
	}>();

	let zoom: number = 1;
	let rotation: number = 0;
	let translateX: number = 0;
	let translateY: number = 0;
	let isDragging: boolean = false;
	let dragStartX: number = 0;
	let dragStartY: number = 0;
	let isImageLoading: boolean = true;
	let hasImageError: boolean = false;

	$: safeImages = photos || [];
	$: safeIndex =
		safeImages.length === 0 ? 0 : Math.min(Math.max(0, index), safeImages.length - 1);
	$: currentPhoto = safeImages[safeIndex] as TaskPhoto | undefined;

	// Reset zoom & pan when image changes or viewer opens
	$: if (currentPhoto) {
		resetTransform();
		isImageLoading = true;
		hasImageError = false;
	}

	function resetTransform() {
		zoom = 1;
		rotation = 0;
		translateX = 0;
		translateY = 0;
	}

	function close() {
		resetTransform();
		dispatch('close');
	}

	function selectIndex(newIndex: number) {
		if (newIndex < 0 || newIndex >= safeImages.length) return;
		index = newIndex;
		dispatch('indexChange', { index: newIndex });
	}

	function next() {
		if (safeImages.length <= 1) return;
		const nextIdx = safeIndex >= safeImages.length - 1 ? 0 : safeIndex + 1;
		selectIndex(nextIdx);
	}

	function prev() {
		if (safeImages.length <= 1) return;
		const prevIdx = safeIndex <= 0 ? safeImages.length - 1 : safeIndex - 1;
		selectIndex(prevIdx);
	}

	function zoomIn() {
		zoom = Math.min(zoom + 0.5, 3.5);
	}

	function zoomOut() {
		if (zoom <= 1) return;
		zoom = Math.max(zoom - 0.5, 1);
		if (zoom === 1) {
			translateX = 0;
			translateY = 0;
		}
	}

	function rotate() {
		rotation = (rotation + 90) % 360;
	}

	function handleDoubleClick() {
		if (zoom > 1) {
			resetTransform();
		} else {
			zoom = 2;
		}
	}

	function handleMouseDown(e: MouseEvent) {
		if (zoom <= 1) return;
		e.preventDefault();
		isDragging = true;
		dragStartX = e.clientX - translateX;
		dragStartY = e.clientY - translateY;
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging || zoom <= 1) return;
		translateX = e.clientX - dragStartX;
		translateY = e.clientY - dragStartY;
	}

	function handleMouseUp() {
		isDragging = false;
	}

	function handleWheel(e: WheelEvent) {
		if (e.ctrlKey || e.metaKey) {
			e.preventDefault();
			if (e.deltaY < 0) {
				zoomIn();
			} else {
				zoomOut();
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		switch (e.key) {
			case 'Escape':
				close();
				break;
			case 'ArrowLeft':
				e.preventDefault();
				prev();
				break;
			case 'ArrowRight':
				e.preventDefault();
				next();
				break;
			case '+':
			case '=':
				e.preventDefault();
				zoomIn();
				break;
			case '-':
			case '_':
				e.preventDefault();
				zoomOut();
				break;
			case '0':
				e.preventDefault();
				resetTransform();
				break;
			case 'r':
			case 'R':
				e.preventDefault();
				rotate();
				break;
		}
	}

	async function downloadCurrentPhoto() {
		if (!currentPhoto?.url) return;
		try {
			const res = await fetch(currentPhoto.url);
			const blob = await res.blob();
			const blobUrl = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = blobUrl;
			link.download = currentPhoto.name || 'task-photo.jpg';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(blobUrl);
		} catch (err) {
			// Fallback: direct link open
			const link = document.createElement('a');
			link.href = currentPhoto.url;
			link.target = '_blank';
			link.download = currentPhoto.name || 'task-photo.jpg';
			link.click();
		}
	}

	function handleDeleteCurrent() {
		if (!currentPhoto) return;
		if (confirm(`Remove photo "${currentPhoto.name}" from this task?`)) {
			dispatch('delete', { photo: currentPhoto, index: safeIndex });
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} on:mouseup={handleMouseUp} on:mousemove={handleMouseMove} />

{#if open && currentPhoto}
	<!-- Fullscreen backdrop -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 z-[80] flex flex-col bg-black/90 backdrop-blur-md select-none animate-fadeIn"
		on:click={close}
	>
		<!-- 1. Top Header Bar -->
		<div
			class="relative z-10 flex flex-wrap items-center justify-between border-b border-[#262a30] bg-[#141619]/90 px-4 py-3 sm:px-6"
			on:click|stopPropagation
		>
			<!-- Left: Task Context & Photo Information -->
			<div class="flex items-center gap-3 min-w-0 pr-4">
				{#if taskTitle}
					<span
						class="hidden sm:inline-flex items-center rounded-md border border-[#333842] bg-[#1a1d23] px-2.5 py-0.5 text-xs font-semibold text-lime-400 max-w-[200px] truncate"
						title={taskTitle}
					>
						{taskTitle}
					</span>
				{/if}

				<div class="min-w-0">
					<div class="flex items-center gap-2">
						<span class="truncate text-sm font-semibold text-white max-w-[240px] sm:max-w-md" title={currentPhoto.name}>
							{currentPhoto.name}
						</span>
						{#if safeImages.length > 1}
							<span class="rounded-full bg-[#262a30] px-2 py-0.5 text-[11px] font-medium text-gray-300">
								{safeIndex + 1} of {safeImages.length}
							</span>
						{/if}
					</div>
					{#if currentPhoto.byte_size}
						<div class="text-[11px] text-gray-400">
							{formatByteSize(currentPhoto.byte_size)}
						</div>
					{/if}
				</div>
			</div>

			<!-- Right: Interactive Controls -->
			<div class="flex items-center gap-1 sm:gap-2">
				<!-- Zoom out -->
				<button
					type="button"
					on:click={zoomOut}
					disabled={zoom <= 1}
					class="rounded-lg p-2 text-gray-300 hover:bg-[#20242b] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
					title="Zoom out (-)"
					aria-label="Zoom out"
				>
					<svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
					</svg>
				</button>

				<!-- Zoom reset pill -->
				<button
					type="button"
					on:click={resetTransform}
					class="rounded-lg px-2 py-1 text-xs font-medium text-gray-300 hover:bg-[#20242b] hover:text-lime-400 transition"
					title="Reset zoom & rotation (0)"
				>
					{Math.round(zoom * 100)}%
				</button>

				<!-- Zoom in -->
				<button
					type="button"
					on:click={zoomIn}
					disabled={zoom >= 3.5}
					class="rounded-lg p-2 text-gray-300 hover:bg-[#20242b] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
					title="Zoom in (+)"
					aria-label="Zoom in"
				>
					<svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
				</button>

				<!-- Rotate -->
				<button
					type="button"
					on:click={rotate}
					class="rounded-lg p-2 text-gray-300 hover:bg-[#20242b] hover:text-lime-400 transition"
					title="Rotate 90° clockwise (R)"
					aria-label="Rotate"
				>
					<svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
				</button>

				<!-- Open in new tab -->
				<a
					href={currentPhoto.url}
					target="_blank"
					rel="noopener noreferrer"
					class="rounded-lg p-2 text-gray-300 hover:bg-[#20242b] hover:text-lime-400 transition"
					title="Open original image in new tab"
					aria-label="Open original"
				>
					<svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
						/>
					</svg>
				</a>

				<!-- Download -->
				<button
					type="button"
					on:click={downloadCurrentPhoto}
					class="rounded-lg p-2 text-gray-300 hover:bg-[#20242b] hover:text-lime-400 transition"
					title="Download image"
					aria-label="Download"
				>
					<svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
						/>
					</svg>
				</button>

				{#if canDelete}
					<!-- Delete -->
					<button
						type="button"
						on:click={handleDeleteCurrent}
						class="rounded-lg p-2 text-red-400 hover:bg-red-950/40 hover:text-red-300 transition"
						title="Delete photo"
						aria-label="Delete photo"
					>
						<svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
							/>
						</svg>
					</button>
				{/if}

				<!-- Close -->
				<button
					type="button"
					on:click={close}
					class="ml-1 sm:ml-2 rounded-lg p-2 text-gray-400 hover:bg-[#20242b] hover:text-white transition"
					title="Close viewer (Esc)"
					aria-label="Close"
				>
					<svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<!-- 2. Center Stage (Image display & arrows) -->
		<div
			class="relative flex-1 flex items-center justify-center overflow-hidden p-2 sm:p-6"
			on:wheel={handleWheel}
		>
			<!-- Previous arrow button -->
			{#if safeImages.length > 1}
				<button
					type="button"
					on:click|stopPropagation={prev}
					class="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-[#333842] bg-[#141619]/90 text-gray-200 shadow-xl backdrop-blur-sm transition hover:scale-105 hover:border-lime-500/50 hover:bg-[#1f2329] hover:text-lime-400"
					title="Previous photo (ArrowLeft)"
					aria-label="Previous photo"
				>
					<svg class="h-6 w-6 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
			{/if}

			<!-- Image viewport container -->
			<div
				class="relative max-h-full max-w-full flex items-center justify-center"
				on:click|stopPropagation
				on:dblclick={handleDoubleClick}
				on:mousedown={handleMouseDown}
				style="cursor: {zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'};"
			>
				{#if isImageLoading}
					<div class="absolute inset-0 flex items-center justify-center">
						<div class="h-10 w-10 animate-spin rounded-full border-2 border-lime-400 border-t-transparent"></div>
					</div>
				{/if}

				{#if hasImageError}
					<div class="flex flex-col items-center justify-center p-8 text-center">
						<svg class="h-12 w-12 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						<p class="text-sm font-semibold text-gray-200">Unable to preview image</p>
						<a
							href={currentPhoto.url}
							target="_blank"
							rel="noopener noreferrer"
							class="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-lime-500/40 bg-lime-500/10 px-3 py-1.5 text-xs font-semibold text-lime-400 hover:bg-lime-500/20"
						>
							Open original file
						</a>
					</div>
				{:else}
					<img
						src={currentPhoto.url}
						alt={currentPhoto.name || 'Task image'}
						on:load={() => (isImageLoading = false)}
						on:error={() => {
							isImageLoading = false;
							hasImageError = true;
						}}
						class="max-h-[72vh] max-w-[88vw] object-contain rounded-lg shadow-2xl select-none"
						style="transform: translate({translateX}px, {translateY}px) scale({zoom}) rotate({rotation}deg); transform-origin: center center; transition: {isDragging ? 'none' : 'transform 0.15s ease-out'};"
						draggable="false"
					/>
				{/if}
			</div>

			<!-- Next arrow button -->
			{#if safeImages.length > 1}
				<button
					type="button"
					on:click|stopPropagation={next}
					class="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-[#333842] bg-[#141619]/90 text-gray-200 shadow-xl backdrop-blur-sm transition hover:scale-105 hover:border-lime-500/50 hover:bg-[#1f2329] hover:text-lime-400"
					title="Next photo (ArrowRight)"
					aria-label="Next photo"
				>
					<svg class="h-6 w-6 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			{/if}
		</div>

		<!-- 3. Bottom Thumbnail Carousel -->
		{#if safeImages.length > 1}
			<div
				class="relative z-10 border-t border-[#262a30] bg-[#141619]/95 px-4 py-3"
				on:click|stopPropagation
			>
				<div class="mx-auto flex max-w-5xl items-center justify-center gap-2 overflow-x-auto py-1 scrollbar-thin">
					{#each safeImages as photo, idx (photo.id || photo.url || idx)}
						<button
							type="button"
							on:click={() => selectIndex(idx)}
							class="relative h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden rounded-lg border transition-all duration-150 {idx ===
							safeIndex
								? 'border-lime-400 ring-2 ring-lime-400/50 scale-105'
								: 'border-[#262a30] opacity-60 hover:opacity-100 hover:border-gray-400'}"
							title={photo.name}
						>
							<img
								src={photo.url}
								alt={photo.name}
								class="h-full w-full object-cover"
								loading="lazy"
							/>
							{#if idx === safeIndex}
								<div class="absolute inset-0 bg-lime-400/10 pointer-events-none"></div>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.animate-fadeIn {
		animation: fadeIn 0.15s ease-out;
	}
</style>
