<script lang="ts">
  import FullCalendarWrapper from './FullCalendarWrapper.svelte';
  import { onMount } from 'svelte';
  import { schedulesStore } from '../stores';
  import { get } from 'svelte/store';
  import Modal from '$lib/components/Modal.svelte'; // Import modal component
  // Remove the problematic icon import
  // Remove the type declaration that was causing issues

  type CalendarEvent = {
    id: string;
    title: string;
    start: string; // ISO string
    end?: string;  // ISO string, optional
    extendedProps: {
      location: string;
      company: string;
      scheduleId: number;
      infoIndex: number;
      occurrenceIndex: number;
    };
    backgroundColor: string;
  };

  let calendarEvents: CalendarEvent[] = [];
  let currentMonth: number = new Date().getMonth() + 1;
  let showModal = false;
  let startDateStr = new Date().toISOString().split('T')[0]; // Default to today
  let endDateStr = new Date().toISOString().split('T')[0];   // Default to today
  let selectedLocation: any = null;
  let scheduledItems = new Set<string>(); // Track scheduled items
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  $: filteredSchedules = $schedulesStore.filter(
    schedule => schedule.start_month === currentMonth
  );

  function handleMonthChange(newMonth: number) {
    currentMonth = newMonth;
  }

  function openModal(location: any, schedule: any, infoIndex: number, companyIndex: number) {
    selectedLocation = {
      ...location,
      company: schedule.company,
      scheduleId: schedule.id,
      infoIndex: infoIndex,
      backgroundColor: `hsl(${(companyIndex * 40) % 360}, 70%, 60%)` // Use companyIndex here
    };
    startDateStr = new Date().toISOString().split('T')[0]; // Reset to today
    endDateStr = new Date().toISOString().split('T')[0];   // Reset to today
    showModal = true;
  }

  function addEvent() {
    if (!selectedLocation || !startDateStr || !endDateStr) return;
    
    const newEvent: CalendarEvent = {
      id: `event-${Date.now()}-${Math.random()}`,
      title: `${selectedLocation.company} - ${selectedLocation.sub_company_name}`,
      start: new Date(startDateStr).toISOString(),
      end: new Date(endDateStr).toISOString(), // Add end date
      extendedProps: {
        location: selectedLocation.location,
        company: selectedLocation.company,
        scheduleId: selectedLocation.scheduleId,
        infoIndex: selectedLocation.infoIndex,
        occurrenceIndex: 0
      },
      backgroundColor: selectedLocation.backgroundColor
    };
    
    calendarEvents = [...calendarEvents, newEvent];
    
    // Add to scheduled items set
    const itemKey = `${selectedLocation.scheduleId}-${selectedLocation.infoIndex}`;
    // Instead of mutating, create a new set and add the item, then reassign
    scheduledItems = new Set(scheduledItems).add(itemKey);
    
    showModal = false;
    startDateStr = new Date().toISOString().split('T')[0]; // Reset to today
    endDateStr = new Date().toISOString().split('T')[0];   // Reset to today
  }

  onMount(() => {
    // Initialize if needed
  });
</script>

<div class="grid grid-cols-12 gap-6">
  <div class="col-span-4 bg-white rounded-lg border border-gray-200 p-6">
    <h3 class="text-lg font-medium text-gray-900 mb-6">
      Company Locations for {months[currentMonth - 1]}
    </h3>
    <div id="company-locations" class="space-y-6">
      {#each filteredSchedules as schedule, index}
        <div class="company-container mb-6">
          <div 
            class="flex items-center justify-between bg-[rgb(30,30,30)] text-white px-3 py-2 rounded-t mb-3"
          >
            <h4 class="text-md font-semibold">{schedule.company}</h4>
            <div 
              class="w-3 h-3 rounded-full" 
              style="background-color: hsl({(index * 40) % 360}, 70%, 60%)">
            </div>
          </div>
          <div class="company-items space-y-4">
            {#each schedule.information as info, infoIndex}
              <div
                class="p-3 rounded text-white cursor-pointer flex justify-between items-center"
                style="background-color: hsl({(index * 40) % 360}, 70%, 60%)"
                on:click={() => openModal(info, schedule, infoIndex, index)}
              >
                <div>
                  <div class="font-medium text-sm">{info.sub_company_name}</div>
                  <div class="text-xs opacity-80">{info.location}</div>
                </div>
                {#if scheduledItems.has(`${schedule.id}-${infoIndex}`)}
                  <!-- Use a simple SVG check icon -->
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <div class="text-center py-4 text-gray-500">
          No companies scheduled for {months[currentMonth - 1]}
        </div>
      {/each}
    </div>
  </div>

  <div class="col-span-8 bg-white rounded-lg border border-gray-200 p-6">
    <h3 class="text-lg font-medium text-gray-900 mb-6">Schedule Calendar</h3>
    <FullCalendarWrapper 
      events={calendarEvents} 
      onMonthChange={handleMonthChange}
      onEventRemove={(eventId) => {
        calendarEvents = calendarEvents.filter(event => event.id !== eventId);
      }}
    />
  </div>
</div>

{#if showModal && selectedLocation}
  <Modal 
    show={showModal} 
    onClose={() => showModal = false}
  >
    <svelte:fragment slot="header">
      {selectedLocation.sub_company_name}
    </svelte:fragment>
    <svelte:fragment slot="body">
      <div class="p-6">
        <h2 class="text-xl font-bold mb-2">{selectedLocation.sub_company_name}</h2>
        <p class="mb-4 text-gray-600">{selectedLocation.location}</p>
        
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Date Range:</label>
          <div class="flex space-x-2">
            <div class="flex-1">
              <label class="block text-xs text-gray-500 mb-1">Start Date</label>
              <input 
                type="date" 
                bind:value={startDateStr}
                class="w-full p-2 border rounded"
              />
            </div>
            <div class="flex-1">
              <label class="block text-xs text-gray-500 mb-1">End Date</label>
              <input 
                type="date" 
                bind:value={endDateStr}
                class="w-full p-2 border rounded"
              />
            </div>
          </div>
        </div>
        
        <div class="flex justify-end space-x-2">
          <button 
            on:click={() => showModal = false}
            class="px-4 py-2 border rounded"
          >
            Cancel
          </button>
          <button 
            on:click={addEvent}
            disabled={!startDateStr || !endDateStr}
            class="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
          >
            Add to Calendar
          </button>
        </div>
      </div>
    </svelte:fragment>
  </Modal>
{/if}

<style>
  .fc .fc-event {
    cursor: pointer;
  }
</style>
