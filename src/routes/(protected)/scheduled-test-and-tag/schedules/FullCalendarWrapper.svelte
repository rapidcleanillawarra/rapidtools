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
          
          // The calendar is showing July but dateInfo.start is June 29
          // We need to determine the actual month being displayed
          // If we're in the last few days of June but seeing July, it's July
          const startMonth = dateInfo.start.getMonth();
          const startDate = dateInfo.start.getDate();
          
          // If we're past the 25th of a month, we're likely viewing the next month
          let currentMonth = startMonth + 1;
          if (startDate < 25) {
            currentMonth = startMonth + 1;
          } else {
            currentMonth = startMonth + 2;
          }
          
          // Handle December to January transition
          if (currentMonth > 12) {
            currentMonth = 1;
          }
          
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
</style>
