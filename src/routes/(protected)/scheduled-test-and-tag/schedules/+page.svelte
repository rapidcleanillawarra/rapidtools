<script lang="ts">
  import FullCalendarWrapper from './FullCalendarWrapper.svelte';
  import { onMount } from 'svelte';
  import { schedulesStore } from '../stores';
  import { get } from 'svelte/store';
  import { Draggable } from '@fullcalendar/interaction';

  type CalendarEvent = {
    title: string;
    start: string;
    extendedProps: {
      location: string;
      company: string;
    };
    backgroundColor: string;
  };

  let calendarEvents: CalendarEvent[] = [];

  function prepareCalendarEvents() {
    const schedules = get(schedulesStore);
    const today = new Date();
    const events: CalendarEvent[] = [];

    schedules.forEach((schedule, index) => {
      const baseMonth = schedule.start_month - 1;
      schedule.information.forEach((info, i) => {
        for (let j = 0; j < schedule.occurence; j++) {
          const date = new Date(today.getFullYear(), baseMonth + j, 5 + i);
          events.push({
            title: `${schedule.company} - ${info.sub_company_name}`,
            start: date.toISOString().split('T')[0],
            extendedProps: {
              location: info.location,
              company: schedule.company
            },
            backgroundColor: `hsl(${(index * 40) % 360}, 70%, 60%)`
          });
        }
      });
    });

    calendarEvents = events;
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
            {#each schedule.information as info}
              <div
                class="p-3 rounded text-white fc-draggable"
                style="background-color: hsl({(index * 40) % 360}, 70%, 60%)"
                data-event={JSON.stringify({
                  title: `${schedule.company} - ${info.sub_company_name}`,
                  extendedProps: {
                    location: info.location,
                    company: schedule.company
                  },
                  backgroundColor: `hsl(${(index * 40) % 360}, 70%, 60%)`
                })}
              >
                <div class="font-medium text-sm">{info.sub_company_name}</div>
                <div class="text-xs opacity-80">{info.location}</div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="col-span-8 bg-white rounded-lg border border-gray-200 p-6">
    <h3 class="text-lg font-medium text-gray-900 mb-6">Schedule Calendar</h3>
    <FullCalendarWrapper events={calendarEvents} />
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
