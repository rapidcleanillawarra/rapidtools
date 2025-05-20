<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
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
      goto('/', { replaceState: true });
    }
    if (value) {
      loadUserProfile(value.uid);
    }
  });

  const unsubIsLoadingAuth = isLoadingAuth.subscribe(value => {
    currentIsLoadingAuth = value;
    if (browser && !value && !currentAuthUser) {
      goto('/', { replaceState: true });
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
      goto('/', { replaceState: true });
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

<div class="dashboard-container">
  {#if currentIsLoadingAuth || isLoadingProfile}
    <p>Loading...</p>
  {:else if currentAuthUser}
    {#if currentProfile}
      <div class="welcome-section">
        <h1 class="text-2xl font-bold mb-4">Welcome, {currentProfile.firstName}!</h1>
        <p class="text-gray-600">Email: {currentAuthUser.email}</p>
        <button 
          class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors" 
          on:click={handleLogout}
        >
          Log Out
        </button>
      </div>
    {:else}
      <div class="profile-setup-section">
        <h2 class="text-xl font-semibold mb-4">Complete Your Profile</h2>
        <p class="text-gray-600 mb-4">Please provide your information to continue</p>
        
        <form on:submit|preventDefault={handleProfileSubmit} class="w-full max-w-md">
          <div class="mb-4">
            <label for="firstName" class="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              id="firstName"
              bind:value={firstName}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div class="mb-4">
            <label for="lastName" class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              id="lastName"
              bind:value={lastName}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {#if profileError}
            <p class="text-red-600 mb-4">{profileError}</p>
          {/if}

          <button
            type="submit"
            class="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            disabled={isLoadingProfile}
          >
            {isLoadingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    {/if}
  {:else if currentAuthError}
    <p class="error">Authentication Error: {typeof currentAuthError === 'object' && currentAuthError !== null && 'message' in currentAuthError ? (currentAuthError as {message: string}).message : 'An unknown error occurred'}. Please try logging in again.</p>
    <p><a href="/">Go to Login</a></p>
  {:else}
    <p>You are not authenticated. Redirecting to login...</p>
  {/if}
</div>

<style>
  .dashboard-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 2rem;
    min-height: calc(100vh - 4rem);
  }
  
  .profile-setup-section {
    width: 100%;
    max-width: 32rem;
    padding: 2rem;
    background-color: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  }

  .welcome-section {
    text-align: center;
  }

  .error {
    color: rgb(220, 38, 38);
    margin-top: 1rem;
  }

  :global(input) {
    font-size: 1rem;
  }
</style> 