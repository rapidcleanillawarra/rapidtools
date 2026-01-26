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
	}>();

	$: tableColumnCount = nonCustomerColumns.length + 1;
</script>

<div class="mt-8 flex flex-col">
	<div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
		<div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
			<div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
				<table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
					<thead class="bg-gray-50 dark:bg-gray-800">
						<tr>
							<th
								scope="col"
								class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-6"
							>
								<div class="flex flex-col gap-2">
									<button
										type="button"
										class="group inline-flex cursor-pointer font-semibold"
										on:click={() => dispatch('sort', 'customer')}
									>
										Customer
										<span
											class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible"
											class:visible={sortField === 'customer'}
											class:invisible={sortField !== 'customer'}
										>
											{#if sortField === 'customer' && sortDirection === 'desc'}
												â†“
											{:else}
												â†‘
											{/if}
										</span>
									</button>
									<input
										type="text"
										placeholder="Search..."
										class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
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
									class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
								>
									<div class="flex flex-col gap-2">
										<button
											type="button"
											class="group inline-flex cursor-pointer font-semibold"
											on:click={() => dispatch('sort', column.key)}
										>
											{column.label}
											<span
												class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible"
												class:visible={sortField === column.key}
												class:invisible={sortField !== column.key}
											>
												{#if sortField === column.key && sortDirection === 'desc'}
													â†“
												{:else}
													â†‘
												{/if}
											</span>
										</button>
										<input
											type="text"
											placeholder="Search..."
											class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
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
					<tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
						{#if loading}
							<tr>
								<td
									colspan={tableColumnCount}
									class="py-4 pl-4 pr-3 text-center text-sm text-gray-500 sm:pl-6">Loading...</td
								>
							</tr>
						{:else if error}
							<tr>
								<td
									colspan={tableColumnCount}
									class="py-4 pl-4 pr-3 text-center text-sm text-red-500 sm:pl-6">{error}</td
								>
							</tr>
						{:else if filteredCount === 0}
							<tr>
								<td
									colspan={tableColumnCount}
									class="py-4 pl-4 pr-3 text-center text-sm text-gray-500 sm:pl-6"
									>No past due orders found.</td
								>
							</tr>
						{:else}
							{#each paginatedOrders as order, index}
								<!-- Main row with all columns spanning 3 rows except customer -->
								<tr
									class="!border-b-0 {index % 2 === 0
										? 'bg-white dark:bg-gray-900'
										: 'bg-gray-50 dark:bg-gray-800/50'}"
								>
									<td
										class="!border-b-0 py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100 sm:pl-6"
									>
										{#if order.username}
											<a
												href="https://www.rapidsupplies.com.au/_cpanel/customer/view?id={order.username}"
												target="_blank"
												rel="noopener noreferrer"
												class="group inline-flex items-center gap-1.5 text-[rgb(40,40,40)] transition-colors hover:text-black dark:text-gray-200 dark:hover:text-white"
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
											{order.customer}
										{/if}
									</td>
									{#each nonCustomerColumns as column}
										<td
											class="{column.key === 'notes' || column.key === 'emailNotifs'
												? 'whitespace-normal'
												: 'whitespace-nowrap'} px-3 py-4 text-sm {column.key === 'pdCounter'
												? `${getPdCounterColor(order[column.key] as number)} ${getPdCounterBgColor(order[column.key] as number)} font-semibold`
												: column.key === 'notes' && (order[column.key] as Note[]).length > 0
													? 'rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
													: 'text-gray-500 dark:text-gray-400'}"
										>
											{#if column.key === 'amount' || column.key === 'payments'}
												${order[column.key]}
											{:else if column.key === 'invoice'}
												<a
													href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={order[
														column.key
													]}"
													target="_blank"
													rel="noopener noreferrer"
													class="group inline-flex items-center gap-1.5 text-[rgb(40,40,40)] transition-colors hover:text-black dark:text-gray-200 dark:hover:text-white"
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
												{#if order.emailConversations && order.emailConversations.length > 0}
													{@const summary = getEmailConversationSummary(order.emailConversations)}
													{@const latestConversation = order.emailConversations[0]}
													{@const isOutbound = isOutboundEmail(latestConversation)}
													{#if summary.inbound + summary.outbound > 1}
														<div class="text-xs">
															<div
																class="font-medium {isOutbound
																	? 'text-green-700 dark:text-green-300'
																	: 'text-blue-700 dark:text-blue-300'}"
															>
																<a
																	href={latestConversation.web_link}
																	target="_blank"
																	rel="noopener noreferrer"
																	class="hover:underline"
																>
																	{getLatestEmailPreview(order.emailConversations)}
																</a>
															</div>
															<div class="mt-1 text-gray-500 dark:text-gray-400">
																{summary.inbound} in / {summary.outbound} out
															</div>
														</div>
													{:else}
														<a
															href={latestConversation.web_link}
															target="_blank"
															rel="noopener noreferrer"
															class="block h-full w-full p-0 text-xs {isOutbound
																? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
																: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'} rounded px-2 py-1 hover:underline"
														>
															{getLatestEmailPreview(order.emailConversations)}
														</a>
													{/if}
												{:else}
													<span class="italic text-gray-400 dark:text-gray-500">No emails</span>
												{/if}
											{:else if column.key === 'assignedTo'}
												<span class="px-2 py-1">{order.assignedTo || 'Unassigned'}</span>
											{:else if column.key === 'followUp'}
												<span class="px-2 py-1"
													>{order.followUp
														? new Date(order.followUp).toLocaleDateString()
														: 'No date set'}</span
												>
											{:else if column.key === 'tickets'}
												{#if order.tickets && order.tickets.length > 0}
													<button
														type="button"
														on:click={() => dispatch('openViewTickets', order)}
														class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all duration-200 border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/50"
													>
														<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
														</svg>
														View ({order.tickets.length})
													</button>
												{:else}
													<button
														type="button"
														on:click={() => dispatch('openTicket', order)}
														class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all duration-200 border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-700"
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
														<div class="text-gray-700 dark:text-gray-300">
															{getLatestNotesForDisplay(order)}
														</div>
														<div class="mt-1 text-gray-500 dark:text-gray-400">
															{getNotesSummary(order)}
														</div>
													{:else}
														<span class="italic text-gray-400 dark:text-gray-500">No notes</span>
													{/if}
												</div>
											{:else}
												{order[column.key]}
											{/if}
										</td>
									{/each}
								</tr>
								<!-- Phone row -->
								<tr
									class={index % 2 === 0
										? 'bg-white dark:bg-gray-900'
										: 'bg-gray-50 dark:bg-gray-800/50'}
								>
									<td class="py-2 pl-4 pr-3 text-sm text-gray-600 dark:text-gray-400 sm:pl-6">
										{#if order.contacts}
											<div class="flex items-center gap-2">
												<svg
													class="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500"
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
													class="group inline-flex items-center gap-1.5 text-[rgb(40,40,40)] transition-colors hover:text-black dark:text-gray-200 dark:hover:text-white"
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
													class="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600"
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
												<span class="italic text-gray-400 dark:text-gray-500">No phone</span>
											</div>
										{/if}
									</td>
									{#each nonCustomerColumns as column}
										<td
											class="{column.key === 'notes' || column.key === 'emailNotifs'
												? 'whitespace-normal'
												: 'whitespace-nowrap'} px-3 py-2 text-sm text-gray-600 dark:text-gray-400"
										>
											{#if column.key === 'notes'}
												{#if order.notes.length > 1}
													<div class="text-xs">
														<div class="text-gray-600 dark:text-gray-400">
															Latest: {new Date(order.notes[0].created_at).toLocaleDateString()}
														</div>
														{#if order.notes.length > 2}
															<div class="mt-1 text-gray-500 dark:text-gray-500">
																+{order.notes.length - 1} more notes
															</div>
														{/if}
													</div>
												{:else if order.notes.length === 1}
													<div class="text-xs text-gray-600 dark:text-gray-400">
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
										? 'bg-white dark:bg-gray-900'
										: 'bg-gray-50 dark:bg-gray-800/50'}"
								>
									<td
										class="!border-t-0 py-2 pl-4 pr-3 text-sm text-gray-600 dark:text-gray-400 sm:pl-6"
									>
										{#if order.email}
											<div class="flex items-center gap-2">
												<svg
													class="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500"
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
													class="group inline-flex items-center gap-1.5 text-[rgb(40,40,40)] transition-colors hover:text-black dark:text-gray-200 dark:hover:text-white"
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
													class="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600"
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
													class="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-all hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-700"
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
												: 'whitespace-nowrap'} px-3 py-2 text-sm text-gray-600 dark:text-gray-400"
										>
											{#if column.key === 'notes'}
												{@const unreadCount = getUnreadNotesCount(order, userEmail)}
												<button
													type="button"
													on:click={() => dispatch('openNotes', order)}
													class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all duration-200 {order
														.notes.length > 0
														? 'border-blue-300 bg-blue-100 text-blue-800 hover:border-blue-400 hover:bg-blue-200 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:bg-blue-900/50'
														: 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-700'}"
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
	</div>
</div>
