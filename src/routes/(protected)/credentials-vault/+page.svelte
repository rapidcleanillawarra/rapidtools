<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Modal from '$lib/components/Modal.svelte';
  import DeleteConfirmationModal from '$lib/components/DeleteConfirmationModal.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import { toastSuccess, toastError } from '$lib/utils/toast';
  import { fetchCredentials, createCredential, updateCredential, deleteCredential } from './services';
  import type { Credential, CredentialFormData } from './types';
  import { emptyCredentialForm } from './types';

  // State
  let credentials: Credential[] = [];
  let loading = true;
  let error = '';

  // Modal state
  let showAddModal = false;
  let showEditModal = false;
  let showDeleteModal = false;
  let isSubmitting = false;
  let isDeleting = false;

  // Form state
  let formData: CredentialFormData = { ...emptyCredentialForm };
  let editingId: string | null = null;
  let deletingCredential: Credential | null = null;

  // Password visibility
  let showPassword = false;

  // Search
  let searchQuery = '';

  // Load credentials on mount
  onMount(async () => {
    await loadCredentials();
  });

  async function loadCredentials() {
    loading = true;
    error = '';
    try {
      credentials = await fetchCredentials();
    } catch (err) {
      error = 'Failed to load credentials. Please try again.';
      console.error(err);
    } finally {
      loading = false;
    }
  }

  // Filtered credentials based on search
  $: filteredCredentials = credentials.filter(cred => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      cred.website?.toLowerCase().includes(query) ||
      cred.username?.toLowerCase().includes(query) ||
      cred.email?.toLowerCase().includes(query) ||
      cred.description?.toLowerCase().includes(query)
    );
  });

  // Add Modal
  function openAddModal() {
    formData = { ...emptyCredentialForm };
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
    formData = { ...emptyCredentialForm };
    showPassword = false;
  }

  async function handleAdd() {
    if (!formData.website.trim()) {
      toastError('Website is required');
      return;
    }

    isSubmitting = true;
    try {
      await createCredential(formData);
      await loadCredentials();
      closeAddModal();
      toastSuccess('Credential added successfully');
    } catch (err) {
      toastError('Failed to add credential');
      console.error(err);
    } finally {
      isSubmitting = false;
    }
  }

  // Edit Modal
  function openEditModal(credential: Credential) {
    editingId = credential.id;
    formData = {
      website: credential.website || '',
      username: credential.username || '',
      email: credential.email || '',
      password: credential.password || '',
      mfa_phone: credential.mfa_phone || '',
      description: credential.description || ''
    };
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    editingId = null;
    formData = { ...emptyCredentialForm };
    showPassword = false;
  }

  async function handleEdit() {
    if (!editingId) return;
    if (!formData.website.trim()) {
      toastError('Website is required');
      return;
    }

    isSubmitting = true;
    try {
      await updateCredential(editingId, formData);
      await loadCredentials();
      closeEditModal();
      toastSuccess('Credential updated successfully');
    } catch (err) {
      toastError('Failed to update credential');
      console.error(err);
    } finally {
      isSubmitting = false;
    }
  }

  // Delete Modal
  function openDeleteModal(credential: Credential) {
    deletingCredential = credential;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    deletingCredential = null;
  }

  async function handleDelete() {
    if (!deletingCredential) return;

    isDeleting = true;
    try {
      await deleteCredential(deletingCredential.id);
      await loadCredentials();
      closeDeleteModal();
      toastSuccess('Credential deleted successfully');
    } catch (err) {
      toastError('Failed to delete credential');
      console.error(err);
    } finally {
      isDeleting = false;
    }
  }


  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }
</script>

<ToastContainer />

<div class="container mx-auto px-4 py-8">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
    <h1 class="text-2xl font-bold text-gray-900">Credentials Vault</h1>
    <button
      on:click={openAddModal}
      class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      Add Credential
    </button>
  </div>

  <!-- Search Bar -->
  <div class="mb-6">
    <div class="relative">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search credentials..."
        class="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <svg class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  </div>

  <!-- Error Message -->
  {#if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6" transition:fade>
      <div class="flex items-center">
        <svg class="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-red-800">{error}</p>
      </div>
    </div>
  {/if}

  <!-- Loading State -->
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
    </div>
  {:else if filteredCredentials.length === 0}
    <div class="text-center py-12 bg-white rounded-lg shadow">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
      <h3 class="mt-4 text-lg font-medium text-gray-900">No credentials found</h3>
      <p class="mt-2 text-gray-500">
        {#if searchQuery}
          No credentials match your search query.
        {:else}
          Get started by adding your first credential.
        {/if}
      </p>
    </div>
  {:else}
    <!-- Credentials Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Access</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Website</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username/Email</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Password</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MFA Phone</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredCredentials as credential (credential.id)}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <button
                    class="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                    title="Request access to this credential"
                  >
                    Request Access
                  </button>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{credential.website}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{credential.username || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-500 font-mono">
                    {credential.password ? '••••••••' : '-'}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{credential.email || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{credential.mfa_phone || '-'}</div>
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm text-gray-900 max-w-xs truncate" title={credential.description || ''}>
                    {credential.description || '-'}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div class="flex justify-end gap-2">
                    <button
                      on:click={() => openEditModal(credential)}
                      class="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                      title="Edit"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      on:click={() => openDeleteModal(credential)}
                      class="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<!-- Add Credential Modal -->
<Modal show={showAddModal} on:close={closeAddModal} size="lg">
  <span slot="header">Add Credential</span>
  <div slot="body">
    <form on:submit|preventDefault={handleAdd} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="website" class="block text-sm font-medium text-gray-700 mb-1">
            Website <span class="text-red-500">*</span>
          </label>
          <input
            id="website"
            type="text"
            bind:value={formData.website}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., accounts.google.com"
            required
          />
        </div>
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700 mb-1">Username/Email</label>
          <input
            id="username"
            type="text"
            bind:value={formData.username}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Login username or email"
          />
        </div>
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            id="email"
            type="email"
            bind:value={formData.email}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Associated email address"
          />
        </div>
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div class="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              bind:value={formData.password}
              class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Account password"
            />
            <button
              type="button"
              on:click={togglePasswordVisibility}
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {#if showPassword}
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                </svg>
              {:else}
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              {/if}
            </button>
          </div>
        </div>
        <div>
          <label for="mfa_phone" class="block text-sm font-medium text-gray-700 mb-1">MFA Phone Number</label>
          <input
            id="mfa_phone"
            type="tel"
            bind:value={formData.mfa_phone}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., +61 400 000 000"
          />
        </div>
      </div>
      <div>
        <label for="description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          id="description"
          bind:value={formData.description}
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
          placeholder="Additional notes about this account..."
        ></textarea>
      </div>
    </form>
  </div>
  <div slot="footer" class="flex justify-end gap-3">
    <button
      on:click={closeAddModal}
      class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
    >
      Cancel
    </button>
    <button
      on:click={handleAdd}
      disabled={isSubmitting}
      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {#if isSubmitting}
        <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Adding...
      {:else}
        Add Credential
      {/if}
    </button>
  </div>
</Modal>

<!-- Edit Credential Modal -->
<Modal show={showEditModal} on:close={closeEditModal} size="lg">
  <span slot="header">Edit Credential</span>
  <div slot="body">
    <form on:submit|preventDefault={handleEdit} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="edit-website" class="block text-sm font-medium text-gray-700 mb-1">
            Website <span class="text-red-500">*</span>
          </label>
          <input
            id="edit-website"
            type="text"
            bind:value={formData.website}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., accounts.google.com"
            required
          />
        </div>
        <div>
          <label for="edit-username" class="block text-sm font-medium text-gray-700 mb-1">Username/Email</label>
          <input
            id="edit-username"
            type="text"
            bind:value={formData.username}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Login username or email"
          />
        </div>
        <div>
          <label for="edit-email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            id="edit-email"
            type="email"
            bind:value={formData.email}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Associated email address"
          />
        </div>
        <div>
          <label for="edit-password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div class="relative">
            <input
              id="edit-password"
              type={showPassword ? "text" : "password"}
              bind:value={formData.password}
              class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Account password"
            />
            <button
              type="button"
              on:click={togglePasswordVisibility}
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {#if showPassword}
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                </svg>
              {:else}
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              {/if}
            </button>
          </div>
        </div>
        <div>
          <label for="edit-mfa_phone" class="block text-sm font-medium text-gray-700 mb-1">MFA Phone Number</label>
          <input
            id="edit-mfa_phone"
            type="tel"
            bind:value={formData.mfa_phone}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., +61 400 000 000"
          />
        </div>
      </div>
      <div>
        <label for="edit-description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          id="edit-description"
          bind:value={formData.description}
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
          placeholder="Additional notes about this account..."
        ></textarea>
      </div>
    </form>
  </div>
  <div slot="footer" class="flex justify-end gap-3">
    <button
      on:click={closeEditModal}
      class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
    >
      Cancel
    </button>
    <button
      on:click={handleEdit}
      disabled={isSubmitting}
      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {#if isSubmitting}
        <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Saving...
      {:else}
        Save Changes
      {/if}
    </button>
  </div>
</Modal>

<!-- Delete Confirmation Modal -->
<DeleteConfirmationModal
  show={showDeleteModal}
  title="Delete Credential"
  message="Are you sure you want to delete the credential for"
  itemName={deletingCredential?.website || ''}
  isDeleting={isDeleting}
  on:confirm={handleDelete}
  on:cancel={closeDeleteModal}
/>

