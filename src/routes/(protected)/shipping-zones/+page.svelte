<script lang="ts">
	const mapUrl =
		'https://www.google.com/maps/d/u/4/embed?mid=1gnVo1MlF89jpjg_JQ6MESa0PKzQTDYY&ehbc=2E312F&noprof=1';

	const zones = [
		{ name: 'Local', color: '#e15f59' },
		{ name: 'South', color: '#f6e854' },
		{ name: 'North', color: '#e6ab48' },
		{ name: 'West / Highlands', color: '#5b9ba9' }
	] as const;

	let iframeError = $state(false);

	function handleIframeError() {
		iframeError = true;
	}
</script>

<svelte:head>
	<title>Shipping Zones - RapidTools</title>
</svelte:head>

<div class="min-h-screen py-6 px-2 sm:px-4 lg:px-6">
	<div class="w-full rounded-2xl border border-[#262a30] bg-[#141619] p-4 shadow-xl sm:p-6 lg:p-8">
		<div class="mb-6">
			<h1 class="text-2xl font-bold tracking-tight text-white">Shipping Zones</h1>
			<p class="mt-1 text-sm text-gray-400">
				Delivery coverage and fees by zone across the service area.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<div class="lg:col-span-2">
				<div
					class="overflow-hidden rounded-2xl border border-[#262a30] bg-[#0e1012] shadow-xl"
				>
					{#if !iframeError}
						<iframe
							src={mapUrl}
							class="h-full min-h-[500px] w-full border-0"
							allowfullscreen
							title="Shipping Zones Map"
							onerror={handleIframeError}
						></iframe>
					{:else}
						<div
							class="flex min-h-[500px] w-full items-center justify-center bg-[#181b20] px-6"
						>
							<div class="max-w-md text-center">
								<h3 class="mb-2 text-lg font-semibold text-white">Map Unavailable</h3>
								<p class="mb-5 text-sm text-gray-400">
									The shipping zones map cannot be displayed at this time.
								</p>
								<a
									href={mapUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="btn-primary inline-block"
								>
									View Map in New Tab
								</a>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<div class="space-y-4">
				<div class="rapid-card">
					<h2 class="mb-4 text-lg font-semibold text-white">Zones</h2>
					<div class="space-y-3">
						{#each zones as zone (zone.name)}
							<div class="flex items-center gap-3">
								<div
									class="h-4 w-4 shrink-0 rounded-sm border border-[#333842]"
									style:background-color={zone.color}
								></div>
								<span class="text-sm font-medium text-gray-200">{zone.name}</span>
							</div>
						{/each}
					</div>
				</div>

				<div class="rapid-card">
					<h2 class="mb-4 text-lg font-semibold text-white">Delivery Fee</h2>

					<div class="mb-5">
						<div class="mb-2 flex items-center gap-2">
							<span class="text-sm font-semibold text-white">Local</span>
							<div
								class="h-3 w-3 rounded-sm border border-[#333842]"
								style="background-color: #e15f59;"
							></div>
						</div>
						<div class="space-y-1 text-sm text-gray-400">
							<p>Free delivery over $150</p>
							<p>Flat $30 delivery under $150</p>
						</div>
					</div>

					<div>
						<div class="mb-2 flex items-center gap-2">
							<span class="text-sm font-semibold text-white">Non Local</span>
							<div
								class="h-3 w-3 rounded-sm border border-[#333842]"
								style="background-color: #f6e854;"
							></div>
							<div
								class="h-3 w-3 rounded-sm border border-[#333842]"
								style="background-color: #e6ab48;"
							></div>
							<div
								class="h-3 w-3 rounded-sm border border-[#333842]"
								style="background-color: #5b9ba9;"
							></div>
						</div>
						<div class="space-y-1 text-sm text-gray-400">
							<p>Free delivery over $200</p>
							<p>Flat $50 delivery under $200</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
