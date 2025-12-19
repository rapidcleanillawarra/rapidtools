<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	export let data: {
		products: Array<{
			sku: string;
			name: string;
			brand: string;
			rrp: number;
			image: string | null;
		}>;
		error?: string;
	};

	let printTriggered = false;

	onMount(() => {
		// Auto-trigger print after images and barcodes load
		if (!data.error && data.products.length > 0 && !printTriggered) {
			printTriggered = true;
			setTimeout(() => {
				if (browser) {
					window.print();
				}
			}, 1500);
		}
	});

	function getBarcodeUrl(sku: string) {
		// Use bwip-js online API for barcode generation (Code 128)
		return `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(sku)}&scale=2&rotate=N&includetext`;
	}

	function formatPrice(price: number | string) {
		const n = typeof price === 'number' ? price : parseFloat(String(price));
		return isNaN(n) ? 'N/A' : n.toFixed(2);
	}
</script>

<svelte:head>
	<title>Print Barcodes</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if data.error}
	<div class="error-page">
		<div class="error-icon">!</div>
		<h2>Error</h2>
		<p>{data.error}</p>
	</div>
{:else if data.products.length === 0}
	<div class="error-page">
		<h2>No products found</h2>
		<p>Please select products to print barcodes for.</p>
	</div>
{:else}
	<div class="labels-container">
		{#each data.products as product}
			<div class="label-sheet">
				<div class="label-content">
					<div class="product-info">
						<div class="brand-name">{product.brand || ''}</div>
						<div class="product-name">{product.name || ''}</div>
					</div>

					<div class="barcode-container">
						<img
							src={getBarcodeUrl(product.sku)}
							alt="Barcode for {product.sku}"
							class="barcode-img"
						/>
					</div>

					<div class="footer-info">
						<div class="sku-text">SKU: {product.sku}</div>
						<div class="price-text">${formatPrice(product.rrp)}</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(body) {
		background: #f3f4f6;
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif;
	}

	.error-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		text-align: center;
		padding: 20px;
	}

	.error-icon {
		width: 64px;
		height: 64px;
		background: #fee2e2;
		color: #ef4444;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 32px;
		font-weight: bold;
		margin-bottom: 16px;
	}

	/* Screen Styling */
	.labels-container {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 20px;
		align-items: center;
	}

	.label-sheet {
		background: white;
		width: 80mm;
		height: 40mm;
		padding: 4mm;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		border: 1px solid #e5e7eb;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		overflow: hidden;
	}

	.label-content {
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.product-info {
		text-align: center;
	}

	.brand-name {
		font-size: 8pt;
		font-weight: 600;
		color: #4b5563;
		text-transform: uppercase;
		line-height: 1.2;
	}

	.product-name {
		font-size: 10pt;
		font-weight: 700;
		color: #111827;
		line-height: 1.2;
		margin-top: 2pt;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.barcode-container {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 4pt 0;
		overflow: hidden;
	}

	.barcode-img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.footer-info {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		border-top: 0.5pt solid #e5e7eb;
		padding-top: 2pt;
	}

	.sku-text {
		font-size: 8pt;
		font-family: monospace;
		color: #374151;
	}

	.price-text {
		font-size: 12pt;
		font-weight: 800;
		color: #000;
	}

	/* Print Styling */
	@media print {
		:global(body) {
			background: white;
			padding: 0;
			margin: 0;
		}

		.labels-container {
			display: block;
			padding: 0;
		}

		.label-sheet {
			page-break-after: always;
			box-shadow: none;
			border: none;
			margin: 0;
			width: 100%; /* Adjust to printer width */
			height: auto;
			min-height: 40mm;
		}

		@page {
			size: 80mm 40mm; /* standard small label size */
			margin: 0;
		}
	}
</style>
