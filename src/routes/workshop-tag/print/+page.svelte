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
		background: #ffffff;
		border: 1px solid #cfcfcf;
		padding: 16px 16px 14px 16px;
		margin: 0 auto;
	}

	/* Top accent bar */
	.accent-bar {
		height: 8px;
		background: #2c7a7b;
		margin-bottom: 10px;
		width: 100%;
	}

	/* Header table */
	.header-table {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 10px;
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
		font-size: 18px;
		font-weight: 800;
		color: #1f2937;
		padding: 4px 0 2px 0;
		text-align: center;
	}

	.subtle {
		font-size: 10px;
		font-weight: 600;
		color: #6b7280;
		text-align: right;
		white-space: nowrap;
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
		background: #ffffff;
		text-align: left;
		font-size: 10px;
		color: #111827;
		font-weight: 800;
		letter-spacing: 0.2px;
	}

	table.tag td {
		font-size: 11px;
		font-weight: 600;
		color: #374151;
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
		width: 34%;
		background: #ffffff;
		border-bottom: 1px solid #e6e6e6;
		padding: 6px 8px;
		text-align: left;
		font-size: 10px;
		font-weight: 800;
		color: #111827;
	}

	.contact-data {
		border-bottom: 1px solid #e6e6e6;
		padding: 6px 8px;
		word-wrap: break-word;
		overflow-wrap: break-word;
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
