<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { base } from '$app/paths';
  import { currentUser, isLoadingAuth, authError, logoutUser } from '$lib/firebase';
  import { userProfile, type UserProfile, fetchUserProfile, createUserProfile } from '$lib/userProfile';
  import type { User } from 'firebase/auth';

  let currentAuthUser: User | null = null;
  let currentIsLoadingAuth: boolean = true;
  let currentAuthError: Error | null | unknown = null;
  let currentProfile: UserProfile | null = null;
  let isLoadingProfile = false;
  let profileError: string | null = null;

  // Form data
  let firstName = '';
  let lastName = '';

  const unsubCurrentUser = currentUser.subscribe(value => {
    currentAuthUser = value;
    if (browser && !currentIsLoadingAuth && !currentAuthUser) {
      goto(base + '/', { replaceState: true });
    }
    if (value) {
      loadUserProfile(value.uid);
    }
  });

  const unsubIsLoadingAuth = isLoadingAuth.subscribe(value => {
    currentIsLoadingAuth = value;
    if (browser && !value && !currentAuthUser) {
      goto(base + '/', { replaceState: true });
    }
  });
  
  const unsubAuthError = authError.subscribe(value => {
    currentAuthError = value;
  });

  const unsubUserProfile = userProfile.subscribe(value => {
    currentProfile = value;
    if (value) {
      firstName = value.firstName;
      lastName = value.lastName;
    }
  });

  async function loadUserProfile(uid: string) {
    isLoadingProfile = true;
    profileError = null;
    try {
      await fetchUserProfile(uid);
    } catch (error) {
      console.error('Error loading profile:', error);
      profileError = 'Failed to load user profile';
    } finally {
      isLoadingProfile = false;
    }
  }

  async function handleProfileSubmit() {
    if (!currentAuthUser) return;
    
    if (!firstName.trim() || !lastName.trim()) {
      profileError = 'Please fill in both first and last name';
      return;
    }

    isLoadingProfile = true;
    profileError = null;
    
    try {
      const newProfile: UserProfile = {
        uid: currentAuthUser.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: currentAuthUser.email || ''
      };
      
      await createUserProfile(newProfile);
      profileError = null;
    } catch (error) {
      console.error('Error saving profile:', error);
      profileError = 'Failed to save profile';
    } finally {
      isLoadingProfile = false;
    }
  }

  async function handleLogout() {
    try {
      await logoutUser();
      // Navigation to login page is handled by the currentUser store subscription (becomes null)
    } catch (e) {
      console.error("Dashboard caught logout error:", e);
    }
  }

  onMount(() => {
    if (browser && !currentIsLoadingAuth && !currentAuthUser) {
      goto(base + '/', { replaceState: true });
    }
    return () => {
      unsubCurrentUser();
      unsubIsLoadingAuth();
      unsubAuthError();
      unsubUserProfile();
    };
  });
</script>

<svelte:head>
  <title>Dashboard - RapidTools</title>
</svelte:head>

<div class="min-h-[calc(100vh-4rem)] w-full p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
  {#if currentIsLoadingAuth || isLoadingProfile}
    <div class="flex flex-col items-center justify-center min-h-[50vh] gap-3">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-lime-400 border-t-transparent"></div>
      <p class="text-sm font-medium text-gray-400">Loading your profile...</p>
    </div>
  {:else if currentAuthUser}
    {#if currentProfile}
      <!-- Welcome Hero -->
      <div class="mb-8 relative overflow-hidden rounded-2xl border border-[#262a30] bg-gradient-to-br from-[#16191d] via-[#141619] to-[#101214] p-6 sm:p-8 shadow-xl">
        <div class="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-lime-500/10 blur-3xl pointer-events-none"></div>
        <div class="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="rounded bg-lime-500/20 px-2 py-0.5 text-xs font-bold tracking-wider text-lime-400 border border-lime-500/30">
                RAPIDTOOLS WORKSPACE
              </span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, <span class="text-lime-400">{currentProfile.firstName}</span>!
            </h1>
            <p class="mt-1 text-sm text-gray-400">
              Logged in as <span class="text-gray-300 font-medium">{currentAuthUser.email}</span>
            </p>
          </div>

          <div class="flex items-center gap-3">
            <a
              href="{base}/edit-profile"
              class="inline-flex items-center gap-2 rounded-lg border border-[#333842] bg-[#1f2329] px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-lime-500/40 hover:bg-[#262a30] hover:text-lime-300"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Edit Profile
            </a>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-900/60 hover:text-red-300"
              on:click={handleLogout}
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log Out
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Launch Navigation Grid -->
      <div class="mb-8">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
          <svg class="h-4 w-4 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          Quick Shortcuts
        </h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Price Lists -->
          <a
            href="{base}/price-lists"
            class="group rounded-xl border border-[#262a30] bg-[#141619] p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-500/50 hover:bg-[#181b20]"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/10 border border-lime-500/20 text-lime-400">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5h12M9 12h12M9 19h12M5 5h.01M5 12h.01M5 19h.01" />
                </svg>
              </div>
              <svg class="h-4 w-4 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 class="text-base font-bold text-white group-hover:text-lime-300">Price Lists</h3>
            <p class="mt-1 text-xs text-gray-400">Manage, calculate, and duplicate SKU price lists.</p>
          </a>

          <!-- Products -->
          <a
            href="{base}/product-request"
            class="group rounded-xl border border-[#262a30] bg-[#141619] p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-500/50 hover:bg-[#181b20]"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/10 border border-lime-500/20 text-lime-400">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <svg class="h-4 w-4 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 class="text-base font-bold text-white group-hover:text-lime-300">Products</h3>
            <p class="mt-1 text-xs text-gray-400">Product requests, approvals, and price updates.</p>
          </a>

          <!-- Orders -->
          <a
            href="{base}/customer-group-invoices"
            class="group rounded-xl border border-[#262a30] bg-[#141619] p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-500/50 hover:bg-[#181b20]"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/10 border border-lime-500/20 text-lime-400">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <svg class="h-4 w-4 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 class="text-base font-bold text-white group-hover:text-lime-300">Orders & Invoices</h3>
            <p class="mt-1 text-xs text-gray-400">Customer invoices, past due accounts, and batch payments.</p>
          </a>

          <!-- Workshop -->
          <a
            href="{base}/workshop/workshop-board"
            class="group rounded-xl border border-[#262a30] bg-[#141619] p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-500/50 hover:bg-[#181b20]"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/10 border border-lime-500/20 text-lime-400">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <svg class="h-4 w-4 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 class="text-base font-bold text-white group-hover:text-lime-300">Workshop Board</h3>
            <p class="mt-1 text-xs text-gray-400">Track service jobs, deliveries, PMIS and equipment repair.</p>
          </a>
        </div>
      </div>
    {:else}
      <!-- Complete Profile Setup -->
      <div class="mx-auto max-w-lg mt-10 rounded-2xl border border-[#262a30] bg-[#141619] p-6 sm:p-8 shadow-2xl">
        <div class="mb-6 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-400">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 class="text-xl font-bold text-white">Complete Your Profile</h2>
          <p class="mt-1 text-sm text-gray-400">Please provide your details to continue to the workspace.</p>
        </div>

        <form on:submit|preventDefault={handleProfileSubmit} class="space-y-4">
          <div>
            <label for="firstName" class="form-label">First Name</label>
            <input
              type="text"
              id="firstName"
              bind:value={firstName}
              class="input-field"
              placeholder="e.g. John"
              required
            />
          </div>

          <div>
            <label for="lastName" class="form-label">Last Name</label>
            <input
              type="text"
              id="lastName"
              bind:value={lastName}
              class="input-field"
              placeholder="e.g. Doe"
              required
            />
          </div>

          {#if profileError}
            <div class="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-400">
              {profileError}
            </div>
          {/if}

          <button
            type="submit"
            class="btn-primary w-full mt-2"
            disabled={isLoadingProfile}
          >
            {isLoadingProfile ? 'Saving Profile...' : 'Save Profile & Continue'}
          </button>
        </form>
      </div>
    {/if}
  {:else if currentAuthError}
    <div class="mx-auto max-w-md mt-16 rounded-xl border border-red-500/30 bg-red-950/30 p-6 text-center shadow-xl">
      <h3 class="text-lg font-bold text-red-400 mb-2">Authentication Error</h3>
      <p class="text-sm text-gray-300 mb-4">{typeof currentAuthError === 'object' && currentAuthError !== null && 'message' in currentAuthError ? (currentAuthError as {message: string}).message : 'An unknown error occurred'}.</p>
      <a href="{base}/" class="btn-primary inline-block">Return to Login</a>
    </div>
  {:else}
    <div class="flex flex-col items-center justify-center min-h-[50vh] gap-3">
      <p class="text-sm text-gray-400">You are not authenticated. Redirecting to login...</p>
    </div>
  {/if}
</div> 