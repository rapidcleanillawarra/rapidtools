<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/firebase';
  import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
  import { fade } from 'svelte/transition';

  interface CustomerGroup {
    id: string;
    code: string;
    name: string;
    docId?: string;
  }

  type SortField = 'id' | 'code' | 'name';
  type SortDirection = 'asc' | 'desc';

  let customerGroups: CustomerGroup[] = [];
  let loading = true;
  let error: string | null = null;
  let showModal = false;
  let showUpdateModal = false;
  let selectedGroup: CustomerGroup | null = null;
  let newGroup = {
    id: '',
    code: '',
    name: ''
  };
  let isSubmitting = false;
  let submitError: string | null = null;
  let isImporting = false;
  let importError: string | null = null;
  let importSuccess = false;
  let fileInput: HTMLInputElement;
  let sortField: SortField = 'id';
  let sortDirection: SortDirection = 'asc';

  function triggerFileInput() {
    fileInput?.click();
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Set new field and default to ascending
      sortField = field;
      sortDirection = 'asc';
    }
    sortData();
  }

  function sortData() {
    customerGroups = [...customerGroups].sort((a, b) => {
      if (sortField === 'id') {
        // Convert IDs to numbers for numeric sorting
        const aValue = parseInt(a[sortField]);
        const bValue = parseInt(b[sortField]);
        
        if (sortDirection === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      } else {
        // String sorting for other fields
        const aValue = a[sortField].toLowerCase();
        const bValue = b[sortField].toLowerCase();
        
        if (sortDirection === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      }
    });
  }

  async function loadCustomerGroups() {
    try {
      loading = true;
      error = null;
      const querySnapshot = await getDocs(collection(db, 'maropost_customer_groups'));
      customerGroups = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        docId: doc.id
      } as CustomerGroup));
      sortData(); // Sort the data after loading
    } catch (e) {
      console.error('Error loading customer groups:', e);
      error = 'Failed to load customer groups. Please try again later.';
    } finally {
      loading = false;
    }
  }

  async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (file.type !== 'application/json') {
      importError = 'Please upload a JSON file';
      return;
    }

    try {
      isImporting = true;
      importError = null;
      importSuccess = false;

      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new Error('Invalid JSON format. Expected an array of customer groups.');
      }

      // Validate each item in the array
      for (const item of data) {
        if (!item.id || !item.code || !item.name) {
          throw new Error('Each item must have id, code, and name fields');
        }
      }

      // Import each item
      for (const item of data) {
        await addDoc(collection(db, 'maropost_customer_groups'), {
          id: String(item.id),
          code: item.code,
          name: item.name
        });
      }

      importSuccess = true;
      await loadCustomerGroups();
    } catch (e) {
      console.error('Error importing customer groups:', e);
      importError = e instanceof Error ? e.message : 'Failed to import customer groups';
    } finally {
      isImporting = false;
      // Reset the file input
      input.value = '';
    }
  }

  async function handleSubmit() {
    try {
      isSubmitting = true;
      submitError = null;
      
      // Validate inputs
      if (!newGroup.id.trim() || !newGroup.code.trim() || !newGroup.name.trim()) {
        throw new Error('ID, Code and Name are required');
      }

      // Add to Firestore
      await addDoc(collection(db, 'maropost_customer_groups'), {
        id: newGroup.id.trim(),
        code: newGroup.code.trim(),
        name: newGroup.name.trim()
      });

      // Reset form and close modal
      newGroup = { id: '', code: '', name: '' };
      showModal = false;
      
      // Reload the list
      await loadCustomerGroups();
    } catch (e) {
      console.error('Error creating customer group:', e);
      submitError = e instanceof Error ? e.message : 'Failed to create customer group';
    } finally {
      isSubmitting = false;
    }
  }

  async function handleUpdate() {
    if (!selectedGroup) return;
    
    try {
      isSubmitting = true;
      submitError = null;

      // Validate inputs
      if (!selectedGroup.id.trim() || !selectedGroup.code.trim() || !selectedGroup.name.trim()) {
        throw new Error('ID, Code and Name are required');
      }

      // Find the document reference
      const querySnapshot = await getDocs(collection(db, 'maropost_customer_groups'));
      const docRef = querySnapshot.docs.find(doc => doc.data().id === selectedGroup?.id);
      
      if (!docRef) {
        throw new Error('Record not found');
      }

      // Update the document
      await updateDoc(doc(db, 'maropost_customer_groups', docRef.id), {
        id: selectedGroup.id.trim(),
        code: selectedGroup.code.trim(),
        name: selectedGroup.name.trim()
      });

      // Close modal and reload
      showUpdateModal = false;
      selectedGroup = null;
      await loadCustomerGroups();
    } catch (e) {
      console.error('Error updating customer group:', e);
      submitError = e instanceof Error ? e.message : 'Failed to update customer group';
    } finally {
      isSubmitting = false;
    }
  }

  async function handleDelete(groupId: string) {
    if (!confirm('Are you sure you want to delete this customer group?')) return;

    try {
      // Find the document reference
      const querySnapshot = await getDocs(collection(db, 'maropost_customer_groups'));
      const docRef = querySnapshot.docs.find(doc => doc.data().id === groupId);
      
      if (!docRef) {
        throw new Error('Record not found');
      }

      // Delete the document
      await deleteDoc(doc(db, 'maropost_customer_groups', docRef.id));
      await loadCustomerGroups();
    } catch (e) {
      console.error('Error deleting customer group:', e);
      alert('Failed to delete customer group. Please try again.');
    }
  }

  function openUpdateModal(group: CustomerGroup) {
    selectedGroup = { ...group };
    showUpdateModal = true;
  }

  onMount(() => {
    loadCustomerGroups();
  });

  function exportToCSV() {
    if (!customerGroups || customerGroups.length === 0) return;

    const escapeForCsv = (value: unknown): string => {
      const str = value == null ? '' : String(value);
      const needsQuoting = /[",\n]/.test(str);
      const escaped = str.replace(/"/g, '""');
      return needsQuoting ? `"${escaped}"` : escaped;
    };

    const headers = ['ID', 'Code', 'Name'];
    const lines = [headers.join(',')];

    // customerGroups is already in the current sort order
    for (const group of customerGroups) {
      const row = [group.id, group.code, group.name].map(escapeForCsv).join(',');
      lines.push(row);
    }

    const csvString = lines.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const filename = `customer-groups-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
      <h1 class="text-2xl font-semibold text-gray-800">Customer Groups</h1>
      <div class="flex space-x-3">
        <input
          type="file"
          accept=".json"
          class="hidden"
          bind:this={fileInput}
          on:change={handleFileUpload}
          disabled={isImporting}
        />
        <button
          class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
          on:click={triggerFileInput}
          disabled={isImporting}
        >
          {#if isImporting}
            <span class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-gray-700 border-t-transparent mr-2"></span>
            Importing...
          {:else}
            Import JSON
          {/if}
        </button>
        <button
          class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          on:click={exportToCSV}
        >
          Download CSV
        </button>
        <button
          class="px-4 py-2 bg-yellow-400 text-gray-900 rounded-md hover:bg-yellow-500 transition-colors"
          on:click={() => showModal = true}
        >
          Create New
        </button>
      </div>
    </div>

    {#if importError}
      <div class="px-6 py-3 bg-red-50 border-b border-red-100">
        <p class="text-red-600">{importError}</p>
      </div>
    {/if}

    {#if importSuccess}
      <div class="px-6 py-3 bg-green-50 border-b border-green-100">
        <p class="text-green-600">Successfully imported customer groups</p>
      </div>
    {/if}

    {#if loading}
      <div class="p-6 text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-yellow-400"></div>
        <p class="mt-2 text-gray-600">Loading customer groups...</p>
      </div>
    {:else if error}
      <div class="p-6 text-center">
        <p class="text-red-600">{error}</p>
        <button 
          class="mt-4 px-4 py-2 bg-yellow-400 text-gray-900 rounded-md hover:bg-yellow-500 transition-colors"
          on:click={loadCustomerGroups}
        >
          Try Again
        </button>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th 
                scope="col" 
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                on:click={() => handleSort('id')}
              >
                <div class="flex items-center space-x-1">
                  <span>ID</span>
                  {#if sortField === 'id'}
                    <span class="text-yellow-400">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  {/if}
                </div>
              </th>
              <th 
                scope="col" 
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                on:click={() => handleSort('code')}
              >
                <div class="flex items-center space-x-1">
                  <span>Code</span>
                  {#if sortField === 'code'}
                    <span class="text-yellow-400">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  {/if}
                </div>
              </th>
              <th 
                scope="col" 
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                on:click={() => handleSort('name')}
              >
                <div class="flex items-center space-x-1">
                  <span>Name</span>
                  {#if sortField === 'name'}
                    <span class="text-yellow-400">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  {/if}
                </div>
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each customerGroups as group (group.docId)}
              <tr 
                class="hover:bg-gray-50 transition-colors"
                transition:fade
              >
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {group.id}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {group.code}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {group.name}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div class="flex space-x-2">
                    <button
                      class="text-blue-600 hover:text-blue-800"
                      on:click={() => openUpdateModal(group)}
                    >
                      Edit
                    </button>
                    <button
                      class="text-red-600 hover:text-red-800"
                      on:click={() => handleDelete(group.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full" transition:fade>
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-800">Create New Customer Group</h2>
      </div>
      
      <form on:submit|preventDefault={handleSubmit} class="p-6">
        <div class="space-y-4">
          <div>
            <label for="id" class="block text-sm font-medium text-gray-700">ID</label>
            <input
              type="text"
              id="id"
              bind:value={newGroup.id}
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-400 focus:ring-yellow-400"
              required
            />
          </div>

          <div>
            <label for="code" class="block text-sm font-medium text-gray-700">Code</label>
            <input
              type="text"
              id="code"
              bind:value={newGroup.code}
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-400 focus:ring-yellow-400"
              required
            />
          </div>
          
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              id="name"
              bind:value={newGroup.name}
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-400 focus:ring-yellow-400"
              required
            />
          </div>

          {#if submitError}
            <p class="text-red-600 text-sm">{submitError}</p>
          {/if}
        </div>

        <div class="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            on:click={() => {
              showModal = false;
              newGroup = { id: '', code: '', name: '' };
              submitError = null;
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-yellow-400 text-gray-900 rounded-md hover:bg-yellow-500 transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            {#if isSubmitting}
              <span class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-gray-900 border-t-transparent mr-2"></span>
              Creating...
            {:else}
              Create
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if showUpdateModal && selectedGroup}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full" transition:fade>
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-800">Update Customer Group</h2>
      </div>
      
      <form on:submit|preventDefault={handleUpdate} class="p-6">
        <div class="space-y-4">
          <div>
            <label for="update-id" class="block text-sm font-medium text-gray-700">ID</label>
            <input
              type="text"
              id="update-id"
              bind:value={selectedGroup.id}
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-400 focus:ring-yellow-400"
              required
            />
          </div>

          <div>
            <label for="update-code" class="block text-sm font-medium text-gray-700">Code</label>
            <input
              type="text"
              id="update-code"
              bind:value={selectedGroup.code}
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-400 focus:ring-yellow-400"
              required
            />
          </div>
          
          <div>
            <label for="update-name" class="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              id="update-name"
              bind:value={selectedGroup.name}
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-400 focus:ring-yellow-400"
              required
            />
          </div>

          {#if submitError}
            <p class="text-red-600 text-sm">{submitError}</p>
          {/if}
        </div>

        <div class="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            on:click={() => {
              showUpdateModal = false;
              selectedGroup = null;
              submitError = null;
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-yellow-400 text-gray-900 rounded-md hover:bg-yellow-500 transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            {#if isSubmitting}
              <span class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-gray-900 border-t-transparent mr-2"></span>
              Updating...
            {:else}
              Update
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if} 