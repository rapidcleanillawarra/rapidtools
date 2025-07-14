<script lang="ts">
  import { schedulesStore } from '../stores';
  import { onMount } from 'svelte';
  
  let isLoading = true;
  let error: string | null = null;
  
  // We can load data asynchronously here if needed, but for now we are using static data
  onMount(() => {
    isLoading = false;
  });
</script>

{#if isLoading}
  <div class="flex justify-center items-center h-64">
    <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
{:else if error}
  <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
    <strong class="font-bold">Error!</strong>
    <span class="block sm:inline"> {error}</span>
  </div>
{:else}
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-lg font-medium text-gray-900">Test & Tag Schedules</h2>
      <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
        Add New Schedule
      </button>
    </div>
    
    <!-- Display the schedules in a table -->
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each $schedulesStore as schedule (schedule.id)}
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{schedule.company}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{schedule.location}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{schedule.date}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                  {schedule.status === 'Scheduled' 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : schedule.status === 'Completed' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'}">
                  {schedule.status}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}