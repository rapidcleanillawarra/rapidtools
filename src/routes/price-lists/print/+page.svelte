<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	export let data: {
		id: string | null;
		filename: string;
		items: Array<{
			id: string;
			sku: string;
			kind: 'sku' | 'static';
			price?: string;
			rrp?: string;
			model?: string;
			imageUrl?: string;
			hasDescription?: boolean;
			shortDescription?: string;
			staticType?: 'page_break' | 'range' | 'category';
			value?: string;
		}>;
		mode?: 'thumb' | 'list';
		includeRrp?: boolean;
		crossRrp?: boolean;
		error?: string;
	};

	$: isListMode = data.mode === 'list';

	let printTriggered = false;

	const handlePrint = () => {
		if (browser) {
			window.print();
		}
	};

onMount(() => {
	// Auto-trigger print after a short delay to allow images to load
	if (!data.error && data.items.length > 0 && !printTriggered) {
		printTriggered = true;
		setTimeout(() => {
			handlePrint();
		}, 2000);
	}
});
</script>

<svelte:head>
	<title>{data.filename || 'Price List'} - Print</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="print-page">
	<!-- Screen-only header with print button -->
	<header class="screen-header">
		<div class="header-content">
			<div class="header-left">
				<img
					src="https://www.rapidsupplies.com.au/assets/images/company_logo_white.png"
					alt="RapidClean"
					class="header-logo"
				/>
				<h1 class="header-title">{data.filename || 'Price List'}</h1>
			</div>
			<button type="button" class="print-button" on:click={handlePrint}>
				Print Price List
			</button>
		</div>
	</header>

	{#if data.error}
		<div class="error-container">
			<div class="error-icon">!</div>
			<h2 class="error-title">Unable to Load Price List</h2>
			<p class="error-message">{data.error}</p>
		</div>
	{:else if data.items.length === 0}
		<div class="empty-container">
			<h2 class="empty-title">No Items Found</h2>
			<p class="empty-message">This price list doesn't contain any items yet.</p>
		</div>
	{:else}
		{#if isListMode}
			<div class="list-content">
				<!-- Header for the first page -->
				<div class="page-break-header">
					<div class="page-break-header-inner">
						<img
							src="https://www.rapidsupplies.com.au/assets/images/company_logo_white.png"
							alt="RapidClean"
							class="print-logo"
						/>
						<h1 class="document-title">{data.filename || 'Price List'}</h1>
						<span class="page-counter" aria-hidden="true"></span>
					</div>
				</div>

				<table class="list-table">
					<tbody>
						{#each data.items as item, index}
							{@const prevItem = index > 0 ? data.items[index - 1] : null}
							{@const shouldShowHeaderBeforeSku = item.kind === 'sku' && (index === 0 || (prevItem && prevItem.kind === 'static' && prevItem.staticType !== 'category'))}
							
							{#if item.kind === 'static' && item.staticType === 'page_break'}
								<tr class="page-break-row">
									<td colspan={data.includeRrp ? "6" : "5"} class="page-break-cell">
										<div class="page-break-header is-break">
											<div class="page-break-header-inner">
												<img
													src="https://www.rapidsupplies.com.au/assets/images/company_logo_white.png"
													alt="RapidClean"
													class="print-logo"
												/>
												<h2 class="document-title">{data.filename || 'Price List'}</h2>
												<span class="page-counter" aria-hidden="true"></span>
											</div>
										</div>
									</td>
								</tr>
							{:else if item.kind === 'static' && item.staticType === 'range'}
								<tr class="range-row">
									<td colspan={data.includeRrp ? "6" : "5"} class="range-cell">
										<span class="range-label">{item.value || 'Range'}</span>
									</td>
								</tr>
							{:else if item.kind === 'static' && item.staticType === 'category'}
								<tr class="category-row">
									<td colspan={data.includeRrp ? "6" : "5"} class="category-cell">
										<span class="category-label">{item.value || 'Category'}</span>
									</td>
								</tr>
								<!-- Table header after category -->
								<tr class="table-header-row">
									<th class="col-image table-header-cell">Image</th>
									<th class="col-sku table-header-cell">SKU</th>
									<th class="col-model table-header-cell">Model</th>
									<th class="col-description table-header-cell">Description</th>
									<th class="col-price table-header-cell">Price</th>
									{#if data.includeRrp}
										<th class="col-rrp table-header-cell">RRP</th>
									{/if}
								</tr>
							{:else if item.kind === 'sku'}
								{#if shouldShowHeaderBeforeSku}
									<!-- Table header before first SKU if no category before -->
									<tr class="table-header-row">
										<th class="col-image table-header-cell">Image</th>
										<th class="col-sku table-header-cell">SKU</th>
										<th class="col-model table-header-cell">Model</th>
										<th class="col-description table-header-cell">Description</th>
										<th class="col-price table-header-cell">Price</th>
										{#if data.includeRrp}
											<th class="col-rrp table-header-cell">RRP</th>
										{/if}
									</tr>
								{/if}
								<tr class="list-item-row">
									<td class="col-image table-cell">
										{#if item.imageUrl}
											<img
												src={item.imageUrl}
												alt={item.model || item.sku}
												class="list-image"
												loading="lazy"
											/>
										{:else}
											<div class="no-image-small">No Image</div>
										{/if}
									</td>
									<td class="col-sku table-cell">{item.sku}</td>
									<td class="col-model table-cell">{item.model || '—'}</td>
									<td class="col-description table-cell">{item.shortDescription || '—'}</td>
									<td class="col-price table-cell">${item.price || '—'}</td>
									{#if data.includeRrp}
										<td class="col-rrp table-cell {data.crossRrp ? 'crossed' : ''}">{item.rrp || '—'}</td>
									{/if}
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="catalog-content">
				<!-- Header for the first page -->
				<div class="page-break-header">
					<div class="page-break-header-inner">
						<img
							src="https://www.rapidsupplies.com.au/assets/images/company_logo_white.png"
							alt="RapidClean"
							class="print-logo"
						/>
						<h1 class="document-title">{data.filename || 'Price List'}</h1>
						<span class="page-counter" aria-hidden="true"></span>
					</div>
				</div>

				{#each data.items as item}
					{#if item.kind === 'static' && item.staticType === 'page_break'}
						<div class="page-break-header is-break">
							<div class="page-break-header-inner">
								<img
									src="https://www.rapidsupplies.com.au/assets/images/company_logo_white.png"
									alt="RapidClean"
									class="print-logo"
								/>
								<h2 class="document-title">{data.filename || 'Price List'}</h2>
								<span class="page-counter" aria-hidden="true"></span>
							</div>
						</div>
					{:else if item.kind === 'static' && item.staticType === 'range'}
						<div class="range-header">
							<span class="range-label">{item.value || 'Range'}</span>
						</div>
					{:else if item.kind === 'static' && item.staticType === 'category'}
						<div class="category-header">
							<span class="category-label">{item.value || 'Category'}</span>
						</div>
					{:else if item.kind === 'sku'}
						<div class="product-card">
							<div class="product-image-container">
								{#if item.imageUrl}
									<img
										src={item.imageUrl}
										alt={item.model || item.sku}
										class="product-image"
										loading="lazy"
									/>
								{:else}
									<div class="no-image">
										<span>No Image</span>
									</div>
								{/if}
							</div>
							<div class="product-details">
								<p class="product-sku">{item.sku}</p>
								{#if item.model}
									<p class="product-model">{item.model}</p>
								{/if}
								<div class="product-pricing">
									<span class="product-price">${item.price}</span>
									{#if data.includeRrp && item.rrp}
										<span class="product-rrp {data.crossRrp ? 'crossed' : ''}">RRP: ${item.rrp}</span>
									{/if}
								</div>
								{#if item.shortDescription}
									<p class="product-description">{item.shortDescription}</p>
								{/if}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	/* Reset and base styles */
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
			sans-serif;
		line-height: 1.5;
		color: #1a1a1a;
		background: #f5f5f5;
	}

	.print-page {
		max-width: 1200px;
		margin: 0 auto;
		background: #fff;
		min-height: 100vh;
	}

	/* Screen-only header */
	.screen-header {
		position: sticky;
		top: 0;
		background: #222222;
		color: #fff;
		padding: 16px 24px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: 100;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.header-logo {
		height: 40px;
		width: auto;
	}

	.header-title {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.025em;
	}

	.print-button {
		background: #80BB3D;
		color: #fff;
		border: none;
		padding: 10px 24px;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.print-logo {
		height: 30px;
		width: auto;
	}

	.document-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #fff;
		flex: 1;
	}

	.page-counter {
		color: #fff;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	/* Error state */
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80px 24px;
		text-align: center;
	}

	.error-icon {
		width: 64px;
		height: 64px;
		background: #fef2f2;
		color: #dc2626;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		font-weight: 700;
		margin-bottom: 24px;
	}

	.error-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #1a1a1a;
		margin-bottom: 8px;
	}

	.error-message {
		font-size: 1rem;
		color: #666;
	}

	/* Empty state */
	.empty-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80px 24px;
		text-align: center;
	}

	.empty-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #1a1a1a;
		margin-bottom: 8px;
	}

	.empty-message {
		font-size: 1rem;
		color: #666;
	}

	/* Catalog content */
.catalog-content {
	padding: 24px;
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	gap: 20px;
	counter-reset: page;
}

	/* List content */
	.list-content {
		padding: 24px;
		counter-reset: page;
	}

	.list-table {
		width: 100%;
		border-collapse: collapse;
		background: #fff;
		font-size: 0.875rem;
	}

	/* Base table cell styling */
	.table-cell {
		padding: 10px 8px;
		border-bottom: 1px solid #e5e7eb;
		vertical-align: top;
	}

	.table-header-cell {
		padding: 12px 8px;
		text-align: left;
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 2px solid #80BB3D;
	}

	.table-header-row {
		background: #6c6c6c;
		color: #fff;
		border: none;
	}

	.table-header-row .table-header-cell {
		border: none !important;
		border-top: none !important;
		border-bottom: 2px solid #80BB3D;
		border-left: none !important;
		border-right: none !important;
		color: #fff;
	}

	.col-image {
		width: 80px;
		text-align: center;
	}

	.col-sku {
		width: 120px;
		font-weight: 600;
		color: #6b7280;
		font-size: 0.75rem;
		text-transform: uppercase;
	}

	.col-model {
		width: 180px;
		font-weight: 500;
	}

	.col-description {
		min-width: 250px;
		color: #4b5563;
		line-height: 1.5;
	}

	.col-price {
		width: 100px;
		font-weight: 700;
		color: #80BB3D;
		font-size: 1rem;
		text-align: left;
	}

	.col-rrp {
		width: 100px;
		color: #6b7280;
		text-align: right;
	}

	.col-rrp.crossed {
		text-decoration: line-through;
	}

	.list-image {
		width: 60px;
		height: 60px;
		object-fit: contain;
		border: 1px solid #e5e7eb;
		border-radius: 4px;
		background: #fff;
	}

	.no-image-small {
		width: 60px;
		height: 60px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid #e5e7eb;
		border-radius: 4px;
		background: #f9fafb;
		color: #9ca3af;
		font-size: 0.65rem;
		text-align: center;
		padding: 4px;
	}

	.page-break-row {
		break-before: page;
		page-break-before: always;
		border: none;
	}

	.page-break-row td {
		border: none !important;
		border-top: none !important;
		border-bottom: none !important;
		border-left: none !important;
		border-right: none !important;
	}

	.page-break-cell {
		padding: 0 !important;
		margin: 100px !important;
		border: none !important;
		border-top: none !important;
		border-bottom: none !important;
		border-left: none !important;
		border-right: none !important;
	}

	.range-row {
		background: #80BB3D;
		border: none;
	}

	.range-row td {
		border: none !important;
		border-top: none !important;
		border-bottom: none !important;
		border-left: none !important;
		border-right: none !important;
	}

	.range-cell {
		padding: 8px 12px;
		border: none !important;
		border-top: none !important;
		border-bottom: none !important;
		border-left: none !important;
		border-right: none !important;
	}

	.range-cell .range-label {
		color: #fff;
		font-size: 1.125rem;
		font-weight: 700;
	}

	.category-row {
		background: #222222;
		border: none;
		margin-top: 12px;
	}

	.category-row td {
		border: none !important;
		border-top: none !important;
		border-bottom: none !important;
		border-left: none !important;
		border-right: none !important;
	}

	.category-cell {
		padding: 12px 12px;
		border: none !important;
		border-top: none !important;
		border-bottom: none !important;
		border-left: none !important;
		border-right: none !important;
	}

	.category-cell .category-label {
		color: #fff;
		font-size: 0.9375rem;
		font-weight: 600;
	}

	/* Range header - Green accent */
	.range-header {
		grid-column: 1 / -1;
		background: #80BB3D;
		color: #fff;
		padding: 16px 24px;
		border-radius: 8px;
	}

	.range-header:first-child {
		margin-top: 0;
	}

	.range-label {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	/* Category header */
	.category-header {
		grid-column: 1 / -1;
		background: #222222;
		color: #fff;
		padding: 12px 20px;
		border-radius: 6px;
		border-left: 4px solid #80BB3D;
	}

	.category-label {
		font-size: 1rem;
		font-weight: 600;
	}

/* Page break headers */
.page-break-header {
	grid-column: 1 / -1;
	margin: 4px 0 8px;
	counter-increment: page;
}

.page-break-header-inner {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	background: #222222;
	color: #fff;
	padding: 8px 12px;
	border-radius: 0;
}

.page-break-header.is-break {
	break-before: page;
	page-break-before: always;
	margin-top: 20px;
}

	/* Product card */
	.product-card {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.product-image-container {
		width: 100%;
		height: 180px;
	background: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		border-bottom: 1px solid #e5e7eb;
	}

	.product-image {
	width: 100%;
	height: 100%;
	object-fit: contain;
	padding: 0;
	}

	.no-image {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: #9ca3af;
		font-size: 0.875rem;
	}

	.product-details {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1;
	}

	.product-sku {
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.product-model {
		font-size: 0.9375rem;
		font-weight: 500;
		color: #1a1a1a;
		line-height: 1.4;
	}

	.product-pricing {
		display: flex;
		align-items: baseline;
		gap: 12px;
		flex-wrap: wrap;
		margin-top: auto;
		padding-top: 8px;
		border-top: 1px solid #f3f4f6;
	}

	.product-price {
		font-size: 1.375rem;
		font-weight: 700;
		color: #80BB3D;
	}

	.product-rrp {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #6b7280;
		margin-top: 4px;
	}

	.product-rrp.crossed {
		text-decoration: line-through;
	}

	.product-description {
		font-size: 0.8125rem;
		color: #4b5563;
		line-height: 1.5;
		margin-top: 4px;
	}

	/* Print styles */
	@media print {
		@page {
			margin: 20px;
			size: A4;
		}

		:global(html),
		:global(body) {
			background: #fff;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
			margin: 0;
			padding: 0;
		}

		.print-page {
			max-width: 100%;
			margin: 0;
			padding: 0;
		}

		.screen-header {
			display: none !important;
		}

		.page-counter::after {
			content: 'Page ' counter(page);
		}

		.page-break-header.is-break .page-counter {
			font-size: 1.1rem;
			font-weight: 500;
		}

		/* Content area with margins for fixed header/footer */
		.catalog-content {
			padding: 20px 20px 32px 20px;
			gap: 12px;
			/* Two columns to target ~6 items per page (3 rows) */
			grid-template-columns: repeat(3, 1fr);
			margin: 0;
		}

		.list-content {
			padding: 20px 20px 32px 20px;
			margin: 0;
		}

		.list-table {
			font-size: 0.75rem;
		}

		.table-header-cell {
			padding: 8px 6px;
			font-size: 0.65rem;
		}

		.table-header-row {
			background: #6c6c6c !important;
			color: #fff !important;
		}

		.table-header-row .table-header-cell {
			padding: 8px 6px;
			font-size: 0.65rem;
			border-bottom: 2px solid #80BB3D;
			color: #fff !important;
		}

		.table-cell {
			padding: 8px 6px;
		}

		.col-image {
			width: 60px;
		}

		.col-sku {
			width: 100px;
		}

		.col-model {
			width: 150px;
		}

		.col-description {
			min-width: 200px;
		}

		.col-price {
			width: 80px;
			text-align: left;
		}

		.col-rrp {
			width: 80px;
		}

		.list-image {
			width: 50px;
			height: 50px;
		}

		.no-image-small {
			width: 50px;
			height: 50px;
			font-size: 0.6rem;
		}

		.list-item-row {
			break-inside: avoid;
			page-break-inside: avoid;
		}

		.range-row,
		.category-row {
			break-after: avoid;
			page-break-after: avoid;
		}

		.product-card {
			break-inside: avoid;
			page-break-inside: avoid;
			box-shadow: none;
			border: 1px solid #d1d5db;
			min-height: 320px;
		}

		.product-image-container {
			height: 140px;
		}

		.product-details {
			padding: 10px;
			gap: 4px;
		}

		.product-sku {
			font-size: 0.65rem;
		}

		.product-model {
			font-size: 0.8rem;
			line-height: 1.3;
		}

		.product-price {
			font-size: 1.1rem;
		}

		.product-pricing {
			padding-top: 6px;
		}

		.range-header {
			break-after: avoid;
			page-break-after: avoid;
			padding: 10px 16px;
		}

		.range-label {
			font-size: 1rem;
		}

		.category-header {
			break-after: avoid;
			page-break-after: avoid;
			padding: 8px 14px;
		}

		.category-label {
			font-size: 0.875rem;
		}

		.page-break-header {
			margin: 4px 0 8px;
		}

		.page-break-header.is-break {
			margin: 20px 0 4px;
		}

		.page-break-header-inner {
			padding: 8px 12px;
			box-shadow: none;
		}

		.error-container,
		.empty-container {
			padding: 48px 24px;
		}

		.product-description {
			font-size: 0.7rem;
			line-height: 1.4;
		}
	}

	/* Responsive adjustments */
	@media screen and (max-width: 768px) {
		.catalog-content {
			grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
			padding: 16px;
			gap: 16px;
		}

		.header-content {
			flex-direction: column;
			align-items: stretch;
			text-align: center;
		}

		.header-left {
			flex-direction: column;
			gap: 12px;
		}

		.print-button {
			width: 100%;
		}
	}

	@media screen and (max-width: 480px) {
		.catalog-content {
			grid-template-columns: 1fr;
		}

		.list-content {
			padding: 16px;
			overflow-x: auto;
		}

		.list-table {
			font-size: 0.75rem;
			min-width: 600px;
		}

		.table-header-cell,
		.table-cell {
			padding: 8px 4px;
		}
	}
</style>
