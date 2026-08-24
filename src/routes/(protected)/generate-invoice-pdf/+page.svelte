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

<svelte:head>
	<title>Generate Invoice PDF - RapidTools</title>
</svelte:head>

<div class="min-h-screen py-6 px-2 sm:px-4 lg:px-6">
	<div class="mx-auto max-w-2xl bg-[#141619] border border-[#262a30] shadow-xl rounded-2xl p-6 sm:p-8">
		<h1 class="mb-6 text-2xl font-bold text-white tracking-tight">Generate Invoice PDF</h1>

		<form on:submit|preventDefault={handleGenerate} class="space-y-5">
			<div>
				<label for="order_id" class="form-label">Order ID</label>
				<input
					type="text"
					id="order_id"
					bind:value={order_id}
					required
					placeholder="e.g. 26-0012128"
					class="input-field"
				/>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="btn-primary w-full flex items-center justify-center gap-2"
			>
				{#if loading}
					<div class="h-4 w-4 animate-spin rounded-full border-2 border-gray-950 border-t-transparent"></div>
					Generating...
				{:else}
					Generate PDF
				{/if}
			</button>
		</form>

		{#if error}
			<div class="mt-6 rounded-xl border border-red-500/30 bg-red-950/20 p-4">
				<p class="font-semibold text-red-400">Error: {error}</p>
				{#if details}
					<pre class="mt-2 whitespace-pre-wrap text-xs text-red-300/90 font-mono bg-[#0e1012] p-3 rounded-lg border border-red-500/20">{details}</pre>
				{/if}
			</div>
		{/if}

		{#if result}
			<div class="mt-8 border-t border-[#262a30] pt-6">
				<h2 class="mb-4 flex items-center text-lg font-bold text-emerald-400">
					<svg class="mr-2 h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
					Invoice Generated Successfully
				</h2>

				<div class="space-y-2.5 rounded-xl border border-[#262a30] bg-[#0e1012] p-4 text-sm">
					<div class="flex justify-between items-center">
						<span class="text-gray-400 font-medium">Execution By:</span>
						<span class="text-gray-200 font-medium">{result.created_by}</span>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-gray-400 font-medium">Customer:</span>
						<span class="text-gray-200 font-medium">{result.customer_username}</span>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-gray-400 font-medium">Created At:</span>
						<span class="text-gray-200 font-medium"
							>{new Date(result.created_at).toLocaleString()}</span
						>
					</div>
					<div class="flex justify-between items-start gap-4">
						<span class="text-gray-400 font-medium shrink-0">File Name:</span>
						<span class="break-all text-right text-gray-200 font-medium">{result.file_name}</span>
					</div>
				</div>

				<div class="mt-5">
					<a
						href={result.onedrive_id}
						target="_blank"
						rel="noopener noreferrer"
						class="btn-secondary w-full inline-flex items-center justify-center gap-2 text-lime-400 hover:text-lime-300"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
