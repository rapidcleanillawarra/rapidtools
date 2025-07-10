<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';

  let printFrame: HTMLIFrameElement;

  onMount(() => {
    // Create a hidden iframe for printing
    printFrame = document.createElement('iframe');
    printFrame.style.display = 'none';
    document.body.appendChild(printFrame);

    return () => {
      document.body.removeChild(printFrame);
    };
  });

  function handlePrint() {
    const printContent = document.querySelector('.template-box');
    if (!printContent || !printFrame || !printFrame.contentWindow) return;

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @page { size: 255pt 610pt; margin: 0; }
            body { margin: 0; padding: 0; }
            .template-box { transform: scale(0.75); transform-origin: top left; }
          </style>
        </head>
        <body>
          ${printContent.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    printFrame.contentWindow.focus();
    printFrame.contentWindow.print();
  }
</script>

<div class="container mx-auto px-4 py-8" in:fade>
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200">
      <h1 class="text-xl font-semibold">Promax Template</h1>
      <p class="text-gray-600">Configure and preview your Promax template layout.</p>
    </div>

    <div class="p-6">
      <div class="grid grid-cols-12 gap-6">
        <!-- Preview Area (8 columns) -->
        <div class="col-span-12 lg:col-span-8">
          <div class="bg-gray-50 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-medium">Template Preview</h2>
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-600">Dimensions: 255pt × 610pt</span>
                <button 
                  class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  on:click={() => window.location.reload()}
                >
                  Refresh Preview
                </button>
                <button 
                  class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center gap-1"
                  on:click={handlePrint}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
              </div>
            </div>
            <div class="border rounded-lg p-4 bg-white overflow-auto">
              <div class="flex items-center justify-center">
                <!-- Template Box with exact dimensions -->
                <div class="relative">
                  <div class="template-box border-2 border-dashed border-gray-300 bg-white">
                    <!-- Branding Background -->
                    <div class="branding-background">
                      <!-- Company Logo -->
                      <div class="company-logo">
                        <div class="company-logo-box flex items-center justify-center">
                          <img 
                            src="https://www.rapidsupplies.com.au/assets/images/company_logo_white.png" 
                            alt="Rapid Supplies Logo"
                            class="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                      <!-- Company Details -->
                      <div class="company-details">
                        <div class="company-details-box flex flex-col items-center justify-center text-white">
                          <div>4227 2833</div>
                          <div>www.rapidsupplies.com.au</div>
                        </div>
                      </div>
                    </div>
                    <!-- Instruction -->
                    <div class="instruction">
                      <div class="text-center">Turn off tap when not in use</div>
                    </div>
                    <!-- Green Arc Overlay (Top) -->
                    <div class="green-arc-top">
                      <img 
                        src="/images/green_arc.png" 
                        alt="Green Arc Top"
                        class="w-full h-full object-cover"
                      />
                    </div>
                    <!-- Product Dial Container -->
                    <div class="product-dial">
                      <div class="product-dial-grid">
                        <div class="product-section border-r border-b border-white/20">
                          <div class="text-white">Top Left</div>
                        </div>
                        <div class="product-section border-b border-white/20">
                          <div class="text-white">Top Right</div>
                        </div>
                        <div class="product-section border-r border-white/20">
                          <div class="text-white">Bottom Left</div>
                        </div>
                        <div class="product-section">
                          <div class="text-white">Bottom Right</div>
                        </div>
                      </div>
                    </div>
                    <!-- Green Arc Overlay (Bottom) -->
                    <div class="green-arc-bottom">
                      <img 
                        src="/images/green_arc.png" 
                        alt="Green Arc Bottom"
                        class="w-full h-full object-cover"
                      />
                    </div>
                    <!-- Template Area Label -->
                    <div class="absolute bottom-0 left-0 w-full h-[413.33px] flex items-center justify-center text-gray-400">
                      Template Area
                    </div>
                  </div>
                  <!-- Dimension Indicators -->
                  <div class="absolute -right-6 top-1/2 -translate-y-1/2 transform rotate-90 text-xs text-gray-500">
                    610pt (813.33px)
                  </div>
                  <div class="absolute bottom-[-20px] left-1/2 -translate-x-1/2 text-xs text-gray-500">
                    255pt (340px)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Configuration Area (4 columns) -->
        <div class="col-span-12 lg:col-span-4">
          <div class="bg-gray-50 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-medium">Configuration</h2>
              <button class="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
                Save
              </button>
            </div>
            <div class="space-y-4">
              <div class="text-sm text-gray-500">
                Configure your template settings here. Changes will be reflected in the preview.
              </div>
              <div class="border rounded-lg p-4 bg-white">
                <p class="text-gray-500">Configuration options coming soon...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .template-box {
    width: 340px; /* 255pt * 1.333333 */
    height: 813.33px; /* 610pt * 1.333333 */
    position: relative;
  }
  .branding-background {
    width: 340px; /* 255pt * 1.333333 */
    height: 307px; /* 230pt * 1.333333 */
    position: relative;
    background-color: rgb(0, 0, 0);
    border-top-left-radius: 12%;
    border-top-right-radius: 12%;
  }
  .company-logo {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 67px; /* 50pt * 1.333333 */
  }
  .company-logo-box {
    width: 200px; /* 150pt * 1.333333 */
    height: 67px; /* 50pt * 1.333333 */
  }
  .company-details {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 154px; /* (50pt + 15pt + logo height) * 1.333333 */
    font-weight: 600;
  }
  .company-details-box {
    width: 213.33px; /* 160pt * 1.333333 */
    height: 40px; /* 30pt * 1.333333 */
  }
  .instruction {
    position: absolute;
    top: 380.33px; /* (230pt + 55pt) * 1.333333 */
    left: 50%;
    transform: translateX(-50%);
    width: 340px; /* 255pt * 1.333333 */
    font-size: 16px;
    font-weight: 500;
    z-index: 2;
  }
  .green-arc-top {
    position: absolute;
    top: 100px;
    left: 0;
    width: 340px; /* 255pt * 1.333333 */
    height: auto;
    z-index: 1;
  }
  .green-arc-bottom {
    position: absolute;
    top: 290px;
    left: 0;
    width: 340px; /* 255pt * 1.333333 */
    height: auto;
    z-index: 0; /* Lower z-index so it appears behind the product dial */
  }
  .product-dial {
    position: absolute;
    top: 467px; /* (230pt + 119.8pt) * 1.333333 */
    left: 0;
    width: 340px; /* 255pt * 1.333333 */
    height: 346.33px; /* Remaining space to bottom: 813.33px - 467px */
    background-color: rgb(0, 0, 0);
    border-bottom-left-radius: 12%;
    border-bottom-right-radius: 12%;
    padding: 0;
    z-index: 2; /* Higher z-index to overlay the green arc */
  }
  .product-dial-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    width: 100%;
    height: 100%;
  }
  .product-section {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    font-size: 16px;
  }
</style> 