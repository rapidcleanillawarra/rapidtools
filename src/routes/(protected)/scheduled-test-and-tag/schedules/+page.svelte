<script lang="ts">
  import FullCalendarWrapper from './FullCalendarWrapper.svelte';
  import { onMount } from 'svelte';
  import { schedulesStore } from '../stores';
  import { get } from 'svelte/store';
  import { Draggable } from '@fullcalendar/interaction';

  type CalendarEvent = {
    id: string;
    title: string;
    start: string;
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
  let usedItems = new Set<string>(); // Track used items by their unique identifier

  function prepareCalendarEvents() {
    // Start with empty calendar - no default events
    calendarEvents = [];
  }

  function handleEventRemove(eventInfo: any) {
    // Remove the event from our local state
    calendarEvents = calendarEvents.filter(event => event.id !== eventInfo.event.id);
    
    // Mark the item as available again
    const event = eventInfo.event;
    const itemKey = `${event.extendedProps.scheduleId}-${event.extendedProps.infoIndex}`;
    usedItems.delete(itemKey);
    usedItems = usedItems; // Trigger reactivity
  }

  function handleEventAdd(newEvent: any) {
    // Add the new event to our local state
    calendarEvents = [...calendarEvents, newEvent];
    
    // Mark the item as used
    const itemKey = `${newEvent.extendedProps.scheduleId}-${newEvent.extendedProps.infoIndex}`;
    usedItems.add(itemKey);
    usedItems = usedItems; // Trigger reactivity
  }

  function isItemUsed(scheduleId: number, infoIndex: number): boolean {
    return usedItems.has(`${scheduleId}-${infoIndex}`);
  }

  function hasUnusedItems(schedule: any): boolean {
    return schedule.information.some((info: any, infoIndex: number) => 
      !isItemUsed(schedule.id, infoIndex)
    );
  }

  onMount(() => {
    prepareCalendarEvents();

    const externalItems = document.getElementById('external-items');
    if (externalItems) {
      new Draggable(externalItems, {
        itemSelector: '.fc-draggable',
        eventData(el) {
          const eventData = el.getAttribute('data-event');
          return eventData ? JSON.parse(eventData) : null;
        }
      });
    }
  });
</script>

<div class="grid grid-cols-12 gap-6">
  <div class="col-span-4 bg-white rounded-lg border border-gray-200 p-6">
    <h3 class="text-lg font-medium text-gray-900 mb-6">Drag Items</h3>
    <div id="external-items" class="space-y-6">
      {#each $schedulesStore as schedule, index}
        {#if hasUnusedItems(schedule)}
          <div class="company-container mb-6">
            <div 
              class="flex items-center justify-between bg-[rgb(30,30,30)] text-white px-3 py-2 rounded-t mb-3"
              data-label="company-title"
            >
              <h4 class="text-md font-semibold">{schedule.company}</h4>
              <div 
                class="w-3 h-3 rounded-full" 
                style="background-color: hsl({(index * 40) % 360}, 70%, 60%)">
              </div>
            </div>
            <div class="company-items space-y-4">
              {#each schedule.information as info, infoIndex}
                {#if !isItemUsed(schedule.id, infoIndex)}
                  <div
                    class="p-3 rounded text-white fc-draggable"
                    style="background-color: hsl({(index * 40) % 360}, 70%, 60%)"
                    data-event={JSON.stringify({
                      title: `${schedule.company} - ${info.sub_company_name}`,
                      extendedProps: {
                        location: info.location,
                        company: schedule.company,
                        scheduleId: schedule.id,
                        infoIndex: infoIndex
                      },
                      backgroundColor: `hsl(${(index * 40) % 360}, 70%, 60%)`
                    })}
                  >
                    <div class="font-medium text-sm">{info.sub_company_name}</div>
                    <div class="text-xs opacity-80">{info.location}</div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  </div>

  <div class="col-span-8 bg-white rounded-lg border border-gray-200 p-6">
    <h3 class="text-lg font-medium text-gray-900 mb-6">Schedule Calendar</h3>
    <FullCalendarWrapper 
      events={calendarEvents} 
      onEventRemove={handleEventRemove}
      onEventAdd={handleEventAdd}
    />
  </div>
</div>

<style>
  .fc .fc-event {
    cursor: pointer;
  }

  #external-items {
    cursor: pointer;
  }
</style>
