<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { teamMembers, availableAssignees } from '../stores';
	import { getAvatarColorClasses, getInitials, type TaskAssignee } from '../types';

	export let selected: TaskAssignee[] = [];
	export let placeholder: string = 'Select team member(s)...';
	export let size: 'sm' | 'md' = 'md';
	export let disabled: boolean = false;

	const dispatch = createEventDispatcher<{
		change: TaskAssignee[];
	}>();

	let isOpen = false;
	let searchQuery = '';
	let searchInputEl: HTMLInputElement | null = null;

	const fallbackTeamNames = ['AJ', 'Windy', 'Joeven', 'Shaira', 'Zsarmaine'];

	$: allOptions = (() => {
		const map = new Map<string, TaskAssignee>();

		// 1. Team members from Firestore profiles
		for (const member of $teamMembers) {
			const name = (member.firstName || '').trim();
			if (!name) continue;
			map.set(name.toLowerCase(), {
				name,
				uid: member.uid || null,
				email: member.email || null
			});
		}

		// 2. Additional names from loaded tasks
		for (const name of $availableAssignees) {
			const trimmed = (name || '').trim();
			if (!trimmed || map.has(trimmed.toLowerCase())) continue;
			map.set(trimmed.toLowerCase(), {
				name: trimmed,
				uid: null,
				email: null
			});
		}

		// 3. Fallback names
		for (const name of fallbackTeamNames) {
			if (!map.has(name.toLowerCase())) {
				map.set(name.toLowerCase(), {
					name,
					uid: null,
					email: null
				});
			}
		}

		return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
	})();

	$: filteredOptions = allOptions.filter((opt) => {
		if (!searchQuery.trim()) return true;
		const q = searchQuery.toLowerCase().trim();
		return opt.name.toLowerCase().includes(q) || (opt.email && opt.email.toLowerCase().includes(q));
	});

	function isOptionSelected(opt: TaskAssignee): boolean {
		return (selected || []).some(
			(s) => (s.name || '').trim().toLowerCase() === opt.name.trim().toLowerCase()
		);
	}

	function toggleOption(opt: TaskAssignee) {
		if (disabled) return;
		let next: TaskAssignee[];
		if (isOptionSelected(opt)) {
			next = (selected || []).filter(
				(s) => s.name.trim().toLowerCase() !== opt.name.trim().toLowerCase()
			);
		} else {
			next = [...(selected || []), opt];
		}
		selected = next;
		dispatch('change', next);
	}

	function removeAssignee(name: string) {
		if (disabled) return;
		const next = (selected || []).filter(
			(s) => s.name.trim().toLowerCase() !== name.trim().toLowerCase()
		);
		selected = next;
		dispatch('change', next);
	}

	function openDropdown() {
		if (disabled) return;
		isOpen = true;
		searchQuery = '';
		setTimeout(() => {
			searchInputEl?.focus();
		}, 50);
	}

	function closeDropdown() {
		isOpen = false;
		searchQuery = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen) {
			closeDropdown();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="relative w-full">
	{#if size === 'md'}
		<!-- Medium Size (e.g. Create Task Modal) -->
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			on:click={openDropdown}
			class="flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-lg border border-[#2a2f37] bg-[#181b20] p-2 text-sm transition hover:border-[#3a424e] focus-within:border-lime-500 cursor-pointer {disabled ? 'opacity-60 cursor-not-allowed' : ''}"
		>
			{#if (!selected || selected.length === 0)}
				<div class="flex items-center gap-2 px-1.5 py-0.5 text-gray-500 select-none">
					<svg class="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
					</svg>
					<span>{placeholder}</span>
				</div>
			{:else}
				{#each selected as a (a.name)}
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-[#2e333d] bg-[#20242b] py-0.5 pl-1 pr-2 text-xs text-gray-200 shadow-sm"
					>
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold {getAvatarColorClasses(a.name)}"
						>
							{getInitials(a.name)}
						</span>
						<span class="font-medium">{a.name}</span>
						{#if !disabled}
							<button
								type="button"
								on:click|stopPropagation={() => removeAssignee(a.name)}
								class="rounded-full p-0.5 text-gray-400 hover:bg-[#2b313a] hover:text-white"
								aria-label={`Remove ${a.name}`}
							>
								<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						{/if}
					</span>
				{/each}

				{#if !disabled}
					<button
						type="button"
						on:click|stopPropagation={openDropdown}
						class="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-lime-400 hover:bg-lime-950/40 hover:text-lime-300"
					>
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Add
					</button>
				{/if}
			{/if}
		</div>
	{:else}
		<!-- Small Size (e.g. Task Detail Modal sidebar) -->
		<div class="space-y-1.5">
			{#if selected && selected.length > 0}
				<div class="flex flex-wrap gap-1.5">
					{#each selected as a (a.name)}
						<span
							class="inline-flex items-center gap-1 rounded-full border border-[#2a2f37] bg-[#181b20] py-0.5 pl-1 pr-1.5 text-xs text-gray-200"
						>
							<span
								class="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-extrabold {getAvatarColorClasses(a.name)}"
							>
								{getInitials(a.name)}
							</span>
							<span class="text-xs font-medium">{a.name}</span>
							{#if !disabled}
								<button
									type="button"
									on:click|stopPropagation={() => removeAssignee(a.name)}
									class="rounded-full p-0.5 text-gray-400 hover:text-white"
									aria-label={`Remove ${a.name}`}
								>
									<svg class="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							{/if}
						</span>
					{/each}
				</div>
			{/if}

			{#if !disabled}
				<button
					type="button"
					on:click={() => (isOpen ? closeDropdown() : openDropdown())}
					class="flex w-full items-center justify-between rounded-lg border border-[#2a2f37] bg-[#181b20] px-3 py-2 text-xs font-medium text-gray-200 transition hover:border-[#3a424e] focus:border-lime-500 focus:outline-none"
				>
					<span class="flex items-center gap-1.5 text-gray-300">
						<svg class="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						{(!selected || selected.length === 0) ? 'Assign team member...' : 'Add / remove assignees'}
					</span>
					<svg
						class="h-3.5 w-3.5 text-gray-400 transition-transform duration-150 {isOpen ? 'rotate-180' : ''}"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
			{/if}
		</div>
	{/if}

	<!-- Dropdown Menu / Popover -->
	{#if isOpen}
		<!-- Invisible backdrop for outside clicks -->
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="fixed inset-0 z-40" on:click={closeDropdown}></div>

		<!-- Dropdown Panel -->
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			on:click|stopPropagation
			class="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[240px] max-w-sm rounded-xl border border-[#2a2f37] bg-[#141619] p-2 shadow-2xl backdrop-blur-md"
		>
			<!-- Search filter -->
			<div class="mb-2">
				<div class="relative">
					<svg
						class="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						bind:this={searchInputEl}
						bind:value={searchQuery}
						type="text"
						placeholder="Search team member..."
						class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] py-1.5 pl-8 pr-3 text-xs text-gray-200 placeholder-gray-500 transition focus:border-lime-500 focus:outline-none"
					/>
				</div>
			</div>

			<!-- Options List -->
			<div class="max-h-52 space-y-0.5 overflow-y-auto scrollbar-thin scrollbar-thumb-[#262a30]">
				{#if filteredOptions.length === 0}
					<div class="py-3 text-center text-xs text-gray-500">
						No matching team members
					</div>
				{:else}
					{#each filteredOptions as opt (opt.name)}
						{@const selected = isOptionSelected(opt)}
						<button
							type="button"
							on:click={() => toggleOption(opt)}
							class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition {selected ? 'bg-lime-950/30 text-lime-300' : 'text-gray-200 hover:bg-[#1f2329]'}"
						>
							<div class="flex items-center gap-2 min-w-0">
								<span
									class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold {getAvatarColorClasses(opt.name)}"
								>
									{getInitials(opt.name)}
								</span>
								<div class="truncate min-w-0">
									<div class="font-medium truncate">{opt.name}</div>
									{#if opt.email}
										<div class="text-[10px] text-gray-500 truncate">{opt.email}</div>
									{/if}
								</div>
							</div>

							<!-- Checkbox indicator -->
							<div
								class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition {selected ? 'border-lime-500 bg-lime-400 text-gray-950' : 'border-[#3a424e] bg-[#181b20]'}"
							>
								{#if selected}
									<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
										<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
									</svg>
								{/if}
							</div>
						</button>
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div class="mt-2 flex items-center justify-between border-t border-[#262a30] pt-2 px-1 text-xs text-gray-400">
				<span>{selected.length} selected</span>
				<button
					type="button"
					on:click={closeDropdown}
					class="font-semibold text-lime-400 hover:text-lime-300"
				>
					Done
				</button>
			</div>
		</div>
	{/if}
</div>
