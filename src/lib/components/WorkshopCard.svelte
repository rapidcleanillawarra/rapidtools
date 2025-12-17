<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { base } from '$app/paths';
	import type { WorkshopRecord } from '$lib/services/workshop';

	export let workshop: WorkshopRecord;
	export let viewMode: 'table' | 'board' = 'table';
	export let draggable: boolean = true;
	export let draggedWorkshopId: string | null = null;
	export let recentlyMovedWorkshopId: string | null = null;

	const dispatch = createEventDispatcher<{
		click: { workshop: WorkshopRecord };
		photoClick: { workshop: WorkshopRecord; photoIndex: number };
		deleteClick: { workshop: WorkshopRecord };
		dragstart: { workshop: WorkshopRecord; event: DragEvent };
		completed: { workshop: WorkshopRecord };
	}>();

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString('en-AU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatDateShort(dateString: string) {
		return new Date(dateString).toLocaleDateString('en-AU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'new':
				return 'bg-yellow-100 text-yellow-800';
			case 'to_be_quoted':
				return 'bg-orange-100 text-orange-800';
			case 'docket_ready':
				return 'bg-blue-100 text-blue-800';
			case 'quoted':
				return 'bg-green-100 text-green-800';
			case 'repaired':
				return 'bg-teal-100 text-teal-800';
			case 'waiting_approval_po':
				return 'bg-purple-100 text-purple-800';
			case 'waiting_for_parts':
				return 'bg-gray-100 text-gray-800';
			case 'booked_in_for_repair_service':
				return 'bg-indigo-100 text-indigo-800';
			case 'pending_jobs':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function handleClick() {
		dispatch('click', { workshop });
	}

	function handlePhotoClick(photoIndex: number, event: Event) {
		event.stopPropagation();
		dispatch('photoClick', { workshop, photoIndex });
	}

	function handleDeleteClick(event: Event) {
		event.stopPropagation();
		dispatch('deleteClick', { workshop });
	}

	function handleDragStart(event: DragEvent) {
		if (!draggable) {
			console.log('[CARD_DRAG_BLOCKED] Drag not allowed for workshop:', workshop.id);
			event.preventDefault();
			return;
		}

		const dragData = {
			workshopId: workshop.id,
			currentStatus: workshop.status
		};
		console.log('[CARD_DRAG_START] Starting drag - Data:', dragData, 'Timestamp:', Date.now());

		// Set the drag data to include the workshop ID
		event.dataTransfer!.setData('application/json', JSON.stringify(dragData));
		// Set drag effect
		event.dataTransfer!.effectAllowed = 'move';

		console.log('[CARD_DRAG_DISPATCH] Dispatching dragstart event for workshop:', workshop.id);
		dispatch('dragstart', { workshop, event });
	}

	function handleCompletedClick(event: Event) {
		event.stopPropagation();
		dispatch('completed', { workshop });
	}

	function showCompletedButton(status: string): boolean {
		return ['repaired', 'pickup_from_workshop', 'return'].includes(status);
	}
</script>

{#if viewMode === 'table'}
	<!-- Table Row View -->
	<tr
		class="cursor-pointer transition-colors hover:bg-gray-50"
		on:click={handleClick}
		role="button"
		tabindex="0"
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleClick();
			}
		}}
	>
		<td class="whitespace-nowrap px-4 py-4">
			<span
				class="inline-flex rounded-full px-2 py-1 text-xs font-semibold {getStatusColor(
					workshop.status
				)}"
			>
				{workshop.status.replace('_', ' ').toUpperCase()}
			</span>
		</td>
		<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-900">
			{#if workshop.photo_urls && workshop.photo_urls.length > 0}
				<div class="flex items-center space-x-1">
					{#each workshop.photo_urls.slice(0, 3) as photoUrl, index}
						<div class="group relative">
							<!-- Photo thumbnail -->
							<button
								type="button"
								class="h-28 w-28 cursor-pointer overflow-hidden rounded border-0 bg-transparent p-0 transition-all hover:ring-2 hover:ring-blue-300"
								on:click={(e) => handlePhotoClick(index, e)}
								aria-label="View photo {index + 1} of {workshop.photo_urls?.length || 0}"
							>
								<img src={photoUrl} alt="" class="h-full w-full rounded-md object-cover" />
							</button>
						</div>
					{/each}

					<!-- Show count if more than 3 photos -->
					{#if workshop.photo_urls.length > 3}
						<div
							class="flex h-28 w-28 items-center justify-center rounded bg-gray-100 text-lg font-medium text-gray-600"
						>
							+{workshop.photo_urls.length - 3}
						</div>
					{/if}
				</div>
			{:else}
				<div class="text-xs text-gray-400">No photos</div>
			{/if}
		</td>
		<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-900">
			<div class="text-sm font-medium text-gray-900">
				{new Date(workshop.created_at).toLocaleDateString('en-AU', {
					day: '2-digit',
					month: '2-digit',
					year: 'numeric'
				})}
			</div>
			<div class="text-xs text-gray-500">
				{new Date(workshop.created_at).toLocaleTimeString('en-AU', {
					hour: '2-digit',
					minute: '2-digit'
				})}
			</div>
		</td>
		<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-900">
			<div class="text-sm font-medium text-gray-900">
				{workshop.created_by || 'Unknown'}
			</div>
		</td>
		<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-900">
			{workshop.clients_work_order || 'N/A'}
		</td>
		<td class="whitespace-normal px-4 py-4">
			<div class="text-sm font-medium text-gray-900">
				{workshop.product_name}
			</div>
			<div class="text-sm text-gray-500">
				{workshop.make_model}
			</div>
		</td>
		<td class="whitespace-normal px-4 py-4">
			<div class="text-sm font-medium text-gray-900">
				{workshop.customer_name}
			</div>
			{#if workshop.customer_data}
				<div class="text-sm text-gray-500">
					{workshop.customer_data.EmailAddress || ''}
				</div>
			{/if}
		</td>
		<td class="relative whitespace-nowrap px-4 py-4 text-sm text-gray-900">
			<!-- X delete button positioned in upper right corner -->
			<button
				type="button"
				class="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white transition-colors duration-200 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
				on:click={handleDeleteClick}
				title="Delete workshop"
				aria-label="Delete workshop"
			>
				<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</td>
	</tr>
{:else}
	<!-- Board Card View -->
	<div
		class="relative cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all duration-200 hover:shadow-md"
		class:bg-purple-50={workshop.status === 'quoted'}
		class:bg-green-50={workshop.status === 'repaired'}
		class:cursor-move={draggable}
		class:opacity-50={draggedWorkshopId === workshop.id}
		class:scale-95={draggedWorkshopId === workshop.id}
		class:rotate-2={draggedWorkshopId === workshop.id}
		class:border-2={recentlyMovedWorkshopId === workshop.id}
		class:border-green-400={recentlyMovedWorkshopId === workshop.id}
		class:shadow-lg={recentlyMovedWorkshopId === workshop.id}
		on:click={handleClick}
		on:dragstart={handleDragStart}
		{draggable}
		role="button"
		tabindex="0"
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleClick();
			}
		}}
	>
		<!-- Photo Section -->
		{#if workshop.photo_urls && workshop.photo_urls.length > 0}
			<div class="mb-3">
				{#if workshop.photo_urls.length === 1}
					<!-- Single photo display -->
					<div class="relative">
						<!-- Photo thumbnail -->
						<button
							type="button"
							class="h-40 w-full cursor-pointer overflow-hidden rounded border-0 bg-transparent p-0 transition-all hover:ring-2 hover:ring-blue-300"
							on:click={(e) => handlePhotoClick(0, e)}
							aria-label="View photo for {workshop.product_name} workshop"
						>
							<img
								src={workshop.photo_urls[0]}
								alt=""
								class="h-full w-full rounded-md object-cover"
							/>
						</button>
					</div>
				{:else}
					<!-- Multiple photos display - show only first image -->
					<div class="relative">
						<!-- Photo thumbnail -->
						<button
							type="button"
							class="h-40 w-full cursor-pointer overflow-hidden rounded border-0 bg-transparent p-0 transition-all hover:ring-2 hover:ring-blue-300"
							on:click={(e) => handlePhotoClick(0, e)}
							aria-label="View first photo of {workshop.photo_urls.length} total photos"
						>
							<img
								src={workshop.photo_urls[0]}
								alt=""
								class="h-full w-full rounded-md object-cover"
							/>
						</button>

						<!-- Photo count indicator for multiple photos -->
						{#if workshop.photo_urls.length > 1}
							<div
								class="absolute right-1 top-1 rounded-full bg-black bg-opacity-70 px-1.5 py-0.5 text-xs text-white"
							>
								{workshop.photo_urls.length}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			<!-- No photos placeholder -->
			<div class="mb-3">
				<div
					class="flex h-32 w-full items-center justify-center rounded border border-gray-200 bg-gray-100 text-xs text-gray-400"
				>
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
						></path>
					</svg>
				</div>
			</div>
		{/if}

		<div class="mb-2 flex items-start justify-between">
			<div class="min-w-0 flex-1">
				<h4 class="truncate text-xs font-medium text-gray-900">
					{#if workshop.order_id && workshop.order_id.trim()}
						{workshop.order_id}
					{:else}
						{workshop.product_name}
					{/if}
				</h4>
				<p class="truncate text-xs text-gray-500">{workshop.customer_name}</p>
				{#if workshop.customer_data?.BillingAddress?.BillCompany}
					<p class="truncate text-xs text-gray-400">
						Company: {workshop.customer_data.BillingAddress.BillCompany}
					</p>
				{/if}
				<p class="truncate text-xs text-gray-400">
					{#if workshop.make_model && workshop.product_name}
						Machine: {workshop.make_model} - {workshop.product_name}
					{:else if workshop.make_model}
						Machine: {workshop.make_model}
					{:else if workshop.product_name}
						Machine: {workshop.product_name}
					{:else}
						Machine: N/A
					{/if}
				</p>
			</div>
		</div>

		<div class="mb-2 text-xs text-gray-500">
			<div>WO: {workshop.clients_work_order || 'N/A'}</div>
			<div>{formatDateShort(workshop.created_at)}</div>
		</div>

		<!-- Completed button for specific statuses -->
		{#if showCompletedButton(workshop.status)}
			<button
				type="button"
				class="mb-2 w-full rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
				on:click={handleCompletedClick}
				title="Mark as completed"
				aria-label="Mark workshop as completed"
			>
				Mark as completed
			</button>
		{/if}

		<!-- Print Tag button -->
		<a
			href="{base}/workshop-tag/print?id={workshop.id}"
			target="_blank"
			rel="noopener noreferrer"
			class="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
			on:click={(e) => e.stopPropagation()}
			title="Print thermal tag"
			aria-label="Print thermal tag for workshop"
		>
			<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
				></path>
			</svg>
			Print Tag
		</a>

		<!-- X delete button positioned in upper right corner -->
		<button
			type="button"
			class="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white transition-colors duration-200 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
			on:click={handleDeleteClick}
			title="Delete workshop"
			aria-label="Delete workshop"
		>
			<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	</div>
{/if}
