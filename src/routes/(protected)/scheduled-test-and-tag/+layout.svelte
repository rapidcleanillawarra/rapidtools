<script lang="ts">
  import { fade } from 'svelte/transition';
  import { page } from '$app/stores';
  import { base } from '$app/paths';

  // Tab options
  const tabs = [
    { id: 'schedules', label: 'Schedules', icon: '📅', path: 'schedules' },
    { id: 'companies', label: 'Companies', icon: '🏢', path: 'companies' }
  ];

  // Determine active tab based on current URL
  $: activeTab = $page.url.pathname.split('/').pop() || 'schedules';
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
          <a
            href={`${base}/scheduled-test-and-tag/${tab.path}`}
            class="py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === tab.path ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          >
            <span class="mr-2">{tab.icon}</span>
            {tab.label}
          </a>
        {/each}
      </nav>
    </div>

    <!-- Content Slot -->
    <div class="p-6">
      <slot />
    </div>
  </div>
</div> 