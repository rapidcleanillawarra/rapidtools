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
  let isEditMode = false;
  let editingEventId: string | null = null;
  let validationErrors: string[] = [];
  let showConfirmModal = false;
  let eventToDelete: CalendarEvent | null = null;
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  $: filteredSchedules = $schedulesStore.filter(
    schedule => schedule.start_month === currentMonth
  );

  function validateDates(): boolean {
    validationErrors = [];
    
    if (!startDateStr || !endDateStr) {
      validationErrors.push('Both start and end dates are required');
      return false;
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

    // Check if dates are in the past
    if (startDate < today) {
      validationErrors.push('Start date cannot be in the past');
    }

    if (endDate < today) {
      validationErrors.push('End date cannot be in the past');
    }

    // Check if end date is before start date
    if (endDate < startDate) {
      validationErrors.push('End date cannot be before start date');
    }

    // Check if date range is too long (optional - you can adjust this limit)
    const daysDifference = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDifference > 365) {
      validationErrors.push('Date range cannot exceed 1 year');
    }

    return validationErrors.length === 0;
  }

  function handleMonthChange(newMonth: number) {
    currentMonth = newMonth;
  }

  function openModal(location: any, schedule: any, infoIndex: number, companyIndex: number) {
    const itemKey = `${schedule.id}-${infoIndex}`;
    const existingEvent = calendarEvents.find(event => 
      event.extendedProps.scheduleId === schedule.id && 
      event.extendedProps.infoIndex === infoIndex
    );

    if (existingEvent) {
      // Edit existing event
      isEditMode = true;
      editingEventId = existingEvent.id;
      startDateStr = existingEvent.start.split('T')[0];
      endDateStr = existingEvent.end ? existingEvent.end.split('T')[0] : existingEvent.start.split('T')[0];
    } else {
      // Add new event
      isEditMode = false;
      editingEventId = null;
      startDateStr = new Date().toISOString().split('T')[0];
      endDateStr = new Date().toISOString().split('T')[0];
    }

    selectedLocation = {
      ...location,
      company: schedule.company,
      scheduleId: schedule.id,
      infoIndex: infoIndex,
      backgroundColor: `hsl(${(companyIndex * 40) % 360}, 70%, 60%)` // Use companyIndex here
    };
    validationErrors = []; // Clear validation errors when opening modal
    showModal = true;
  }

  function openEventModal(event: any) {
    // Find the corresponding schedule and location info
    const schedule = $schedulesStore.find(s => s.id === event.extendedProps.scheduleId);
    if (!schedule) return;

    const locationInfo = schedule.information[event.extendedProps.infoIndex];
    if (!locationInfo) return;

    // Find the company index for color
    const companyIndex = $schedulesStore.findIndex(s => s.id === event.extendedProps.scheduleId);

    // Open modal in edit mode
    isEditMode = true;
    editingEventId = event.id;
    startDateStr = event.start.split('T')[0];
    endDateStr = event.end ? event.end.split('T')[0] : event.start.split('T')[0];

    selectedLocation = {
      ...locationInfo,
      company: schedule.company,
      scheduleId: schedule.id,
      infoIndex: event.extendedProps.infoIndex,
      backgroundColor: event.backgroundColor
    };
    validationErrors = []; // Clear validation errors when opening modal
    showModal = true;
  }

  function addEvent() {
    if (!selectedLocation || !startDateStr || !endDateStr) return;
    
    // Validate dates before proceeding
    if (!validateDates()) {
      return; // Don't proceed if validation fails
    }
    
    if (isEditMode && editingEventId) {
      // Update existing event
      calendarEvents = calendarEvents.map(event => {
        if (event.id === editingEventId) {
          return {
            ...event,
            start: new Date(startDateStr).toISOString(),
            end: new Date(endDateStr).toISOString()
          };
        }
        return event;
      });
    } else {
      // Check if event already exists
      const existingEvent = calendarEvents.find(event => 
        event.extendedProps.scheduleId === selectedLocation.scheduleId && 
        event.extendedProps.infoIndex === selectedLocation.infoIndex
      );

      if (existingEvent) {
        // Don't add duplicate, just close modal
        showModal = false;
        return;
      }

      // Add new event
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
    }
    
    showModal = false;
    startDateStr = new Date().toISOString().split('T')[0]; // Reset to today
    endDateStr = new Date().toISOString().split('T')[0];   // Reset to today
    isEditMode = false;
    editingEventId = null;
    validationErrors = []; // Clear validation errors
  }

  function removeEvent(eventId: string) {
    const eventToRemove = calendarEvents.find(event => event.id === eventId);
    if (eventToRemove) {
      // Set for confirmation
      eventToDelete = eventToRemove;
      showConfirmModal = true;
    }
  }

  function removeCurrentEvent() {
    if (editingEventId) {
      const eventToRemove = calendarEvents.find(event => event.id === editingEventId);
      if (eventToRemove) {
        eventToDelete = eventToRemove;
        showConfirmModal = true;
      }
    }
  }

  function confirmDelete() {
    if (!eventToDelete) return;
    
    const event = eventToDelete; // Create local reference to avoid null check issues
    
    // Remove from scheduled items set
    const itemKey = `${event.extendedProps.scheduleId}-${event.extendedProps.infoIndex}`;
    scheduledItems = new Set([...scheduledItems].filter(item => item !== itemKey));
    
    // Remove from calendar events
    calendarEvents = calendarEvents.filter(calEvent => calEvent.id !== event.id);
    
    // Close both modals
    showConfirmModal = false;
    showModal = false;
    isEditMode = false;
    editingEventId = null;
    validationErrors = [];
    eventToDelete = null;
  }

  function cancelDelete() {
    showConfirmModal = false;
    eventToDelete = null;
  }

  // Reactive validation - validate dates whenever they change
  $: if (startDateStr && endDateStr) {
    validateDates();
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
      onEventClick={openEventModal}
      onEventRemove={(eventId) => {
        removeEvent(eventId);
      }}
    />
  </div>
</div>

{#if showModal && selectedLocation}
  <Modal 
    show={showModal} 
    onClose={() => {
      showModal = false;
      isEditMode = false;
      editingEventId = null;
    }}
  >
    <svelte:fragment slot="header">
      {isEditMode ? 'Edit Schedule' : 'Add Schedule'} - {selectedLocation.sub_company_name}
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
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div class="flex-1">
              <label class="block text-xs text-gray-500 mb-1">End Date</label>
              <input 
                type="date" 
                bind:value={endDateStr}
                class="w-full p-2 border rounded"
                min={startDateStr || new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          
          {#if validationErrors.length > 0}
            <div class="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <div class="text-sm text-red-800">
                <div class="font-medium mb-1">Please fix the following errors:</div>
                <ul class="list-disc list-inside space-y-1">
                  {#each validationErrors as error}
                    <li>{error}</li>
                  {/each}
                </ul>
              </div>
            </div>
          {/if}
        </div>
        
        <div class="flex justify-between items-center">
          {#if isEditMode && editingEventId}
            <button 
              on:click={removeCurrentEvent}
              class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Remove Schedule
            </button>
          {:else}
            <div></div>
          {/if}
          
          <div class="flex space-x-2">
            <button 
              on:click={() => {
                showModal = false;
                isEditMode = false;
                editingEventId = null;
              }}
              class="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              on:click={addEvent}
              disabled={!startDateStr || !endDateStr || validationErrors.length > 0}
              class="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400 hover:bg-blue-700"
            >
              {isEditMode ? 'Update Schedule' : 'Add to Calendar'}
            </button>
          </div>
        </div>
      </div>
    </svelte:fragment>
  </Modal>
{/if}

{#if showConfirmModal && eventToDelete}
  <Modal 
    show={showConfirmModal} 
    onClose={cancelDelete}
  >
    <svelte:fragment slot="header">
      Confirm Delete Schedule
    </svelte:fragment>
    <svelte:fragment slot="body">
      <div class="p-6">
        <div class="mb-4">
          <div class="flex items-center mb-3">
            <div 
              class="w-4 h-4 rounded mr-3" 
              style="background-color: {eventToDelete.backgroundColor}">
            </div>
            <h3 class="text-lg font-semibold">{eventToDelete.title}</h3>
          </div>
          <p class="text-gray-600 mb-2">Location: {eventToDelete.extendedProps.location}</p>
          <p class="text-gray-600 mb-4">
            Date: {new Date(eventToDelete.start).toLocaleDateString()}
            {#if eventToDelete.end && eventToDelete.end !== eventToDelete.start}
              - {new Date(eventToDelete.end).toLocaleDateString()}
            {/if}
          </p>
        </div>
        
        <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
          <div class="flex">
            <svg class="w-5 h-5 text-yellow-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <div class="text-sm text-yellow-800">
              <p class="font-medium">Are you sure you want to delete this schedule?</p>
              <p class="mt-1">This action cannot be undone.</p>
            </div>
          </div>
        </div>
        
        <div class="flex justify-end space-x-2">
          <button 
            on:click={cancelDelete}
            class="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            on:click={confirmDelete}
            class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete Schedule
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
