<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { base } from '$app/paths';

  // State management
  let activeTab = 'schedules';
  let isLoading = false;

  // Tab options
  const tabs = [
    { id: 'schedules', label: 'Schedules', icon: '📅' },
    { id: 'companies', label: 'Companies', icon: '🏢' }
  ];

  function switchTab(tabId: string) {
    activeTab = tabId;
  }
</script>

<div class="container mx-auto px-4 py-8" in:fade>
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-gray-200">
      <h1 class="text-xl font-semibold">Scheduled Test & Tag</h1>
      <p class="text-gray-600">Manage test and tag schedules and company information.</p>
    </div>

    <!-- Tab Navigation -->
    <div class="border-b border-gray-200">
      <nav class="flex space-x-8 px-6">
        {#each tabs as tab}
          <button
            class="py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
            on:click={() => switchTab(tab.id)}
          >
            <span class="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        {/each}
      </nav>
    </div>

    <!-- Tab Content -->
    <div class="p-6">
      {#if activeTab === 'schedules'}
        <!-- Schedules Tab -->
        <div class="space-y-6">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900">Test & Tag Schedules</h2>
            <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              Add New Schedule
            </button>
          </div>
          
          <!-- Placeholder content for schedules -->
          <div class="bg-gray-50 rounded-lg p-8 text-center">
            <div class="text-gray-400 text-6xl mb-4">📅</div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">Schedules Management</h3>
            <p class="text-gray-600 mb-4">Manage test and tag schedules for different locations and equipment.</p>
            <div class="space-y-2 text-sm text-gray-500">
              <p>• View upcoming test and tag appointments</p>
              <p>• Schedule new test and tag sessions</p>
              <p>• Track completion status</p>
              <p>• Generate reports</p>
            </div>
          </div>
        </div>
      {:else if activeTab === 'companies'}
        <!-- Companies Tab -->
        <div class="space-y-6">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900">Companies</h2>
            <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              Add New Company
            </button>
          </div>
          
          <!-- Placeholder content for companies -->
          <div class="bg-gray-50 rounded-lg p-8 text-center">
            <div class="text-gray-400 text-6xl mb-4">🏢</div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">Company Management</h3>
            <p class="text-gray-600 mb-4">Manage company information and contact details for test and tag services.</p>
            <div class="space-y-2 text-sm text-gray-500">
              <p>• View company profiles</p>
              <p>• Manage contact information</p>
              <p>• Track service history</p>
              <p>• Set up recurring schedules</p>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div> 