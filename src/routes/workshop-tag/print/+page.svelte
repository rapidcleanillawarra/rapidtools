<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	export let data: {
		id: string | null;
		workshop: {
			order_id: string | null;
			clients_work_order: string | null;
			product_name: string | null;
			customer_name: string | null;
			customer_data: {
				BillingAddress?: {
					BillCompany?: string;
				};
			} | null;
			optional_contacts: Array<{
				name: string;
				number: string;
				email: string;
			}> | null;
			make_model: string | null;
			serial_number: string | null;
			site_location: string | null;
			fault_description: string | null;
			created_at: string | null;
		} | null;
		error?: string;
	};

	let printTriggered = false;

	// Format date for display
	function formatDate(dateString: string | null): string {
		if (!dateString) return '';
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString('en-AU', {
				day: '2-digit',
				month: 'short',
				year: 'numeric'
			});
		} catch {
			return dateString;
		}
	}

	const handlePrint = () => {
		if (browser) {
			window.print();
		}
	};

	onMount(() => {
		// Auto-trigger print after a short delay to allow content to render
		if (!data.error && data.workshop && !printTriggered) {
			printTriggered = true;
			setTimeout(() => {
				handlePrint();
			}, 800);
		}
	});

	$: workshop = data.workshop;
	$: dateIssued = formatDate(workshop?.created_at || null);
	$: orderId = workshop?.order_id || 'N/A';
	$: company = workshop?.customer_data?.BillingAddress?.BillCompany || '';
	$: optionalContacts = workshop?.optional_contacts || [];
</script>

<svelte:head>
	<title>Workshop Tag - {orderId}</title>
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
				<h1 class="header-title">Workshop Tag #{orderId}</h1>
			</div>
			<button type="button" class="print-button" on:click={handlePrint}> Print Tag </button>
		</div>
	</header>

	{#if data.error}
		<div class="error-container">
			<div class="error-icon">!</div>
			<h2 class="error-title">Unable to Load Workshop</h2>
			<p class="error-message">{data.error}</p>
		</div>
	{:else if !workshop}
		<div class="empty-container">
			<h2 class="empty-title">No Workshop Found</h2>
			<p class="empty-message">The workshop data could not be loaded.</p>
		</div>
	{:else}
		<div class="sticker">
			<div class="accent-bar"></div>

			<table class="header-table">
				<tbody>
					<tr>
						<td>
							<img
								class="logo"
								src="https://www.rapidsupplies.com.au/assets/images/Company%20Logo%20New%20Black.png"
								alt="Company Logo"
							/>
						</td>
						<td class="subtle">Date Issued: {dateIssued}</td>
					</tr>
					<tr>
						<td class="title" colspan="2"># {orderId}</td>
					</tr>
				</tbody>
			</table>

			<table class="tag">
				<tbody>
					<tr>
						<th>Client Work Order</th>
						<td>{workshop.clients_work_order || ''}</td>
					</tr>

					<tr>
						<th>Product Name</th>
						<td>{workshop.product_name || ''}</td>
					</tr>

					<tr>
						<th>Customer Name</th>
						<td>{workshop.customer_name || ''}</td>
					</tr>

					<tr>
						<th>Company</th>
						<td>{company}</td>
					</tr>

					{#if optionalContacts.length > 0}
						<tr>
							<th>Contacts</th>
							<td class="contacts-cell">
								<table class="contacts-table">
									<tbody>
										<tr>
											<th class="contact-header">Name</th>
											<th class="contact-header">Phone</th>
											<th class="contact-header">Email</th>
										</tr>
										{#each optionalContacts as contact}
											<tr>
												<td class="contact-data">{contact.name || ''}</td>
												<td class="contact-data">{contact.number || ''}</td>
												<td class="contact-data">{contact.email || ''}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</td>
						</tr>
					{/if}

					<tr>
						<th>Make / Model</th>
						<td>{workshop.make_model || ''}</td>
					</tr>

					<tr>
						<th>Serial Number</th>
						<td>{workshop.serial_number || ''}</td>
					</tr>

					<tr>
						<th>Site Location</th>
						<td>{workshop.site_location || ''}</td>
					</tr>

					<tr>
						<th>Fault Description</th>
						<td><div class="fault">{workshop.fault_description || ''}</div></td>
					</tr>
				</tbody>
			</table>
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
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		line-height: 1.4;
		color: #1a1a1a;
		background: #f5f5f5;
	}

	.print-page {
		max-width: 600px;
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
		height: 36px;
		width: auto;
	}

	.header-title {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.025em;
	}

	.print-button {
		background: #2c7a7b;
		color: #fff;
		border: none;
		padding: 10px 24px;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		transition: background 0.2s;
	}

	.print-button:hover {
		background: #285e5e;
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

	/* Sticker container */
	.sticker {
		width: 100%;
		background: #ffffff;
		padding: 16px;
	}

	/* Top accent bar */
	.accent-bar {
		height: 8px;
		background: #2c7a7b;
		margin-bottom: 12px;
		width: 100%;
	}

	/* Header table */
	.header-table {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 12px;
	}

	.header-table td {
		vertical-align: middle;
	}

	.logo {
		height: 34px;
		width: auto;
		display: block;
	}

	.title {
		font-size: 20px;
		font-weight: 800;
		color: #1f2937;
		padding: 6px 0 2px 0;
	}

	.subtle {
		font-size: 10px;
		color: #6b7280;
		text-align: right;
		white-space: nowrap;
		font-weight: 600;
	}

	/* Data table */
	table.tag {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		border: 1px solid #d9d9d9;
		overflow: hidden;
	}

	table.tag th,
	table.tag td {
		border-bottom: 1px solid #e6e6e6;
		padding: 8px 10px;
		vertical-align: top;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	table.tag tr:last-child th,
	table.tag tr:last-child td {
		border-bottom: none;
	}

	table.tag th {
		width: 32%;
		background: #f7f7f7;
		text-align: left;
		font-size: 11px;
		color: #111827;
		font-weight: 700;
		letter-spacing: 0.2px;
	}

	table.tag td {
		font-size: 12px;
		font-weight: 600;
		color: #1a1a1a;
	}

	/* Contacts nested table */
	.contacts-cell {
		padding: 0 !important;
	}

	.contacts-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}

	.contact-header {
		width: 33.33%;
		background: #f7f7f7;
		border-bottom: 1px solid #e6e6e6;
		padding: 6px 8px;
		text-align: left;
		font-size: 10px;
		font-weight: 700;
		color: #111827;
	}

	.contact-data {
		border-bottom: 1px solid #e6e6e6;
		padding: 6px 8px;
		word-wrap: break-word;
		overflow-wrap: break-word;
		font-size: 11px;
		font-weight: 600;
	}

	.contacts-table tr:last-child .contact-data {
		border-bottom: none;
	}

	/* Fault description block */
	.fault {
		border: 1px solid #e1e1e1;
		padding: 8px;
		background: #ffffff;
		min-height: 48px;
		white-space: pre-wrap;
		font-weight: 600;
	}

	/* ========================================
     THERMAL PRINTER STYLES (100mm x 150mm)
     ======================================== */
	@media print {
		@page {
			size: 100mm 150mm;
			margin: 4mm;
		}

		:global(html),
		:global(body) {
			background: #fff !important;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
			margin: 0;
			padding: 0;
			font-size: 10px;
		}

		.print-page {
			max-width: 100%;
			margin: 0;
			padding: 0;
			min-height: auto;
		}

		.screen-header {
			display: none !important;
		}

		.sticker {
			padding: 0;
			border: none;
		}

		.accent-bar {
			height: 6px;
			margin-bottom: 8px;
			background: #000 !important;
		}

		.header-table {
			margin-bottom: 8px;
		}

		.logo {
			height: 28px;
		}

		.title {
			font-size: 16px;
			font-weight: 900;
			padding: 4px 0 0 0;
		}

		.subtle {
			font-size: 9px;
			font-weight: 700;
		}

		table.tag th,
		table.tag td {
			padding: 5px 6px;
		}

		table.tag th {
			font-size: 9px;
			font-weight: 800;
			width: 30%;
		}

		table.tag td {
			font-size: 10px;
			font-weight: 700;
		}

		.contact-header {
			font-size: 8px;
			font-weight: 800;
			padding: 4px 5px;
		}

		.contact-data {
			font-size: 9px;
			font-weight: 700;
			padding: 4px 5px;
		}

		.fault {
			min-height: 36px;
			padding: 5px;
			font-size: 10px;
			font-weight: 700;
			border: 1px solid #000;
		}
	}
</style>
