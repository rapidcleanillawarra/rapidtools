<script lang="ts">
	import { onMount } from 'svelte';

	// Sample static data for now
	const customers = [
		{
			id: 1,
			name: 'Acme Corporation',
			email: 'contact@acme.com',
			phone: '(02) 1234 5678',
			status: 'Active'
		},
		{
			id: 2,
			name: 'Global Industries',
			email: 'info@global.com',
			phone: '(02) 2345 6789',
			status: 'Active'
		},
		{
			id: 3,
			name: 'TechStart Solutions',
			email: 'hello@techstart.com',
			phone: '(02) 3456 7890',
			status: 'Inactive'
		},
		{
			id: 4,
			name: 'Blue Ocean Enterprises',
			email: 'support@blueocean.com',
			phone: '(02) 4567 8901',
			status: 'Active'
		},
		{
			id: 5,
			name: 'Peak Performance Ltd',
			email: 'sales@peakperf.com',
			phone: '(02) 5678 9012',
			status: 'Pending'
		}
	];

	onMount(() => {
		// Handle sidebar state
		const handleSidebarToggle = (event: CustomEvent) => {
			const mainContent = document.querySelector('main');
			if (mainContent && event.detail.isDesktop) {
				mainContent.style.marginLeft = event.detail.minimized ? '80px' : '280px';
			} else if (mainContent) {
				mainContent.style.marginLeft = '0';
			}
		};

		window.addEventListener('sidebar-toggle', handleSidebarToggle as EventListener);

		return () => {
			window.removeEventListener('sidebar-toggle', handleSidebarToggle as EventListener);
		};
	});
</script>

<main class="min-h-screen bg-gray-50 p-6 transition-all duration-300">
	<div class="mx-auto max-w-7xl">
		<!-- Page Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900">Customers</h1>
			<p class="mt-2 text-gray-600">Manage and view customer information</p>
		</div>

		<!-- Customers Table -->
		<div class="overflow-hidden rounded-lg bg-white shadow-md">
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-900">
						<tr>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-yellow-400"
							>
								ID
							</th>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-yellow-400"
							>
								Customer Name
							</th>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-yellow-400"
							>
								Email
							</th>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-yellow-400"
							>
								Phone
							</th>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-yellow-400"
							>
								Status
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white">
						{#each customers as customer}
							<tr class="transition-colors hover:bg-gray-50">
								<td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
									{customer.id}
								</td>
								<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
									{customer.name}
								</td>
								<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
									{customer.email}
								</td>
								<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
									{customer.phone}
								</td>
								<td class="whitespace-nowrap px-6 py-4">
									<span
										class="inline-flex rounded-full px-2 text-xs font-semibold leading-5"
										class:bg-green-100={customer.status === 'Active'}
										class:text-green-800={customer.status === 'Active'}
										class:bg-red-100={customer.status === 'Inactive'}
										class:text-red-800={customer.status === 'Inactive'}
										class:bg-yellow-100={customer.status === 'Pending'}
										class:text-yellow-800={customer.status === 'Pending'}
									>
										{customer.status}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</main>

<style>
	main {
		margin-left: 0;
	}

	@media (min-width: 1024px) {
		main {
			margin-left: 280px;
		}
	}
</style>
