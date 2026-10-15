<script lang="ts">
  import { onMount } from 'svelte';
  import {
    gatherCurrentUserInfo,
    generateAutomaticSessionName,
    createPricingSession,
    sessionLoading
  } from '../stores';
  import { toastSuccess, toastError } from '$lib/utils/toast';

  export let open: boolean = false;
  export let onClose: () => void;
  export let onSuccess: () => void = () => {};

  let userName: string = '';
  let userEmail: string = '';
  let autoSessionName: string = '';
  let loadingUserInfo: boolean = false;

  $: if (open) {
    loadUserAndInitName();
  }

  async function loadUserAndInitName() {
    loadingUserInfo = true;
    try {
      const info = await gatherCurrentUserInfo();
      userName = info.userName;
      userEmail = info.userEmail || '';
      autoSessionName = generateAutomaticSessionName(userName);
    } catch (e) {
      console.error('[CreateSessionModal] failed to get user info', e);
      userName = 'User';
      autoSessionName = generateAutomaticSessionName(userName);
    } finally {
      loadingUserInfo = false;
    }
  }

  function regenerateName() {
    autoSessionName = generateAutomaticSessionName(userName);
  }

  async function handleSubmit() {
    if (!autoSessionName.trim()) {
      autoSessionName = generateAutomaticSessionName(userName);
    }
    const res = await createPricingSession(autoSessionName.trim());
    if (res.success) {
      toastSuccess(`Session "${res.session?.session_name}" started.`);
      onSuccess();
      onClose();
    } else {
      toastError(res.message || 'Failed to start session');
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
    <div class="w-full max-w-lg rounded-2xl bg-[#141619] border border-[#262a30] shadow-2xl p-6 text-gray-200 animate-in fade-in zoom-in-95 duration-150">
      <div class="flex items-center justify-between border-b border-[#262a30] pb-3 mb-4">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-500/10 text-lime-400 border border-lime-500/20">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-white">Start Pricing Session</h3>
            <p class="text-xs text-gray-400">Required before making pricing adjustments</p>
          </div>
        </div>
        <button
          type="button"
          class="text-gray-400 hover:text-gray-200 transition-colors p-1"
          on:click={onClose}
          disabled={$sessionLoading}
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="space-y-4 text-xs">
        <!-- User Information Preview -->
        <div class="rounded-xl bg-[#181b20] border border-[#262a30] p-3.5 space-y-1.5">
          <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            User Information
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
            <div>
              <span class="text-gray-400">Name:</span>
              <span class="ml-1 font-semibold text-white">
                {#if loadingUserInfo}
                  <span class="text-gray-500">Loading...</span>
                {:else}
                  {userName || 'Unknown'}
                {/if}
              </span>
            </div>
            <div>
              <span class="text-gray-400">Email:</span>
              <span class="ml-1 text-gray-300 font-mono text-[11px]">
                {userEmail || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <!-- Automatic Session Name -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label for="session_name_input" class="block font-medium text-gray-300">
              Automatic Session Name
            </label>
            <button
              type="button"
              class="text-[11px] text-lime-400 hover:text-lime-300 inline-flex items-center gap-1 font-medium transition-colors"
              on:click={regenerateName}
            >
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Regenerate</span>
            </button>
          </div>
          <input
            id="session_name_input"
            type="text"
            bind:value={autoSessionName}
            class="block w-full rounded-lg border border-[#262a30] bg-[#0e1012] px-3 py-2 text-xs text-gray-200 shadow-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-500 transition-colors"
            placeholder="Automatic session name"
          />
          <p class="mt-1 text-[11px] text-gray-400">
            Automatically generated with user name and current timestamp. You can adjust if needed.
          </p>
        </div>

        <!-- Explanatory note -->
        <div class="rounded-lg bg-lime-500/5 border border-lime-500/15 p-2.5 text-gray-300 text-[11px] leading-relaxed">
          <strong class="text-lime-400 font-semibold">Note:</strong> All price adjustments, snapshots, and changes saved while this session is active will be linked to this session record in the database for auditing and history tracking.
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-2.5 border-t border-[#262a30] pt-4">
        <button
          type="button"
          class="btn-secondary text-xs py-2 px-3"
          on:click={onClose}
          disabled={$sessionLoading}
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn-primary text-xs font-bold py-2 px-4 inline-flex items-center justify-center gap-2"
          on:click={handleSubmit}
          disabled={$sessionLoading}
        >
          {#if $sessionLoading}
            <div class="animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-950 border-t-transparent"></div>
            <span>Creating...</span>
          {:else}
            <span>Start Session</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
