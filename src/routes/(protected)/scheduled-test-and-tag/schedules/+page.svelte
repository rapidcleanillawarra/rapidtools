<script lang="ts">
  import FullCalendarWrapper from './FullCalendarWrapper.svelte';
  import { onMount } from 'svelte';
  import { schedulesStore } from '../stores';
  import { get } from 'svelte/store';
  import Modal from '$lib/components/Modal.svelte'; // Import modal component
  import { currentUser } from '$lib/firebase';
  import { userProfile } from '$lib/userProfile';
  import { 
    loadSTTEvents, 
    saveSTTEvent, 
    updateSTTEvent, 
    deleteSTTEvent,
    calendarEventToSTTEvent,
    sttEventToCalendarEvent,
    type STTEvent 
  } from '../utils/sttEvents';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import { toastSuccess, toastError } from '$lib/utils/toast';

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
  let isLoading = false;
  let isSaving = false;
  let isDeleting = false;
  let user: any;
  let profile: any;
  
  // Subscribe to user and profile stores
  currentUser.subscribe(value => user = value);
  userProfile.subscribe(value => profile = value);
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  $: filteredSchedules = $schedulesStore.filter(
    schedule => schedule.start_month === currentMonth
  );

  function validateSchedule(): boolean {
    validationErrors = [];
    
    // Date validation
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

    // Location and contact validation
    if (selectedLocation) {
      // Check if location has required fields
      if (!selectedLocation.sub_company_name?.trim()) {
        validationErrors.push('Sub-company name is required');
      }
      
      if (!selectedLocation.location?.trim()) {
        validationErrors.push('Location is required');
      }
      
      // Check if location has at least one contact
      if (!selectedLocation.contacts || selectedLocation.contacts.length === 0) {
        validationErrors.push('At least one contact is required for this location');
      } else {
        // Check if at least one contact has a name
        const hasValidContact = selectedLocation.contacts.some((contact: any) => 
          contact.name && contact.name.trim().length > 0
        );
        
        if (!hasValidContact) {
          validationErrors.push('At least one contact must have a name');
        }
        
        // Additional validation: ensure at least one contact has either phone or email
        const hasContactInfo = selectedLocation.contacts.some((contact: any) => 
          (contact.phone && contact.phone.trim().length > 0) || 
          (contact.email && contact.email.trim().length > 0)
        );
        
        if (!hasContactInfo) {
          validationErrors.push('At least one contact must have a phone number or email address');
        }
      }
    } else {
      validationErrors.push('No location selected for scheduling');
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
    if (!schedule) {
      toastError('Schedule not found');
      return;
    }

    const locationInfo = schedule.information[event.extendedProps.infoIndex];
    if (!locationInfo) {
      toastError('Location information not found');
      return;
    }

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

  async function addEvent() {
    if (!selectedLocation || !startDateStr || !endDateStr) return;
    
    // Check if user is authenticated
    if (!user) {
      toastError('You must be logged in to save schedules');
      return;
    }
    
    // Validate schedule before proceeding
    if (!validateSchedule()) {
      return; // Don't proceed if validation fails
    }
    
    try {
      isSaving = true;
      if (isEditMode && editingEventId) {
        // Update existing event in Firestore
        await updateSTTEvent(editingEventId, {
          start_date: new Date(startDateStr).toISOString(),
          end_date: new Date(endDateStr).toISOString()
        });
        
        // Update local calendar events
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
        
        toastSuccess('Schedule updated successfully');
        // Add success animation
        const successElement = document.createElement('div');
        successElement.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-checkmark';
        successElement.innerHTML = '✅ Schedule Updated!';
        document.body.appendChild(successElement);
        setTimeout(() => {
          document.body.removeChild(successElement);
        }, 3000);
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

        // Create new event data
        const newEventData = {
          title: `${selectedLocation.company} - ${selectedLocation.sub_company_name}`,
          start: new Date(startDateStr).toISOString(),
          end: new Date(endDateStr).toISOString(),
          extendedProps: {
            location: selectedLocation.location,
            company: selectedLocation.company,
            scheduleId: selectedLocation.scheduleId,
            infoIndex: selectedLocation.infoIndex,
            occurrenceIndex: 0
          },
          backgroundColor: selectedLocation.backgroundColor
        };

        // Save to Firestore
        const schedule = $schedulesStore.find(s => s.id === selectedLocation.scheduleId);
        const locationInfo = schedule?.information[selectedLocation.infoIndex];
        
        if (!schedule || !locationInfo) {
          toastError('Invalid schedule or location information');
          return;
        }
        
        // Validate that the information_id exists
        if (!locationInfo.information_id) {
          toastError('Missing location information ID');
          return;
        }

        const sttEventData = calendarEventToSTTEvent(
          newEventData, 
          locationInfo, 
          schedule,
          user?.uid,
          user?.email
        );
        
        const firestoreId = await saveSTTEvent(sttEventData);
        
        // Add to local calendar events
        const newEvent: CalendarEvent = {
          id: firestoreId,
          ...newEventData
        };
        
        calendarEvents = [...calendarEvents, newEvent];
        
        // Add to scheduled items set
        const itemKey = `${selectedLocation.scheduleId}-${selectedLocation.infoIndex}`;
        scheduledItems = new Set(scheduledItems).add(itemKey);
        
        toastSuccess('Schedule added successfully');
        // Add success animation
        showSuccessAnimation();
      }
    } catch (error) {
      console.error('Error saving event:', error);
      toastError('Failed to save schedule');
      return;
    } finally {
      isSaving = false;
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

  async function confirmDelete() {
    if (!eventToDelete) return;
    
    const event = eventToDelete; // Create local reference to avoid null check issues
    
    try {
      isDeleting = true;
      // Delete from Firestore
      await deleteSTTEvent(event.id);
      
      // Remove from scheduled items set
      const itemKey = `${event.extendedProps.scheduleId}-${event.extendedProps.infoIndex}`;
      scheduledItems = new Set([...scheduledItems].filter(item => item !== itemKey));
      
      // Remove from calendar events
      calendarEvents = calendarEvents.filter(calEvent => calEvent.id !== event.id);
      
      toastSuccess('Schedule deleted successfully');
      showDeleteSuccessAnimation();
    } catch (error) {
      console.error('Error deleting event:', error);
      toastError('Failed to delete schedule');
      return;
    } finally {
      isDeleting = false;
    }
    
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

  // Reactive validation - validate schedule whenever dates change
  $: if (startDateStr && endDateStr) {
    validateSchedule();
  }

  // Load events from Firestore on mount
  async function loadEventsFromFirestore() {
    try {
      isLoading = true;
      const sttEvents = await loadSTTEvents();
      
      // Convert STT events to calendar events and map infoIndex
      const events: CalendarEvent[] = [];
      const scheduledSet = new Set<string>();
      
      sttEvents.forEach(sttEvent => {
        // Find the corresponding schedule and location info to get infoIndex
        const schedule = $schedulesStore.find(s => s.id === sttEvent.schedule_id.toString());
        if (schedule) {
          const infoIndex = schedule.information.findIndex(info => info.information_id === sttEvent.information_id);
          if (infoIndex !== -1) {
            const calendarEvent = sttEventToCalendarEvent(sttEvent);
            calendarEvent.extendedProps.infoIndex = infoIndex;
            events.push(calendarEvent);
            
            // Add to scheduled items set
            const itemKey = `${sttEvent.schedule_id.toString()}-${infoIndex}`;
            scheduledSet.add(itemKey);
          }
        }
      });
      
      calendarEvents = events;
      scheduledItems = scheduledSet;
      
    } catch (error) {
      console.error('Error loading events from Firestore:', error);
      toastError('Failed to load events from database');
    } finally {
      isLoading = false;
    }
  }

  // Show success animation
  function showSuccessAnimation() {
    const successElement = document.createElement('div');
    successElement.className = 'fixed top-4 right-4 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-checkmark flex items-center';
    successElement.innerHTML = `
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      Schedule Saved Successfully!
    `;
    document.body.appendChild(successElement);
    setTimeout(() => {
      if (document.body.contains(successElement)) {
        document.body.removeChild(successElement);
      }
    }, 3000);
  }

  // Show delete success animation
  function showDeleteSuccessAnimation() {
    const successElement = document.createElement('div');
    successElement.className = 'fixed top-4 right-4 bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-checkmark flex items-center';
    successElement.innerHTML = `
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      Schedule Deleted Successfully!
    `;
    document.body.appendChild(successElement);
    setTimeout(() => {
      if (document.body.contains(successElement)) {
        document.body.removeChild(successElement);
      }
    }, 3000);
  }

  // Add ripple effect to buttons
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

  // Refresh events from Firestore
  async function refreshEvents() {
    await loadEventsFromFirestore();
  }

  onMount(() => {
    loadEventsFromFirestore();
  });
</script>

<div class="grid grid-cols-12 gap-6">
  <div class="col-span-4 bg-white rounded-lg border border-gray-200 p-6 shadow-lg">
    <h3 class="text-lg font-medium text-gray-900 mb-6 flex items-center">
      <span class="mr-2">📅</span>
      Company Locations for {months[currentMonth - 1]}
    </h3>
    {#if isLoading}
      <div class="flex flex-col items-center justify-center py-12">
        <div class="relative">
          <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
          <div class="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 animate-ping"></div>
        </div>
        <span class="mt-4 text-gray-600 font-medium">Loading events...</span>
        <div class="mt-2 text-xs text-gray-400">Please wait while we fetch your schedules</div>
      </div>
    {:else}
      <div id="company-locations" class="space-y-6">
        {#each filteredSchedules as schedule, index (schedule.id)}
          <div class="company-container mb-6 animate-fade-in" style="animation-delay: {index * 100}ms;">
            <div 
              class="flex items-center justify-between bg-gradient-to-r from-gray-800 to-gray-900 text-white px-4 py-3 rounded-t-lg mb-3 shadow-md transform hover:scale-[1.02] transition-transform duration-200"
            >
              <h4 class="text-md font-semibold">{schedule.company}</h4>
              <div 
                class="w-4 h-4 rounded-full shadow-lg animate-pulse" 
                style="background-color: hsl({(index * 40) % 360}, 70%, 60%)">
              </div>
            </div>
            <div class="company-items space-y-3">
              {#each schedule.information as info, infoIndex (info.information_id)}
                <div
                  class="p-4 rounded-lg text-white cursor-pointer flex justify-between items-center transform hover:scale-[1.02] hover:shadow-lg transition-all duration-200 ease-out"
                  style="background: linear-gradient(135deg, hsl({(index * 40) % 360}, 70%, 60%), hsl({(index * 40) % 360}, 70%, 50%))"
                  on:click={() => openModal(info, schedule, infoIndex, index)}
                >
                  <div class="flex-1">
                    <div class="font-medium text-sm mb-1">{info.sub_company_name}</div>
                    <div class="text-xs opacity-90">{info.location}</div>
                  </div>
                  {#if scheduledItems.has(`${schedule.id}-${infoIndex}`)}
                    <div class="flex items-center">
                      <div class="bg-green-500 rounded-full p-1 mr-2 animate-bounce">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                        </svg>
                      </div>
                      <span class="text-xs font-medium text-green-200">Scheduled</span>
                    </div>
                  {:else}
                    <div class="text-xs opacity-60">Click to schedule</div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="text-center py-12">
            <div class="text-6xl mb-4">📋</div>
            <div class="text-gray-500 font-medium">No companies scheduled for {months[currentMonth - 1]}</div>
            <div class="text-sm text-gray-400 mt-2">Select a different month to view schedules</div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="col-span-8 bg-white rounded-lg border border-gray-200 p-6 shadow-lg">
    <div class="flex justify-between items-center mb-6">
      <h3 class="text-lg font-medium text-gray-900 flex items-center">
        <span class="mr-2">🗓️</span>
        Schedule Calendar
      </h3>
      <button 
        on:click={refreshEvents}
        on:click={addRippleEffect}
        disabled={isLoading}
        class="btn-primary floating-btn px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center shadow-md"
      >
        {#if isLoading}
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
        {:else}
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        {/if}
        {isLoading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
    <div class="relative">
      {#if isLoading}
        <div class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
            <div class="mt-4 text-gray-600">Updating calendar...</div>
          </div>
        </div>
      {/if}
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
</div>

<ToastContainer />

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
      <div class="modal-enter">
        {isEditMode ? 'Edit Schedule' : 'Add Schedule'} - {selectedLocation.sub_company_name}
      </div>
    </svelte:fragment>
    <svelte:fragment slot="body">
      <div class="modal-enter">
      <div class="p-6">
        <h2 class="text-xl font-bold mb-2">{selectedLocation.sub_company_name}</h2>
        <p class="mb-4 text-gray-600">{selectedLocation.location}</p>
        
        <div class="mb-6">
          <label class="block text-sm font-medium mb-3 text-gray-700">📅 Date Range:</label>
          <div class="flex space-x-4">
            <div class="flex-1">
              <label class="block text-xs text-gray-600 mb-2 font-medium">Start Date</label>
              <input 
                type="date" 
                bind:value={startDateStr}
                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div class="flex-1">
              <label class="block text-xs text-gray-600 mb-2 font-medium">End Date</label>
              <input 
                type="date" 
                bind:value={endDateStr}
                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
                min={startDateStr || new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          
          {#if validationErrors.length > 0}
            <div class="mt-4 p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg animate-pulse">
              <div class="text-sm text-red-800">
                <div class="font-medium mb-2 flex items-center">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Please fix the following errors:
                </div>
                <ul class="list-disc list-inside space-y-1">
                  {#each validationErrors as error}
                    <li class="flex items-center">
                      <span class="w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                      {error}
                    </li>
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
              disabled={isDeleting}
              class="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 transform hover:scale-105 transition-all duration-200 shadow-md flex items-center"
            >
              {#if isDeleting}
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Removing...
              {:else}
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                Remove Schedule
              {/if}
            </button>
          {:else}
            <div></div>
          {/if}
          
          <div class="flex space-x-3">
            <button 
              on:click={() => {
                showModal = false;
                isEditMode = false;
                editingEventId = null;
              }}
              disabled={isSaving || isDeleting}
              class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200"
            >
              Cancel
            </button>
            <button 
              on:click={addEvent}
              on:click={addRippleEffect}
              disabled={!startDateStr || !endDateStr || validationErrors.length > 0 || isSaving || isDeleting}
              class="btn-primary px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg disabled:from-gray-400 disabled:to-gray-500 hover:from-blue-700 hover:to-blue-800 shadow-md flex items-center"
            >
              {#if isSaving}
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                {isEditMode ? 'Updating...' : 'Saving...'}
              {:else}
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                {isEditMode ? 'Update Schedule' : 'Add to Calendar'}
              {/if}
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
        
        <div class="flex justify-end space-x-3">
          <button 
            on:click={cancelDelete}
            disabled={isDeleting}
            class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200"
          >
            Cancel
          </button>
          <button 
            on:click={confirmDelete}
            disabled={isDeleting}
            class="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 transform hover:scale-105 transition-all duration-200 shadow-md flex items-center"
          >
            {#if isDeleting}
              <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Deleting...
            {:else}
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Delete Schedule
            {/if}
          </button>
        </div>
      </div>
    </svelte:fragment>
  </Modal>
{/if}

<style>
  .fc .fc-event {
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .fc .fc-event:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  /* Fade in animation for company containers */
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
  
  /* Pulse animation for loading states */
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
  
  /* Bounce animation for scheduled items */
  @keyframes bounce {
    0%, 20%, 53%, 80%, 100% {
      transform: translate3d(0, 0, 0);
    }
    40%, 43% {
      transform: translate3d(0, -8px, 0);
    }
    70% {
      transform: translate3d(0, -4px, 0);
    }
    90% {
      transform: translate3d(0, -2px, 0);
    }
  }
  
  .animate-bounce {
    animation: bounce 1s infinite;
  }
  
  /* Scale animation for hover effects */
  .hover-scale {
    transition: transform 0.2s ease-out;
  }
  
  .hover-scale:hover {
    transform: scale(1.02);
  }
  
  /* Gradient text animation */
  @keyframes gradient {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
  
  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient 3s ease infinite;
  }
  
  /* Modal entrance animation */
  .modal-enter {
    animation: modalEnter 0.3s ease-out;
  }
  
  @keyframes modalEnter {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  /* Success checkmark animation */
  @keyframes checkmark {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  .animate-checkmark {
    animation: checkmark 0.5s ease-out;
  }
  
  /* Shimmer loading effect */
  @keyframes shimmer {
    0% {
      background-position: -200px 0;
    }
    100% {
      background-position: calc(200px + 100%) 0;
    }
  }
  
  .shimmer {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200px 100%;
    animation: shimmer 1.5s infinite;
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
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
  
  /* Floating action button effect */
  .floating-btn {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .floating-btn:hover {
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }
  
  /* Card hover effects */
  .card-hover {
    transition: all 0.3s ease;
  }
  
  .card-hover:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  }
</style>
