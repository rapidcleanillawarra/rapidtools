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
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ef4444;
          color: white;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: bold;
          line-height: 1;
          display: none;
          z-index: 10;
          box-shadow: 0 2px 4px rgba(0,0,0,0.4);
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

  /* FullCalendar Dark Theme Overrides */
  :global(.fc) {
    --fc-border-color: #262a30;
    --fc-page-bg-color: #141619;
    --fc-neutral-bg-color: #181b20;
    --fc-neutral-text-color: #9ca3af;
    --fc-today-bg-color: rgba(132, 204, 22, 0.08);
    font-family: inherit;
    color: #e5e7eb;
  }

  :global(.fc .fc-toolbar) {
    margin-bottom: 1.25rem !important;
  }

  :global(.fc .fc-toolbar-title) {
    color: #ffffff !important;
    font-size: 1.25rem !important;
    font-weight: 700 !important;
    letter-spacing: -0.02em;
  }

  :global(.fc .fc-button-primary) {
    background-color: #1f2329 !important;
    border-color: #333842 !important;
    color: #e5e7eb !important;
    font-size: 0.8125rem !important;
    font-weight: 600 !important;
    border-radius: 0.5rem !important;
    padding: 0.4rem 0.75rem !important;
    box-shadow: none !important;
    transition: all 150ms ease !important;
    text-transform: capitalize !important;
  }

  :global(.fc .fc-button-primary:hover) {
    background-color: #262a30 !important;
    color: #a3e635 !important;
    border-color: #84cc16 !important;
  }

  :global(.fc .fc-button-primary:focus) {
    box-shadow: 0 0 0 2px rgba(132, 204, 22, 0.4) !important;
  }

  :global(.fc .fc-button-primary:disabled) {
    background-color: #141619 !important;
    border-color: #262a30 !important;
    color: #6b7280 !important;
    opacity: 0.5 !important;
  }

  :global(.fc .fc-button-primary.fc-button-active) {
    background-color: #84cc16 !important;
    border-color: #84cc16 !important;
    color: #090a0b !important;
  }

  :global(.fc-theme-standard th),
  :global(.fc-theme-standard td),
  :global(.fc-theme-standard .fc-scrollgrid) {
    border-color: #262a30 !important;
  }

  :global(.fc .fc-col-header-cell) {
    background-color: #181b20 !important;
    padding: 0.5rem 0 !important;
  }

  :global(.fc .fc-col-header-cell-cushion) {
    color: #9ca3af !important;
    font-size: 0.75rem !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.05em;
  }

  :global(.fc .fc-daygrid-day) {
    background-color: #141619;
    transition: background-color 150ms ease;
  }

  :global(.fc .fc-daygrid-day:hover) {
    background-color: #181b20;
  }

  :global(.fc .fc-daygrid-day-number) {
    color: #9ca3af !important;
    font-size: 0.8125rem !important;
    font-weight: 500 !important;
    padding: 0.375rem 0.5rem !important;
  }

  :global(.fc .fc-day-today) {
    background-color: rgba(132, 204, 22, 0.06) !important;
  }

  :global(.fc .fc-day-today .fc-daygrid-day-number) {
    color: #a3e635 !important;
    font-weight: 700 !important;
  }

  :global(.fc .fc-day-other) {
    background-color: rgba(14, 16, 18, 0.6) !important;
  }

  :global(.fc .fc-day-other .fc-daygrid-day-number) {
    color: #4b5563 !important;
  }

  :global(.fc .fc-daygrid-day-frame) {
    min-height: 5rem;
  }

  :global(.fc-event) {
    border: none !important;
    border-radius: 0.375rem !important;
    padding: 2px 4px !important;
    font-size: 0.75rem !important;
    font-weight: 600 !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
    margin: 1px 2px !important;
    cursor: pointer !important;
    user-select: none !important;
    transition: all 150ms ease !important;
  }

  :global(.fc-event:hover) {
    transform: scale(1.02);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35) !important;
  }

  :global(.fc-event-main),
  :global(.fc-event-title) {
    cursor: pointer !important;
    user-select: none !important;
  }
</style>
