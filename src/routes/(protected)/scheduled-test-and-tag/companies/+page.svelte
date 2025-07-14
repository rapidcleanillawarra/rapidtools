<script lang="ts">
  import { onMount } from 'svelte';
  import ScheduleModal from './ScheduleModal.svelte';
  import {
    filteredSchedules,
    currentSchedule,
    formMode,
    isModalOpen,
    isLoading,
    searchTerm,
    sortBy,
    sortDirection,
    setCreateMode,
    setEditMode,
    setViewMode,
    resetForm
  } from './stores';
  import { createSchedule, updateSchedule, deleteSchedule, loadSchedulesFromFirestore } from './utils';
  import { getMonthName, formatPhoneNumber } from './utils';
  import type { Schedule, ScheduleFormData } from './types';

  let currentPage = 1;
  const itemsPerPage = 10;

  // Load data from Firestore on component mount
  onMount(async () => {
    try {
      isLoading.set(true);
      await loadSchedulesFromFirestore();
    } catch (error) {
      console.error('Failed to load schedules:', error);
      // You might want to show a toast notification here
    } finally {
      isLoading.set(false);
    }
  });

  // Paginated schedules
  $: paginatedSchedules = $filteredSchedules.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  $: totalPages = Math.ceil($filteredSchedules.length / itemsPerPage);

  function handleCreate() {
    setCreateMode();
  }

  function handleEdit(schedule: Schedule) {
    setEditMode(schedule);
  }

  function handleView(schedule: Schedule) {
    setViewMode(schedule);
  }

  async function handleSave(event: CustomEvent<ScheduleFormData>) {
    const scheduleData = event.detail;
    isLoading.set(true);
    
    try {
      if ($formMode === 'create') {
        await createSchedule(scheduleData);
        alert('Company created successfully!');
      } else if ($formMode === 'edit' && scheduleData.id) {
        await updateSchedule(scheduleData.id, scheduleData);
        alert('Company updated successfully!');
      }
      resetForm();
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to save company'}`);
    } finally {
      isLoading.set(false);
    }
  }

  async function handleDelete(event: CustomEvent<number>) {
    const id = event.detail;
    if (confirm('Are you sure you want to delete this company? This action cannot be undone.')) {
      isLoading.set(true);
      try {
        await deleteSchedule(id);
        alert('Company deleted successfully!');
        resetForm();
      } catch (error) {
        console.error('Error deleting schedule:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete company'}`);
      } finally {
        isLoading.set(false);
      }
    }
  }

  function handleClose() {
    resetForm();
  }

  function handleSort(column: 'company' | 'start_month' | 'occurence') {
    if ($sortBy === column) {
      sortDirection.set($sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      sortBy.set(column);
      sortDirection.set('asc');
    }
    currentPage = 1; // Reset to first page when sorting
  }

  function handleSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    searchTerm.set(target.value);
    currentPage = 1; // Reset to first page when searching
  }

  function goToPage(page: number) {
    currentPage = page;
  }

  function getSortIcon(column: 'company' | 'start_month' | 'occurence') {
    if ($sortBy !== column) return '↕️';
    return $sortDirection === 'asc' ? '↑' : '↓';
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex justify-between items-center">
    <div>
      <h2 class="text-2xl font-bold text-gray-900">Companies</h2>
      <p class="text-gray-600 mt-1">Manage test and tag service schedules</p>
    </div>
    <button
      on:click={handleCreate}
      class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      Add New Company
    </button>
  </div>

  <!-- Search and Filters -->
  <div class="bg-white rounded-lg shadow p-4">
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="flex-1">
        <label for="search" class="block text-sm font-medium text-gray-700 mb-1">
          Search Companies
        </label>
        <input
          id="search"
          type="text"
          placeholder="Search by company name, location, or contact..."
          bind:value={$searchTerm}
          on:input={handleSearch}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div class="flex items-end">
        <button
          on:click={() => searchTerm.set('')}
          class="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  </div>

  <!-- Results Summary -->
  <div class="flex justify-between items-center text-sm text-gray-600">
    <span>
      Showing {($filteredSchedules.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0)} to {Math.min(currentPage * itemsPerPage, $filteredSchedules.length)} of {$filteredSchedules.length} companies
    </span>
    <span>
      Page {currentPage} of {totalPages}
    </span>
  </div>

  <!-- Data Table -->
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <button
                on:click={() => handleSort('company')}
                class="flex items-center gap-1 hover:text-gray-700 transition-colors"
              >
                Company {getSortIcon('company')}
              </button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <button
                on:click={() => handleSort('start_month')}
                class="flex items-center gap-1 hover:text-gray-700 transition-colors"
              >
                Start Month {getSortIcon('start_month')}
              </button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <button
                on:click={() => handleSort('occurence')}
                class="flex items-center gap-1 hover:text-gray-700 transition-colors"
              >
                Frequency {getSortIcon('occurence')}
              </button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Locations
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Contacts
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Notes
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each paginatedSchedules as schedule}
            <tr class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">{schedule.company}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{getMonthName(schedule.start_month)}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  Every {schedule.occurence} month{schedule.occurence !== 1 ? 's' : ''}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{schedule.information.length}</div>
                <div class="text-xs text-gray-500">
                  {schedule.information.map(info => info.sub_company_name).join(', ')}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">
                  {schedule.information.reduce((total, info) => total + info.contacts.length, 0)} total
                </div>
                <div class="text-xs text-gray-500">
                  {schedule.information.flatMap(info => info.contacts).slice(0, 2).map(contact => contact.name).join(', ')}
                  {schedule.information.flatMap(info => info.contacts).length > 2 ? '...' : ''}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{schedule.notes.length}</div>
                {#if schedule.notes.length > 0}
                  <div class="text-xs text-gray-500">{schedule.notes[0].title}</div>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex justify-end gap-2">
                  <button
                    on:click={() => handleView(schedule)}
                    class="text-blue-600 hover:text-blue-900 transition-colors"
                    title="View Details"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    on:click={() => handleEdit(schedule)}
                    class="text-green-600 hover:text-green-900 transition-colors"
                    title="Edit"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    {#if $filteredSchedules.length === 0}
      <div class="text-center py-12">
        <div class="text-gray-400 text-6xl mb-4">🏢</div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">
          {#if $searchTerm}
            No companies found
          {:else}
            No companies yet
          {/if}
        </h3>
        <p class="text-gray-600 mb-4">
          {#if $searchTerm}
            Try adjusting your search terms or clear the search to see all companies.
          {:else}
            Get started by adding your first company schedule.
          {/if}
        </p>
        {#if !$searchTerm}
          <button
            on:click={handleCreate}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Add Your First Company
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="flex justify-center">
      <nav class="flex items-center gap-1">
        <button
          on:click={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          class="px-3 py-2 text-sm text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        
        {#each Array.from({length: totalPages}, (_, i) => i + 1) as page}
          <button
            on:click={() => goToPage(page)}
            class="px-3 py-2 text-sm border rounded-md transition-colors"
            class:bg-blue-600={currentPage === page}
            class:text-white={currentPage === page}
            class:border-blue-600={currentPage === page}
            class:text-gray-500={currentPage !== page}
            class:bg-white={currentPage !== page}
            class:border-gray-300={currentPage !== page}
            class:hover:bg-gray-50={currentPage !== page}
          >
            {page}
          </button>
        {/each}
        
        <button
          on:click={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          class="px-3 py-2 text-sm text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </nav>
    </div>
  {/if}
</div>

<!-- Modal -->
<ScheduleModal
  schedule={$currentSchedule}
  mode={$formMode}
  isOpen={$isModalOpen}
  on:save={handleSave}
  on:delete={handleDelete}
  on:close={handleClose}
/>

<!-- Loading Overlay -->
{#if $isLoading}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 flex items-center gap-3">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span class="text-gray-700">Loading...</span>
    </div>
  </div>
{/if}