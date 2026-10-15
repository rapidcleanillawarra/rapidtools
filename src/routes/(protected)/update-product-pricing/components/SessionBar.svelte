<script lang="ts">
  import type { PricingSession } from '../types';

  export let session: PricingSession | null = null;
  export let loading: boolean = false;
  export let onStartSession: () => void;
  export let onCompleteSession: () => void;
  export let onViewHistory: () => void;

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
</script>

<div class="mb-5 rounded-xl border transition-all duration-200 {session ? 'bg-[#15191e] border-lime-500/30 shadow-md shadow-lime-950/20' : 'bg-[#1c1815] border-amber-500/40 shadow-md shadow-amber-950/20'} p-3.5 sm:p-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <!-- Left: Status & Info -->
    <div class="flex items-start gap-3">
      {#if session}
        <div class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-lime-500/10 text-lime-400 border border-lime-500/20">
          <span class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-lime-500"></span>
          </span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-lime-500/15 text-lime-400 border border-lime-500/30">
              Active Session
            </span>
            <h3 class="text-sm font-semibold text-white truncate max-w-md" title={session.session_name}>
              {session.session_name}
            </h3>
          </div>
          <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span>User: <strong class="text-gray-200 font-medium">{session.user_name || 'Unknown'}</strong> ({session.user_email || 'No email'})</span>
            <span>•</span>
            <span>Started: {formatDate(session.created_at)}</span>
            <span>•</span>
            <span>Updated: <span class="font-bold text-lime-400">{session.items_updated_count ?? 0}</span> items</span>
          </div>
        </div>
      {:else}
        <div class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
              No Active Session
            </span>
            <p class="text-sm font-medium text-gray-200">
              Please create a session before updating product pricing
            </p>
          </div>
          <p class="mt-1 text-xs text-gray-400">
            Pricing updates are tracked under sessions containing user details and snapshot history.
          </p>
        </div>
      {/if}
    </div>

    <!-- Right: Action Buttons -->
    <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
      <button
        type="button"
        class="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
        on:click={onViewHistory}
      >
        <svg class="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>History</span>
      </button>

      {#if session}
        <button
          type="button"
          class="bg-[#241a1a] hover:bg-red-950/60 text-red-300 hover:text-red-200 border border-red-800/40 rounded-lg text-xs font-semibold py-1.5 px-3 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
          disabled={loading}
          on:click={onCompleteSession}
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>Complete Session</span>
        </button>
      {:else}
        <button
          type="button"
          class="btn-primary text-xs py-1.5 px-3.5 font-bold inline-flex items-center gap-1.5"
          disabled={loading}
          on:click={onStartSession}
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Start New Session</span>
        </button>
      {/if}
    </div>
  </div>
</div>
