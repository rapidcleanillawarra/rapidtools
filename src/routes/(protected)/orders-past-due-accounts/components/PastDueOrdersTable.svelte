<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		getPdCounterBgColor,
		getPdCounterColor,
		getUnreadNotesCount,
		getLatestNote,
		getLatestNotesForDisplay,
		getNotesSummary,
		formatShortDate,
		type ColumnDefinition,
		type ColumnKey,
		type ProcessedOrder
	} from '../pastDueAccounts';

	export let paginatedOrders: ProcessedOrder[] = [];
	export let nonCustomerColumns: ColumnDefinition[] = [];
	export let sortField: ColumnKey;
	export let sortDirection: 'asc' | 'desc';
	export let loading = false;
	export let error = '';
	export let filteredCount = 0;
	export let userEmail: string | null = null;

	const dispatch = createEventDispatcher<{
		sort: ColumnKey;
		openNotes: ProcessedOrder;
		openEmail: ProcessedOrder;
	}>();

	let expandedInvoices = new Set<string>();
	let openMenuInvoice: string | null = null;
	let initializedExpand = false;

	$: if (!initializedExpand && paginatedOrders.length > 0) {
		expandedInvoices = new Set([paginatedOrders[0].invoice]);
		initializedExpand = true;
	}

	function toggleExpand(invoice: string) {
		const next = new Set(expandedInvoices);
		if (next.has(invoice)) {
			next.delete(invoice);
		} else {
			next.add(invoice);
		}
		expandedInvoices = next;
	}

	function toggleMenu(invoice: string, event: MouseEvent) {
		event.stopPropagation();
		openMenuInvoice = openMenuInvoice === invoice ? null : invoice;
	}

	function handleWindowClick() {
		if (openMenuInvoice) {
			openMenuInvoice = null;
		}
	}

	$: tableColumnCount = nonCustomerColumns.length + 2;

	function isRightAligned(key: ColumnKey): boolean {
		return key === 'payments' || key === 'invoiceAmount' || key === 'amount';
	}

	function isCenterAligned(key: ColumnKey): boolean {
		return key === 'pdCounter';
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div class="mt-4 rounded-2xl border border-[#262a30] bg-[#141619] shadow-xl overflow-visible">
	<div class="overflow-x-auto">
		<table class="w-full min-w-full divide-y divide-[#262a30] text-sm text-gray-200">
			<thead class="bg-[#16191d] text-xs font-medium text-gray-400">
				<tr>
					<th scope="col" class="py-3.5 pl-6 pr-3 text-left font-medium text-gray-400">
						<button
							type="button"
							class="group inline-flex cursor-pointer items-center gap-1.5 font-medium text-gray-400 transition hover:text-gray-200"
							on:click={() => dispatch('sort', 'customer')}
						>
							<span>Customer</span>
							<span
								class="flex-none text-lime-400 {sortField === 'customer'
									? 'opacity-100'
									: 'opacity-0 group-hover:opacity-60'}"
							>
								{#if sortField === 'customer' && sortDirection === 'desc'}
									↓
								{:else}
									↑
								{/if}
							</span>
						</button>
					</th>
					{#each nonCustomerColumns as column}
						<th
							scope="col"
							class="px-4 py-3.5 font-medium text-gray-400 {isRightAligned(column.key)
								? 'text-right'
								: isCenterAligned(column.key)
									? 'text-center'
									: 'text-left'}"
						>
							<button
								type="button"
								class="group inline-flex cursor-pointer items-center gap-1.5 font-medium text-gray-400 transition hover:text-gray-200 {isRightAligned(
									column.key
								)
									? 'ml-auto'
									: isCenterAligned(column.key)
										? 'mx-auto'
										: ''}"
								on:click={() => dispatch('sort', column.key)}
							>
								<span>{column.label}</span>
								<span
									class="flex-none text-lime-400 {sortField === column.key
										? 'opacity-100'
										: 'opacity-0 group-hover:opacity-60'}"
								>
									{#if sortField === column.key && sortDirection === 'desc'}
										↓
									{:else}
										↑
									{/if}
								</span>
							</button>
						</th>
					{/each}
					<th scope="col" class="w-20 py-3.5 pl-3 pr-5 text-right font-medium text-gray-400">
						<span class="sr-only">Actions</span>
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[#22262c] bg-[#141619]">
				{#if loading}
					<tr>
						<td
							colspan={tableColumnCount}
							class="py-12 pl-6 pr-6 text-center text-sm text-gray-400"
						>
							Loading past due accounts...
						</td>
					</tr>
				{:else if error}
					<tr>
						<td
							colspan={tableColumnCount}
							class="py-12 pl-6 pr-6 text-center text-sm text-red-400"
						>
							{error}
						</td>
					</tr>
				{:else if filteredCount === 0}
					<tr>
						<td
							colspan={tableColumnCount}
							class="py-12 pl-6 pr-6 text-center text-sm text-gray-400"
						>
							No past due orders found.
						</td>
					</tr>
				{:else}
					{#each paginatedOrders as order (order.invoice)}
						{@const isExpanded = expandedInvoices.has(order.invoice)}
						{@const latestNote = getLatestNote(order)}
						{@const unreadCount = getUnreadNotesCount(order, userEmail)}
						<tr
							class="transition-colors hover:bg-[#1a1d22]/80 {isExpanded
								? 'bg-[#181b20]/70 !border-b-0'
								: 'bg-[#141619]'}"
						>
							<!-- Customer Column -->
							<td class="py-4 pl-6 pr-3 align-middle">
								<div class="flex flex-col">
									{#if order.username}
										<a
											href="https://www.rapidsupplies.com.au/_cpanel/customer/view?id={order.username}"
											target="_blank"
											rel="noopener noreferrer"
											class="text-sm font-semibold text-gray-100 transition-colors hover:text-lime-400 w-fit"
										>
											{order.customer}
										</a>
									{:else}
										<span class="text-sm font-semibold text-gray-100">{order.customer}</span>
									{/if}
									<div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
										{#if order.contacts}
											<span>{order.contacts}</span>
										{/if}
										{#if order.contacts && order.email}
											<span class="text-gray-600">&bull;</span>
										{:else if order.contacts && !order.email}
											<span class="text-gray-600">&bull;</span>
										{/if}
										{#if order.email}
											<button
												type="button"
												on:click={() => dispatch('openEmail', order)}
												class="truncate max-w-[220px] text-gray-400 transition hover:text-gray-200"
												title="Compose email to {order.email}"
											>
												{order.email}
											</button>
										{/if}
									</div>
								</div>
							</td>

							<!-- Dynamic Non-Customer Columns -->
							{#each nonCustomerColumns as column}
								<td
									class="px-4 py-4 align-middle text-sm {isRightAligned(column.key)
										? 'text-right whitespace-nowrap'
										: isCenterAligned(column.key)
											? 'text-center whitespace-nowrap'
											: column.key === 'notes'
												? 'whitespace-normal min-w-[200px]'
												: 'whitespace-nowrap'}"
								>
									{#if column.key === 'invoice'}
										<a
											href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={order.invoice}"
											target="_blank"
											rel="noopener noreferrer"
											class="font-semibold text-lime-400 transition-colors hover:text-lime-300"
										>
											{order.invoice}
										</a>
									{:else if column.key === 'pdCounter'}
										<span
											class="inline-flex min-w-[3.25rem] items-center justify-center rounded-lg px-2.5 py-1 text-xs font-bold {getPdCounterColor(
												order.pdCounter
											)} {getPdCounterBgColor(order.pdCounter)}"
										>
											{order.pdCounter}
										</span>
									{:else if column.key === 'payments' || column.key === 'invoiceAmount'}
										<span class="text-gray-300">${order[column.key]}</span>
									{:else if column.key === 'amount'}
										<span class="font-bold text-white">${order.amount}</span>
									{:else if column.key === 'notes'}
										{#if latestNote}
											<div class="flex flex-col">
												<span class="text-sm font-medium text-gray-200 line-clamp-1">
													{getLatestNotesForDisplay(order, 60)}
												</span>
												<span class="mt-0.5 text-xs text-gray-400">
													{latestNote.creator_full_name || latestNote.created_by} &bull; {formatShortDate(latestNote.created_at)} &bull; {getNotesSummary(order)}
												</span>
											</div>
										{:else}
											<span class="text-xs italic text-gray-500">No notes</span>
										{/if}
									{:else if column.key === 'assignedTo'}
										<span class="text-gray-300">{order.assignedTo || 'Unassigned'}</span>
									{:else if column.key === 'followUp'}
										<span class="text-gray-300">
											{order.followUp
												? new Date(order.followUp).toLocaleDateString()
												: 'No date set'}
										</span>
									{:else}
										<span class="text-gray-300">{order[column.key]}</span>
									{/if}
								</td>
							{/each}

							<!-- Expand & More Actions Column -->
							<td class="py-4 pl-3 pr-5 text-right align-middle whitespace-nowrap">
								<div class="inline-flex items-center justify-end gap-1">
									<button
										type="button"
										on:click={() => toggleExpand(order.invoice)}
										class="rounded-lg p-1.5 text-gray-400 transition hover:bg-[#23272e] hover:text-gray-200"
										title={isExpanded ? 'Collapse details' : 'Expand details'}
									>
										<svg
											class="h-4 w-4 transition-transform duration-150 {isExpanded
												? 'rotate-180'
												: ''}"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 9l-7 7-7-7"
											/>
										</svg>
									</button>

									<div class="relative">
										<button
											type="button"
											on:click={(e) => toggleMenu(order.invoice, e)}
											class="rounded-lg p-1.5 text-gray-400 transition hover:bg-[#23272e] hover:text-gray-200"
											title="More options"
										>
											<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
												<path
													d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
												/>
											</svg>
										</button>

										{#if openMenuInvoice === order.invoice}
											<div
												class="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-[#262a30] bg-[#181b20] py-1.5 text-left shadow-2xl"
											>
												<button
													type="button"
													on:click={() => {
														openMenuInvoice = null;
														dispatch('openEmail', order);
													}}
													class="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-200 transition hover:bg-[#22262d]"
												>
													<svg
														class="h-3.5 w-3.5 text-gray-400"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
														/>
													</svg>
													Compose email
												</button>
												<button
													type="button"
													on:click={() => {
														openMenuInvoice = null;
														dispatch('openNotes', order);
													}}
													class="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-200 transition hover:bg-[#22262d]"
												>
													<svg
														class="h-3.5 w-3.5 text-gray-400"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
														/>
													</svg>
													Manage notes
												</button>
												<a
													href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={order.invoice}"
													target="_blank"
													rel="noopener noreferrer"
													class="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-gray-200 transition hover:bg-[#22262d]"
												>
													<svg
														class="h-3.5 w-3.5 text-gray-400"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
														/>
													</svg>
													Open invoice
												</a>
											</div>
										{/if}
									</div>
								</div>
							</td>
						</tr>

						<!-- Expandable Detail Panel Row -->
						{#if isExpanded}
							<tr class="bg-[#111316]">
								<td colspan={tableColumnCount} class="px-8 py-5">
									<div
										class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
									>
										<div
											class="grid flex-1 grid-cols-1 gap-6 sm:grid-cols-2 lg:divide-x lg:divide-[#23272f]"
										>
											<!-- Contact details -->
											<div class="space-y-2.5">
												<div class="text-xs font-medium text-gray-400">Contact details</div>
												<div class="space-y-2 text-sm">
													<div class="flex items-center gap-2.5 text-gray-200">
														<svg
															class="h-4 w-4 flex-shrink-0 text-gray-400"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
															/>
														</svg>
														{#if order.contacts}
															<a
																href="tel:{order.contacts}"
																class="text-gray-200 transition hover:text-white"
															>
																{order.contacts}
															</a>
														{:else}
															<span class="italic text-gray-500">No phone number</span>
														{/if}
													</div>
													<div class="flex items-center gap-2.5 text-gray-200">
														<svg
															class="h-4 w-4 flex-shrink-0 text-gray-400"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
															/>
														</svg>
														{#if order.email}
															<button
																type="button"
																on:click={() => dispatch('openEmail', order)}
																class="text-left text-gray-200 transition hover:text-lime-400"
															>
																{order.email}
															</button>
														{:else}
															<button
																type="button"
																on:click={() => dispatch('openEmail', order)}
																class="text-xs font-medium text-lime-400 transition hover:text-lime-300"
															>
																Draft Email (no address on file)
															</button>
														{/if}
													</div>
												</div>
											</div>

											<!-- Notes summary -->
											<div class="space-y-1.5 lg:pl-8">
												<div class="text-xs font-medium text-gray-400">Notes</div>
												{#if latestNote}
													<div class="text-xs text-gray-400">
														Latest by <span class="text-gray-300 font-medium">{latestNote.creator_full_name || latestNote.created_by}</span> &bull; {formatShortDate(latestNote.created_at)}
													</div>
													<div class="text-sm font-medium text-gray-200">
														{getLatestNotesForDisplay(order, 120)}
													</div>
													<div class="text-xs text-gray-500">
														{getNotesSummary(order)}
													</div>
												{:else}
													<div class="text-sm italic text-gray-500">
														No notes recorded for this invoice.
													</div>
												{/if}
											</div>
										</div>

										<!-- Action Buttons -->
										<div class="flex flex-wrap items-center gap-2.5">
											<button
												type="button"
												on:click={() => dispatch('openNotes', order)}
												class="inline-flex items-center gap-2 rounded-xl border border-[#2c313a] bg-[#1a1d22] px-4 py-2 text-xs font-semibold text-gray-200 transition hover:border-[#3a404c] hover:bg-[#22262d] hover:text-white"
											>
												<svg
													class="h-4 w-4 text-gray-400"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
													/>
												</svg>
												View notes
												{#if unreadCount > 0}
													<span
														class="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
													>
														{unreadCount}
													</span>
												{/if}
											</button>

											<button
												type="button"
												on:click={() => dispatch('openNotes', order)}
												class="inline-flex items-center gap-1.5 rounded-xl bg-lime-400 px-4 py-2 text-xs font-semibold text-gray-950 shadow-sm transition hover:bg-lime-300"
											>
												<svg
													class="h-4 w-4"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2.5"
														d="M12 4v16m8-8H4"
													/>
												</svg>
												Add note
											</button>
										</div>
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>

