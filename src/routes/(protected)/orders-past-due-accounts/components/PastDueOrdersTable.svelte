<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		getPdCounterBgColor,
		getPdCounterColor,
		getUnreadNotesCount,
		getLatestNotesForDisplay,
		getNotesSummary,
		isOutboundEmail,
		getLatestEmailPreview,
		getEmailConversationSummary,
		type ColumnDefinition,
		type ColumnKey,
		type Note,
		type ProcessedOrder
	} from '../pastDueAccounts';

	export let paginatedOrders: ProcessedOrder[] = [];
	export let nonCustomerColumns: ColumnDefinition[] = [];
	export let searchFilters: Partial<Record<ColumnKey, string>> = {};
	export let sortField: ColumnKey;
	export let sortDirection: 'asc' | 'desc';
	export let loading = false;
	export let error = '';
	export let filteredCount = 0;
	export let userEmail: string | null = null;

	const dispatch = createEventDispatcher<{
		sort: ColumnKey;
		searchChange: { key: ColumnKey; value: string };
		openNotes: ProcessedOrder;
		openEmail: ProcessedOrder;
		openTicket: ProcessedOrder;
		openViewTickets: ProcessedOrder;
		openEmailConversations: ProcessedOrder;
	}>();

	$: tableColumnCount = nonCustomerColumns.length + 1;
</script>

<div class="mt-6 rounded-2xl border border-[#262a30] bg-[#141619] shadow-xl overflow-hidden">
	<div class="overflow-x-auto">
		<table class="w-full min-w-full divide-y divide-[#262a30] text-sm text-gray-200">
			<thead class="bg-[#181b20] text-xs font-semibold uppercase tracking-wider text-gray-400">
				<tr>
					<th
						scope="col"
						class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-300 sm:pl-6"
					>
						<div class="flex flex-col gap-2">
							<button
								type="button"
								class="group inline-flex cursor-pointer items-center font-semibold text-gray-300 hover:text-lime-400 transition"
								on:click={() => dispatch('sort', 'customer')}
							>
								Customer
								<span
									class="ml-2 flex-none rounded text-lime-400 group-hover:visible group-focus:visible"
									class:visible={sortField === 'customer'}
									class:invisible={sortField !== 'customer'}
								>
									{#if sortField === 'customer' && sortDirection === 'desc'}
										↓
									{:else}
										↑
									{/if}
								</span>
							</button>
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-2.5 py-1 text-xs font-normal text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
								value={searchFilters['customer'] || ''}
								on:input={(e) =>
									dispatch('searchChange', {
										key: 'customer',
										value: e.currentTarget.value
									})}
							/>
						</div>
					</th>
					{#each nonCustomerColumns as column}
						<th
							scope="col"
							class="px-3 py-3.5 text-left text-sm font-semibold text-gray-300"
						>
							<div class="flex flex-col gap-2">
								<button
									type="button"
									class="group inline-flex cursor-pointer items-center font-semibold text-gray-300 hover:text-lime-400 transition"
									on:click={() => dispatch('sort', column.key)}
								>
									{column.label}
									<span
										class="ml-2 flex-none rounded text-lime-400 group-hover:visible group-focus:visible"
										class:visible={sortField === column.key}
										class:invisible={sortField !== column.key}
									>
										{#if sortField === column.key && sortDirection === 'desc'}
											↓
										{:else}
											↑
										{/if}
									</span>
								</button>
								<input
									type="text"
									placeholder="Search..."
									class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-2.5 py-1 text-xs font-normal text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
									value={searchFilters[column.key] || ''}
									on:input={(e) =>
										dispatch('searchChange', {
											key: column.key,
											value: e.currentTarget.value
										})}
								/>
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody class="divide-y divide-[#262a30] bg-[#141619]">
				{#if loading}
					<tr>
						<td
							colspan={tableColumnCount}
							class="py-8 pl-4 pr-3 text-center text-sm text-gray-400 sm:pl-6">Loading...</td
						>
					</tr>
				{:else if error}
					<tr>
						<td
							colspan={tableColumnCount}
							class="py-8 pl-4 pr-3 text-center text-sm text-red-400 sm:pl-6">{error}</td
						>
					</tr>
				{:else if filteredCount === 0}
					<tr>
						<td
							colspan={tableColumnCount}
							class="py-8 pl-4 pr-3 text-center text-sm text-gray-400 sm:pl-6"
							>No past due orders found.</td
						>
					</tr>
				{:else}
					{#each paginatedOrders as order, index}
						<!-- Main row with all columns spanning 3 rows except customer -->
						<tr
							class="!border-b-0 {index % 2 === 0
								? 'bg-[#141619]'
								: 'bg-[#181b20]/40'} hover:bg-[#1f2329]/60 transition-colors"
						>
							<td
								class="!border-b-0 py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6"
							>
								{#if order.username}
									<a
										href="https://www.rapidsupplies.com.au/_cpanel/customer/view?id={order.username}"
										target="_blank"
										rel="noopener noreferrer"
										class="group inline-flex items-center gap-1.5 text-white transition-colors hover:text-lime-400 font-medium"
									>
										<span>{order.customer}</span>
										<svg
											class="h-4 w-4 opacity-70 transition-all group-hover:scale-110 group-hover:opacity-100"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
											></path>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
											></path>
										</svg>
									</a>
								{:else}
									<span class="text-white font-medium">{order.customer}</span>
								{/if}
							</td>
							{#each nonCustomerColumns as column}
								<td
									class="{column.key === 'notes' || column.key === 'emailNotifs'
										? 'whitespace-normal'
										: 'whitespace-nowrap'} px-3 py-4 text-sm {column.key === 'pdCounter'
										? `${getPdCounterColor(order[column.key] as number)} ${getPdCounterBgColor(order[column.key] as number)} font-semibold rounded-lg px-2.5 py-1 text-center inline-block`
										: column.key === 'notes' && (order[column.key] as Note[]).length > 0
											? 'rounded-lg border border-blue-500/20 bg-blue-950/20 text-gray-200'
											: 'text-gray-300'}"
								>
									{#if column.key === 'amount' || column.key === 'payments'}
										<span class="font-medium text-gray-200">${order[column.key]}</span>
									{:else if column.key === 'invoice'}
										<a
											href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={order[
												column.key
											]}"
											target="_blank"
											rel="noopener noreferrer"
											class="group inline-flex items-center gap-1.5 text-lime-400 font-medium transition-colors hover:text-lime-300"
										>
											<span>{order[column.key]}</span>
											<svg
												class="h-4 w-4 opacity-70 transition-all group-hover:scale-110 group-hover:opacity-100"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
												></path>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
												></path>
											</svg>
										</a>
									{:else if column.key === 'emailNotifs'}
										<button
											type="button"
											on:click={() => dispatch('openEmailConversations', order)}
											class="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-950/30 px-2.5 py-1 text-xs font-semibold text-sky-400 hover:bg-sky-900/40 hover:text-sky-300 transition"
										>
											<svg
												class="h-3.5 w-3.5"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												xmlns="http://www.w3.org/2000/svg"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
												></path>
											</svg>
											View Emails
										</button>
									{:else if column.key === 'assignedTo'}
										<span class="px-2 py-1 text-gray-300">{order.assignedTo || 'Unassigned'}</span>
									{:else if column.key === 'followUp'}
										<span class="px-2 py-1 text-gray-300"
											>{order.followUp
												? new Date(order.followUp).toLocaleDateString()
												: 'No date set'}</span
										>
									{:else if column.key === 'tickets'}
										{#if order.tickets && order.tickets.length > 0}
											<button
												type="button"
												on:click={() => dispatch('openViewTickets', order)}
												class="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/30 px-2.5 py-1 text-xs font-semibold text-indigo-400 hover:bg-indigo-900/40 hover:text-indigo-300 transition"
											>
												<svg
													class="h-3.5 w-3.5"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
													/>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
													/>
												</svg>
												View ({order.tickets.length})
											</button>
										{:else}
											<button
												type="button"
												on:click={() => dispatch('openTicket', order)}
												class="inline-flex items-center gap-1.5 rounded-lg border border-[#333842] bg-[#1f2329] px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-[#262a30] hover:text-white transition"
											>
												<svg
													class="h-3.5 w-3.5"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M12 6v6m0 0v6m0-6h6m-6 0H6"
													></path>
												</svg>
												Create Ticket
											</button>
										{/if}
									{:else if column.key === 'notes'}
										<div class="text-xs">
											{#if (order[column.key] as Note[]).length > 0}
												<div class="text-gray-200">
													{getLatestNotesForDisplay(order)}
												</div>
												<div class="mt-1 text-gray-400">
													{getNotesSummary(order)}
												</div>
											{:else}
												<span class="italic text-gray-500">No notes</span>
											{/if}
										</div>
									{:else}
										<span class="text-gray-300">{order[column.key]}</span>
									{/if}
								</td>
							{/each}
						</tr>
						<!-- Phone row -->
						<tr
							class="{index % 2 === 0
								? 'bg-[#141619]'
								: 'bg-[#181b20]/40'} hover:bg-[#1f2329]/60 transition-colors"
						>
							<td class="py-2 pl-4 pr-3 text-sm text-gray-400 sm:pl-6">
								{#if order.contacts}
									<div class="flex items-center gap-2">
										<svg
											class="h-4 w-4 flex-shrink-0 text-gray-500"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
											></path>
										</svg>
										<a
											href="tel:{order.contacts}"
											class="group inline-flex items-center gap-1.5 text-gray-300 transition-colors hover:text-white"
										>
											<span>{order.contacts}</span>
											<svg
												class="h-3.5 w-3.5 opacity-70 transition-all group-hover:scale-110 group-hover:opacity-100"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
												></path>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
												></path>
											</svg>
										</a>
									</div>
								{:else}
									<div class="flex items-center gap-2">
										<svg
											class="h-4 w-4 flex-shrink-0 text-gray-600"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
											></path>
										</svg>
										<span class="italic text-gray-500">No phone</span>
									</div>
								{/if}
							</td>
							{#each nonCustomerColumns as column}
								<td
									class="{column.key === 'notes' || column.key === 'emailNotifs'
										? 'whitespace-normal'
										: 'whitespace-nowrap'} px-3 py-2 text-sm text-gray-400"
								>
									{#if column.key === 'notes'}
										{#if order.notes.length > 1}
											<div class="text-xs">
												<div class="text-gray-400">
													Latest: {new Date(order.notes[0].created_at).toLocaleDateString()}
												</div>
												{#if order.notes.length > 2}
													<div class="mt-1 text-gray-500">
														+{order.notes.length - 1} more notes
													</div>
												{/if}
											</div>
										{:else if order.notes.length === 1}
											<div class="text-xs text-gray-400">
												Created: {new Date(order.notes[0].created_at).toLocaleDateString()}
											</div>
										{/if}
									{:else}
										<!-- Empty cell for other columns in phone row -->
									{/if}
								</td>
							{/each}
						</tr>
						<!-- Email row -->
						<tr
							class="!border-t-0 {index % 2 === 0
								? 'bg-[#141619]'
								: 'bg-[#181b20]/40'} hover:bg-[#1f2329]/60 transition-colors"
						>
							<td
								class="!border-t-0 py-2 pl-4 pr-3 text-sm text-gray-400 sm:pl-6"
							>
								{#if order.email}
									<div class="flex items-center gap-2">
										<svg
											class="h-4 w-4 flex-shrink-0 text-gray-500"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
											></path>
										</svg>
										<button
											type="button"
											on:click={() => dispatch('openEmail', order)}
											class="group inline-flex items-center gap-1.5 text-gray-300 transition-colors hover:text-white"
										>
											<span>{order.email}</span>
											<svg
												class="h-3.5 w-3.5 opacity-70 transition-all group-hover:scale-110 group-hover:opacity-100"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
												></path>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
												></path>
											</svg>
										</button>
									</div>
								{:else}
									<div class="flex items-center gap-2">
										<svg
											class="h-4 w-4 flex-shrink-0 text-gray-600"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
											></path>
										</svg>
										<button
											type="button"
											on:click={() => dispatch('openEmail', order)}
											class="inline-flex items-center gap-1.5 rounded-lg border border-[#333842] bg-[#1f2329] px-2.5 py-1 text-xs font-medium text-gray-300 shadow-sm transition hover:bg-[#262a30] hover:text-white"
											title="Draft email (no email address available)"
										>
											<svg
												class="h-3.5 w-3.5"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
												></path>
											</svg>
											Draft Email
										</button>
									</div>
								{/if}
							</td>
							{#each nonCustomerColumns as column}
								<td
									class="!border-t-0 {column.key === 'notes' || column.key === 'emailNotifs'
										? 'whitespace-normal'
										: 'whitespace-nowrap'} px-3 py-2 text-sm text-gray-400"
								>
									{#if column.key === 'notes'}
										{@const unreadCount = getUnreadNotesCount(order, userEmail)}
										<div class="flex flex-wrap gap-2">
											<button
												type="button"
												on:click={() => dispatch('openNotes', order)}
												class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition {order
													.notes.length > 0
													? 'border-blue-500/30 bg-blue-950/30 text-blue-400 hover:bg-blue-900/40 hover:text-blue-300'
													: 'border-[#333842] bg-[#1f2329] text-gray-300 hover:bg-[#262a30] hover:text-white'}"
											>
												<svg
													class="h-3.5 w-3.5"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
													></path>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
													></path>
												</svg>
												View Notes
												{#if unreadCount > 0}
													<span
														class="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold leading-none text-white"
													>
														{unreadCount}
													</span>
												{/if}
											</button>
											<button
												type="button"
												on:click={() => dispatch('openNotes', order)}
												class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300 transition"
											>
												<svg
													class="h-3.5 w-3.5"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M12 4v16m8-8H4"
													></path>
												</svg>
												Add Notes
											</button>
										</div>
									{:else}
										<!-- Empty cell for other columns in email row -->
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>
