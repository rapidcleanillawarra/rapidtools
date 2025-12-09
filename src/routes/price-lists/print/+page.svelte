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
		error?: string;
	};

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
		<!-- Print header (repeats on each page via position: fixed) -->
		<div class="print-header">
			<div class="print-header-inner">
				<img
					src="https://www.rapidsupplies.com.au/assets/images/company_logo_white.png"
					alt="RapidClean"
					class="print-logo"
				/>
				<h1 class="document-title">{data.filename || 'Price List'}</h1>
			</div>
		</div>

		<!-- Print footer with page numbers -->
		<div class="print-footer">
			<span class="page-number"></span>
		</div>

		<div class="catalog-content">
			{#each data.items as item}
				{#if item.kind === 'static' && item.staticType === 'page_break'}
					<div class="page-break"></div>
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
		transition: all 0.2s ease;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.print-button:hover {
		background: #6fa030;
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.print-button:active {
		transform: translateY(0);
	}

	/* Print header (visible when printing) */
	.print-header {
		display: none;
	}

	.print-header-inner {
		background: #222222;
		color: #fff;
		padding: 16px 24px;
		display: flex;
		align-items: center;
		gap: 20px;
	}

	.print-logo {
		height: 40px;
		width: auto;
	}

	.document-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #fff;
		flex: 1;
	}

	/* Print footer (visible when printing) */
	.print-footer {
		display: none;
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
	}

	/* Range header - Green accent */
	.range-header {
		grid-column: 1 / -1;
		background: #80BB3D;
		color: #fff;
		padding: 16px 24px;
		border-radius: 8px;
		margin-top: 16px;
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

	/* Page break */
	.page-break {
		display: none;
	}

	/* Product card */
	.product-card {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		overflow: hidden;
		transition: box-shadow 0.2s ease;
		display: flex;
		flex-direction: column;
	}

	.product-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.product-image-container {
		width: 100%;
		height: 180px;
		background: #f9fafb;
		display: flex;
		align-items: center;
		justify-content: center;
		border-bottom: 1px solid #e5e7eb;
	}

	.product-image {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		padding: 12px;
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

	.product-description {
		font-size: 0.8125rem;
		color: #4b5563;
		line-height: 1.5;
		margin-top: 4px;
	}

	/* Print styles */
	@media print {
		@page {
			margin: 0;
			size: A4;
		}

		@page :first {
			margin-top: 0;
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

		/* Fixed header that repeats on every page */
		.print-header {
			display: block !important;
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			z-index: 1000;
		}

		.print-header-inner {
			padding: 12px 20px;
		}

		.print-logo {
			height: 32px;
		}

		.document-title {
			font-size: 1.25rem;
		}

		/* Fixed footer with page numbers */
		.print-footer {
			display: block !important;
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			background: #fff;
			padding: 8px 20px;
			text-align: center;
			font-size: 0.75rem;
			color: #666;
			border-top: 1px solid #e5e7eb;
		}

		.page-number::after {
			content: counter(page);
			counter-increment: page;
		}

		.print-footer::before {
			content: "Page ";
		}

		/* Content area with margins for fixed header/footer */
		.catalog-content {
			padding: 80px 20px 50px 20px;
			gap: 12px;
			grid-template-columns: repeat(3, 1fr);
			margin: 0;
		}

		.product-card {
			break-inside: avoid;
			page-break-inside: avoid;
			box-shadow: none;
			border: 1px solid #d1d5db;
		}

		.product-card:hover {
			box-shadow: none;
		}

		.product-image-container {
			height: 100px;
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
			margin-top: 12px;
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

		.page-break {
			display: block;
			grid-column: 1 / -1;
			height: 0;
			break-before: page;
			page-break-before: always;
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
	}
</style>
