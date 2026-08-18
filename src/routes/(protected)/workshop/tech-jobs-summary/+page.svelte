<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteDate } from 'svelte/reactivity';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import {
    assignWorkshopTech,
    getTechJobsSummary,
    getWorkshop,
    notifyAssignTechToTeams,
    WORKSHOP_TECH_JOB_TYPES,
    type TechJobsSummaryRow
  } from '$lib/services/workshop';
  import { toastError, toastSuccess } from '$lib/utils/toast';
  import { currentUser } from '$lib/firebase';
  import { userProfile } from '$lib/userProfile';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import AssignTechModal from '../workshop-board/components/AssignTechModal.svelte';
  import CancelJobModal from './components/CancelJobModal.svelte';
  import {
    originalData,
    isLoading,
    tableError,
    currentPage,
    itemsPerPage,
    sortField,
    sortDirection,
    searchQuery,
    selectedTech,
    selectedJobType,
    assignmentStatus,
    dateFrom,
    dateTo,
    dateError,
    paginatedData,
    totalPages,
    tableData,
    summaryStats,
    techOptions,
    validateFilters,
    resetFilters,
    viewMode,
    setViewMode,
    simpleJobs,
    simpleJobsByTech
  } from './stores';
  import {
    getSortIcon,
    formatStatusLabel,
    formatSydneyDate,
    assignmentStatusClass,
    jobTypeClass,
    formatSimpleSchedule,
    formatSydneyTodayLabel,
    formatSydneyNowTime,
    isOverdueJob,
    isJobCompleted
  } from './utils';
  import { ASSIGNMENT_STATUS_OPTIONS } from './types';
  import type { SortField } from './types';

  const now = new SvelteDate();
  const sydneyDateLabel = $derived(formatSydneyTodayLabel(now.getTime()));
  const sydneyTimeLabel = $derived(formatSydneyNowTime(now.getTime()));
  const nowMillis = $derived(now.getTime());
  const overdueCount = $derived($simpleJobs.filter((row) => isOverdueJob(row, nowMillis)).length);
  const remainingCount = $derived($simpleJobs.filter((row) => !isJobCompleted(row)).length);
  const completedCount = $derived($simpleJobs.filter((row) => isJobCompleted(row)).length);

  let showAssignTechModal = $state(false);
  let assignTechSubmitting = $state(false);
  let rowForAssignTech = $state.raw<TechJobsSummaryRow | null>(null);
  let showCancelJobModal = $state(false);
  let cancelJobSubmitting = $state(false);
  let rowForCancelJob = $state.raw<TechJobsSummaryRow | null>(null);

  function handleSortClick(field: SortField) {
    if ($sortField === field) {
      sortDirection.set($sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      sortField.set(field);
      sortDirection.set('asc');
    }
  }

  function handleWorkshopClick(workshopId: string) {
    void goto(`${base}/workshop/form?workshop_id=${workshopId}`);
  }

  function handleItemsPerPageChange() {
    currentPage.set(1);
  }

  function handleOrderClick(event: MouseEvent) {
    event.stopPropagation();
  }

  function handleRowKeydown(event: KeyboardEvent, workshopId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleWorkshopClick(workshopId);
    }
  }

  function openAssignTechModal(row: TechJobsSummaryRow, event: MouseEvent) {
    event.stopPropagation();
    rowForAssignTech = row;
    showAssignTechModal = true;
  }

  function closeAssignTechModal() {
    showAssignTechModal = false;
    rowForAssignTech = null;
  }

  function openCancelJobModal(row: TechJobsSummaryRow, event: MouseEvent) {
    event.stopPropagation();
    rowForCancelJob = row;
    showCancelJobModal = true;
  }

  function closeCancelJobModal() {
    showCancelJobModal = false;
    rowForCancelJob = null;
  }

  async function loadTechJobs(silent = false) {
    if (!silent) isLoading.set(true);
    tableError.set(null);
    try {
      const data = await getTechJobsSummary();
      originalData.set(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tech jobs';
      tableError.set(message);
      toastError(message);
    } finally {
      if (!silent) isLoading.set(false);
    }
  }

  async function handleAssignTechConfirm(
    event: CustomEvent<{
      assignedTo: string;
      assignedToName: string;
      schedule: string;
      jobType: string;
      changeReason: string;
      save: boolean;
      sendNotice: boolean;
    }>
  ) {
    const row = rowForAssignTech;
    if (!row) return;

    const { assignedTo, assignedToName, schedule, jobType, changeReason, save, sendNotice } =
      event.detail;
    const user = $currentUser;
    const profile = $userProfile;
    const assignedByName = user
      ? profile
        ? `${profile.firstName} ${profile.lastName}`.trim()
        : user.displayName || user.email?.split('@')[0] || 'Unknown User'
      : 'Unknown User';
    const assignedBy = user?.email ?? null;

    try {
      assignTechSubmitting = true;

      if (save) {
        await assignWorkshopTech(row.workshop_id, assignedTo || null, assignedToName || null, {
          schedule: schedule || null,
          jobType: jobType || null,
          workshopStatus: row.current_workshop_status,
          assignedBy,
          assignedByName: assignedByName || null,
          changeReason: changeReason || null
        });
      }

      let teamsOk = true;
      if (sendNotice) {
        const workshop = await getWorkshop(row.workshop_id);
        teamsOk = workshop
          ? await notifyAssignTechToTeams(workshop, {
              assignedToName: assignedToName || null,
              schedule,
              jobType: jobType || null,
              assignedByName: assignedByName || null,
              changeReason: changeReason || null
            })
          : false;
        if (!teamsOk) {
          toastError(
            save
              ? 'Teams notification failed. Technician was assigned.'
              : 'Teams notification failed. Please try again.'
          );
          if (save) {
            await loadTechJobs(true);
            closeAssignTechModal();
          }
          return;
        }
      }

      if (save) await loadTechJobs(true);
      closeAssignTechModal();
      if (save && sendNotice) {
        toastSuccess(
          assignedTo
            ? 'Technician assigned and Teams notice sent.'
            : 'Technician assignment removed and Teams notice sent.'
        );
      } else if (save) {
        toastSuccess(
          assignedTo ? 'Technician assigned successfully.' : 'Technician assignment removed.'
        );
      } else if (sendNotice) {
        toastSuccess('Teams notice sent.');
      }
    } catch (err) {
      console.error('[TECH_JOBS] Failed to assign tech:', err);
      toastError(
        sendNotice && !save
          ? 'Failed to send Teams notice. Please try again.'
          : 'Failed to assign technician. Please try again.'
      );
    } finally {
      assignTechSubmitting = false;
    }
  }

  async function handleCancelJobConfirm(changeReason: string) {
    const row = rowForCancelJob;
    const reason = changeReason.trim();
    if (!row || !reason) return;

    const user = $currentUser;
    const profile = $userProfile;
    const assignedByName = user
      ? profile
        ? `${profile.firstName} ${profile.lastName}`.trim()
        : user.displayName || user.email?.split('@')[0] || 'Unknown User'
      : 'Unknown User';
    const assignedBy = user?.email ?? null;

    try {
      cancelJobSubmitting = true;
      await assignWorkshopTech(row.workshop_id, null, null, {
        workshopStatus: row.current_workshop_status,
        assignedBy,
        assignedByName: assignedByName || null,
        changeReason: reason
      });

      const workshop = await getWorkshop(row.workshop_id);
      const teamsOk = workshop
        ? await notifyAssignTechToTeams(workshop, {
            assignedToName: null,
            schedule: row.schedule,
            jobType: row.job_type,
            assignedByName: assignedByName || null,
            changeReason: reason
          })
        : false;

      await loadTechJobs(true);
      closeCancelJobModal();
      if (!teamsOk) {
        toastError('Teams notification failed. Job was cancelled and unassigned.');
      } else {
        toastSuccess('Job cancelled and technician unassigned.');
      }
    } catch (err) {
      console.error('[TECH_JOBS] Failed to cancel job:', err);
      toastError('Failed to cancel job. Please try again.');
    } finally {
      cancelJobSubmitting = false;
    }
  }

  $effect(() => {
    if ($viewMode !== 'simple') return;
    const interval = setInterval(() => {
      now.setTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  });

  onMount(() => {
    void loadTechJobs();
  });
</script>

<ToastContainer />

{#snippet assignScheduleButton(row: TechJobsSummaryRow)}
  {#if row.assignment_status === 'active' && !isJobCompleted(row)}
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
      title="Reschedule technician"
      aria-label="Reschedule technician"
      onclick={(event) => openAssignTechModal(row, event)}
    >
      <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        ></path>
      </svg>
      Reschedule
    </button>
  {:else}
    <span class="text-sm text-gray-400">—</span>
  {/if}
{/snippet}

{#snippet cancelJobButton(row: TechJobsSummaryRow)}
  {#if row.assignment_status === 'active' && !isJobCompleted(row)}
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
      title="Cancel job or unassign technician"
      aria-label="Cancel job or unassign technician"
      onclick={(event) => openCancelJobModal(row, event)}
    >
      <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        ></path>
      </svg>
      Cancel
    </button>
  {:else}
    <span class="text-sm text-gray-400">—</span>
  {/if}
{/snippet}

<svelte:head>
  <title>Tech Jobs Summary - RapidTools</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-8">
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 mb-2">Tech Jobs Summary</h1>
          <p class="text-gray-600">
            {$viewMode === 'simple'
              ? 'Jobs due today, including completed'
              : 'Assigned technician jobs from the workshop schedule'}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div class="inline-flex rounded-lg bg-gray-100 p-0.5" role="tablist" aria-label="View mode">
            <button
              type="button"
              role="tab"
              aria-selected={$viewMode === 'simple'}
              onclick={() => setViewMode('simple')}
              class="px-3 py-1.5 text-sm font-medium rounded-md {$viewMode === 'simple'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'}"
            >
              Simple
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={$viewMode === 'advanced'}
              onclick={() => setViewMode('advanced')}
              class="px-3 py-1.5 text-sm font-medium rounded-md {$viewMode === 'advanced'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'}"
            >
              Advanced
            </button>
          </div>
          <a
            href="{base}/workshop/workshop-board"
            class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              ></path>
            </svg>
            Workshop Board
          </a>
        </div>
      </div>
    </div>

    {#if $tableError}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div class="flex">
          <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
          <span class="text-red-800">{$tableError}</span>
        </div>
      </div>
    {/if}

    {#if $viewMode === 'simple'}
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <span class="text-sm text-gray-600">{sydneyDateLabel}</span>
        <span class="text-lg font-semibold tabular-nums text-gray-900">{sydneyTimeLabel}</span>
        <span class="text-xs text-gray-400">Sydney</span>
        <span class="text-sm font-medium text-gray-900">{remainingCount} remaining</span>
        {#if completedCount > 0}
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {completedCount} completed
          </span>
        {/if}
        {#if overdueCount > 0}
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            {overdueCount} overdue
          </span>
        {/if}
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <label for="search-simple-jobs" class="block text-sm font-medium text-gray-700 mb-1">Search</label>
        <input
          id="search-simple-jobs"
          type="text"
          bind:value={$searchQuery}
          placeholder="Search customer, product, order, tech..."
          class="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
        />
      </div>

      {#if $isLoading}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            <span class="ml-2 text-gray-600">Loading tech jobs...</span>
          </div>
        </div>
      {:else if $simpleJobs.length === 0}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <div class="text-center py-12">
            <h3 class="text-sm font-medium text-gray-900">No jobs for today</h3>
            <p class="mt-1 text-sm text-gray-500">There are no remaining or completed technician jobs due today.</p>
          </div>
        </div>
      {:else}
        {#each $simpleJobsByTech as group (`${group.email ?? ''}:${group.name}`)}
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 class="text-sm font-semibold text-gray-900">{group.name}</h2>
              <span class="text-xs font-medium text-gray-500">{group.jobs.length} job{group.jobs.length === 1 ? '' : 's'}</span>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule</th>
                    <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job type</th>
                    <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                    <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Board status</th>
                    <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reschedule</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each group.jobs as row (row.id)}
                    {@const completed = isJobCompleted(row)}
                    {@const overdue = !completed && isOverdueJob(row, nowMillis)}
                    <tr
                      class={[
                        'cursor-pointer hover:bg-gray-50',
                        completed && 'bg-green-50',
                        overdue && 'bg-red-50'
                      ]}
                      tabindex="0"
                      title="Open workshop job"
                      onclick={() => handleWorkshopClick(row.workshop_id)}
                      onkeydown={(event) => handleRowKeydown(event, row.workshop_id)}
                    >
                      <td class="px-3 py-2 whitespace-nowrap">
                        {#if completed}
                          <span class="text-sm text-green-800 font-medium">{formatSimpleSchedule(row.schedule)}</span>
                          <span class="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Completed</span>
                        {:else if !row.schedule}
                          <span class="text-sm {overdue ? 'text-red-700 font-medium' : 'text-gray-400'}">Unscheduled</span>
                          {#if overdue}
                            <span class="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Overdue</span>
                          {/if}
                        {:else if overdue}
                          <span class="text-sm text-red-700 font-medium">{formatSimpleSchedule(row.schedule)}</span>
                          <span class="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Overdue</span>
                        {:else}
                          <span class="text-sm text-gray-500">{formatSimpleSchedule(row.schedule)}</span>
                        {/if}
                      </td>
                      <td class="px-3 py-2 whitespace-nowrap">
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {jobTypeClass(
                            row.job_type
                          )}"
                        >
                          {row.job_type || '—'}
                        </span>
                      </td>
                      <td class="px-3 py-2 whitespace-nowrap">
                        <div class="text-sm font-medium text-gray-900">{row.customer_name || '—'}</div>
                        {#if row.site_location}
                          <div class="text-sm text-gray-500">{row.site_location}</div>
                        {/if}
                      </td>
                      <td class="px-3 py-2">
                        <div class="text-sm text-gray-900">{row.product_name || '—'}</div>
                        {#if row.make_model || row.serial_number}
                          <div class="text-sm text-gray-500">
                            {row.make_model ?? ''}{#if row.make_model && row.serial_number} · {/if}{row.serial_number ?? ''}
                          </div>
                        {/if}
                      </td>
                      <td class="px-3 py-2 whitespace-nowrap">
                        {#if row.order_id}
                          <a
                            href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={row.order_id}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-blue-600 hover:text-blue-800 underline font-medium"
                            onclick={handleOrderClick}
                          >
                            #{row.order_id}
                          </a>
                        {:else}
                          <span class="text-gray-400">No order</span>
                        {/if}
                        {#if row.clients_work_order}
                          <div class="text-sm text-gray-500">{row.clients_work_order}</div>
                        {/if}
                      </td>
                      <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {formatStatusLabel(row.current_workshop_status)}
                      </td>
                      <td class="px-3 py-2 whitespace-nowrap">
                        {@render assignScheduleButton(row)}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/each}
      {/if}
    {/if}

    {#if $viewMode === 'advanced'}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div class="filter-controls">
        <div>
          <label for="search-tech-jobs" class="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input
            id="search-tech-jobs"
            type="text"
            bind:value={$searchQuery}
            placeholder="Search customer, product, order, tech..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          />
        </div>

        <div>
          <label for="filter-tech" class="block text-sm font-medium text-gray-700 mb-1">Technician</label>
          <select
            id="filter-tech"
            bind:value={$selectedTech}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          >
            <option value="">All technicians</option>
            {#each $techOptions as tech (tech.value)}
              <option value={tech.value}>{tech.label}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="filter-job-type" class="block text-sm font-medium text-gray-700 mb-1">Job type</label>
          <select
            id="filter-job-type"
            bind:value={$selectedJobType}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          >
            <option value="">All job types</option>
            {#each WORKSHOP_TECH_JOB_TYPES as type (type)}
              <option value={type}>{type}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="filter-assignment-status" class="block text-sm font-medium text-gray-700 mb-1"
            >Assignment status</label
          >
          <select
            id="filter-assignment-status"
            bind:value={$assignmentStatus}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          >
            {#each ASSIGNMENT_STATUS_OPTIONS as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="filter-date-from" class="block text-sm font-medium text-gray-700 mb-1">Date from</label>
          <input
            id="filter-date-from"
            type="date"
            bind:value={$dateFrom}
            onchange={validateFilters}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          />
        </div>

        <div>
          <label for="filter-date-to" class="block text-sm font-medium text-gray-700 mb-1">Date to</label>
          <input
            id="filter-date-to"
            type="date"
            bind:value={$dateTo}
            onchange={validateFilters}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          />
        </div>

        <div class="flex items-end">
          <button
            type="button"
            onclick={resetFilters}
            class="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          >
            Clear filters
          </button>
        </div>
      </div>

      {#if $dateError}
        <p class="mt-3 text-sm text-red-600">{$dateError}</p>
      {/if}
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <p class="text-sm font-medium text-gray-500">Total jobs</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{$summaryStats.total}</p>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <p class="text-sm font-medium text-gray-500">Active jobs</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{$summaryStats.active}</p>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <p class="text-sm font-medium text-gray-500">Technicians</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{$summaryStats.uniqueTechs}</p>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <p class="text-sm font-medium text-gray-500">Loaded</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900">{$originalData.length}</p>
        <p class="text-xs text-gray-500">all schedule rows</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h2 class="text-sm font-medium text-gray-700 mb-2">By technician</h2>
        {#if $summaryStats.byTech.length === 0}
          <p class="text-sm text-gray-400">No technicians</p>
        {:else}
          <div class="flex flex-wrap gap-2">
            {#each $summaryStats.byTech as tech (`${tech.email ?? ''}:${tech.name}`)}
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
              >
                {tech.name}
                <span class="text-gray-500">{tech.count}</span>
              </span>
            {/each}
          </div>
        {/if}
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h2 class="text-sm font-medium text-gray-700 mb-2">By job type</h2>
        {#if $summaryStats.byJobType.length === 0}
          <p class="text-sm text-gray-400">No job types</p>
        {:else}
          <div class="flex flex-wrap gap-2">
            {#each $summaryStats.byJobType as item (item.type)}
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium {jobTypeClass(
                  item.type
                )}"
              >
                {item.type}
                <span>{item.count}</span>
              </span>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {#if $isLoading}
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
          <span class="ml-2 text-gray-600">Loading tech jobs...</span>
        </div>
      {:else if $tableData.length === 0}
        <div class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No tech jobs found</h3>
          <p class="mt-1 text-sm text-gray-500">Try adjusting your filters or search terms.</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="p-0 text-left">
                  <button
                    type="button"
                    class="w-full text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-100"
                    onclick={() => handleSortClick('assigned_tech_name')}
                  >
                    Technician {getSortIcon('assigned_tech_name', $sortField, $sortDirection)}
                  </button>
                </th>
                <th scope="col" class="p-0 text-left">
                  <button
                    type="button"
                    class="w-full text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-100"
                    onclick={() => handleSortClick('job_type')}
                  >
                    Job type {getSortIcon('job_type', $sortField, $sortDirection)}
                  </button>
                </th>
                <th scope="col" class="p-0 text-left">
                  <button
                    type="button"
                    class="w-full text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-100"
                    onclick={() => handleSortClick('schedule')}
                  >
                    Schedule {getSortIcon('schedule', $sortField, $sortDirection)}
                  </button>
                </th>
                <th scope="col" class="p-0 text-left">
                  <button
                    type="button"
                    class="w-full text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-100"
                    onclick={() => handleSortClick('customer_name')}
                  >
                    Customer {getSortIcon('customer_name', $sortField, $sortDirection)}
                  </button>
                </th>
                <th scope="col" class="p-0 text-left">
                  <button
                    type="button"
                    class="w-full text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-100"
                    onclick={() => handleSortClick('product_name')}
                  >
                    Product {getSortIcon('product_name', $sortField, $sortDirection)}
                  </button>
                </th>
                <th scope="col" class="p-0 text-left">
                  <button
                    type="button"
                    class="w-full text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-100"
                    onclick={() => handleSortClick('order_id')}
                  >
                    Order {getSortIcon('order_id', $sortField, $sortDirection)}
                  </button>
                </th>
                <th scope="col" class="p-0 text-left">
                  <button
                    type="button"
                    class="w-full text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-100"
                    onclick={() => handleSortClick('current_workshop_status')}
                  >
                    Board status {getSortIcon('current_workshop_status', $sortField, $sortDirection)}
                  </button>
                </th>
                <th scope="col" class="p-0 text-left">
                  <button
                    type="button"
                    class="w-full text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-100"
                    onclick={() => handleSortClick('assignment_status')}
                  >
                    Assignment {getSortIcon('assignment_status', $sortField, $sortDirection)}
                  </button>
                </th>
                <th scope="col" class="p-0 text-left">
                  <button
                    type="button"
                    class="w-full text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-100"
                    onclick={() => handleSortClick('assigned_by_name')}
                  >
                    Assigned by {getSortIcon('assigned_by_name', $sortField, $sortDirection)}
                  </button>
                </th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reschedule
                </th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cancel
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each $paginatedData as row (row.id)}
                <tr
                  class="hover:bg-gray-50 cursor-pointer"
                  tabindex="0"
                  title="Open workshop job"
                  onclick={() => handleWorkshopClick(row.workshop_id)}
                  onkeydown={(event) => handleRowKeydown(event, row.workshop_id)}
                >
                  <td class="px-4 py-3 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">{row.assigned_tech_name || 'Unassigned'}</div>
                    {#if row.assigned_tech}
                      <div class="text-sm text-gray-500">{row.assigned_tech}</div>
                    {/if}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {jobTypeClass(
                        row.job_type
                      )}"
                    >
                      {row.job_type || '—'}
                    </span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatSydneyDate(row.schedule)}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">{row.customer_name || '—'}</div>
                    {#if row.site_location}
                      <div class="text-sm text-gray-500">{row.site_location}</div>
                    {/if}
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-sm text-gray-900">{row.product_name || '—'}</div>
                    {#if row.make_model || row.serial_number}
                      <div class="text-sm text-gray-500">
                        {row.make_model ?? ''}{#if row.make_model && row.serial_number} · {/if}{row.serial_number ?? ''}
                      </div>
                    {/if}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    {#if row.order_id}
                      <a
                        href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={row.order_id}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-600 hover:text-blue-800 underline font-medium"
                        onclick={handleOrderClick}
                      >
                        #{row.order_id}
                      </a>
                    {:else}
                      <span class="text-gray-400">No order</span>
                    {/if}
                    {#if row.clients_work_order}
                      <div class="text-sm text-gray-500">{row.clients_work_order}</div>
                    {/if}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatStatusLabel(row.current_workshop_status)}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {assignmentStatusClass(
                        row.assignment_status
                      )}"
                    >
                      {formatStatusLabel(row.assignment_status)}
                    </span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {row.assigned_by_name || '—'}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    {@render assignScheduleButton(row)}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    {@render cancelJobButton(row)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200">
          <div class="text-sm text-gray-600">
            Showing {($currentPage - 1) * $itemsPerPage + 1}–{Math.min(
              $currentPage * $itemsPerPage,
              $tableData.length
            )} of {$tableData.length} jobs
          </div>
          <div class="flex items-center gap-3">
            <select
              bind:value={$itemsPerPage}
              onchange={handleItemsPerPageChange}
              aria-label="Rows per page"
              class="text-sm border border-gray-300 rounded-md px-2 py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={() => currentPage.update((page) => Math.max(1, page - 1))}
                disabled={$currentPage === 1}
                class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span class="text-sm text-gray-600">Page {$currentPage} of {$totalPages}</span>
              <button
                type="button"
                onclick={() => currentPage.update((page) => Math.min($totalPages, page + 1))}
                disabled={$currentPage >= $totalPages}
                class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
    {/if}
  </div>
</div>

<AssignTechModal
  show={showAssignTechModal}
  workshopLabel={rowForAssignTech?.customer_name || rowForAssignTech?.order_id || ''}
  initialAssignedTo={rowForAssignTech?.assigned_tech || ''}
  initialAssignedToName={rowForAssignTech?.assigned_tech_name || ''}
  initialSchedule={rowForAssignTech?.schedule || ''}
  initialJobType={rowForAssignTech?.job_type || ''}
  submitting={assignTechSubmitting}
  on:confirm={handleAssignTechConfirm}
  on:cancel={closeAssignTechModal}
/>

{#if showCancelJobModal && rowForCancelJob}
  <CancelJobModal
    workshopLabel={rowForCancelJob.customer_name || rowForCancelJob.order_id || ''}
    assignedTechName={rowForCancelJob.assigned_tech_name || rowForCancelJob.assigned_tech || ''}
    scheduleLabel={rowForCancelJob.schedule ? formatSydneyDate(rowForCancelJob.schedule) : ''}
    jobType={rowForCancelJob.job_type || ''}
    submitting={cancelJobSubmitting}
    onconfirm={handleCancelJobConfirm}
    oncancel={closeCancelJobModal}
  />
{/if}

<style>
  .filter-controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }
</style>
