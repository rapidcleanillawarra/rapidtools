<script lang="ts">
  import { onMount } from 'svelte';
  import { Calendar } from '@fullcalendar/core';
  import dayGridPlugin from '@fullcalendar/daygrid';
  import interactionPlugin from '@fullcalendar/interaction';
  import type { EventInput } from '@fullcalendar/core';

  export let events: EventInput[] = [];
  export let onMonthChange: ((month: number) => void) | undefined = undefined;
  export let onEventRemove: ((eventId: string) => void) | undefined = undefined;
  export let onEventClick: ((event: any) => void) | undefined = undefined;
  
  let calendarEl: HTMLElement;
  let calendar: Calendar;
  let previousMonth: number = new Date().getMonth() + 1;

  onMount(() => {
    calendar = new Calendar(calendarEl, {
      plugins: [dayGridPlugin, interactionPlugin],
      initialView: 'dayGridMonth',
      editable: false,
      droppable: false,
      events,
      datesSet: (dateInfo) => {
        if (onMonthChange) {
          console.log('DEBUG - dateInfo.start:', dateInfo.start);
          console.log('DEBUG - dateInfo.start.getMonth():', dateInfo.start.getMonth());
          
          // Get the current date being displayed by the calendar
          const currentDate = calendar.getDate();
          const currentMonth = currentDate.getMonth() + 1;
          
          console.log('DEBUG - calendar.getDate():', currentDate);
          console.log('DEBUG - calculated currentMonth:', currentMonth);
          
          let direction = 'same';
          if (currentMonth > previousMonth) {
            direction = 'next';
          } else if (currentMonth < previousMonth) {
            direction = 'previous';
          }
          
          console.log('Calendar direction:', direction, 'from', previousMonth, 'to', currentMonth);
          previousMonth = currentMonth;
          onMonthChange(currentMonth);
        }
      },
      eventClick: (info) => {
        if (onEventClick) {
          onEventClick(info.event);
        }
      },
      eventDidMount: (eventInfo) => {
        const eventEl = eventInfo.el;
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '×';
        removeBtn.className = 'event-remove-btn';
        removeBtn.style.cssText = `
          position: absolute;
          top: -5px;
          right: -5px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ef4444;
          color: white;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          display: none;
          z-index: 10;
        `;
        
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onEventRemove) {
            onEventRemove(eventInfo.event.id);
          }
        });
        
        eventEl.style.position = 'relative';
        eventEl.appendChild(removeBtn);
        
        eventEl.addEventListener('mouseenter', () => {
          removeBtn.style.display = 'block';
        });
        
        eventEl.addEventListener('mouseleave', () => {
          removeBtn.style.display = 'none';
        });
      }
    });

    calendar.render();
  });

  $: if (calendar && events) {
    calendar.removeAllEvents();
    calendar.addEventSource(events);
  }
</script>

<div bind:this={calendarEl} class="fc-wrapper"></div>

<style>
  .fc-wrapper {
    max-width: 100%;
  }

  .event-remove-btn:hover {
    background: #dc2626 !important;
  }

  /* Make calendar events show pointer cursor on hover */
  .fc-event {
    cursor: pointer !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
  }

  .fc-event:hover {
    cursor: pointer !important;
  }

  /* Prevent text selection on event content */
  .fc-event-main {
    cursor: pointer !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
  }

  .fc-event-title {
    cursor: pointer !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
  }
</style>
