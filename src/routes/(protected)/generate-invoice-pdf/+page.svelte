<script lang="ts">
	let order_id = '';
	let loading = false;
	let error = '';
	let details = '';
	let result: any = null;

	async function handleGenerate() {
		if (!order_id) return;

		loading = true;
		error = '';
		details = '';
		result = null;

		const endpoint =
			'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/085d23545582412795e162562558953d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=HLKhlTnMPzldKLVFn2pfHoFx3tCqAkFO0BXwhITJfIs';

		// Current time format: 2026-01-23 03:13:17
		const now = new Date();
		const currentTime = now.toISOString().replace('T', ' ').substring(0, 19);

		const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<ns:Event xmlns:ns="NetoAPI">
  <CurrentTime>${currentTime}</CurrentTime>
  <EventID>15954</EventID>
  <EventType>Order</EventType>
  <Order>
    <OrderID>${order_id}</OrderID>
    <OrderStatus>generate</OrderStatus>
  </Order>
</ns:Event>`;

		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/xml'
				},
				body: xmlPayload
			});

			if (!response.ok) {
				const text = await response.text();
				error = 'Failed to generate invoice.';
				details = text;
				return;
			}

			result = await response.json();
		} catch (err: any) {
			console.error('Request failed:', err);
			error = 'Internal server error or CORS issue.';
			details = err.message;
		} finally {
			loading = false;
		}
	}
</script>

<div class="container mx-auto max-w-2xl p-6">
	<div class="rounded-lg bg-white p-6 shadow-md">
		<h1 class="mb-6 text-2xl font-bold text-gray-800">Generate Invoice PDF</h1>

		<form on:submit|preventDefault={handleGenerate} class="space-y-4">
			<div>
				<label for="order_id" class="mb-1 block text-sm font-medium text-gray-700">Order ID</label>
				<input
					type="text"
					id="order_id"
					bind:value={order_id}
					required
					placeholder="e.g. 26-0012128"
					class="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
				/>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-md bg-blue-600 px-4 py-2 font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
			>
				{loading ? 'Generating...' : 'Generate PDF'}
			</button>
		</form>

		{#if error}
			<div class="mt-6 rounded-md border border-red-200 bg-red-50 p-4">
				<p class="font-medium text-red-700">Error: {error}</p>
				{#if details}
					<pre class="mt-2 whitespace-pre-wrap text-xs text-red-600">{details}</pre>
				{/if}
			</div>
		{/if}

		{#if result}
			<div class="mt-8 border-t pt-6">
				<h2 class="mb-4 flex items-center text-lg font-semibold text-green-700">
					<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
					Invoice Generated Successfully
				</h2>

				<div class="grid grid-cols-1 gap-4 rounded-md bg-gray-50 p-4">
					<div class="grid grid-cols-3 gap-2">
						<span class="text-sm font-medium text-gray-500">Execution By:</span>
						<span class="col-span-2 text-sm text-gray-800">{result.created_by}</span>
					</div>
					<div class="grid grid-cols-3 gap-2">
						<span class="text-sm font-medium text-gray-500">Customer:</span>
						<span class="col-span-2 text-sm text-gray-800">{result.customer_username}</span>
					</div>
					<div class="grid grid-cols-3 gap-2">
						<span class="text-sm font-medium text-gray-500">Created At:</span>
						<span class="col-span-2 text-sm text-gray-800"
							>{new Date(result.created_at).toLocaleString()}</span
						>
					</div>
					<div class="grid grid-cols-3 gap-2">
						<span class="text-sm font-medium text-gray-500">File Name:</span>
						<span class="col-span-2 break-all text-sm text-gray-800">{result.file_name}</span>
					</div>
				</div>

				<div class="mt-6">
					<a
						href={result.onedrive_id}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
					>
						<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							/>
						</svg>
						Open in OneDrive
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>
