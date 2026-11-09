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
  $: pathSegments = $page.url.pathname.replace(/\/+$/, '').split('/');
  $: activeTab = pathSegments[pathSegments.length - 1] || 'schedules';
  $: isFullWidthPage = activeTab === 'sheet' || activeTab === 'equipments';
</script>

{#if isFullWidthPage}
  <slot />
{:else}
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
          <a
            href={`${base}/scheduled-test-and-tag/${tab.path}`}
            class="py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {activeTab === tab.path ? 'border-lime-500 text-lime-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-[#333842]'}"
          >
            <span class="mr-2">{tab.icon}</span>
            {tab.label}
          </a>
        {/each}
      </nav>
    </div>

    <!-- Content Slot -->
    <div>
      <slot />
    </div>
  </div>
</div>
{/if}
