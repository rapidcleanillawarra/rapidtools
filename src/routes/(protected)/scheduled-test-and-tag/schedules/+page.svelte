<script lang="ts">
  import { schedulesStore } from '../stores';
  import { onMount } from 'svelte';
  
  let isLoading = true;
  let error: string | null = null;
  
  // Drag and drop state
  let draggedItem: any = null;
  let draggedOverDate: number | null = null;
  let scheduledItems: { [key: string]: any[] } = {};
  
  function hsvToHex(h: number, s: number, v: number) {
    let r: number = 0, g: number = 0, b: number = 0;

    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);

    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }

    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function getDistinctColors(n = 25) {
    const colors = [];
    for (let i = 0; i < n; i++) {
      const h = i / n;      // hue: 0.0 to 1.0
      const s = 0.75;       // saturation
      const v = 0.9;        // brightness
      colors.push(hsvToHex(h, s, v));
    }
    return colors;
  }
  
  const companyColors = getDistinctColors();
  
  // Month selector state
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const currentDate = new Date();
  let selectedMonth = currentDate.getMonth(); // 0-11
  let selectedYear = currentDate.getFullYear();
  let showMonthDropdown = false;
  
  // We can load data asynchronously here if needed, but for now we are using static data
  onMount(() => {
    isLoading = false;
  });
  
  function previousMonth() {
    if (selectedMonth === 0) {
      selectedMonth = 11;
      selectedYear--;
    } else {
      selectedMonth--;
    }
  }
  
  function nextMonth() {
    if (selectedMonth === 11) {
      selectedMonth = 0;
      selectedYear++;
    } else {
      selectedMonth++;
    }
  }
  
  function selectMonth(monthIndex: number) {
    selectedMonth = monthIndex;
    showMonthDropdown = false;
  }
  
  function toggleMonthDropdown() {
    showMonthDropdown = !showMonthDropdown;
  }

  function getCalendarDays(year: number, month: number) {
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: (number | null)[] = [];
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday, 6 for Saturday

    // Add days from previous month to fill the grid
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add days from the current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  }
  
  // Simple HTML5 drag and drop functions
  function handleDragStart(event: DragEvent, item: any) {
    draggedItem = item;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify(item));
    }
  }
  
  function handleDragOver(event: DragEvent, date: number) {
    event.preventDefault();
    draggedOverDate = date;
  }
  
  function handleDragLeave(event: DragEvent) {
    draggedOverDate = null;
  }
  
  function handleDrop(event: DragEvent, date: number) {
    event.preventDefault();
    if (draggedItem && date) {
      const dateKey = `${selectedYear}-${selectedMonth + 1}-${date}`;
      if (!scheduledItems[dateKey]) {
        scheduledItems[dateKey] = [];
      }
      scheduledItems[dateKey].push(draggedItem);
      scheduledItems = scheduledItems; // Trigger reactivity
    }
    draggedItem = null;
    draggedOverDate = null;
  }
  
  function getScheduledItemsForDate(date: number) {
    const dateKey = `${selectedYear}-${selectedMonth + 1}-${date}`;
    return scheduledItems[dateKey] || [];
  }
  
  function removeScheduledItem(date: number, itemIndex: number) {
    const dateKey = `${selectedYear}-${selectedMonth + 1}-${date}`;
    if (scheduledItems[dateKey]) {
      scheduledItems[dateKey].splice(itemIndex, 1);
      scheduledItems = scheduledItems; // Trigger reactivity
    }
  }
  
  // Generate unique ID for items
  function generateItemId(company: string, subCompany: string, location: string, companyIndex: number) {
    return `${companyIndex}-${company.replace(/\s+/g, '-')}-${subCompany.replace(/\s+/g, '-')}-${location.replace(/\s+/g, '-')}`.toLowerCase();
  }
  
  // Process company data with IDs
  function processCompanyData(schedule: any, companyIndex: number) {
    if (!schedule || !schedule.information) return [];
    return schedule.information.map((info: any) => ({
      ...info,
      company: schedule.company,
      company_index: companyIndex,
      id: generateItemId(schedule.company, info.sub_company_name, info.location, companyIndex)
    }));
  }
</script>

{#if isLoading}
  <div class="flex justify-center items-center h-64">
    <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
{:else if error}
  <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
    <strong class="font-bold">Error!</strong>
    <span class="block sm:inline"> {error}</span>
  </div>
{:else}
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-lg font-medium text-gray-900">Test & Tag Schedules</h2>
      <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
        Add New Schedule
      </button>
    </div>
    
    <!-- Month Selector -->
    <div class="flex items-center justify-center space-x-4 bg-white p-4 rounded-lg border border-gray-200">
      <button 
        on:click={previousMonth}
        class="p-2 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="Previous month"
      >
        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
      </button>
      
      <div class="relative">
        <button 
          on:click={toggleMonthDropdown}
          class="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-gray-100 transition-colors min-w-[200px] justify-center"
        >
          <span class="text-lg font-semibold text-gray-900">
            {months[selectedMonth]} {selectedYear}
          </span>
          <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>
        
        {#if showMonthDropdown}
          <div class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
            {#each months as month, index}
              <button 
                on:click={() => selectMonth(index)}
                class="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors {selectedMonth === index ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}"
              >
                {month} {selectedYear}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      
      <button 
        on:click={nextMonth}
        class="p-2 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="Next month"
      >
        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </button>
    </div>
    
    <!-- Schedule Container -->
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-4 bg-white rounded-lg border border-gray-200 p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Left Column</h3>
        <div class="space-y-4">
          {#each $schedulesStore as schedule, index (schedule.id)}
            <div class="company-container border border-gray-200 rounded p-4">
              <h4 class="text-md font-semibold text-white mb-2 bg-[rgb(30,30,30)] p-2 rounded flex items-center justify-between">
                <span>{schedule.company}</span>
                <div class="w-3 h-3 rounded-full" style="background-color: {companyColors[index % companyColors.length]}"></div>
              </h4>
              <div class="company-information">
                <div class="space-y-3">
                  {#each processCompanyData(schedule, index) as item, itemIndex}
                    <div 
                      draggable="true"
                      on:dragstart={(event) => handleDragStart(event, item)}
                      class="company-information-item text-white p-3 rounded cursor-move hover:opacity-80 transition-opacity" 
                      style="background-color: {companyColors[item.company_index % companyColors.length]}"
                    >
                      <div class="font-medium text-sm">{item.sub_company_name}</div>
                      <div class="text-xs opacity-80">{item.location}</div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
      
      <div class="col-span-8 bg-white rounded-lg border border-gray-200 p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Calendar View</h3>
        
        <!-- Calendar Header -->
        <div class="grid grid-cols-7 gap-1 mb-2">
          {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
            <div class="text-center text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          {/each}
        </div>
        
        <!-- Calendar Grid -->
        <div class="grid grid-cols-7 gap-1">
          {#each getCalendarDays(selectedYear, selectedMonth) as day, index}
            {#if day === null}
              <!-- Empty cell for days outside the month -->
              <div class="h-12 border border-gray-100 bg-gray-50"></div>
            {:else}
              <!-- Date cell -->
              <div 
                on:dragover={(event) => handleDragOver(event, day)}
                on:dragleave={handleDragLeave}
                on:drop={(event) => handleDrop(event, day)}
                data-date={day}
                class="h-24 border border-gray-200 bg-white p-1 relative hover:bg-gray-50 transition-colors {draggedOverDate === day ? 'bg-blue-50 border-blue-300' : ''}"
              >
                <div class="text-sm text-gray-900 font-medium mb-1">
                  {day}
                </div>
                <!-- Scheduled items display -->
                <div class="space-y-1 max-h-16 overflow-y-auto">
                  {#each getScheduledItemsForDate(day) as item, itemIndex}
                    <div 
                      class="text-xs p-1 rounded text-white flex items-center justify-between group"
                      style="background-color: {companyColors[item.company_index % companyColors.length]}"
                    >
                      <div class="truncate flex-1">
                        <div class="font-medium">{item.sub_company_name}</div>
                        <div class="opacity-80">{item.location}</div>
                      </div>
                      <button 
                        on:click={() => removeScheduledItem(day, itemIndex)}
                        class="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-white hover:text-red-200"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}