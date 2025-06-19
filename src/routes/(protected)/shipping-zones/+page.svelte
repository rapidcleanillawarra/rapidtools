<script lang="ts">
  // No functionality needed for a static page
  let iframeError = false;
  
  function handleIframeError() {
    iframeError = true;
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="flex flex-wrap">
    <!-- Left column (2/3 width) -->
    <div class="w-full md:w-2/3 p-4">
      <h1 class="text-2xl font-bold mb-4">Shipping Zones</h1>
      <div class="w-full h-full min-h-[500px]">
        {#if !iframeError}
          <iframe 
            src="https://www.google.com/maps/d/u/4/embed?mid=1gnVo1MlF89jpjg_JQ6MESa0PKzQTDYY&ehbc=2E312F&noprof=1" 
            class="w-full h-full border-0"
            allowfullscreen
            title="Shipping Zones Map"
            on:error={handleIframeError}
          ></iframe>
        {:else}
          <div class="w-full h-full min-h-[500px] bg-gray-100 flex items-center justify-center border rounded">
            <div class="text-center p-8">
              <h3 class="text-lg font-semibold text-gray-700 mb-2">Map Unavailable</h3>
              <p class="text-gray-600 mb-4">The shipping zones map cannot be displayed at this time.</p>
              <a 
                href="https://www.google.com/maps/d/u/4/embed?mid=1gnVo1MlF89jpjg_JQ6MESa0PKzQTDYY&ehbc=2E312F&noprof=1"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                View Map in New Tab
              </a>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Right column (1/3 width) -->
    <div class="w-full md:w-1/3 p-4">
      <!-- Zones Legend -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold mb-4">Zones</h1>
        <div class="space-y-3">
          <div class="flex items-center space-x-3">
            <div class="w-4 h-4 rounded-sm" style="background-color: #e15f59;"></div>
            <span class="text-lg text-gray-800">Local</span>
          </div>
          <div class="flex items-center space-x-3">
            <div class="w-4 h-4 rounded-sm" style="background-color: #f6e854;"></div>
            <span class="text-lg text-gray-800">South</span>
          </div>
          <div class="flex items-center space-x-3">
            <div class="w-4 h-4 rounded-sm" style="background-color: #e6ab48;"></div>
            <span class="text-lg text-gray-800">North</span>
          </div>
          <div class="flex items-center space-x-3">
            <div class="w-4 h-4 rounded-sm" style="background-color: #5b9ba9;"></div>
            <span class="text-lg text-gray-800">West / Highlands</span>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <hr class="border-gray-300 mb-8">

      <!-- Delivery Fee Information -->
      <div>
        <h2 class="text-2xl font-bold mb-4">Delivery Fee</h2>
        
        <!-- Local -->
        <div class="mb-6">
          <div class="flex items-center space-x-2 mb-2">
            <span class="text-lg font-medium text-gray-800">Local</span>
            <div class="w-3 h-3 rounded-sm" style="background-color: #e15f59;"></div>
          </div>
          <div class="ml-1 space-y-1">
            <p class="text-gray-700">Free delivery over $150</p>
            <p class="text-gray-700">Flat $20 delivery under $150</p>
          </div>
        </div>

        <!-- Non Local -->
        <div>
          <div class="flex items-center space-x-2 mb-2">
            <span class="text-lg font-medium text-gray-800">Non Local</span>
            <div class="w-3 h-3 rounded-sm mr-1" style="background-color: #f6e854;"></div>
            <div class="w-3 h-3 rounded-sm mr-1" style="background-color: #e6ab48;"></div>
            <div class="w-3 h-3 rounded-sm" style="background-color: #5b9ba9;"></div>
          </div>
          <div class="ml-1 space-y-1">
            <p class="text-gray-700">Free delivery over $200</p>
            <p class="text-gray-700">Flat $30 delivery under $150</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div> 