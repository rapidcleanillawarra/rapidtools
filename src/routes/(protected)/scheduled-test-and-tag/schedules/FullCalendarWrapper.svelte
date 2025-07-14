<script lang="ts">
  import { onMount } from 'svelte';
  import { Calendar } from '@fullcalendar/core';
  import dayGridPlugin from '@fullcalendar/daygrid';
  import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
  import type { EventInput } from '@fullcalendar/core';

  export let events: EventInput[] = [];
  export let editable = true;
  export let droppable = true;
  export let onEventRemove: ((eventInfo: any) => void) | undefined = undefined;
  export let onEventAdd: ((eventInfo: any) => void) | undefined = undefined;
  export let removeAfterDrop = true; // New prop with default value

  let calendarEl: HTMLElement;
  let calendar: Calendar;

  onMount(() => {
    calendar = new Calendar(calendarEl, {
      plugins: [dayGridPlugin, interactionPlugin],
      initialView: 'dayGridMonth',
      editable,
      droppable,
      events,
      drop: (dropInfo) => {
        // Handle external item drop
        if (onEventAdd) {
          const eventData = dropInfo.draggedEl.getAttribute('data-event');
          if (eventData) {
            const parsedEvent = JSON.parse(eventData);
            const newEvent = {
              ...parsedEvent,
              id: `dropped-${Date.now()}-${Math.random()}`,
              start: dropInfo.dateStr
            };
            onEventAdd(newEvent);
            // Remove the dragged element only after successfully adding the event
            // dropInfo.draggedEl.remove(); // This line is removed as per the edit hint
          }
        }
      },
      eventRemove: (eventInfo) => {
        if (onEventRemove) {
          onEventRemove(eventInfo);
        }
      },
      eventDidMount: (eventInfo) => {
        // Add remove button to events
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
          calendar.getEventById(eventInfo.event.id)?.remove();
        });
        
        eventEl.style.position = 'relative';
        eventEl.appendChild(removeBtn);
        
        // Show remove button on hover
        eventEl.addEventListener('mouseenter', () => {
          removeBtn.style.display = 'block';
        });
        
        eventEl.addEventListener('mouseleave', () => {
          removeBtn.style.display = 'none';
        });
      },
      eventReceive: (info) => {
        if (removeAfterDrop && info.draggedEl) {
          info.draggedEl.remove();
        }
      }
    });

    calendar.render();

    // Initialize Draggable for external elements
    const externalEvents = document.getElementById('external-events');
    if (externalEvents) {
      new Draggable(externalEvents, {
        itemSelector: '.fc-event',
        eventData: function(eventEl) {
          return {
            title: eventEl.innerText,
            duration: '02:00'
          };
        }
      });
    } else {
      console.warn('Element with id "external-events" not found. Draggable not initialized.');
    }
  });

  // Update events when the prop changes
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
