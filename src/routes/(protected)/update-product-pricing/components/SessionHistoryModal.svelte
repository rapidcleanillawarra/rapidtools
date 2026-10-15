<script lang="ts">
  import { onMount } from 'svelte';
  import {
    sessionHistory,
    currentSession,
    fetchRecentSessions,
    completePricingSession,
    sessionLoading
  } from '../stores';
  import type { PricingSession } from '../types';
  import { toastSuccess, toastError } from '$lib/utils/toast';

  export let open: boolean = false;
  export let onClose: () => void;

  let loading: boolean = false;

  $: if (open) {
    loadSessions();
  }

  async function loadSessions() {
    loading = true;
    try {
      await fetchRecentSessions(30);
    } finally {
      loading = false;
    }
  }

  function formatDate(isoString?: string | null): string {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  }

  async function handleCompleteSession(session: PricingSession) {
    const res = await completePricingSession(session.id);
    if (res.success) {
      toastSuccess(`Session "${session.session_name}" completed.`);
      await loadSessions();
    } else {
      toastError(res.message);
    }
  }

  function handleSelectSession(session: PricingSession) {
    currentSession.set(session);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('rapidtools_pricing_update_session_id', session.id);
    }
    toastSuccess(`Active session set to "${session.session_name}".`);
    onClose();
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
    <div class="w-full max-w-3xl rounded-2xl bg-[#141619] border border-[#262a30] shadow-2xl p-6 text-gray-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
      <div class="flex items-center justify-between border-b border-[#262a30] pb-3 mb-4 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-500/10 text-lime-400 border border-lime-500/20">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-white">Pricing Session History</h3>
            <p class="text-xs text-gray-400">Review past pricing update sessions and audit details</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="text-xs text-gray-400 hover:text-lime-400 transition-colors p-1.5 rounded-lg hover:bg-[#1f2329]"
            title="Refresh history"
            on:click={loadSessions}
            disabled={loading}
          >
            <svg class="w-4 h-4 {loading ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            type="button"
            class="text-gray-400 hover:text-gray-200 transition-colors p-1"
            on:click={onClose}
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="overflow-y-auto flex-1 pr-1 text-xs">
        {#if loading && $sessionHistory.length === 0}
          <div class="flex items-center justify-center py-12 text-gray-400 gap-2">
            <div class="animate-spin rounded-full h-5 w-5 border-2 border-lime-400 border-t-transparent"></div>
            <span>Loading sessions...</span>
          </div>
        {:else if $sessionHistory.length === 0}
          <div class="py-12 text-center text-gray-400">
            <p class="font-medium">No sessions found.</p>
            <p class="mt-1 text-[11px] text-gray-500">New sessions will be saved here when created.</p>
          </div>
        {:else}
          <div class="overflow-x-auto rounded-xl border border-[#262a30]">
            <table class="w-full text-left text-xs">
              <thead class="bg-[#181b20] text-gray-400 border-b border-[#262a30]">
                <tr>
                  <th class="py-2.5 px-3 font-semibold">Session Name</th>
                  <th class="py-2.5 px-3 font-semibold">User</th>
                  <th class="py-2.5 px-3 font-semibold">Created</th>
                  <th class="py-2.5 px-3 font-semibold text-center">Items Updated</th>
                  <th class="py-2.5 px-3 font-semibold text-center">Status</th>
                  <th class="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#262a30]">
                {#each $sessionHistory as item (item.id)}
                  {@const isCurrent = $currentSession?.id === item.id}
                  <tr class="hover:bg-[#1a1e24] transition-colors {isCurrent ? 'bg-lime-500/5' : ''}">
                    <td class="py-2.5 px-3 font-medium text-white max-w-[200px] truncate" title={item.session_name}>
                      <div class="flex items-center gap-1.5">
                        {#if isCurrent}
                          <span class="h-2 w-2 rounded-full bg-lime-400 shrink-0" title="Current Active Session"></span>
                        {/if}
                        <span class="truncate">{item.session_name}</span>
                      </div>
                    </td>
                    <td class="py-2.5 px-3 text-gray-300">
                      <div>{item.user_name || 'Unknown'}</div>
                      <div class="text-[10px] text-gray-500 font-mono">{item.user_email || ''}</div>
                    </td>
                    <td class="py-2.5 px-3 text-gray-400 whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </td>
                    <td class="py-2.5 px-3 text-center">
                      <span class="font-bold text-lime-400">{item.items_updated_count ?? 0}</span>
                    </td>
                    <td class="py-2.5 px-3 text-center whitespace-nowrap">
                      {#if item.status === 'active'}
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-lime-500/15 text-lime-400 border border-lime-500/30">
                          Active
                        </span>
                      {:else if item.status === 'completed'}
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-500/15 text-gray-400 border border-gray-500/30">
                          Completed
                        </span>
                      {:else}
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                          {item.status}
                        </span>
                      {/if}
                    </td>
                    <td class="py-2.5 px-3 text-right whitespace-nowrap">
                      {#if item.status === 'active'}
                        {#if !isCurrent}
                          <button
                            type="button"
                            class="text-[11px] text-lime-400 hover:text-lime-300 font-medium mr-2"
                            on:click={() => handleSelectSession(item)}
                          >
                            Set Active
                          </button>
                        {/if}
                        <button
                          type="button"
                          class="text-[11px] text-red-400 hover:text-red-300 font-medium"
                          on:click={() => handleCompleteSession(item)}
                        >
                          Complete
                        </button>
                      {:else}
                        <span class="text-[11px] text-gray-500 italic">Closed</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

      <div class="mt-4 flex justify-end border-t border-[#262a30] pt-3 shrink-0">
        <button
          type="button"
          class="btn-secondary text-xs py-1.5 px-3.5"
          on:click={onClose}
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}
