<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import ScheduleModal from './ScheduleModal.svelte';
  import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import { toastSuccess, toastError, toastInfo, toastWarning } from '$lib/utils/toast';
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
    resetForm
  } from './stores';
  import { createSchedule, updateSchedule, deleteSchedule, loadSchedules } from './utils';
  import { getMonthName, formatPhoneNumber } from './utils';
  import type { Schedule, ScheduleFormData } from './types';

  let currentPage = 1;
  const itemsPerPage = 10;
  let selectedSchedules = new Set<string>();
  let showBulkDeleteConfirm = false;
  let isTableLoading = false;
  let isSaving = false;
  let isDeleting = false;

  // Animation functions
  function addRippleEffect(event: MouseEvent) {
    const button = event.currentTarget as HTMLElement;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');
    
    button.appendChild(ripple);
    
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  function createConfettiEffect() {
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
    const confettiCount = 50;
    
    for (let i = 0; i < confettiCount; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        document.body.appendChild(confetti);
        
        setTimeout(() => {
          if (document.body.contains(confetti)) {
            document.body.removeChild(confetti);
          }
        }, 5000);
      }, i * 50);
    }
  }

  function addSuccessCelebration() {
    const sparkles = ['✨', '🎉', '🎊', '⭐', '🌟'];
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle-effect';
        sparkle.textContent = sparkles[Math.floor(Math.random() * sparkles.length)];
        sparkle.style.left = Math.random() * 100 + 'vw';
        sparkle.style.top = Math.random() * 100 + 'vh';
        sparkle.style.animationDelay = Math.random() * 2 + 's';
        document.body.appendChild(sparkle);
        
        setTimeout(() => {
          if (document.body.contains(sparkle)) {
            document.body.removeChild(sparkle);
          }
        }, 3000);
      }, i * 200);
    }
  }

  // Load data from Supabase on component mount
  onMount(async () => {
    try {
      isLoading.set(true);
      isTableLoading = true;
      await loadSchedules();
    } catch (error) {
      console.error('Failed to load schedules:', error);
      toastError('Failed to load companies', 'Error');
    } finally {
      isLoading.set(false);
      isTableLoading = false;
    }
  });

  // Paginated schedules
  $: paginatedSchedules = $filteredSchedules.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  $: totalPages = Math.ceil($filteredSchedules.length / itemsPerPage);

  function handleCreate() {
    console.log('=== CREATE BUTTON CLICKED ===');
    setCreateMode();
  }

  function handleEdit(schedule: Schedule) {
    setEditMode(schedule);
  }

  async function handleSave(event: CustomEvent<ScheduleFormData>) {
    const scheduleData = event.detail;
    console.log('=== SAVE BUTTON CLICKED ===');
    console.log('Form data:', scheduleData);
    
    isSaving = true;
    isLoading.set(true);
    
    try {
      if ($formMode === 'create') {
        console.log('Creating new schedule...');
        toastInfo('Creating company...', 'Creating');
        const result = await createSchedule(scheduleData);
        console.log('Schedule created successfully:', result);
        toastSuccess('Company created successfully!', 'Created');
      } else if ($formMode === 'edit' && scheduleData.id) {
        console.log('Updating schedule with ID:', scheduleData.id);
        toastInfo('Updating company...', 'Updating');
        const result = await updateSchedule(scheduleData.id, scheduleData);
        console.log('Schedule updated successfully:', result);
        toastSuccess('Company updated successfully!', 'Updated');
      }
      resetForm();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toastError(`Failed to save company: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Error');
    } finally {
      isLoading.set(false);
      isSaving = false;
    }
  }

  async function handleDelete(event: CustomEvent<string>) {
    const id = event.detail;
    if (confirm('Are you sure you want to delete this company? This action cannot be undone.')) {
      isDeleting = true;
      isLoading.set(true);
      try {
        toastInfo('Deleting company...', 'Deleting');
        await deleteSchedule(id);
        toastSuccess('Company deleted successfully!', 'Deleted');
        resetForm();
      } catch (error) {
        console.error('Error deleting schedule:', error);
        toastError(`Failed to delete company: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Error');
      } finally {
        isLoading.set(false);
        isDeleting = false;
      }
    }
  }

  async function handleDeleteDirect(schedule: Schedule) {
    const companyName = schedule.company;
    const locationCount = schedule.information.length;
    const contactCount = schedule.information.reduce((total, info) => total + info.contacts.length, 0);
    const noteCount = schedule.notes.length;
    
    const confirmMessage = `Are you sure you want to delete "${companyName}"?\n\n` +
      `This will permanently remove:\n` +
      `• ${locationCount} location${locationCount !== 1 ? 's' : ''}\n` +
      `• ${contactCount} contact${contactCount !== 1 ? 's' : ''}\n` +
      `• ${noteCount} note${noteCount !== 1 ? 's' : ''}\n` +
      `• All scheduled events for this company\n\n` +
      `This action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
      isDeleting = true;
      isLoading.set(true);
      try {
        toastInfo(`Deleting "${companyName}"...`, 'Deleting');
        await deleteSchedule(schedule.id);
        toastSuccess(`Company "${companyName}" deleted successfully!`, 'Deleted');
      } catch (error) {
        console.error('Error deleting schedule:', error);
        toastError(`Failed to delete company: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Error');
      } finally {
        isLoading.set(false);
        isDeleting = false;
      }
    }
  }

  function handleClose() {
    resetForm();
  }

  function openSheet(schedule: Schedule) {
    goto(`${base}/scheduled-test-and-tag/sheet?id=${schedule.id}`);
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

  function toggleScheduleSelection(scheduleId: string) {
    if (selectedSchedules.has(scheduleId)) {
      selectedSchedules.delete(scheduleId);
    } else {
      selectedSchedules.add(scheduleId);
    }
    selectedSchedules = selectedSchedules; // Trigger reactivity
  }

  function selectAllSchedules() {
    if (selectedSchedules.size === paginatedSchedules.length) {
      selectedSchedules.clear();
    } else {
      selectedSchedules = new Set(paginatedSchedules.map(s => s.id));
    }
    selectedSchedules = selectedSchedules; // Trigger reactivity
  }

  async function handleBulkDelete() {
    if (selectedSchedules.size === 0) return;
    
    const selectedScheduleObjects = paginatedSchedules.filter(s => selectedSchedules.has(s.id));
    const companyNames = selectedScheduleObjects.map(s => s.company).join(', ');
    
    const confirmMessage = `Are you sure you want to delete ${selectedSchedules.size} compan${selectedSchedules.size === 1 ? 'y' : 'ies'}?\n\n` +
      `This will permanently remove:\n` +
      `• ${selectedScheduleObjects.length} compan${selectedScheduleObjects.length === 1 ? 'y' : 'ies'}\n` +
      `• All associated locations, contacts, and notes\n` +
      `• All scheduled events for these companies\n\n` +
      `Companies to delete: ${companyNames}\n\n` +
      `This action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
      isDeleting = true;
      isLoading.set(true);
      try {
        toastInfo(`Deleting ${selectedSchedules.size} companies...`, 'Bulk Delete');
        const deletePromises = selectedScheduleObjects.map(schedule => deleteSchedule(schedule.id));
        await Promise.all(deletePromises);
        toastSuccess(`Successfully deleted ${selectedSchedules.size} compan${selectedSchedules.size === 1 ? 'y' : 'ies'}!`, 'Bulk Delete');
        selectedSchedules.clear();
        selectedSchedules = selectedSchedules; // Trigger reactivity
      } catch (error) {
        console.error('Error bulk deleting schedules:', error);
        toastError(`Failed to delete companies: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Error');
      } finally {
        isLoading.set(false);
        isDeleting = false;
      }
    }
  }
</script>

<style>
  /* Fade in animation */
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in {
    animation: fadeIn 0.6s ease-out forwards;
  }
  /* Ripple effect for buttons */
  .ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: scale(0);
    animation: ripple-animation 0.6s linear;
    pointer-events: none;
  }
  @keyframes ripple-animation {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
  /* Enhanced button styles */
  .btn-primary {
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
  }
  .btn-primary:hover {
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
  /* Interactive hover effects */
  .interactive-hover {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .interactive-hover:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }
  /* Confetti animation */
  .confetti-piece {
    position: fixed;
    top: -10px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    animation: confetti-fall linear infinite;
    z-index: 9999;
    pointer-events: none;
  }
  @keyframes confetti-fall {
    0% {
      transform: translateY(-10px) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(720deg);
      opacity: 0;
    }
  }
  /* Sparkle effect */
  .sparkle-effect {
    position: fixed;
    font-size: 2rem;
    pointer-events: none;
    z-index: 10000;
    animation: sparkle 3s ease-out forwards;
  }
  @keyframes sparkle {
    0% {
      transform: scale(0) rotate(0deg);
      opacity: 0;
    }
    50% {
      transform: scale(1.5) rotate(180deg);
      opacity: 1;
    }
    100% {
      transform: scale(0) rotate(360deg);
      opacity: 0;
    }
  }
  /* Pulse animation */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  /* Enhanced table row animations */
  tr.interactive-hover:hover {
    background-color: #f8fafc;
    transform: scale(1.01);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .compact-table th,
  .compact-table td {
    padding: 0.375rem 0.5rem;
  }
  .compact-table .col-tight {
    width: 1%;
    text-align: center;
    white-space: nowrap;
  }
  .compact-table .col-company {
    min-width: 10rem;
    max-width: 14rem;
  }
  .compact-table .col-company > div {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Success state animations */
  .success-glow {
    animation: successGlow 2s ease-out;
  }
  @keyframes successGlow {
    0% {
      box-shadow: 0 0 5px rgba(34, 197, 94, 0.5);
    }
    50% {
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.8);
    }
    100% {
      box-shadow: 0 0 5px rgba(34, 197, 94, 0.5);
    }
  }
</style>

<div class="space-y-2">
  <!-- Header -->
  <div class="flex flex-wrap justify-between items-center gap-2 animate-fade-in">
    <h2 class="text-lg font-semibold text-gray-900">Companies</h2>
    <div class="flex gap-1.5">
      {#if selectedSchedules.size > 0}
        <button
          on:click={handleBulkDelete}
          disabled={isDeleting}
          class="btn-primary bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-2.5 py-1.5 rounded text-xs font-medium transition-all duration-300 flex items-center gap-1.5 shadow hover:shadow-md"
        >
          {#if isDeleting}
            <div class="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
            Deleting...
          {:else}
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete ({selectedSchedules.size})
          {/if}
        </button>
      {/if}
      <button
        on:click={handleCreate}
        disabled={isSaving}
        class="btn-primary bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-2.5 py-1.5 rounded text-xs font-medium transition-all duration-300 flex items-center gap-1.5 shadow hover:shadow-md"
      >
        {#if isSaving}
          <div class="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
          Saving...
        {:else}
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Company
        {/if}
      </button>
    </div>
  </div>

  <!-- Search and Filters -->
  <div class="bg-white rounded shadow p-2 animate-fade-in" style="animation-delay: 100ms;">
    <div class="flex gap-2">
      <div class="relative flex-1">
        <label for="search" class="sr-only">Search companies</label>
        <input
          id="search"
          type="text"
          placeholder="Search companies..."
          bind:value={$searchTerm}
          on:input={handleSearch}
          class="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
        <div class="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
          <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
      </div>
      <button
        on:click={() => searchTerm.set('')}
        class="px-2 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center gap-1 shrink-0"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        Clear
      </button>
    </div>
  </div>

  <!-- Results Summary -->
  <div class="flex justify-between items-center text-xs text-gray-500 px-0.5">
    <span>
      {($filteredSchedules.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0)}–{Math.min(currentPage * itemsPerPage, $filteredSchedules.length)} of {$filteredSchedules.length}
    </span>
    <span>
      Page {currentPage}/{totalPages || 1}
    </span>
  </div>

  <!-- Data Table -->
  <div class="bg-white rounded shadow overflow-hidden animate-fade-in" style="animation-delay: 200ms;">
    <div class="overflow-x-auto">
      {#if isTableLoading}
        <!-- Skeleton Table -->
        <div class="p-2">
          <div class="space-y-4">
            {#each Array(5) as _, index}
              <div class="flex items-center space-x-4 animate-pulse" style="animation-delay: {index * 100}ms;">
                <SkeletonLoader type="circle" width="1rem" height="1rem" />
                <SkeletonLoader type="text" width="150px" height="1.25rem" />
                <SkeletonLoader type="text" width="100px" height="1.25rem" />
                <SkeletonLoader type="text" width="120px" height="1.25rem" />
                <SkeletonLoader type="circle" width="1.5rem" height="1.5rem" />
                <SkeletonLoader type="text" width="80px" height="1.25rem" />
                <SkeletonLoader type="text" width="80px" height="1.25rem" />
                <SkeletonLoader type="text" width="60px" height="1.25rem" />
                <div class="flex space-x-2">
                  <SkeletonLoader type="button" width="2rem" height="2rem" />
                  <SkeletonLoader type="button" width="2rem" height="2rem" />
                  <SkeletonLoader type="button" width="2rem" height="2rem" />
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <table class="compact-table min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="col-tight text-xs font-medium text-gray-500 uppercase tracking-wide">
              <input
                type="checkbox"
                checked={selectedSchedules.size === paginatedSchedules.length && paginatedSchedules.length > 0}
                on:change={selectAllSchedules}
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th class="col-company text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <button
                on:click={() => handleSort('company')}
                class="flex items-center gap-1 hover:text-gray-700 transition-colors"
              >
                Company {getSortIcon('company')}
              </button>
            </th>
            <th class="col-tight text-xs font-medium text-gray-500 uppercase tracking-wide">
              <button
                on:click={() => handleSort('start_month')}
                class="flex items-center justify-center gap-1 hover:text-gray-700 transition-colors w-full"
              >
                Start {getSortIcon('start_month')}
              </button>
            </th>
            <th class="col-tight text-xs font-medium text-gray-500 uppercase tracking-wide">
              <button
                on:click={() => handleSort('occurence')}
                class="flex items-center justify-center gap-1 hover:text-gray-700 transition-colors w-full"
              >
                Freq {getSortIcon('occurence')}
              </button>
            </th>
            <th class="col-tight text-xs font-medium text-gray-500 uppercase tracking-wide">
              Color
            </th>
            <th class="col-tight text-xs font-medium text-gray-500 uppercase tracking-wide">
              Loc
            </th>
            <th class="col-tight text-xs font-medium text-gray-500 uppercase tracking-wide">
              Cont
            </th>
            <th class="col-tight text-xs font-medium text-gray-500 uppercase tracking-wide">
              Notes
            </th>
            <th class="col-tight text-xs font-medium text-gray-500 uppercase tracking-wide">
              Sheet
            </th>
            <th class="col-tight text-xs font-medium text-gray-500 uppercase tracking-wide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each paginatedSchedules as schedule, index}
            <tr
              class="hover:bg-gray-50 transition-all duration-300 animate-fade-in interactive-hover cursor-pointer"
              style="animation-delay: {index * 50}ms;"
              on:click={() => handleEdit(schedule)}
            >
              <td class="col-tight" on:click|stopPropagation>
                <input
                  type="checkbox"
                  checked={selectedSchedules.has(schedule.id)}
                  on:change={() => toggleScheduleSelection(schedule.id)}
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td class="col-company">
                <div class="font-medium text-gray-900" title={schedule.company}>{schedule.company}</div>
              </td>
              <td class="col-tight text-gray-900">
                {getMonthName(schedule.start_month).slice(0, 3)}
              </td>
              <td class="col-tight text-gray-900">
                {schedule.occurence}
              </td>
              <td class="col-tight">
                <div
                  class="w-4 h-4 rounded-full border border-gray-300 shadow-sm mx-auto"
                  style="background-color: {schedule.color || '#3b82f6'};"
                  title="{schedule.color || '#3b82f6'}"
                ></div>
              </td>
              <td class="col-tight text-gray-900">
                {schedule.information.length}
              </td>
              <td class="col-tight text-gray-900">
                {schedule.information.reduce((total, info) => total + info.contacts.length, 0)}
              </td>
              <td class="col-tight text-gray-900">
                {schedule.notes.length}
              </td>
              <td class="col-tight" on:click|stopPropagation>
                <div class="flex justify-center">
                  <button
                    on:click={() => openSheet(schedule)}
                    class="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-all duration-300"
                    title="Open service sheet"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                </div>
              </td>
              <td class="col-tight" on:click|stopPropagation>
                <div class="flex justify-center">
                  <button
                    on:click={() => handleDeleteDirect(schedule)}
                    class="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-all duration-300"
                    title="Delete"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      {/if}
    </div>

    <!-- Empty State -->
    {#if $filteredSchedules.length === 0 && !isTableLoading}
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

<!-- Toast Container -->
<ToastContainer />

<!-- Loading Overlay -->
{#if $isLoading}
  <div class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 flex items-center gap-3 shadow-lg">
      <div class="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
      <span class="text-gray-700 font-medium">Loading...</span>
    </div>
  </div>
{/if}