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

	function formatPrice(price: number | string) {
		const n = typeof price === 'number' ? price : parseFloat(String(price));
		return isNaN(n) ? 'N/A' : n.toFixed(2);
	}
</script>

<svelte:head>
	<title>Print Product Labels</title>
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
		<p>Please select products to print labels for.</p>
	</div>
{:else}
	<div class="labels-container">
		{#each data.products as product}
			<div class="label-sheet">
				<div class="label-content">
					<div class="image-container">
						{#if product.image}
							<img src={product.image} alt={product.name || product.sku} class="product-img" />
						{:else}
							<div class="no-image">No Image</div>
						{/if}
					</div>

					<div class="info-section">
						<div class="product-name">{product.name || ''}</div>
						<div class="price-row">
							<span class="price-text">${formatPrice(product.rrp)}</span>
							<span class="gst-text">(inc. GST)</span>
						</div>
						<div class="footer-info">
							<div class="sku-text">{product.sku}</div>
							<div class="brand-name">{product.brand || ''}</div>
						</div>
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
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		padding: 10px;
		max-width: 210mm;
		margin: 0 auto;
	}

	.label-sheet {
		background: white;
		width: 100%;
		height: 35mm;
		padding: 2mm 3mm;
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
		border: 1px solid #d1d5db;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		overflow: hidden;
	}

	.label-content {
		height: 100%;
		display: flex;
		flex-direction: row;
		gap: 3mm;
	}

	.image-container {
		width: 30mm;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: #f9fafb;
		border-radius: 2px;
	}

	.product-img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.no-image {
		font-size: 7pt;
		color: #9ca3af;
		text-align: center;
	}

	.info-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-width: 0;
	}

	.product-name {
		font-size: 9pt;
		font-weight: 700;
		color: #000;
		line-height: 1.15;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.price-row {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}

	.price-text {
		font-size: 18pt;
		font-weight: 900;
		color: #16a34a;
	}

	.gst-text {
		font-size: 7pt;
		color: #6b7280;
	}

	.footer-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.sku-text {
		font-size: 7pt;
		font-family: monospace;
		color: #6b7280;
	}

	.brand-name {
		font-size: 7pt;
		font-weight: 500;
		color: #6b7280;
		text-transform: uppercase;
	}

	/* Print Styling - A4 with 2 columns */
	@media print {
		@page {
			size: A4;
			margin: 8mm;
		}

		:global(body) {
			background: white;
			padding: 0;
			margin: 0;
		}

		.labels-container {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 4mm;
			padding: 0;
			max-width: 100%;
		}

		.label-sheet {
			box-shadow: none;
			border: 0.5pt solid #999;
			margin: 0;
			width: 100%;
			height: 35mm;
			page-break-inside: avoid;
		}
	}
</style>
