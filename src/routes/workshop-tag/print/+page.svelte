<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { base } from '$app/paths';

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

	// Format date for display in Australian Sydney timezone
	function formatDate(dateString: string | null): string {
		if (!dateString) return '';
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString('en-AU', {
				timeZone: 'Australia/Sydney',
				month: 'long',
				day: 'numeric',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});
		} catch {
			return dateString;
		}
	}

	onMount(() => {
		// Auto-trigger print after a short delay to allow content to render
		if (!data.error && data.workshop && !printTriggered) {
			printTriggered = true;
			setTimeout(() => {
				if (browser) {
					window.print();
				}
			}, 800);
		}
	});

	let qrCodeUrl = '';

	$: workshop = data.workshop;
	$: dateIssued = formatDate(workshop?.created_at || null);
	$: orderId = workshop?.order_id || 'N/A';
	$: company = workshop?.customer_data?.BillingAddress?.BillCompany || 'N/A';
	$: optionalContacts = workshop?.optional_contacts || [];
	$: workshopId = data.id || '';

	// Generate QR code URL dynamically based on current origin
	$: if (browser && workshopId) {
		const fullUrl = `${window.location.origin}${base}/workshop/form?workshop_id=${workshopId}`;
		qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(fullUrl)}`;
	}
</script>

<svelte:head>
	<title>Workshop Tag - {orderId}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if data.error}
	<div class="error-page">
		<div class="error-icon">!</div>
		<h2>Unable to Load Workshop</h2>
		<p>{data.error}</p>
	</div>
{:else if !workshop}
	<div class="error-page">
		<h2>No Workshop Found</h2>
		<p>The workshop data could not be loaded.</p>
	</div>
{:else}
	<div class="sticker">
		<table class="header-table">
			<tbody>
				<tr>
					<td>
						<img
							class="logo"
							src="https://www.rapidsupplies.com.au/assets/images/company_logo_thermal_transparent.png"
							alt="Company Logo"
						/>
					</td>
					<td class="order-id"># {orderId}</td>
				</tr>
			</tbody>
		</table>

		<hr />

		<table class="tag">
			<tbody>
				<tr>
					<th>Client Work Order</th>
					<td>{workshop.clients_work_order || 'N/A'}</td>
				</tr>

				<tr>
					<th>Product Name</th>
					<td>{workshop.product_name || 'N/A'}</td>
				</tr>

				<tr>
					<th>Customer Name</th>
					<td>{workshop.customer_name || 'N/A'}</td>
				</tr>

				<tr>
					<th>Company</th>
					<td>{company}</td>
				</tr>

				<tr>
					<th>Make / Model</th>
					<td>{workshop.make_model || 'N/A'}</td>
				</tr>

				<tr>
					<th>Serial Number</th>
					<td>{workshop.serial_number || 'N/A'}</td>
				</tr>

				<tr>
					<th>Site Location</th>
					<td>{workshop.site_location || 'N/A'}</td>
				</tr>

				<tr>
					<th colspan="2" class="fault-header-full">Fault Description</th>
				</tr>
				<tr>
					<td colspan="2" class="fault">{workshop.fault_description || 'N/A'}</td>
				</tr>

				<tr>
					<th colspan="2" class="contacts-header-full">Contacts</th>
				</tr>
				<tr>
					<td colspan="2" class="contacts-cell">
						<table class="contacts-table">
							<tbody>
								{#if optionalContacts.length > 0}
									{#each optionalContacts.slice(0, 2) as contact}
										{#if contact.email && contact.number}
											<!-- Both email and phone available -->
											<tr>
												<td class="contact-name" rowspan="2">{contact.name || 'N/A'}</td>
												<td class="contact-info" colspan="2">{contact.email}</td>
											</tr>
											<tr>
												<td class="contact-info" colspan="2">{contact.number}</td>
											</tr>
										{:else if contact.email}
											<!-- Only email available -->
											<tr>
												<td class="contact-name">{contact.name || 'N/A'}</td>
												<td class="contact-info" colspan="2">{contact.email}</td>
											</tr>
										{:else if contact.number}
											<!-- Only phone available -->
											<tr>
												<td class="contact-name">{contact.name || 'N/A'}</td>
												<td class="contact-info" colspan="2">{contact.number}</td>
											</tr>
										{:else}
											<!-- No contact details, just show name -->
											<tr>
												<td class="contact-name contact-name-centered" colspan="3"
													>{contact.name || 'N/A'}</td
												>
											</tr>
										{/if}
									{/each}
								{:else}
									<!-- No contacts available -->
									<tr>
										<td class="contact-name contact-name-centered" colspan="3">No Contacts</td>
									</tr>
								{/if}
							</tbody>
						</table>
					</td>
				</tr>
			</tbody>
		</table>

		{#if qrCodeUrl}
			<div class="qr-code-container">
				<img src={qrCodeUrl} alt="Workshop QR Code" class="qr-code" />
				<div class="qr-code-label">Scan to Open Workshop</div>
			</div>
		{/if}

		<div class="date-issued">Date Issued: {dateIssued}</div>
	</div>
{/if}

<style>
	/* Reset */
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(html),
	:global(body) {
		background: #ffffff;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		font-size: 11px;
		padding: 0;
		margin: 0;
	}

	/* Error page */
	.error-page {
		padding: 40px;
		text-align: center;
	}

	.error-page .error-icon {
		width: 48px;
		height: 48px;
		background: #fef2f2;
		color: #dc2626;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 16px;
	}

	.error-page h2 {
		font-size: 1.25rem;
		color: #1a1a1a;
		margin-bottom: 8px;
	}

	.error-page p {
		color: #666;
	}

	/* Sticker container - full width, no extra padding */
	.sticker {
		width: 100%;
		max-width: 100mm;
		min-height: 150mm;
		background: #ffffff;
		border: 1px solid #cfcfcf;
		padding: 16px 16px 14px 16px;
		margin: 0 auto;
		position: relative;
		display: flex;
		flex-direction: column;
	}

	/* Header table */
	.header-table {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 4px;
	}

	.header-table td {
		vertical-align: middle;
	}

	.logo {
		height: 50px;
		width: auto;
		display: block;
	}

	.order-id {
		font-size: 18px;
		font-weight: 800;
		color: #000000;
		text-align: center;
		vertical-align: middle;
	}

	hr {
		border: none;
		border-top: 1px solid #000000;
		margin: 8px 0;
	}

	.date-issued {
		font-size: 10px;
		font-weight: 600;
		color: #000000;
		text-align: right;
		position: absolute;
		bottom: 14px;
		right: 16px;
		left: 16px;
	}

	/* Data table */
	table.tag {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		overflow: hidden;
	}

	table.tag th,
	table.tag td {
		padding: 3px 6px;
		vertical-align: top;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	table.tag th {
		width: 32%;
		background: #ffffff;
		text-align: left;
		font-size: 10px;
		color: #000000;
		font-weight: 800;
		letter-spacing: 0.2px;
	}

	table.tag td {
		font-size: 11px;
		font-weight: 600;
		color: #000000;
	}

	/* Contacts nested table */
	.contacts-header-full {
		width: 100%;
		text-align: center;
		font-size: 10px;
		font-weight: 800;
		color: #000000;
		padding: 5px 8px;
	}

	.contacts-cell {
		padding: 0 !important;
	}

	.contacts-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		border: 1px solid #999999;
	}

	.contacts-table tr {
		border-bottom: 1px solid #999999;
	}

	.contacts-table tr:last-child {
		border-bottom: none;
	}

	.contact-name {
		width: 30%;
		background: #ffffff;
		padding: 4px 6px;
		text-align: left;
		font-size: 11px;
		font-weight: 800;
		color: #000000;
		word-wrap: break-word;
		overflow-wrap: break-word;
		vertical-align: middle;
		border: 1px solid #999999;
	}

	.contact-info {
		border: 1px solid #999999;
		padding: 4px 6px;
		font-size: 10px;
		font-weight: 600;
		color: #000000;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.contact-name-centered {
		text-align: center;
	}

	/* QR Code */
	.qr-code-container {
		position: absolute;
		bottom: 14px;
		left: 16px;
	}

	.qr-code {
		width: 80px;
		height: 80px;
		display: block;
	}

	.qr-code-label {
		font-size: 8px;
		font-weight: 600;
		color: #000000;
		text-align: center;
		margin-top: 4px;
	}

	/* Fault description */
	.fault-header-full {
		width: 100%;
		text-align: center;
		font-size: 10px;
		font-weight: 800;
		color: #000000;
		padding: 5px 8px;
	}

	.fault {
		padding: 5px;
		background: #ffffff;
		min-height: 36px;
		white-space: pre-wrap;
	}

	/* Print styles - ensure pixel-perfect match */
	@media print {
		@page {
			size: 100mm 150mm;
			margin: 0;
		}

		:global(html),
		:global(body) {
			background: #fff !important;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
			margin: 0;
			padding: 0;
		}

		.sticker {
			max-width: 100%;
			border: none;
			margin: 0;
			padding: 16px 16px 14px 16px;
		}
	}
</style>
