<script lang="ts">
  import { fade } from 'svelte/transition';
  import { base } from '$app/paths';

  // State management
  let activeTab = 'schedules';

  // Tab options
  const tabs = [
    { id: 'schedules', label: 'Schedules', icon: '📅' },
    { id: 'companies', label: 'Companies', icon: '🏢' }
  ];

  function switchTab(tabId: string) {
    activeTab = tabId;
  }
</script>

<svelte:head>
  <title>Scheduled Test & Tag - RapidTools</title>
</svelte:head>

<div class="min-h-screen py-6 px-2 sm:px-4 lg:px-6" in:fade>
  <div class="w-full bg-[#141619] border border-[#262a30] shadow-xl rounded-2xl p-4 sm:p-6 lg:p-8">
    <!-- Header -->
    <div class="pb-4 border-b border-[#262a30] mb-6">
      <h1 class="text-2xl font-bold text-white tracking-tight">Scheduled Test & Tag</h1>
      <p class="mt-1 text-sm text-gray-400">Manage test and tag schedules and company information.</p>
    </div>

    <!-- Tab Navigation -->
    <div class="border-b border-[#262a30] mb-6">
      <nav class="flex space-x-8">
        {#each tabs as tab}
          <button
            type="button"
            class="py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === tab.id ? 'border-lime-500 text-lime-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-[#333842]'}"
            on:click={() => switchTab(tab.id)}
          >
            <span class="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        {/each}
      </nav>
    </div>

    <!-- Tab Content -->
    <div>
      {#if activeTab === 'schedules'}
        <!-- Schedules Tab -->
        <div class="space-y-6">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-semibold text-white">Test & Tag Schedules</h2>
            <a href={`${base}/scheduled-test-and-tag/schedules`} class="btn-primary text-sm inline-flex items-center">
              Go to Schedules
            </a>
          </div>
          
          <div class="bg-[#181b20] border border-[#262a30] rounded-xl p-8 text-center">
            <div class="text-gray-500 text-6xl mb-4">📅</div>
            <h3 class="text-lg font-semibold text-white mb-2">Schedules Management</h3>
            <p class="text-gray-400 mb-4 max-w-md mx-auto">Manage test and tag schedules for different locations and equipment.</p>
            <div class="space-y-2 text-sm text-gray-400">
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
            <h2 class="text-lg font-semibold text-white">Companies</h2>
            <a href={`${base}/scheduled-test-and-tag/companies`} class="btn-primary text-sm inline-flex items-center">
              Go to Companies
            </a>
          </div>
          
          <div class="bg-[#181b20] border border-[#262a30] rounded-xl p-8 text-center">
            <div class="text-gray-500 text-6xl mb-4">🏢</div>
            <h3 class="text-lg font-semibold text-white mb-2">Company Management</h3>
            <p class="text-gray-400 mb-4 max-w-md mx-auto">Manage company information and contact details for test and tag services.</p>
            <div class="space-y-2 text-sm text-gray-400">
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
