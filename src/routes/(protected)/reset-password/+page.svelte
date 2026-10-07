<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { currentUser, sendPasswordReset, updateUserPassword, verifyResetCode, confirmResetCode } from '$lib/firebase';
  import { fetchAllUserProfiles, type UserProfile } from '$lib/userProfile';
  import { toastSuccess, toastError, toastInfo } from '$lib/utils/toast';
  import type { User } from 'firebase/auth';

  // Tabs
  type TabType = 'accounts' | 'email' | 'change-mine' | 'verify-code';
  let activeTab: TabType = 'accounts';

  // Auth User
  let user: User | null = null;
  const unsubUser = currentUser.subscribe((val) => {
    user = val;
  });

  onDestroy(() => {
    unsubUser();
  });

  // Tab 1: Team Accounts Directory
  let teamUsers: UserProfile[] = [];
  let isLoadingUsers = true;
  let loadUsersError: string | null = null;
  let userSearchQuery = '';
  let sendingResetUids: Set<string> = new Set();
  let resetTimestamps: Record<string, string> = {}; // email -> formatted time

  // Tab 2: Custom Email Form
  let customEmail = '';
  let isSendingCustomReset = false;
  let customResetHistory: { email: string; timestamp: string }[] = [];

  // Tab 3: Change Current User's Password
  let newPassword = '';
  let confirmPassword = '';
  let showNewPassword = false;
  let showConfirmPassword = false;
  let isUpdatingPassword = false;
  let requiresRecentLogin = false;
  let isSendingSelfReset = false;

  // Tab 4: Verify & Redeem Reset Code (oobCode)
  let actionCode = '';
  let verifiedEmail: string | null = null;
  let isVerifyingCode = false;
  let codeNewPassword = '';
  let showCodeNewPassword = false;
  let isConfirmingCode = false;
  let codeCompleted = false;

  onMount(async () => {
    // Check if URL has oobCode or mode parameter from Firebase email link
    const searchParams = $page.url.searchParams;
    const oobCodeParam = searchParams.get('oobCode');
    const modeParam = searchParams.get('mode');

    if (oobCodeParam) {
      actionCode = oobCodeParam;
      activeTab = 'verify-code';
      await handleVerifyCode();
    } else if (modeParam === 'resetPassword') {
      activeTab = 'verify-code';
    }

    await loadTeamUsers();
  });

  async function loadTeamUsers() {
    isLoadingUsers = true;
    loadUsersError = null;
    try {
      teamUsers = await fetchAllUserProfiles();
    } catch (err: unknown) {
      console.error('Failed to load user profiles:', err);
      loadUsersError = 'Could not load team accounts from Firestore. You can still send reset emails directly using the "Send by Email" tab.';
    } finally {
      isLoadingUsers = false;
    }
  }

  // Filtered users
  $: filteredUsers = teamUsers.filter((u) => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    return fullName.includes(q) || (u.email && u.email.toLowerCase().includes(q)) || (u.uid && u.uid.toLowerCase().includes(q));
  });

  function formatCurrentTime(): string {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // Send password reset for team user
  async function handleSendTeamUserReset(targetUser: UserProfile) {
    if (!targetUser.email) {
      toastError(`No email address on file for ${targetUser.firstName || 'this user'}.`);
      return;
    }

    const email = targetUser.email.trim();
    sendingResetUids.add(targetUser.uid);
    sendingResetUids = new Set(sendingResetUids);

    try {
      await sendPasswordReset(email);
      const timeStr = formatCurrentTime();
      resetTimestamps[email] = timeStr;
      resetTimestamps = { ...resetTimestamps };

      // Add to session history
      customResetHistory = [{ email, timestamp: timeStr }, ...customResetHistory.filter(h => h.email !== email)];

      toastSuccess(`Password reset email dispatched to ${email}`, 'Reset Link Sent');
    } catch (err: unknown) {
      console.error('Error sending reset email:', err);
      const msg = mapFirebaseError(err);
      toastError(msg, 'Failed to Send Reset');
    } finally {
      sendingResetUids.delete(targetUser.uid);
      sendingResetUids = new Set(sendingResetUids);
    }
  }

  // Send custom email reset
  async function handleSendCustomReset() {
    if (!customEmail.trim()) {
      toastError('Please enter an email address.');
      return;
    }

    const email = customEmail.trim();
    isSendingCustomReset = true;

    try {
      await sendPasswordReset(email);
      const timeStr = formatCurrentTime();
      resetTimestamps[email] = timeStr;
      resetTimestamps = { ...resetTimestamps };

      customResetHistory = [{ email, timestamp: timeStr }, ...customResetHistory.filter(h => h.email !== email)];

      toastSuccess(`Password reset email dispatched to ${email}`, 'Reset Link Sent');
      customEmail = '';
    } catch (err: unknown) {
      console.error('Error sending custom reset email:', err);
      const msg = mapFirebaseError(err);
      toastError(msg, 'Failed to Send Reset');
    } finally {
      isSendingCustomReset = false;
    }
  }

  // Direct password update for currently logged-in user
  async function handleUpdateMyPassword() {
    if (!user) {
      toastError('You must be signed in to change your password.');
      return;
    }

    if (!newPassword) {
      toastError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      toastError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toastError('Passwords do not match.');
      return;
    }

    isUpdatingPassword = true;
    requiresRecentLogin = false;

    try {
      await updateUserPassword(user, newPassword);
      toastSuccess('Your password was updated successfully!', 'Password Changed');
      newPassword = '';
      confirmPassword = '';
    } catch (err: unknown) {
      console.error('Error updating personal password:', err);
      const errorObj = err as { code?: string; message?: string };
      if (errorObj?.code === 'auth/requires-recent-login') {
        requiresRecentLogin = true;
        toastError('For security, updating your password directly requires a recent login session.', 'Recent Login Required');
      } else {
        const msg = mapFirebaseError(err);
        toastError(msg, 'Password Update Failed');
      }
    } finally {
      isUpdatingPassword = false;
    }
  }

  // Send reset email to logged-in user if requires-recent-login
  async function handleSendSelfReset() {
    if (!user?.email) return;
    isSendingSelfReset = true;
    try {
      await sendPasswordReset(user.email);
      toastSuccess(`Password reset email sent to your email (${user.email}). Check your inbox!`, 'Reset Email Sent');
      requiresRecentLogin = false;
    } catch (err: unknown) {
      console.error('Error sending self reset:', err);
      toastError(mapFirebaseError(err), 'Failed to Send');
    } finally {
      isSendingSelfReset = false;
    }
  }

  // Verify action code
  async function handleVerifyCode() {
    if (!actionCode.trim()) {
      toastError('Please enter a reset action code.');
      return;
    }

    isVerifyingCode = true;
    verifiedEmail = null;
    codeCompleted = false;

    try {
      const email = await verifyResetCode(actionCode.trim());
      verifiedEmail = email;
      toastSuccess(`Code verified for account: ${email}`, 'Code Verified');
    } catch (err: unknown) {
      console.error('Error verifying action code:', err);
      const msg = mapFirebaseError(err);
      toastError(msg, 'Invalid Code');
    } finally {
      isVerifyingCode = false;
    }
  }

  // Confirm password reset with action code
  async function handleConfirmCodeReset() {
    if (!actionCode.trim()) {
      toastError('Action code is missing.');
      return;
    }

    if (!codeNewPassword || codeNewPassword.length < 6) {
      toastError('Please enter a password with at least 6 characters.');
      return;
    }

    isConfirmingCode = true;
    try {
      await confirmResetCode(actionCode.trim(), codeNewPassword);
      codeCompleted = true;
      toastSuccess('Password reset has been completed successfully!', 'Reset Complete');
      codeNewPassword = '';
    } catch (err: unknown) {
      console.error('Error confirming reset code:', err);
      toastError(mapFirebaseError(err), 'Reset Failed');
    } finally {
      isConfirmingCode = false;
    }
  }

  // Copy helper
  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toastInfo(`${label} copied to clipboard`);
    } catch {
      toastError('Failed to copy to clipboard');
    }
  }

  function mapFirebaseError(error: unknown): string {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: string }).code)
        : '';
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: string }).message)
        : '';

    switch (code) {
      case 'auth/user-not-found':
        return 'No registered Firebase account found for that email address.';
      case 'auth/invalid-email':
        return 'Please provide a valid email address.';
      case 'auth/expired-action-code':
        return 'The password reset link or code has expired. Please request a new reset email.';
      case 'auth/invalid-action-code':
        return 'The password reset code is invalid or has already been used.';
      case 'auth/weak-password':
        return 'Password is too weak. It must be at least 6 characters.';
      case 'auth/requires-recent-login':
        return 'This security operation requires recent authentication. Please sign in again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment before trying again.';
      case 'auth/network-request-failed':
        return 'Network connection failed. Please check your internet connection.';
      default:
        return message || 'An error occurred with Firebase Authentication. Please try again.';
    }
  }
</script>

<svelte:head>
  <title>Reset Password Management | RapidTools</title>
</svelte:head>

<div class="min-h-[calc(100vh-4rem)] w-full p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
  <!-- Page Header -->
  <div class="mb-8">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-2">
          <span class="rounded bg-lime-500/20 px-2.5 py-0.5 text-xs font-bold tracking-wider text-lime-400 border border-lime-500/30">
            SECURITY & ACCESS
          </span>
          <span class="text-xs text-gray-500">•</span>
          <span class="text-xs text-gray-400 font-medium">Firebase Authentication</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-400">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </span>
          Password Reset Management
        </h1>
        <p class="mt-2 text-sm text-gray-400 max-w-3xl">
          Manage account password resets for team members, dispatch official Firebase reset links to registered email addresses, or update your personal credentials.
        </p>
      </div>

      <!-- Quick Action to Dashboard -->
      <div class="flex items-center gap-2">
        <a
          href="{base}/dashboard"
          class="inline-flex items-center gap-2 rounded-lg border border-[#333842] bg-[#1a1d22] px-3.5 py-2 text-xs font-semibold text-gray-300 transition hover:bg-[#22262d] hover:text-white"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </a>
      </div>
    </div>
  </div>

  <!-- Security Explanation Banner -->
  <div class="mb-8 rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 sm:p-5 text-sm text-gray-300 backdrop-blur-sm">
    <div class="flex items-start gap-3.5">
      <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 mt-0.5">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="flex-1 space-y-1">
        <h4 class="font-semibold text-white">How Firebase Account Password Resets Work</h4>
        <p class="text-xs text-gray-400 leading-relaxed">
          For security and privacy, Firebase Authentication does not permit administrators to arbitrarily overwrite or view passwords in plaintext from client applications.
          Instead, Firebase generates a secure, one-time encrypted password reset link and dispatches it directly to the user's registered email address.
          The user clicks the link to choose their new password and can immediately sign into RapidTools.
        </p>
      </div>
    </div>
  </div>

  <!-- Navigation Tabs -->
  <div class="mb-6 border-b border-[#262a30]">
    <nav class="flex flex-wrap gap-2 sm:gap-4 -mb-px" aria-label="Tabs">
      <button
        type="button"
        class="flex items-center gap-2 border-b-2 py-3 px-3.5 text-xs sm:text-sm font-semibold transition-all {activeTab === 'accounts' ? 'border-lime-400 text-lime-400' : 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}"
        on:click={() => (activeTab = 'accounts')}
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Team Accounts
        {#if teamUsers.length > 0}
          <span class="rounded-full bg-[#20242a] px-2 py-0.5 text-[10px] font-bold text-gray-300">
            {teamUsers.length}
          </span>
        {/if}
      </button>

      <button
        type="button"
        class="flex items-center gap-2 border-b-2 py-3 px-3.5 text-xs sm:text-sm font-semibold transition-all {activeTab === 'email' ? 'border-lime-400 text-lime-400' : 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}"
        on:click={() => (activeTab = 'email')}
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Send by Email
      </button>

      <button
        type="button"
        class="flex items-center gap-2 border-b-2 py-3 px-3.5 text-xs sm:text-sm font-semibold transition-all {activeTab === 'change-mine' ? 'border-lime-400 text-lime-400' : 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}"
        on:click={() => (activeTab = 'change-mine')}
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Change My Password
      </button>

      <button
        type="button"
        class="flex items-center gap-2 border-b-2 py-3 px-3.5 text-xs sm:text-sm font-semibold transition-all {activeTab === 'verify-code' ? 'border-lime-400 text-lime-400' : 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}"
        on:click={() => (activeTab = 'verify-code')}
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Action Code / Redeem
      </button>
    </nav>
  </div>

  <!-- TAB 1: TEAM ACCOUNTS DIRECTORY -->
  {#if activeTab === 'accounts'}
    <div class="space-y-4" transition:fade={{ duration: 150 }}>
      <!-- Search & Controls Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="relative flex-1 max-w-md">
          <input
            type="text"
            bind:value={userSearchQuery}
            placeholder="Search by name, email, or UID..."
            class="w-full rounded-xl border border-[#262a30] bg-[#141619] px-4 py-2.5 pl-10 text-sm text-gray-200 placeholder-gray-500 focus:border-lime-500/50 focus:outline-none focus:ring-1 focus:ring-lime-500/50"
          />
          <svg class="absolute left-3 top-3 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {#if userSearchQuery}
            <button
              type="button"
              on:click={() => (userSearchQuery = '')}
              class="absolute right-3 top-3 text-xs text-gray-500 hover:text-gray-300"
            >
              Clear
            </button>
          {/if}
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            on:click={loadTeamUsers}
            disabled={isLoadingUsers}
            class="inline-flex items-center gap-2 rounded-xl border border-[#262a30] bg-[#141619] px-3.5 py-2.5 text-xs font-semibold text-gray-300 transition hover:bg-[#1a1d22] hover:text-white disabled:opacity-50"
          >
            <svg class="h-3.5 w-3.5 {isLoadingUsers ? 'animate-spin text-lime-400' : 'text-gray-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh List
          </button>
        </div>
      </div>

      {#if loadUsersError}
        <div class="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-300 flex items-center justify-between">
          <p>{loadUsersError}</p>
          <button
            type="button"
            on:click={loadTeamUsers}
            class="text-xs font-semibold underline hover:text-amber-200 ml-4 flex-shrink-0"
          >
            Try Again
          </button>
        </div>
      {/if}

      <!-- Accounts Table / Cards -->
      {#if isLoadingUsers}
        <div class="flex flex-col items-center justify-center rounded-2xl border border-[#262a30] bg-[#141619] p-12 text-center">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-lime-400 border-t-transparent mb-3"></div>
          <p class="text-sm font-medium text-gray-400">Loading team member accounts...</p>
        </div>
      {:else if filteredUsers.length === 0}
        <div class="flex flex-col items-center justify-center rounded-2xl border border-[#262a30] bg-[#141619] p-12 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e2228] text-gray-500 mb-3">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 class="text-base font-bold text-gray-200">No accounts match your query</h3>
          <p class="mt-1 text-xs text-gray-400 max-w-sm">
            Try adjusting your search query, or use the "Send by Email" tab to trigger a reset email to any address.
          </p>
        </div>
      {:else}
        <div class="overflow-hidden rounded-2xl border border-[#262a30] bg-[#141619] shadow-xl">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm text-gray-300">
              <thead class="border-b border-[#262a30] bg-[#101214] text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th scope="col" class="py-3.5 px-4 sm:px-6">Team Member</th>
                  <th scope="col" class="py-3.5 px-4 sm:px-6">Email Address</th>
                  <th scope="col" class="py-3.5 px-4 sm:px-6 hidden md:table-cell">User ID (UID)</th>
                  <th scope="col" class="py-3.5 px-4 sm:px-6">Status / Recent</th>
                  <th scope="col" class="py-3.5 px-4 sm:px-6 text-right">Reset Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#1e2228]">
                {#each filteredUsers as teamUser (teamUser.uid)}
                  {@const isSending = sendingResetUids.has(teamUser.uid)}
                  {@const lastSent = teamUser.email ? resetTimestamps[teamUser.email] : null}
                  <tr class="transition-colors hover:bg-[#181b20]">
                    <!-- Name & Avatar -->
                    <td class="py-3 px-4 sm:px-6">
                      <div class="flex items-center gap-3">
                        <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-lime-400 to-lime-600 font-bold text-gray-950 shadow-sm text-xs">
                          {#if teamUser.firstName}
                            {teamUser.firstName[0].toUpperCase()}
                          {:else if teamUser.email}
                            {teamUser.email[0].toUpperCase()}
                          {:else}
                            U
                          {/if}
                        </div>
                        <div class="overflow-hidden">
                          <p class="font-semibold text-white truncate">
                            {teamUser.firstName || ''} {teamUser.lastName || ''}
                            {#if !teamUser.firstName && !teamUser.lastName}
                              <span class="text-gray-500 font-normal italic">Unnamed Account</span>
                            {/if}
                          </p>
                          {#if user?.email === teamUser.email}
                            <span class="inline-block rounded bg-lime-500/10 px-1.5 py-0.2 text-[10px] font-bold text-lime-400 border border-lime-500/20">
                              You
                            </span>
                          {/if}
                        </div>
                      </div>
                    </td>

                    <!-- Email -->
                    <td class="py-3 px-4 sm:px-6 font-mono text-xs">
                      {#if teamUser.email}
                        <div class="flex items-center gap-2">
                          <span class="text-gray-200 truncate">{teamUser.email}</span>
                          <button
                            type="button"
                            on:click={() => copyToClipboard(teamUser.email, 'Email')}
                            class="rounded p-1 text-gray-500 hover:bg-[#20242a] hover:text-gray-300"
                            title="Copy email"
                          >
                            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      {:else}
                        <span class="text-gray-500 italic">No email</span>
                      {/if}
                    </td>

                    <!-- UID -->
                    <td class="py-3 px-4 sm:px-6 hidden md:table-cell font-mono text-xs text-gray-400">
                      <div class="flex items-center gap-2">
                        <span class="truncate max-w-[120px]">{teamUser.uid}</span>
                        <button
                          type="button"
                          on:click={() => copyToClipboard(teamUser.uid, 'UID')}
                          class="rounded p-1 text-gray-500 hover:bg-[#20242a] hover:text-gray-300"
                          title="Copy UID"
                        >
                          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </td>

                    <!-- Status / Last Sent -->
                    <td class="py-3 px-4 sm:px-6">
                      {#if lastSent}
                        <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                          <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Sent at {lastSent}
                        </span>
                      {:else}
                        <span class="inline-flex items-center gap-1.5 rounded-full bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-400">
                          <span class="h-1.5 w-1.5 rounded-full bg-gray-500"></span>
                          Ready
                        </span>
                      {/if}
                    </td>

                    <!-- Action Button -->
                    <td class="py-3 px-4 sm:px-6 text-right">
                      <button
                        type="button"
                        disabled={isSending || !teamUser.email}
                        on:click={() => handleSendTeamUserReset(teamUser)}
                        class="inline-flex items-center gap-1.5 rounded-lg border border-[#333842] bg-[#1a1d22] px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:border-lime-500/40 hover:bg-[#22262d] hover:text-lime-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        title={teamUser.email ? `Send password reset email to ${teamUser.email}` : 'No email available'}
                      >
                        {#if isSending}
                          <svg class="h-3.5 w-3.5 animate-spin text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Sending...</span>
                        {:else}
                          <svg class="h-3.5 w-3.5 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span>Send Reset Link</span>
                        {/if}
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- TAB 2: SEND BY CUSTOM EMAIL -->
  {#if activeTab === 'email'}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6" transition:fade={{ duration: 150 }}>
      <!-- Form Box -->
      <div class="lg:col-span-2 rounded-2xl border border-[#262a30] bg-[#141619] p-6 sm:p-8 shadow-xl">
        <h2 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <svg class="h-5 w-5 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Send Password Reset Email
        </h2>
        <p class="text-xs text-gray-400 mb-6">
          Dispatch an official Firebase password reset link to any registered user email. This works for both team members in the directory and external accounts.
        </p>

        <form on:submit|preventDefault={handleSendCustomReset} class="space-y-4">
          <div>
            <label for="customEmail" class="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
              Target Account Email Address
            </label>
            <div class="relative">
              <input
                id="customEmail"
                type="email"
                bind:value={customEmail}
                placeholder="e.g. employee@rapidcleanillawarra.com.au"
                required
                class="w-full rounded-xl border border-[#262a30] bg-[#101214] px-4 py-3 pl-11 text-sm text-gray-100 placeholder-gray-500 focus:border-lime-500/50 focus:outline-none focus:ring-1 focus:ring-lime-500/50"
              />
              <svg class="absolute left-3.5 top-3.5 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
              </svg>
            </div>
          </div>

          <div class="pt-2 flex items-center justify-between">
            <p class="text-[11px] text-gray-500">
              The email will arrive from your Firebase project's configured sender.
            </p>
            <button
              type="submit"
              disabled={isSendingCustomReset || !customEmail.trim()}
              class="inline-flex items-center gap-2 rounded-xl bg-lime-500 px-5 py-2.5 text-xs font-bold text-gray-950 transition hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {#if isSendingCustomReset}
                <svg class="h-4 w-4 animate-spin text-gray-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Dispatching...</span>
              {:else}
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Send Password Reset Email</span>
              {/if}
            </button>
          </div>
        </form>
      </div>

      <!-- History / Info Sidebar -->
      <div class="rounded-2xl border border-[#262a30] bg-[#141619] p-6 shadow-xl flex flex-col justify-between">
        <div>
          <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <svg class="h-4 w-4 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Session Dispatch History
          </h3>

          {#if customResetHistory.length === 0}
            <div class="rounded-xl border border-dashed border-[#262a30] p-6 text-center text-xs text-gray-500">
              No reset emails dispatched in this session yet.
            </div>
          {:else}
            <div class="space-y-2 max-h-[300px] overflow-y-auto">
              {#each customResetHistory as item}
                <div class="flex items-center justify-between rounded-lg border border-[#20242a] bg-[#101214] p-2.5 text-xs">
                  <span class="font-mono text-gray-300 truncate max-w-[160px]">{item.email}</span>
                  <span class="text-[10px] text-emerald-400 font-semibold">{item.timestamp}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="mt-6 border-t border-[#262a30] pt-4">
          <p class="text-[11px] text-gray-400 leading-normal">
            <strong>Tip:</strong> If the user does not receive their email within 2-3 minutes, remind them to check their Spam/Junk folder or confirm the email address spelling.
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- TAB 3: CHANGE MY PASSWORD (DIRECT UPDATE) -->
  {#if activeTab === 'change-mine'}
    <div class="max-w-xl mx-auto rounded-2xl border border-[#262a30] bg-[#141619] p-6 sm:p-8 shadow-xl" transition:fade={{ duration: 150 }}>
      <div class="flex items-center gap-3 mb-6">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-500/10 border border-lime-500/20 text-lime-400">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <h2 class="text-lg font-bold text-white">Change Your Account Password</h2>
          <p class="text-xs text-gray-400">
            Directly update the password for your currently logged-in account ({user?.email || 'Current User'}).
          </p>
        </div>
      </div>

      {#if requiresRecentLogin}
        <div class="mb-6 rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-xs text-amber-300 space-y-3">
          <div class="flex items-start gap-2">
            <svg class="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p>
              Firebase requires a recent sign-in before allowing direct password updates. You can either sign out and log back in, or immediately dispatch a password reset email to yourself below:
            </p>
          </div>
          <button
            type="button"
            on:click={handleSendSelfReset}
            disabled={isSendingSelfReset}
            class="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30"
          >
            {#if isSendingSelfReset}
              <span>Sending Email...</span>
            {:else}
              <span>Send Me a Password Reset Email Instead</span>
            {/if}
          </button>
        </div>
      {/if}

      <form on:submit|preventDefault={handleUpdateMyPassword} class="space-y-4">
        <!-- New Password -->
        <div>
          <label for="newPassword" class="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
            New Password
          </label>
          <div class="relative">
            <input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              bind:value={newPassword}
              placeholder="Minimum 6 characters"
              required
              minlength="6"
              class="w-full rounded-xl border border-[#262a30] bg-[#101214] px-4 py-2.5 pr-10 text-sm text-gray-100 placeholder-gray-500 focus:border-lime-500/50 focus:outline-none focus:ring-1 focus:ring-lime-500/50"
            />
            <button
              type="button"
              on:click={() => (showNewPassword = !showNewPassword)}
              class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200"
              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {#if showNewPassword}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                {:else}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                {/if}
              </svg>
            </button>
          </div>
        </div>

        <!-- Confirm Password -->
        <div>
          <label for="confirmPassword" class="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
            Confirm New Password
          </label>
          <div class="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              bind:value={confirmPassword}
              placeholder="Re-type new password"
              required
              minlength="6"
              class="w-full rounded-xl border border-[#262a30] bg-[#101214] px-4 py-2.5 pr-10 text-sm text-gray-100 placeholder-gray-500 focus:border-lime-500/50 focus:outline-none focus:ring-1 focus:ring-lime-500/50"
            />
            <button
              type="button"
              on:click={() => (showConfirmPassword = !showConfirmPassword)}
              class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {#if showConfirmPassword}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                {:else}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                {/if}
              </svg>
            </button>
          </div>
        </div>

        <!-- Requirements Indicator -->
        <div class="rounded-xl border border-[#20242a] bg-[#101214] p-3 text-xs space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full {newPassword.length >= 6 ? 'bg-lime-400' : 'bg-gray-600'}"></span>
            <span class="{newPassword.length >= 6 ? 'text-lime-300' : 'text-gray-400'}">At least 6 characters</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full {newPassword && newPassword === confirmPassword ? 'bg-lime-400' : 'bg-gray-600'}"></span>
            <span class="{newPassword && newPassword === confirmPassword ? 'text-lime-300' : 'text-gray-400'}">Passwords match</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isUpdatingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
          class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-lime-500 py-3 text-sm font-bold text-gray-950 transition hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-md mt-2"
        >
          {#if isUpdatingPassword}
            <svg class="h-4 w-4 animate-spin text-gray-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Updating Password...</span>
          {:else}
            <span>Update My Password</span>
          {/if}
        </button>
      </form>
    </div>
  {/if}

  <!-- TAB 4: VERIFY & REDEEM ACTION CODE -->
  {#if activeTab === 'verify-code'}
    <div class="max-w-xl mx-auto rounded-2xl border border-[#262a30] bg-[#141619] p-6 sm:p-8 shadow-xl" transition:fade={{ duration: 150 }}>
      <div class="flex items-center gap-3 mb-6">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-500/10 border border-lime-500/20 text-lime-400">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h2 class="text-lg font-bold text-white">Redeem Password Reset Code</h2>
          <p class="text-xs text-gray-400">
            Paste the one-time action code (<code class="text-lime-400">oobCode</code>) received in a reset email link to verify and set a new password.
          </p>
        </div>
      </div>

      {#if codeCompleted}
        <div class="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-6 text-center space-y-3">
          <div class="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 class="text-base font-bold text-white">Password Reset Successful!</h3>
          <p class="text-xs text-gray-300">
            The account password has been updated. You can now use the new credentials to log into RapidTools.
          </p>
          <button
            type="button"
            on:click={() => {
              codeCompleted = false;
              actionCode = '';
              verifiedEmail = null;
            }}
            class="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-gray-950 hover:bg-emerald-400"
          >
            Reset Another Code
          </button>
        </div>
      {:else}
        <div class="space-y-4">
          <!-- Action Code input -->
          <div>
            <label for="actionCode" class="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
              Reset Action Code (oobCode)
            </label>
            <div class="flex gap-2">
              <input
                id="actionCode"
                type="text"
                bind:value={actionCode}
                placeholder="Paste code or link query parameter..."
                class="flex-1 rounded-xl border border-[#262a30] bg-[#101214] px-4 py-2.5 font-mono text-xs text-gray-100 placeholder-gray-500 focus:border-lime-500/50 focus:outline-none focus:ring-1 focus:ring-lime-500/50"
              />
              <button
                type="button"
                on:click={handleVerifyCode}
                disabled={isVerifyingCode || !actionCode.trim()}
                class="rounded-xl border border-[#333842] bg-[#1a1d22] px-4 py-2.5 text-xs font-semibold text-gray-200 hover:border-lime-500/40 hover:bg-[#22262d] hover:text-lime-300 disabled:opacity-50"
              >
                {#if isVerifyingCode}
                  <svg class="h-4 w-4 animate-spin text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                {:else}
                  <span>Verify Code</span>
                {/if}
              </button>
            </div>
          </div>

          {#if verifiedEmail}
            <div class="rounded-xl border border-lime-500/30 bg-lime-950/20 p-3.5 text-xs text-gray-300 space-y-1" transition:slide>
              <span class="text-lime-400 font-bold uppercase tracking-wider text-[10px]">Verified Account</span>
              <p class="font-mono text-sm text-white font-semibold">{verifiedEmail}</p>
            </div>

            <!-- New Password for Verified Code -->
            <div class="pt-2">
              <label for="codeNewPassword" class="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                Set New Password for this Account
              </label>
              <div class="relative">
                <input
                  id="codeNewPassword"
                  type={showCodeNewPassword ? 'text' : 'password'}
                  bind:value={codeNewPassword}
                  placeholder="Minimum 6 characters"
                  minlength="6"
                  class="w-full rounded-xl border border-[#262a30] bg-[#101214] px-4 py-2.5 pr-10 text-sm text-gray-100 placeholder-gray-500 focus:border-lime-500/50 focus:outline-none focus:ring-1 focus:ring-lime-500/50"
                />
                <button
                  type="button"
                  on:click={() => (showCodeNewPassword = !showCodeNewPassword)}
                  class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200"
                  aria-label={showCodeNewPassword ? 'Hide password' : 'Show password'}
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {#if showCodeNewPassword}
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    {:else}
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    {/if}
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={isConfirmingCode || !codeNewPassword || codeNewPassword.length < 6}
              on:click={handleConfirmCodeReset}
              class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-lime-500 py-3 text-sm font-bold text-gray-950 transition hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-md mt-2"
            >
              {#if isConfirmingCode}
                <svg class="h-4 w-4 animate-spin text-gray-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Applying New Password...</span>
              {:else}
                <span>Confirm & Set New Password</span>
              {/if}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
