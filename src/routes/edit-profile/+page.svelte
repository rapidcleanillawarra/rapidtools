<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { currentUser, isLoadingAuth } from '$lib/firebase';
  import { userProfile, type UserProfile, fetchUserProfile, updateUserProfile } from '$lib/userProfile';
  import type { User } from 'firebase/auth';

  let currentAuthUser: User | null = null;
  let currentIsLoadingAuth: boolean = true;
  let currentProfile: UserProfile | null = null;
  let isLoadingProfile = false;
  let profileError: string | null = null;
  let updateSuccess = false;

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

  async function handleProfileUpdate() {
    if (!currentAuthUser || !currentProfile) return;
    
    if (!firstName.trim() || !lastName.trim()) {
      profileError = 'Please fill in both first and last name';
      return;
    }

    isLoadingProfile = true;
    profileError = null;
    updateSuccess = false;
    
    try {
      await updateUserProfile(currentAuthUser.uid, {
        ...currentProfile,
        firstName: firstName.trim(),
        lastName: lastName.trim()
      });
      updateSuccess = true;
      profileError = null;
    } catch (error) {
      console.error('Error updating profile:', error);
      profileError = 'Failed to update profile';
      updateSuccess = false;
    } finally {
      isLoadingProfile = false;
    }
  }

  onMount(() => {
    if (browser && !currentIsLoadingAuth && !currentAuthUser) {
      goto('/', { replaceState: true });
    }
    return () => {
      unsubCurrentUser();
      unsubIsLoadingAuth();
      unsubUserProfile();
    };
  });
</script>

<svelte:head>
  <title>Edit Profile - RapidTools</title>
</svelte:head>

<div class="edit-profile-container">
  {#if currentIsLoadingAuth || isLoadingProfile}
    <p>Loading...</p>
  {:else if currentAuthUser && currentProfile}
    <div class="edit-profile-section">
      <h2 class="text-xl font-semibold mb-4">Edit Your Profile</h2>
      
      <form on:submit|preventDefault={handleProfileUpdate} class="w-full max-w-md">
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

        {#if updateSuccess}
          <p class="text-green-600 mb-4">Profile updated successfully!</p>
        {/if}

        <div class="flex gap-4">
          <button
            type="submit"
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            disabled={isLoadingProfile}
          >
            {isLoadingProfile ? 'Updating...' : 'Update Profile'}
          </button>
          
          <button
            type="button"
            class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            on:click={() => goto('/dashboard')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  {:else}
    <p>You are not authenticated. Redirecting to login...</p>
  {/if}
</div>

<style>
  .edit-profile-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 2rem;
    min-height: calc(100vh - 4rem);
  }
  
  .edit-profile-section {
    width: 100%;
    max-width: 32rem;
    padding: 2rem;
    background-color: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  }

  :global(input) {
    font-size: 1rem;
  }
</style> 