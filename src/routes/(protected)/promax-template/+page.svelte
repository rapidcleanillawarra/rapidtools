<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { db } from '$lib/firebase';
  import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
  import { userProfile } from '$lib/userProfile';

  // Asset paths using base for proper deployment
  const bottleSvg = `${base}/images/bottle.svg`;
  const bucketSvg = `${base}/images/bucket.svg`;
  const scrubberSvg = `${base}/images/scrubber.svg`;
  const sinkFillSvg = `${base}/images/sink_fill.svg`;
  const greenArcPng = `${base}/images/green_arc.png`;

  let selectedElement: string | null = null;
  
  type SectionKey = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  type ElementType = 'title' | 'code' | 'logo' | 'description';
  
  // Add interface for template products
  interface TemplateProduct {
    brand: string;
    code: string;
    color: string;
    name: string;
    image?: string;
    imageUrl?: string;
  }

  // Add state for template products and search
  let templateProducts: TemplateProduct[] = [];
  let searchQuery = '';
  let isLoading = false;
  let isPrinting = false;
  
  // Add state for template history
  let templateHistory: any[] = [];
  let isLoadingHistory = false;
  
  // Add currentSelection object to track detailed selection state
  let currentSelection = {
    section: null as string | null,
    elementType: null as string | null,
    value: null as string | null,
    position: null as string | null
  };

  const defaultTemplateData = {
    topLeft: {
      title: "FLORAL",
      code: "K2",
      logo: bottleSvg,
      description: "Air Freshener",
      color: "#EC4899" // Magenta/Pink color
    },
    topRight: {
      title: "Lime Fresh",
      code: "844",
      logo: bottleSvg,
      description: "Disinfectant Cleaner",
      color: "#FEF08A" // Yellow color
    },
    bottomLeft: {
      title: "HI GENIC",
      code: "H4",
      logo: bottleSvg,
      description: "Bathroom Cleaner",
      color: "#5EEAD4" // Teal color
    },
    bottomRight: {
      title: "REFLECTION",
      code: "H3",
      logo: bottleSvg,
      description: "Glass Cleaner",
      color: "#60A5FA" // Blue color
    },
    instruction: "Turn off tap when not in use"
  };

  const templateData = { ...defaultTemplateData };

  // Function to fetch template products
  async function fetchTemplateProducts() {
    isLoading = true;
    try {
      const querySnapshot = await getDocs(collection(db, 'template_products'));
      templateProducts = querySnapshot.docs.map(doc => ({
        ...doc.data() as TemplateProduct
      }));
    } catch (error) {
      console.error('Error fetching template products:', error);
    } finally {
      isLoading = false;
    }
  }

  // Computed property for filtered products
  $: filteredProducts = searchQuery
    ? templateProducts.filter(product => 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : templateProducts;

  // Function to handle product selection
  function handleProductSelect(product: TemplateProduct) {
    if (currentSelection.section && currentSelection.elementType) {
      const section = currentSelection.section as SectionKey;
      templateData[section].title = product.name;
      templateData[section].code = product.code;
      templateData[section].color = product.color;
      if (product.imageUrl) {
        templateData[section].logo = product.imageUrl;
      }
      searchQuery = '';
    }
  }

  // Function to fetch template history
  async function fetchTemplateHistory() {
    if (!$userProfile?.uid) return;
    
    isLoadingHistory = true;
    try {
      const q = query(
        collection(db, 'template_history'),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      const querySnapshot = await getDocs(q);
      templateHistory = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching template history:', error);
    } finally {
      isLoadingHistory = false;
    }
  }

  // Function to load template from history
  function loadTemplateFromHistory(historyItem: any) {
    if (historyItem.template_data) {
      const data = historyItem.template_data;
      
      // Update template data with history data
      templateData.topLeft = { ...data.topLeft };
      templateData.topRight = { ...data.topRight };
      templateData.bottomLeft = { ...data.bottomLeft };
      templateData.bottomRight = { ...data.bottomRight };
      templateData.instruction = data.instruction;
      
      console.log('Loaded template from history:', historyItem.session_id);
    }
  }

  // Fetch history when component mounts or user changes
  $: if ($userProfile?.uid) {
    fetchTemplateHistory();
  }

  // Modal state management
  let showModal = false;
  
  function openModal() {
    showModal = true;
  }
  
  function closeModal() {
    showModal = false;
    selectedElement = null;
    currentSelection = {
      section: null,
      elementType: null,
      value: null,
      position: null
    };
  }
  
  function handleModalBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }

  function selectElement(elementId: string) {
    selectedElement = elementId;
    
    // Parse the elementId to update currentSelection
    const [position, type] = elementId.split('-');
    
    // Get the current value based on position and type
    let value = null;
    if (position && type && (position as SectionKey) in templateData && type in templateData[position as SectionKey]) {
      value = templateData[position as SectionKey][type as ElementType];
    } else if (elementId === 'instruction') {
      value = templateData.instruction;
    }
    
    currentSelection = {
      section: position,
      elementType: type,
      value: value,
      position: position === 'instruction' ? 'center' : 
               position.includes('top') ? 'top' : 'bottom'
    };

    // Fetch products when selecting a title or code
    if (type === 'title' || type === 'code') {
      fetchTemplateProducts();
    }
    
    // Open the modal
    openModal();
    
    // Log the current selection state
    console.log('Current Selection:', JSON.stringify(currentSelection, null, 2));
  }

  async function handlePrint() {
    isPrinting = true;
    try {
      // Build the JSON data from current templateData
      const printData = {
        topLeft: {
          title: templateData.topLeft.title,
          code: templateData.topLeft.code,
          logo: templateData.topLeft.logo,
          description: templateData.topLeft.description,
          color: templateData.topLeft.color
        },
        topRight: {
          title: templateData.topRight.title,
          code: templateData.topRight.code,
          logo: templateData.topRight.logo,
          description: templateData.topRight.description,
          color: templateData.topRight.color
        },
        bottomLeft: {
          title: templateData.bottomLeft.title,
          code: templateData.bottomLeft.code,
          logo: templateData.bottomLeft.logo,
          description: templateData.bottomLeft.description,
          color: templateData.bottomLeft.color
        },
        bottomRight: {
          title: templateData.bottomRight.title,
          code: templateData.bottomRight.code,
          logo: templateData.bottomRight.logo,
          description: templateData.bottomRight.description,
          color: templateData.bottomRight.color
        },
        instruction: templateData.instruction
      };

      // Generate a unique session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Save to Firestore template_history collection
      const historyData = {
        session_id: sessionId,
        template_data: printData,
        created_by: $userProfile ? `${$userProfile.firstName} ${$userProfile.lastName}` : 'Unknown User',
        user_id: $userProfile?.uid || 'unknown',
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'template_history'), historyData);

      // Refresh history after saving
      fetchTemplateHistory();

      // Log the data being sent
      console.log('Print Data:', JSON.stringify(printData, null, 2));
      console.log('Saved to template_history with session ID:', sessionId);

      // Encode the data and navigate to print page
      const encodedData = encodeURIComponent(JSON.stringify(printData));
      const printUrl = `${base}/promax-template/print?data=${encodedData}`;
      
      // Open in new window for printing
      window.open(printUrl, '_blank');
    } catch (error) {
      console.error('Error saving template history:', error);
      // Still proceed with printing even if saving fails
      const printData = {
        topLeft: templateData.topLeft,
        topRight: templateData.topRight,
        bottomLeft: templateData.bottomLeft,
        bottomRight: templateData.bottomRight,
        instruction: templateData.instruction
      };
      
      const encodedData = encodeURIComponent(JSON.stringify(printData));
      const printUrl = `${base}/promax-template/print?data=${encodedData}`;
      window.open(printUrl, '_blank');
    } finally {
      isPrinting = false;
    }
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
        <!-- Preview Area (Left Side) -->
        <div class="col-span-8">
          <div class="bg-gray-50 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-medium">Template Preview</h2>
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-600">Click any element to edit</span>
                <button 
                  class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  on:click={() => window.location.reload()}
                >
                  Reset
                </button>
                <button 
                  class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  on:click={handlePrint}
                  disabled={isPrinting}
                >
                  {#if isPrinting}
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <span>Print</span>
                  {/if}
                </button>
              </div>
            </div>
            <div class="border rounded-lg p-4 bg-white overflow-auto" style="height: 950px;">
              <div class="flex items-center justify-center">
                <!-- Template Box with exact dimensions -->
                <div class="relative">
                  <div class="template-box bg-white">
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
                          <div>☎ 4227 2833</div>
                          <div>🌐rapidsupplies.com.au</div>
                        </div>
                      </div>
                    </div>
                    <!-- Instruction -->
                    <div 
                      class="instruction" 
                      class:selected={selectedElement === 'instruction'}
                      on:click={() => selectElement('instruction')}
                      on:keypress
                    >
                      <div class="text-center">{templateData.instruction}</div>
                    </div>
                    <!-- Green Arc Overlay (Top) -->
                    <div class="green-arc-top">
                      <img 
                        src="{greenArcPng}" 
                        alt="Green Arc Top"
                        class="w-full h-full object-cover object-top"
                      />
                    </div>
                    <!-- Product Dial Container -->
                    <div class="product-dial">
                      <div class="center-circle"></div>
                      <div class="product-dial-grid">
                        <!-- Top Left -->
                        <div class="product-section top-left" style="background-color: {templateData.topLeft.color};">
                          <div class="product-content">
                            <div 
                              class="product-title"
                              class:selected={selectedElement === 'topLeft-title'}
                              on:click|stopPropagation={() => selectElement('topLeft-title')}
                              on:keypress
                            >{templateData.topLeft.title}</div>
                            <div class="product-code-logo">
                              <div 
                                class="product-code"
                                class:selected={selectedElement === 'topLeft-code'}
                                on:click|stopPropagation={() => selectElement('topLeft-code')}
                                on:keypress
                              >{templateData.topLeft.code}</div>
                              <div 
                                class="product-logo-placeholder"
                                class:selected={selectedElement === 'topLeft-logo'}
                                on:click|stopPropagation={() => selectElement('topLeft-logo')}
                                on:keypress
                              >
                                <img src={templateData.topLeft.logo} alt="Product Icon" />
                              </div>
                            </div>
                          </div>
                          <div 
                            class="product-description"
                            class:selected={selectedElement === 'topLeft-description'}
                            on:click|stopPropagation={() => selectElement('topLeft-description')}
                            on:keypress
                          >{templateData.topLeft.description}</div>
                        </div>
                        <!-- Top Right -->
                        <div class="product-section top-right" style="background-color: {templateData.topRight.color};">
                          <div class="product-content">
                            <div 
                              class="product-title"
                              class:selected={selectedElement === 'topRight-title'}
                              on:click|stopPropagation={() => selectElement('topRight-title')}
                              on:keypress
                            >{templateData.topRight.title}</div>
                            <div class="product-code-logo">
                              <div 
                                class="product-code"
                                class:selected={selectedElement === 'topRight-code'}
                                on:click|stopPropagation={() => selectElement('topRight-code')}
                                on:keypress
                              >{templateData.topRight.code}</div>
                              <div 
                                class="product-logo-placeholder"
                                class:selected={selectedElement === 'topRight-logo'}
                                on:click|stopPropagation={() => selectElement('topRight-logo')}
                                on:keypress
                              >
                                <img src={templateData.topRight.logo} alt="Product Icon" />
                              </div>
                            </div>
                          </div>
                          <div 
                            class="product-description"
                            class:selected={selectedElement === 'topRight-description'}
                            on:click|stopPropagation={() => selectElement('topRight-description')}
                            on:keypress
                          >{templateData.topRight.description}</div>
                        </div>
                        <!-- Bottom Left -->
                        <div class="product-section bottom-left" style="background-color: {templateData.bottomLeft.color};">
                          <div class="product-content">
                            <div 
                              class="product-description"
                              class:selected={selectedElement === 'bottomLeft-description'}
                              on:click|stopPropagation={() => selectElement('bottomLeft-description')}
                              on:keypress
                            >{templateData.bottomLeft.description}</div>
                            <div class="product-code-logo">
                              <div 
                                class="product-code"
                                class:selected={selectedElement === 'bottomLeft-code'}
                                on:click|stopPropagation={() => selectElement('bottomLeft-code')}
                                on:keypress
                              >{templateData.bottomLeft.code}</div>
                              <div 
                                class="product-logo-placeholder"
                                class:selected={selectedElement === 'bottomLeft-logo'}
                                on:click|stopPropagation={() => selectElement('bottomLeft-logo')}
                                on:keypress
                              >
                                <img src={templateData.bottomLeft.logo} alt="Product Icon" />
                              </div>
                            </div>
                            <div 
                              class="product-title"
                              class:selected={selectedElement === 'bottomLeft-title'}
                              on:click|stopPropagation={() => selectElement('bottomLeft-title')}
                              on:keypress
                            >{templateData.bottomLeft.title}</div>
                          </div>
                        </div>
                        <!-- Bottom Right -->
                        <div class="product-section bottom-right" style="background-color: {templateData.bottomRight.color};">
                          <div class="product-content">
                            <div 
                              class="product-description"
                              class:selected={selectedElement === 'bottomRight-description'}
                              on:click|stopPropagation={() => selectElement('bottomRight-description')}
                              on:keypress
                            >{templateData.bottomRight.description}</div>
                            <div class="product-code-logo">
                              <div 
                                class="product-code"
                                class:selected={selectedElement === 'bottomRight-code'}
                                on:click|stopPropagation={() => selectElement('bottomRight-code')}
                                on:keypress
                              >{templateData.bottomRight.code}</div>
                              <div 
                                class="product-logo-placeholder"
                                class:selected={selectedElement === 'bottomRight-logo'}
                                on:click|stopPropagation={() => selectElement('bottomRight-logo')}
                                on:keypress
                              >
                                <img src={templateData.bottomRight.logo} alt="Product Icon" />
                              </div>
                            </div>
                            <div 
                              class="product-title"
                              class:selected={selectedElement === 'bottomRight-title'}
                              on:click|stopPropagation={() => selectElement('bottomRight-title')}
                              on:keypress
                            >{templateData.bottomRight.title}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <!-- Green Arc Overlay (Bottom) -->
                    <div class="green-arc-bottom">
                      <img 
                        src="{greenArcPng}" 
                        alt="Green Arc Bottom"
                        class="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- History Area (Right Side) -->
        <div class="col-span-4">
          <div class="bg-gray-50 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-medium">Template History</h2>
              <button 
                class="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                on:click={fetchTemplateHistory}
                disabled={isLoadingHistory}
              >
                {isLoadingHistory ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            
            <div class="space-y-3 max-h-[800px] overflow-y-auto">
              {#if isLoadingHistory}
                <div class="flex items-center justify-center py-8">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              {:else if templateHistory.length === 0}
                <div class="text-center py-8 text-gray-500">
                  <p>No template history found</p>
                  <p class="text-sm mt-1">Print a template to see it here</p>
                </div>
              {:else}
                {#each templateHistory as historyItem (historyItem.id)}
                  <div 
                    class="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors"
                    on:click={() => loadTemplateFromHistory(historyItem)}
                    on:keypress={(e) => e.key === 'Enter' && loadTemplateFromHistory(historyItem)}
                    tabindex="0"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="text-sm font-medium text-gray-900">
                          {historyItem.session_id}
                        </div>
                        <div class="text-xs text-gray-500 mt-1">
                          Created by: {historyItem.created_by}
                        </div>
                        <div class="text-xs text-gray-500">
                          {#if historyItem.timestamp}
                            {new Date(historyItem.timestamp.toDate()).toLocaleString()}
                          {:else}
                            Unknown date
                          {/if}
                        </div>
                      </div>
                      <div class="ml-2">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    
                    <!-- Preview of template data -->
                    <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div class="bg-gray-50 rounded p-2">
                        <div class="font-medium">Top Left</div>
                        <div class="text-gray-600">{historyItem.template_data?.topLeft?.title || 'N/A'}</div>
                      </div>
                      <div class="bg-gray-50 rounded p-2">
                        <div class="font-medium">Top Right</div>
                        <div class="text-gray-600">{historyItem.template_data?.topRight?.title || 'N/A'}</div>
                      </div>
                      <div class="bg-gray-50 rounded p-2">
                        <div class="font-medium">Bottom Left</div>
                        <div class="text-gray-600">{historyItem.template_data?.bottomLeft?.title || 'N/A'}</div>
                      </div>
                      <div class="bg-gray-50 rounded p-2">
                        <div class="font-medium">Bottom Right</div>
                        <div class="text-gray-600">{historyItem.template_data?.bottomRight?.title || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Configuration Modal -->
{#if showModal}
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    on:click={handleModalBackdropClick}
    transition:fade={{ duration: 200 }}
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Modal Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">
          {#if currentSelection.section === 'instruction'}
            Edit Instruction
          {:else if currentSelection.elementType === 'logo'}
            Select Logo
          {:else if currentSelection.elementType === 'title'}
            Edit Product Title
          {:else if currentSelection.elementType === 'code'}
            Edit Product Code
          {:else if currentSelection.elementType === 'description'}
            Edit Description
          {:else}
            Edit Element
          {/if}
        </h2>
        <button 
          class="text-gray-400 hover:text-gray-600 transition-colors"
          on:click={closeModal}
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Modal Content -->
      <div class="p-6 space-y-4">
        {#if currentSelection.section === 'instruction'}
          <div class="space-y-4">
            <div class="text-sm font-medium text-gray-700">Instruction Text</div>
            <input 
              type="text" 
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              bind:value={templateData.instruction}
              placeholder="Enter instruction text"
            />
          </div>
        {:else if currentSelection.elementType === 'logo'}
          <div class="space-y-4">
            <div class="text-sm font-medium text-gray-700">Select Logo</div>
            <select 
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              bind:value={templateData[currentSelection.section as SectionKey].logo}
            >
              <option value="{bottleSvg}">Bottle</option>
              <option value="{bucketSvg}">Bucket</option>
              <option value="{scrubberSvg}">Scrubber</option>
              <option value="{sinkFillSvg}">Sink</option>
            </select>
            <div class="flex justify-center">
              <img 
                src={templateData[currentSelection.section as SectionKey].logo} 
                alt="Selected Logo" 
                class="w-16 h-16 object-contain"
              />
            </div>
          </div>
        {:else if currentSelection.elementType === 'description'}
          <div class="space-y-4">
            <div class="text-sm font-medium text-gray-700">Description Text</div>
            <input 
              type="text" 
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              bind:value={templateData[currentSelection.section as SectionKey].description}
              placeholder="Enter description text"
            />
          </div>
        {:else if currentSelection.elementType === 'title' || currentSelection.elementType === 'code'}
          <div class="space-y-4">
            {#if currentSelection.elementType === 'title' || currentSelection.elementType === 'code'}
              <!-- Search input -->
              <div class="space-y-2">
                <div class="text-sm font-medium text-gray-700">
                  Search Products
                </div>
                <div class="relative">
                  <input 
                    type="text" 
                    class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Search by product name or brand..."
                    bind:value={searchQuery}
                  />
                  {#if isLoading}
                    <div class="absolute right-3 top-2">
                      <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Products dropdown -->
              {#if searchQuery && filteredProducts.length > 0}
                <div class="mt-1 max-h-60 overflow-auto border border-gray-200 rounded-md bg-white shadow-sm">
                  {#each filteredProducts as product (product.code)}
                    <button
                      class="w-full px-4 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 flex items-center justify-between"
                      on:click={() => handleProductSelect(product)}
                    >
                      <div>
                        <div class="font-medium">{product.name}</div>
                        <div class="text-sm text-gray-500">{product.brand}</div>
                      </div>
                      <div 
                        class="w-6 h-6 rounded-full" 
                        style="background-color: {product.color}"
                      ></div>
                    </button>
                  {/each}
                </div>
              {:else if searchQuery && filteredProducts.length === 0}
                <div class="mt-1 p-4 text-center text-gray-500 border border-gray-200 rounded-md">
                  No products found
                </div>
              {/if}

              <!-- Separator -->
              <div class="border-t border-gray-200 my-4"></div>
            {/if}

            <!-- Manual input fields -->
            <div class="text-sm font-medium text-gray-700">
              {currentSelection.elementType === 'title' ? 'Product Title' : 'Product Code'}
            </div>
            <input 
              type="text" 
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              bind:value={templateData[currentSelection.section as SectionKey][currentSelection.elementType as ElementType]}
              placeholder={currentSelection.elementType === 'title' ? 'Enter product title' : 'Enter product code'}
            />
            <div class="text-sm font-medium text-gray-700">Section Color</div>
            <input 
              type="color" 
              class="w-full h-12 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              bind:value={templateData[currentSelection.section as SectionKey].color}
            />
          </div>
        {/if}
      </div>

      <!-- Modal Footer -->
      <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
        <button 
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          on:click={closeModal}
        >
          Cancel
        </button>
        <button 
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          on:click={closeModal}
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .template-box {
    width: 340px; /* 255pt * 1.333333 */
    height: 813.33px; /* 610pt * 1.333333 */
    position: relative;
  }
  .branding-background {
    width: 340px; /* 255pt * 1.333333 */
    height: 240px; /* 180pt * 1.333333 */
    position: relative;
    background-color: rgb(0, 0, 0);
    border-top-left-radius: 7%;
    border-top-right-radius: 7%;
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
    top: 320px; /* (230pt + 55pt) * 1.333333 */
    left: 50%;
    transform: translateX(-50%);
    width: 340px; /* 255pt * 1.333333 */
    font-size: 16px;
    font-weight: 500;
    z-index: 2;
    cursor: pointer;
    transition: background-color 0.2s ease-in-out;
    padding: 8px 0;
    border-radius: 8px;
  }
  .instruction:hover {
    background-color: #e0f2fe; /* light blue */
  }
  .instruction.selected {
    background-color: #dcfce7; /* light green */
    color: #166534; /* dark green text */
  }
  .green-arc-top {
    position: absolute;
    top: 56px;
    left: 0;
    width: 340px; /* 255pt * 1.333333 */
    height: auto;
    z-index: 1;
  }
  .green-arc-bottom {
    position: absolute;
    top: 282px;
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
    border-bottom-left-radius: 7%;
    border-bottom-right-radius: 7%;
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
  .center-circle {
    position: absolute;
    width: 186.53px; /* 139.9pt * 1.333333 */
    height: 188.4px; /* 141.3pt * 1.333333 */
    border: 1px solid #000000;
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 3;
    background-color: #ffffff;
  }

  .product-section {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 1rem;
    font-size: 16px;
    color: #000000;
    font-weight: 500;
    position: relative;
    cursor: pointer;
  }

  .product-section .product-title,
  .product-section .product-code,
  .product-section .product-logo-placeholder,
  .product-section .product-description {
    transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
  }

  .product-section .product-title:hover,
  .product-section .product-description:hover,
  .product-section .product-code:hover,
  .product-section .product-logo-placeholder:hover {
    background-color: #e0f2fe !important; /* light blue */
  }

  .product-section .product-title:hover,
  .product-section .product-description:hover,
  .product-section .product-code:hover {
    color: #0ea5e9 !important;
  }
  
  .product-title.selected,
  .product-code.selected,
  .product-logo-placeholder.selected,
  .product-description.selected {
    background-color: #dcfce7 !important; /* light green */
  }

  .product-title.selected,
  .product-description.selected,
  .product-code.selected {
    color: #22c55e !important;
  }

  /* Top-left section styling */
  .product-section.top-left {
    padding: 0;
  }

  .product-section.top-left .product-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .product-section.top-left .product-title {
    background-color: rgb(30, 30, 30);
    color: #ffffff;
    padding: 5.33px 10.67px; /* 4pt 8pt * 1.333333 */
    border-radius: 5.33px;
    margin-top: 6.67px;
    width: 156px; /* 117pt * 1.333333 */
    font-size: 13.33px; /* 10pt * 1.333333 */
    text-align: center;
  }

  .product-section.top-left .product-description {
    position: absolute;
    bottom: 6.67px;
    left: 6.67px;
    width: 66.67px; /* 50pt * 1.333333 */
    height: 66.67px;
    background-color: rgb(30, 30, 30);
    color: #ffffff;
    padding: 5.33px 10.67px;
    border-radius: 5.33px;
    font-size: 10.67px; /* 8pt * 1.333333 */
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-section.top-left .product-code-logo {
    display: flex;
    background-color: rgb(30, 30, 30);
    margin-top: 6.67px;
    width: 156px; /* 117pt * 1.333333 */
    font-size: 26.67px; /* 20pt * 1.333333 */
    height: 33.33px; /* 25pt * 1.333333 */
    border-radius: 13.33px;
    overflow: hidden;
  }

  .product-section.top-left .product-code {
    flex: 1;
    color: #ffffff;
    padding: 5.33px 10.67px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bolder;
  }

  .product-section.top-left .product-logo-placeholder {
    flex: 1;
    background-color: #1e1e1e;
    min-height: 26.67px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-section.top-left .product-logo-placeholder img {
    width: 40px; /* 30pt * 1.333333 */
    height: 29.33px; /* 22pt * 1.333333 */
  }

  /* Top-right section styling */
  .product-section.top-right {
    padding: 0;
    border: none;
  }

  .product-section.top-right .product-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .product-section.top-right .product-title {
    background-color: rgb(30, 30, 30);
    color: #ffffff;
    padding: 5.33px 10.67px;
    border-radius: 5.33px;
    margin-top: 6.67px;
    width: 156px;
    font-size: 13.33px;
    text-align: center;
  }

  .product-section.top-right .product-description {
    position: absolute;
    bottom: 6.67px;
    right: 6.67px;
    width: 66.67px;
    height: 66.67px;
    background-color: rgb(30, 30, 30);
    color: #ffffff;
    padding: 5.33px 10.67px;
    border-radius: 5.33px;
    font-size: 10.67px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-section.top-right .product-code-logo {
    display: flex;
    background-color: rgb(30, 30, 30);
    margin-top: 6.67px;
    width: 156px;
    font-size: 26.67px;
    height: 33.33px;
    border-radius: 13.33px;
    overflow: hidden;
  }

  .product-section.top-right .product-code {
    flex: 1;
    color: #ffffff;
    padding: 5.33px 10.67px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bolder;
  }

  .product-section.top-right .product-logo-placeholder {
    flex: 1;
    background-color: #1e1e1e;
    min-height: 26.67px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-section.top-right .product-logo-placeholder img {
    width: 40px;
    height: 29.33px;
  }

  /* Bottom-left section styling */
  .product-section.bottom-left {
    padding: 0;
    border-bottom-left-radius: 7%;
    border: none;
  }

  .product-section.bottom-left .product-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    justify-content: space-between;
    height: 100%;
  }

  .product-section.bottom-left .product-description {
    position: absolute;
    top: 6.67px;
    left: 6.67px;
    background-color: rgb(30, 30, 30);
    color: #ffffff;
    padding: 5.33px 10.67px;
    border-radius: 5.33px;
    width: 66.67px;
    height: 66.67px;
    font-size: 10.67px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-section.bottom-left .product-code-logo {
    position: absolute;
    bottom: 46.67px; /* 35pt * 1.333333 */
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    background-color: rgb(30, 30, 30);
    width: 156px;
    font-size: 26.67px;
    height: 33.33px;
    border-radius: 13.33px;
    overflow: hidden;
  }

  .product-section.bottom-left .product-code {
    flex: 1;
    color: #ffffff;
    padding: 5.33px 10.67px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bolder;
  }

  .product-section.bottom-left .product-logo-placeholder {
    flex: 1;
    background-color: #1e1e1e;
    min-height: 26.67px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-section.bottom-left .product-logo-placeholder img {
    width: 40px;
    height: 29.33px;
  }

  .product-section.bottom-left .product-title {
    position: absolute;
    bottom: 6.67px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgb(30, 30, 30);
    color: #ffffff;
    padding: 5.33px 10.67px;
    border-radius: 5.33px;
    width: 156px;
    font-size: 13.33px;
    text-align: center;
  }

  /* Bottom-right section styling */
  .product-section.bottom-right {
    padding: 0;
    border-bottom-right-radius: 7%;
    border: none;
  }

  .product-section.bottom-right .product-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    justify-content: space-between;
    height: 100%;
  }

  .product-section.bottom-right .product-description {
    position: absolute;
    top: 6.67px;
    right: 6.67px;
    background-color: rgb(30, 30, 30);
    color: #ffffff;
    padding: 5.33px 10.67px;
    border-radius: 5.33px;
    width: 66.67px;
    height: 66.67px;
    font-size: 10.67px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-section.bottom-right .product-code-logo {
    position: absolute;
    bottom: 46.67px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    background-color: rgb(30, 30, 30);
    width: 156px;
    font-size: 26.67px;
    height: 33.33px;
    border-radius: 13.33px;
    overflow: hidden;
  }

  .product-section.bottom-right .product-code {
    flex: 1;
    color: #ffffff;
    padding: 5.33px 10.67px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bolder;
  }

  .product-section.bottom-right .product-logo-placeholder {
    flex: 1;
    background-color: #1e1e1e;
    min-height: 26.67px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .product-section.bottom-right .product-logo-placeholder img {
    width: 40px;
    height: 29.33px;
  }

  .product-section.bottom-right .product-title {
    position: absolute;
    bottom: 6.67px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgb(30, 30, 30);
    color: #ffffff;
    padding: 5.33px 10.67px;
    border-radius: 5.33px;
    width: 156px;
    font-size: 13.33px;
    text-align: center;
  }
</style> 