  <script lang="ts">
    import { fade } from 'svelte/transition';
    import { currentUser } from '$lib/firebase';
    import { userProfile, type UserProfile } from '$lib/userProfile';
    import { supabase } from '$lib/supabase';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { toastSuccess, toastInfo, toastWarning } from '$lib/utils/toast';

    let user: any = null;
    let profile: UserProfile | null = null;
    let draggedElement: HTMLElement | null = null;
    let draggedOverElement: HTMLElement | null = null;
    let isProcessingDrop: boolean = false;
    let skuText = '';
    let skuList: string[] = [];
    let failedSkus: string[] = [];

    let skuPriceData: any[] = [];

    // Session management
    let currentSessionId: string | null = null;
    let currentSessionName: string = '';
    let showSaveDialog: boolean = false;

    // Dynamic hierarchy data structure
    let hierarchy: any[] = [
      {
        id: 1,
        title: '',
        level2Items: [
          {
            id: 1,
            title: '',
            level3Items: []
          },
          {
            id: 2,
            title: '',
            level3Items: []
          }
        ]
      }
    ];

    let nextId = 7; // For generating unique IDs

    // Subscribe to user changes
    currentUser.subscribe((u) => {
      user = u;
    });

    // Subscribe to profile changes
    userProfile.subscribe((p) => {
      profile = p;
    });

    // Sessions data
    let savedSessions: any[] = [];
    let loadingSessions: boolean = false;

    // Load sessions when component mounts
    onMount(async () => {
      await loadSavedSessions();
    });

    // Focus input when dialog opens
    $: if (showSaveDialog) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        const input = document.getElementById('sessionName');
        if (input) input.focus();
      }, 100);
    }

    // Function to fetch product data from external API
    async function fetchProductData(sku: string): Promise<{
      sku: string;
      price: string;
      name: string;
      description: string;
      image: string | null;
      certifications: string[];
    } | null> {
      try {
        const response = await fetch('https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            "Filter": {
              "SKU": [sku],
              "OutputSelector": [
                "Model",
                "SKU",
                "RRP",
                "Description",
                "Images",
                "Misc11"
              ]
            },
            "action": "GetItem"
          })
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.Ack !== 'Success' || !data.Item || data.Item.length === 0) {
          throw new Error('Product not found or API returned error');
        }

        const item = data.Item[0];

        // Select image: prefer "Main", then Alt 1, Alt 2, etc.
        let selectedImage: string | null = null;
        if (item.Images && item.Images.length > 0) {
          // Sort images by priority: Main first, then Alt 1, Alt 2, etc.
          const sortedImages = item.Images.sort((a: any, b: any) => {
            if (a.Name === 'Main') return -1;
            if (b.Name === 'Main') return 1;
            const aNum = a.Name.startsWith('Alt ') ? parseInt(a.Name.split(' ')[1]) || 999 : 999;
            const bNum = b.Name.startsWith('Alt ') ? parseInt(b.Name.split(' ')[1]) || 999 : 999;
            return aNum - bNum;
          });
          selectedImage = sortedImages[0].URL;
        }

        // Parse certifications from Misc11
        const certifications = item.Misc11 ? item.Misc11.split(';').filter((cert: string) => cert.trim()) : [];

        return {
          sku: item.SKU,
          price: item.RRP || '0.00',
          name: item.Model || sku,
          description: item.Description || '',
          image: selectedImage,
          certifications
        };
      } catch (error) {
        console.error(`Error fetching product data for SKU ${sku}:`, error);
        // Return basic data if API fails
        return {
          sku,
          price: '0.00',
          name: sku,
          description: '',
          image: null,
          certifications: []
        };
      }
    }

    // Helper function to check if SKU already exists in any catalogue
    function skuExistsInCatalogue(skuContent: string): boolean {
      for (const level1 of hierarchy) {
        for (const level2 of level1.level2Items) {
          for (const level3 of level2.level3Items) {
            for (const item of level3.items) {
              // Extract SKU from item content (remove the 📦 prefix)
              const itemSku = item.content.replace('📦 ', '');
              if (itemSku === skuContent) {
                return true;
              }
            }
          }
        }
      }
      return false;
    }


    // Save catalogue session to Supabase
    async function saveCatalogueSession(sessionName: string, isTemplate = false) {
      try {
        const catalogueData = {
          productRanges: hierarchy.map(level1 => ({
            title: level1.title || 'Unnamed Range',
            categories: level1.level2Items.map(level2 => ({
              name: level2.title || 'Unnamed Category',
              products: level2.level3Items.flatMap(level3 =>
                level3.items.map(item => {
                  const skuContent = item.content.replace('📦 ', '');
                  const skuData = skuPriceData.find(d => d.sku === skuContent);
                  return {
                    sku: skuContent,
                    name: skuData?.name || skuContent.toUpperCase(),
                    price: skuData ? `$${skuData.price}` : '$0.00',
                    image: skuData?.image || null,
                    description: skuData?.description || '',
                    certifications: skuData?.certifications || []
                  };
                })
              )
            }))
          })),
          printSettings: {
            pageSize: "A4",
            margin: "1cm",
            productsPerPage: 3,
            repeatHeaderOnNewPage: true
          }
        };

        // Generate a random UUID for this session (since we can't use Firebase UID directly)
        const sessionUserId = crypto.randomUUID();

        const { data, error } = await supabase
          .from('catalogue_sessions')
          .insert({
            user_id: sessionUserId,
            session_name: sessionName,
            catalogue_data: catalogueData,
            available_skus: skuPriceData,
            is_template: isTemplate
            // created_by and updated_by are nullable, so we can omit them
          })
          .select()
          .single();

        if (error) throw error;

        toastSuccess(`Session "${sessionName}" saved successfully!`, 'Session Saved');
        return data;
      } catch (error) {
        console.error('Error saving session:', error);
        toastWarning('Failed to save session', 'Save Error');
        throw error;
      }
    }

    // Load catalogue session from Supabase
    async function loadCatalogueSession(sessionId: string) {
      try {
        const { data, error } = await supabase
          .from('catalogue_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', '00000000-0000-0000-0000-000000000000')
          .single();

        if (error) throw error;

        // Set current session info
        currentSessionId = data.id;
        currentSessionName = data.session_name;

        // Restore catalogue data
        const catalogueData = data.catalogue_data;

        // Restore available SKUs
        skuPriceData = data.available_skus || [];
        skuList = skuPriceData.map(item => item.sku);

        // Reconstruct hierarchy from catalogue data
        // This would need to be implemented based on your data structure
        // For now, we'll log it
        console.log('Loaded catalogue data:', catalogueData);

        toastSuccess(`Session "${data.session_name}" loaded successfully!`, 'Session Loaded');
        await loadSavedSessions(); // Refresh the sessions list
        return data;
      } catch (error) {
        console.error('Error loading session:', error);
        toastWarning('Failed to load session', 'Load Error');
        throw error;
      }
    }

    // Open save dialog
    function openSaveDialog() {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      currentSessionName = currentSessionName || `Catalogue ${timestamp}`;
      showSaveDialog = true;
    }

    // Close save dialog
    function closeSaveDialog() {
      showSaveDialog = false;
    }

    // Handle save session
    async function handleSaveSession() {
      if (!currentSessionName.trim()) {
        toastWarning('Please enter a session name', 'Session Name Required');
        return;
      }

      try {
        const sessionData = await saveCatalogueSession(currentSessionName.trim());
        currentSessionId = sessionData.id;
        closeSaveDialog();
        await loadSavedSessions(); // Refresh the sessions list
      } catch (error) {
        // Error handling is done in saveCatalogueSession
      }
    }

    // Load saved sessions from Supabase
    async function loadSavedSessions() {
      if (!user?.uid) return;

      loadingSessions = true;
      try {
        const { data, error } = await supabase
          .from('catalogue_sessions')
          .select('id, session_name, created_at, is_template')
          .eq('user_id', '00000000-0000-0000-0000-000000000000')
          .order('created_at', { ascending: false });

        if (error) throw error;
        savedSessions = data || [];
      } catch (error) {
        console.error('Error loading sessions:', error);
        toastWarning('Failed to load saved sessions', 'Load Error');
      } finally {
        loadingSessions = false;
      }
    }

    // Delete a saved session
    async function deleteSession(sessionId: string, sessionName: string) {
      try {
        const { error } = await supabase
          .from('catalogue_sessions')
          .delete()
          .eq('id', sessionId)
          .eq('user_id', '00000000-0000-0000-0000-000000000000');

        if (error) throw error;

        toastSuccess(`Session "${sessionName}" deleted successfully!`, 'Session Deleted');
        await loadSavedSessions(); // Refresh the list

        // If the deleted session was the current one, clear it
        if (currentSessionId === sessionId) {
          currentSessionId = null;
          currentSessionName = '';
        }
      } catch (error) {
        console.error('Error deleting session:', error);
        toastWarning('Failed to delete session', 'Delete Error');
      }
    }

    // Function to submit catalogue data via POST (now also saves)
    async function submitCatalogue() {
      try {
        // Auto-save if not already saved
        if (!currentSessionId) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const defaultName = `Catalogue ${timestamp}`;
          await saveCatalogueSession(defaultName);
        }

        // Build JSON structure matching catalogue-data.json format
        const catalogueData = {
          productRanges: hierarchy.map(level1 => ({
            title: level1.title || 'Unnamed Range',
            categories: level1.level2Items.map(level2 => ({
              name: level2.title || 'Unnamed Category',
              products: level2.level3Items.flatMap(level3 =>
                level3.items.map(item => {
                  const skuContent = item.content.replace('📦 ', '');
                  const skuData = skuPriceData.find(d => d.sku === skuContent);
                  return {
                    sku: skuContent,
                    name: skuData?.name || skuContent.toUpperCase(),
                    price: skuData ? `$${skuData.price}` : '$0.00',
                    image: skuData?.image || null,
                    description: skuData?.description || '',
                    certifications: skuData?.certifications || []
                  };
                })
              )
            }))
          })),
          printSettings: {
            pageSize: "A4",
            margin: "1cm",
            productsPerPage: 3,
            repeatHeaderOnNewPage: true
          }
        };

        // Encode the data and navigate to the print page with query parameter
        const encodedData = encodeURIComponent(JSON.stringify(catalogueData));
        const printUrl = `/catalogue/print?data=${encodedData}`;

        // Open in new tab
        window.open(printUrl, '_blank');
      } catch (error) {
        console.error('Error during print process:', error);
        toastWarning('Failed to prepare catalogue for printing', 'Print Error');
      }
    }

    function handleDragStart(event: DragEvent) {
      draggedElement = event.target as HTMLElement;
      draggedElement.style.opacity = '0.5';
    }

    function handleDragEnd(event: DragEvent) {
      if (draggedElement) {
        draggedElement.style.opacity = '1';
        draggedElement = null;
      }

      // Clean up visual feedback from catalogue containers
      document.querySelectorAll('.bg-green-50').forEach(el => {
        const element = el as HTMLElement;
        element.style.backgroundColor = '';
        element.style.borderColor = '';
      });

      draggedOverElement = null;
    }

    function handleDragOver(event: DragEvent) {
      event.preventDefault();
      draggedOverElement = event.currentTarget as HTMLElement;

      // For sorting within the same container, show visual feedback
      const targetElement = event.currentTarget as HTMLElement;
      if (targetElement.classList.contains('sortable-item')) {
        const rect = targetElement.getBoundingClientRect();
        const y = event.clientY - rect.top;
        const height = rect.height;

        // Remove previous indicators
        document.querySelectorAll('.drop-indicator').forEach(el => el.remove());

        // Create drop indicator
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator bg-blue-500 h-1 rounded-full';
        indicator.style.position = 'absolute';
        indicator.style.width = 'calc(100% - 1rem)';
        indicator.style.left = '0.5rem';
        indicator.style.zIndex = '10';

        if (y < height / 2) {
          // Drop above
          indicator.style.top = '-2px';
          targetElement.style.marginTop = '4px';
        } else {
          // Drop below
          indicator.style.bottom = '-2px';
          targetElement.style.marginBottom = '4px';
        }

        targetElement.appendChild(indicator);
        targetElement.style.position = 'relative';
      } else if (targetElement.classList.contains('bg-green-50')) {
        // Dragging over a catalogue container - show highlight
        targetElement.style.backgroundColor = '#dbeafe'; // blue-100
        targetElement.style.borderColor = '#3b82f6'; // blue-500
      }
    }

    function handleDrop(event: DragEvent) {
      event.preventDefault();
      event.stopPropagation();
      draggedOverElement = event.currentTarget as HTMLElement;

      // Prevent multiple drop processing
      if (isProcessingDrop) {
        return;
      }
      isProcessingDrop = true;

      // Clean up visual indicators
      document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
      document.querySelectorAll('.sortable-item').forEach(el => {
        (el as HTMLElement).style.marginTop = '';
        (el as HTMLElement).style.marginBottom = '';
      });

      if (draggedElement && draggedOverElement && draggedElement !== draggedOverElement) {
        console.log('Drop detected:', {
          draggedElement: draggedElement.className,
          draggedOverElement: draggedOverElement.className,
          draggedOverElementDataset: { ...draggedOverElement.dataset }
        });

        const skuContent = draggedElement.dataset.sku;
        const toLevel1Id = parseInt(draggedOverElement.dataset.level1Id || '0');
        const toLevel2Id = parseInt(draggedOverElement.dataset.level2Id || '0');

        // If dropping a SKU from the list to a catalogue
        if (skuContent && toLevel1Id && toLevel2Id) {
          addSKUToCatalogue(toLevel1Id, toLevel2Id, skuContent);
        } else {
          // Check if this is an item being dragged (not a SKU from the list)
          const fromItemId = parseInt(draggedElement.dataset.itemId || '0');
          const fromLevel3Id = parseInt(draggedElement.dataset.level3Id || '0');
          const fromLevel2Id = parseInt(draggedElement.dataset.fromLevel2Id || '0');
          const fromLevel1Id = parseInt(draggedElement.dataset.fromLevel1Id || '0');

          if (fromItemId && fromLevel3Id && fromLevel2Id && fromLevel1Id) {
            console.log('Item drag detected:', { fromItemId, fromLevel3Id, fromLevel2Id, fromLevel1Id, toLevel1Id, toLevel2Id });

            // Check if dropping on another item for sorting within same container
            const targetItemId = parseInt(draggedOverElement.dataset.targetItemId || '0');
            const isDroppingOnItem = draggedOverElement.classList.contains('sortable-item');

            console.log('Drop analysis:', { targetItemId, isDroppingOnItem, sameContainer: fromLevel1Id === toLevel1Id && fromLevel2Id === toLevel2Id });

            if (targetItemId && isDroppingOnItem && fromLevel1Id === toLevel1Id && fromLevel2Id === toLevel2Id) {
              // Sorting within the same container
              const rect = draggedOverElement.getBoundingClientRect();
              const y = event.clientY - rect.top;
              const height = rect.height;
              const insertBefore = y < height / 2;

              console.log('Reordering within same container');
              reorderItemWithinCatalogue(fromLevel1Id, fromLevel2Id, fromItemId, targetItemId, insertBefore);
            } else if (toLevel1Id && toLevel2Id) {
              // Moving to a different catalogue (either on empty area or different catalogue)
              console.log('Moving to different catalogue');
              moveItemToCatalogue(fromLevel1Id, fromLevel2Id, fromLevel3Id, fromItemId, toLevel1Id, toLevel2Id);
            }
          }
        }
      }
      draggedOverElement = null;
      isProcessingDrop = false;
    }

    // Add new level 1 container
    function addLevel1() {
      hierarchy = [...hierarchy, {
        id: nextId++,
        title: '',
        level2Items: []
      }];
    }

    // Remove level 1 container
    function removeLevel1(level1Id: number) {
      hierarchy = hierarchy.filter(item => item.id !== level1Id);
    }

    // Add level 2 container to a level 1
    function addLevel2(level1Id: number) {
      hierarchy = hierarchy.map(level1 => {
        if (level1.id === level1Id) {
          return {
            ...level1,
            level2Items: [...level1.level2Items, {
              id: nextId++,
              title: '',
              level3Items: []
            }]
          };
        }
        return level1;
      });
    }

    // Remove level 2 container
    function removeLevel2(level1Id: number, level2Id: number) {
      hierarchy = hierarchy.map(level1 => {
        if (level1.id === level1Id) {
          return {
            ...level1,
            level2Items: level1.level2Items.filter(level2 => level2.id !== level2Id)
          };
        }
        return level1;
      });
    }


    // Add item to level 2 container (creates level 3 if needed)
    function addItemToLevel2(level1Id: number, level2Id: number) {
      hierarchy = hierarchy.map(level1 => {
        if (level1.id === level1Id) {
          return {
            ...level1,
            level2Items: level1.level2Items.map(level2 => {
              if (level2.id === level2Id) {
                let level3Items = [...level2.level3Items];
                // If no level 3 containers exist, create one
                if (level3Items.length === 0) {
                  level3Items = [{
                    id: nextId++,
                    title: 'Level 3',
                    items: []
                  }];
                }
                // Add item to the first level 3 container
                level3Items[0] = {
                  ...level3Items[0],
                  items: [...level3Items[0].items, {
                    id: nextId++,
                    content: `📦 Item ${String.fromCharCode(65 + (nextId - 9))}`
                  }]
                };
                return {
                  ...level2,
                  level3Items
                };
              }
              return level2;
            })
          };
        }
        return level1;
      });
    }

    // Add item to level 3 container (legacy function, keeping for compatibility)
    function addItem(level1Id: number, level2Id: number, level3Id: number) {
      hierarchy = hierarchy.map(level1 => {
        if (level1.id === level1Id) {
          return {
            ...level1,
            level2Items: level1.level2Items.map(level2 => {
              if (level2.id === level2Id) {
                return {
                  ...level2,
                  level3Items: level2.level3Items.map(level3 => {
                    if (level3.id === level3Id) {
                      return {
                        ...level3,
                        items: [...level3.items, {
                          id: nextId++,
                          content: `📦 Item ${String.fromCharCode(65 + (nextId - 8))}`
                        }]
                      };
                    }
                    return level3;
                  })
                };
              }
              return level2;
            })
          };
        }
        return level1;
      });
    }

    // Remove item from level 3 container
    function removeItem(level1Id: number, level2Id: number, level3Id: number, itemId: number) {
      let removedItem: any = null;

      // First, find the item to be removed
      hierarchy.forEach(level1 => {
        if (level1.id === level1Id) {
          level1.level2Items.forEach(level2 => {
            if (level2.id === level2Id) {
              level2.level3Items.forEach(level3 => {
                if (level3.id === level3Id) {
                  level3.items.forEach(item => {
                    if (item.id === itemId) {
                      removedItem = item;
                    }
                  });
                }
              });
            }
          });
        }
      });

      // If we found the item, extract the SKU and add it back to the available list
      if (removedItem) {
        const skuContent = removedItem.content.replace('📦 ', '');
        // Check if SKU is not already in the list before adding
        if (!skuList.includes(skuContent)) {
          skuList = [...skuList, skuContent];
          toastInfo(`SKU "${skuContent}" returned to available list`, 'SKU Restored');
        }
      }

      // Then remove the item from the hierarchy
      hierarchy = hierarchy.map(level1 => {
        if (level1.id === level1Id) {
          return {
            ...level1,
            level2Items: level1.level2Items.map(level2 => {
              if (level2.id === level2Id) {
                return {
                  ...level2,
                  level3Items: level2.level3Items.map(level3 => {
                    if (level3.id === level3Id) {
                      return {
                        ...level3,
                        items: level3.items.filter(item => item.id !== itemId)
                      };
                    }
                    return level3;
                  })
                };
              }
              return level2;
            })
          };
        }
        return level1;
      });
    }

    // Process SKUs from textarea
    async function processSKUs() {
      if (skuText.trim()) {
        // Split by newlines first to get each line
        const lines = skuText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        const skusToProcess: string[] = [];
        const errors: string[] = [];

        for (const line of lines) {
          // Accept either just SKU or SKU,price format (price will be overridden by API)
          const parts = line.split(',').map(part => part.trim());
          const sku = parts[0];
          if (sku) {
            skusToProcess.push(sku);
          } else {
            errors.push(`Invalid line: "${line}" - missing SKU`);
          }
        }

        if (skusToProcess.length === 0) {
          toastWarning('No valid SKUs found to process', 'No SKUs');
          return;
        }

        // Show loading state
        toastInfo(`Fetching product data for ${skusToProcess.length} SKU${skusToProcess.length > 1 ? 's' : ''}...`, 'Processing');

        // Fetch data for all SKUs
        const fetchPromises = skusToProcess.map(sku => fetchProductData(sku));
        const fetchResults = await Promise.all(fetchPromises);

        const processedData: Array<{
          sku: string,
          price: string,
          name: string,
          description: string,
          image: string | null,
          certifications: string[]
        }> = [];
        const apiErrors: string[] = [];

        fetchResults.forEach((result, index) => {
          if (result) {
            processedData.push(result);
          } else {
            apiErrors.push(skusToProcess[index]);
          }
        });

        // Filter out duplicates based on SKU
        const uniqueData: Array<{
          sku: string,
          price: string,
          name: string,
          description: string,
          image: string | null,
          certifications: string[]
        }> = [];
        const duplicateSKUs: string[] = [];
        const existingSKUs: string[] = [];

        for (const item of processedData) {
          const existingIndex = uniqueData.findIndex(d => d.sku === item.sku);
          if (existingIndex !== -1) {
            duplicateSKUs.push(item.sku);
          } else if (skuExistsInCatalogue(item.sku)) {
            existingSKUs.push(item.sku);
          } else {
            uniqueData.push(item);
          }
        }

        skuPriceData = uniqueData;
        skuList = uniqueData.map(item => item.sku); // Keep skuList for backward compatibility
        failedSkus = apiErrors; // Store failed SKUs for display
        skuText = ''; // Clear the textarea after processing

        // Build JSON structure matching catalogue-data.json format
        const jsonData = {
          productRanges: hierarchy.map(level1 => ({
            title: level1.title || 'Unnamed Range',
            categories: level1.level2Items.map(level2 => ({
              name: level2.title || 'Unnamed Category',
              products: level2.level3Items.flatMap(level3 =>
                level3.items.map(item => {
                  const skuContent = item.content.replace('📦 ', '');
                  const skuData = uniqueData.find(d => d.sku === skuContent);
                  return {
                    sku: skuContent,
                    name: skuData?.name || skuContent.toUpperCase(),
                    price: skuData ? `$${skuData.price}` : '$0.00',
                    image: skuData?.image || null,
                    description: skuData?.description || '',
                    certifications: skuData?.certifications || []
                  };
                })
              )
            }))
          }))
        };

        console.log('Catalogue JSON Data:', jsonData);

        if (uniqueData.length > 0) {
          toastSuccess(`Processed ${uniqueData.length} SKU${uniqueData.length > 1 ? 's' : ''} successfully!`, 'SKUs Processed');
        }

        // Notify about errors
        if (errors.length > 0) {
          toastWarning(`${errors.length} line${errors.length > 1 ? 's' : ''} had parsing errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`, 'Parsing Errors');
        }

        if (apiErrors.length > 0) {
          toastWarning(`${apiErrors.length} SKU${apiErrors.length > 1 ? 's' : ''} failed to fetch from API: ${apiErrors.join(', ')}`, 'API Errors');
        }

        // Notify about duplicates and existing SKUs
        if (duplicateSKUs.length > 0) {
          toastWarning(`${duplicateSKUs.length} duplicate SKU${duplicateSKUs.length > 1 ? 's' : ''} removed: ${duplicateSKUs.join(', ')}`, 'Duplicates Removed');
        }

        if (existingSKUs.length > 0) {
          toastWarning(`${existingSKUs.length} SKU${existingSKUs.length > 1 ? 's' : ''} already in catalogue: ${existingSKUs.join(', ')}`, 'SKUs Already Exist');
        }
      }
    }

    // Add SKU item to a catalogue
    function addSKUToCatalogue(level1Id: number, level2Id: number, skuContent: string) {
      // Check if SKU already exists in any catalogue
      if (skuExistsInCatalogue(skuContent)) {
        toastWarning(`SKU "${skuContent}" already exists in catalogue`, 'Duplicate SKU');
        // Remove from skuList if it exists there
        skuList = skuList.filter(sku => sku !== skuContent);
        return;
      }

      hierarchy = hierarchy.map(level1 => {
        if (level1.id === level1Id) {
          return {
            ...level1,
            level2Items: level1.level2Items.map(level2 => {
              if (level2.id === level2Id) {
                let level3Items = [...level2.level3Items];

                // If no level 3 containers exist, create one
                if (level3Items.length === 0) {
                  level3Items = [{
                    id: nextId++,
                    title: 'Level 3',
                    items: []
                  }];
                }

                // Find the last level 3 container or create a new one if the last one is full (limit to 10 items per container)
                let targetLevel3Index = level3Items.length - 1;
                if (level3Items[targetLevel3Index].items.length >= 10) {
                  // Create a new level 3 container
                  level3Items = [...level3Items, {
                    id: nextId++,
                    title: 'Level 3',
                    items: []
                  }];
                  targetLevel3Index = level3Items.length - 1;
                }

                // Add SKU to the target level 3 container
                level3Items[targetLevel3Index] = {
                  ...level3Items[targetLevel3Index],
                  items: [...level3Items[targetLevel3Index].items, {
                    id: nextId++,
                    content: `📦 ${skuContent}`
                  }]
                };

                return {
                  ...level2,
                  level3Items
                };
              }
              return level2;
            })
          };
        }
        return level1;
      });

      // Remove the SKU from the list
      skuList = skuList.filter(sku => sku !== skuContent);

      // Show success toast
      toastInfo(`SKU "${skuContent}" added to catalogue`, 'SKU Added');

      // Log the updated JSON structure
      const updatedJsonData = {
        productRanges: hierarchy.map(level1 => ({
          title: level1.title || 'Unnamed Range',
          categories: level1.level2Items.map(level2 => ({
            name: level2.title || 'Unnamed Category',
            products: level2.level3Items.flatMap(level3 =>
              level3.items.map(item => {
                const skuContent = item.content.replace('📦 ', '');
                const skuData = skuPriceData.find(d => d.sku === skuContent);
                return {
                  sku: skuContent,
                  name: skuData?.name || skuContent.toUpperCase(),
                  price: skuData ? `$${skuData.price}` : '$0.00',
                  image: skuData?.image || null,
                  description: skuData?.description || '',
                  certifications: skuData?.certifications || []
                };
              })
            )
          }))
        }))
      };
      console.log('Catalogue JSON Data (after adding SKU):', updatedJsonData);
    }

    // Reorder item within the same catalogue
    function reorderItemWithinCatalogue(level1Id: number, level2Id: number, fromItemId: number, toItemId: number, insertBefore: boolean) {
      hierarchy = hierarchy.map(level1 => {
        if (level1.id === level1Id) {
          return {
            ...level1,
            level2Items: level1.level2Items.map(level2 => {
              if (level2.id === level2Id) {
                // Collect all items from all level3 containers in this level2
                let allItems: any[] = [];
                level2.level3Items.forEach(level3 => {
                  allItems = [...allItems, ...level3.items];
                });

                // Find indices in the flat list
                const fromIndex = allItems.findIndex(item => item.id === fromItemId);
                const toIndex = allItems.findIndex(item => item.id === toItemId);

                if (fromIndex !== -1 && toIndex !== -1) {
                  // Reorder the flat list
                  const [movedItem] = allItems.splice(fromIndex, 1);
                  const targetIndex = insertBefore ? toIndex : toIndex + 1;
                  allItems.splice(targetIndex, 0, movedItem);

                  // Redistribute items back into level3 containers (max 10 per container)
                  const newLevel3Items: any[] = [];
                  for (let i = 0; i < allItems.length; i += 10) {
                    newLevel3Items.push({
                      id: i === 0 && level2.level3Items[0] ? level2.level3Items[0].id : nextId++,
                      title: 'Level 3',
                      items: allItems.slice(i, i + 10)
                    });
                  }

                  return {
                    ...level2,
                    level3Items: newLevel3Items
                  };
                }
              }
              return level2;
            })
          };
        }
        return level1;
      });

      toastInfo('Item reordered within catalogue', 'Item Reordered');
    }

    // Move item from one catalogue to another
    function moveItemToCatalogue(fromLevel1Id: number, fromLevel2Id: number, fromLevel3Id: number, fromItemId: number, toLevel1Id: number, toLevel2Id: number) {
      console.log('=== MOVE ITEM TO CATALOGUE START ===');
      console.log('Parameters:', { fromLevel1Id, fromLevel2Id, fromLevel3Id, fromItemId, toLevel1Id, toLevel2Id });
      console.log('Current hierarchy before move:', JSON.stringify(hierarchy, null, 2));

      let itemToMove: any = null;

      // First, find and remove the item from the source catalogue
      console.log(`Removing item from level1:${fromLevel1Id}, level2:${fromLevel2Id}, level3:${fromLevel3Id}`);
      hierarchy = hierarchy.map(level1 => {
        if (level1.id === fromLevel1Id) {
          console.log(`Processing level1 ${level1.id}`);
          return {
            ...level1,
            level2Items: level1.level2Items.map(level2 => {
              if (level2.id === fromLevel2Id) {
                console.log(`Processing level2 ${level2.id} (source)`);
                return {
                  ...level2,
                  level3Items: level2.level3Items.map(level3 => {
                    if (level3.id === fromLevel3Id) {
                      const itemIndex = level3.items.findIndex(item => item.id === fromItemId);
                      console.log(`Looking for item ${fromItemId} in level3 ${fromLevel3Id}, found at index:`, itemIndex);
                      if (itemIndex !== -1) {
                        itemToMove = level3.items[itemIndex];
                        console.log('Item to move found:', itemToMove);
                        const newItems = [...level3.items];
                        newItems.splice(itemIndex, 1);
                        console.log(`Removed item, level3 now has ${newItems.length} items`);
                        return {
                          ...level3,
                          items: newItems
                        };
                      } else {
                        console.log('Item not found in this level3');
                      }
                    }
                    return level3;
                  })
                };
              }
              return level2;
            })
          };
        }
        return level1;
      });

      console.log('Hierarchy after removal:', JSON.stringify(hierarchy, null, 2));

      // Then, add the item to the target catalogue
      if (itemToMove) {
        console.log('Adding item to target catalogue...');
        // Extract SKU from the item content
        const itemSku = itemToMove.content.replace('📦 ', '');
        console.log('Item SKU:', itemSku);

        // Check if this SKU already exists in the target catalogue (but not in the same location we're moving from)
        let skuExistsInTarget = false;
        hierarchy.forEach(level1 => {
          level1.level2Items.forEach(level2 => {
            // Skip the source catalogue if it's the same one
            if (!(level1.id === fromLevel1Id && level2.id === fromLevel2Id)) {
              level2.level3Items.forEach(level3 => {
                level3.items.forEach(item => {
                  const existingSku = item.content.replace('📦 ', '');
                  if (existingSku === itemSku) {
                    skuExistsInTarget = true;
                  }
                });
              });
            }
          });
        });

        if (skuExistsInTarget) {
          toastWarning(`SKU "${itemSku}" already exists in target catalogue`, 'Duplicate SKU');
          return;
        }
        console.log(`Adding item to level1:${toLevel1Id}, level2:${toLevel2Id}`);
        hierarchy = hierarchy.map(level1 => {
          if (level1.id === toLevel1Id) {
            console.log(`Processing level1 ${level1.id} for addition`);
            return {
              ...level1,
              level2Items: level1.level2Items.map(level2 => {
                if (level2.id === toLevel2Id) {
                  console.log(`Processing level2 ${level2.id} (target) - has ${level2.level3Items.length} level3 containers`);
                  let level3Items = [...level2.level3Items];
                  console.log(`Target level2 ${level2.id} initially has ${level3Items.length} level3 containers`);
                  // If no level 3 containers exist, create one
                  if (level3Items.length === 0) {
                    console.log('Creating new level3 container for empty target level2');
                    level3Items = [{
                      id: nextId++,
                      title: 'Level 3',
                      items: []
                    }];
                    console.log('Created level3 container with id:', level3Items[0].id);
                  }

                  // Find the last level 3 container or create a new one if the last one is full (limit to 10 items per container)
                  let targetLevel3Index = level3Items.length - 1;
                  console.log(`targetLevel3Index initially: ${targetLevel3Index}, level3Items.length: ${level3Items.length}`);
                  if (level3Items.length > 0 && level3Items[targetLevel3Index].items.length >= 10) {
                    // Create a new level 3 container
                    level3Items = [...level3Items, {
                      id: nextId++,
                      title: 'Level 3',
                      items: []
                    }];
                    targetLevel3Index = level3Items.length - 1;
                    console.log('Created new level3 container, targetLevel3Index now:', targetLevel3Index);
                  }

                  // Add item to the target level 3 container
                  console.log(`Adding item to level3 index ${targetLevel3Index}`);
                  console.log('Target level3 container has:', level3Items[targetLevel3Index].items.length, 'items');
                  level3Items[targetLevel3Index] = {
                    ...level3Items[targetLevel3Index],
                    items: [...level3Items[targetLevel3Index].items, itemToMove]
                  };
                  console.log('After adding:', level3Items[targetLevel3Index].items.length, 'items');
                  return {
                    ...level2,
                    level3Items
                  };
                }
                return level2;
              })
            };
          }
          return level1;
        });

        console.log('=== MOVE ITEM TO CATALOGUE COMPLETE ===');
        console.log('Item to move was:', itemToMove);
        console.log('Final hierarchy after move:', JSON.stringify(hierarchy, null, 2));
        toastInfo(`Item moved to catalogue`, 'Item Moved');

        // Log the updated JSON structure
        const updatedJsonData = {
          productRanges: hierarchy.map(level1 => ({
            title: level1.title || 'Unnamed Range',
            categories: level1.level2Items.map(level2 => ({
              name: level2.title || 'Unnamed Category',
              products: level2.level3Items.flatMap(level3 =>
                level3.items.map(item => {
                  const skuContent = item.content.replace('📦 ', '');
                  const skuData = skuPriceData.find(d => d.sku === skuContent);
                  return {
                    sku: skuContent,
                    name: skuData?.name || skuContent.toUpperCase(),
                    price: skuData ? `$${skuData.price}` : '$0.00',
                    image: skuData?.image || null,
                    description: skuData?.description || '',
                    certifications: skuData?.certifications || []
                  };
                })
              )
            }))
          }))
        };
        console.log('Catalogue JSON Data (after moving item):', updatedJsonData);
      }
    }
  </script>

  <style>
    .sortable-item {
      transition: margin 0.2s ease;
    }
    .drop-indicator {
      transition: all 0.2s ease;
    }
  </style>

  <div class="container mx-auto px-4 py-8" in:fade>
    <div class="max-w-full mx-auto">
      <div class="bg-white shadow-lg rounded-lg overflow-hidden">
        <!-- Page Header -->
        <div class="px-8 py-6 border-b border-gray-200">
          <h2 class="text-2xl font-bold text-gray-800">Create Product Catalogue</h2>
        </div>

        <div id="page-content" class="px-8 py-8">
          <div class="grid grid-cols-12 gap-4">
            <!-- Left Column - SKUs -->
            <div class="col-span-3">
              <div class="space-y-4">
                <!-- SKUs Textarea -->
                <div class="bg-gray-50 rounded-lg p-4">
                  <label for="skus" class="block text-sm font-medium text-gray-700 mb-2">SKUs (API Lookup)</label>
                  <textarea
                    id="skus"
                    rows="8"
                    bind:value={skuText}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(148,186,77)] focus:border-[rgb(148,186,77)] resize-none"
                    placeholder="Enter SKUs here... (one per line, prices and details will be fetched from API)"
                  ></textarea>
                  <button
                    on:click={processSKUs}
                    class="mt-2 w-full bg-[rgb(148,186,77)] text-white px-4 py-2 rounded-lg hover:bg-[rgb(122,157,61)] transition-colors font-semibold"
                  >
                    Process SKUs & Prices
                  </button>
                </div>

                <!-- SKU List -->
                {#if skuList.length > 0}
                  <div class="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Available SKUs</h4>
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                      {#each skuList as sku, i (i)}
                        {@const skuData = skuPriceData.find(d => d.sku === sku)}
                        <div
                          class="bg-orange-100 border border-orange-300 rounded p-2 text-sm cursor-move draggable flex justify-between items-center"
                          role="button"
                          tabindex="0"
                          draggable="true"
                          data-sku={sku}
                          on:dragstart={handleDragStart}
                          on:dragend={handleDragEnd}
                        >
                          <div class="flex-1">
                            <div class="font-medium">{skuData?.name || sku}</div>
                            <div class="text-xs text-gray-600">{sku} • ${skuData?.price || '0.00'}</div>
                          </div>
                          <button
                            on:click={(e) => {
                              e.stopPropagation();
                              toastWarning(`SKU "${sku}" removed from list`, 'SKU Removed');
                              skuList = skuList.filter(s => s !== sku);
                            }}
                            class="text-orange-600 hover:text-orange-800 ml-1"
                            title="Remove SKU"
                          >
                            ×
                          </button>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- Failed SKUs List -->
                {#if failedSkus.length > 0}
                  <div class="bg-white border border-red-200 rounded-lg p-4">
                    <h4 class="text-sm font-medium text-red-700 mb-2">Failed to Fetch SKUs</h4>
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                      {#each failedSkus as sku, i (i)}
                        <div class="bg-red-50 border border-red-200 rounded p-2 text-sm flex justify-between items-center">
                          <div class="flex-1">
                            <div class="font-medium text-red-800">{sku}</div>
                            <div class="text-xs text-red-600">Failed to fetch from API</div>
                          </div>
                          <button
                            on:click={(e) => {
                              e.stopPropagation();
                              failedSkus = failedSkus.filter(s => s !== sku);
                              toastInfo(`SKU "${sku}" removed from failed list`, 'SKU Removed');
                            }}
                            class="text-red-600 hover:text-red-800 ml-1"
                            title="Remove from list"
                          >
                            ×
                          </button>
                        </div>
                      {/each}
                    </div>
                    <div class="mt-2 text-xs text-red-600">
                      These SKUs could not be found in the product database. You can try re-entering them or contact support.
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Middle Column - Dynamic Hierarchy -->
            <div class="col-span-6">
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <h3 class="text-lg font-semibold text-gray-800">Dynamic Hierarchy</h3>
                  <button
                    on:click={addLevel1}
                    class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors"
                  >
                    + Add Range
                  </button>
                </div>

                {#each hierarchy as level1 (level1.id)}
                  <div class="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 min-h-[200px]"
                       role="region">

                    <div class="flex justify-between items-center mb-3">
                      <input
                        type="text"
                        bind:value={level1.title}
                        class="flex-1 text-md font-medium text-blue-800 bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-400 rounded px-2 py-1"
                        placeholder="Product Range"
                        on:input={() => {
                          const updatedJsonData = {
                            productRanges: hierarchy.map(level1 => ({
                              title: level1.title || 'Unnamed Range',
                              categories: level1.level2Items.map(level2 => ({
                                name: level2.title || 'Unnamed Category',
                                products: level2.level3Items.flatMap(level3 =>
                                  level3.items.map(item => {
                                    const skuContent = item.content.replace('📦 ', '');
                                    const skuData = skuPriceData.find(d => d.sku === skuContent);
                                    return {
                                      sku: skuContent,
                                      name: skuContent.toUpperCase(),
                                      price: skuData ? `$${skuData.price}` : '$0.00',
                                      image: null,
                                      description: '',
                                      certifications: []
                                    };
                                  })
                                )
                              }))
                            }))
                          };
                          console.log('Catalogue JSON Data (range name changed):', updatedJsonData);
                        }}
                      />
                      <div class="flex space-x-1 ml-2">
                        <button
                          on:click={() => addLevel2(level1.id)}
                          class="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 transition-colors"
                          title="Add Catalogue"
                        >
                          + Catalogue
                        </button>
                        <button
                          on:click={() => removeLevel1(level1.id)}
                          class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition-colors"
                          title="Remove Level 1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {#each level1.level2Items as level2 (level2.id)}
                      <div
                        class="bg-green-50 border-2 border-green-200 rounded-lg p-3 mb-3 min-h-[120px]"
                        role="region"
                        data-level1-id={level1.id}
                        data-level2-id={level2.id}
                        on:dragover={handleDragOver}
                        on:drop={handleDrop}
                      >

                        <div class="flex justify-between items-center mb-2">
                          <input
                            type="text"
                            bind:value={level2.title}
                            class="flex-1 text-sm font-medium text-green-800 bg-transparent border-none outline-none focus:ring-2 focus:ring-green-400 rounded px-2 py-1"
                            placeholder="Catalogue"
                            on:input={() => {
                              const updatedJsonData = {
                                productRanges: hierarchy.map(level1 => ({
                                  title: level1.title || 'Unnamed Range',
                                  categories: level1.level2Items.map(level2 => ({
                                    name: level2.title || 'Unnamed Category',
                                    products: level2.level3Items.flatMap(level3 =>
                                      level3.items.map(item => {
                                        const skuContent = item.content.replace('📦 ', '');
                                        const skuData = skuPriceData.find(d => d.sku === skuContent);
                                        return {
                                          sku: skuContent,
                                          name: skuContent.toUpperCase(),
                                          price: skuData ? `$${skuData.price}` : '$0.00',
                                          image: null,
                                          description: '',
                                          certifications: []
                                        };
                                      })
                                    )
                                  }))
                                }))
                              };
                              console.log('Catalogue JSON Data (catalogue name changed):', updatedJsonData);
                            }}
                          />
                          <div class="flex space-x-1">
                            <button
                              on:click={() => removeLevel2(level1.id, level2.id)}
                              class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition-colors"
                              title="Remove Catalogue"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        <!-- Items can be added directly to level 2 containers -->
                        <div class="space-y-1 min-h-[40px] relative">
                          <!-- Drop zone for moving items to this catalogue -->
                          <div
                            class="absolute inset-0 opacity-0 hover:opacity-25 bg-blue-100 border-2 border-dashed border-blue-300 rounded transition-opacity duration-200"
                            style="pointer-events: none;"
                          ></div>

                          {#each level2.level3Items as level3 (level3.id)}
                            {#each level3.items as item (item.id)}
                              {@const skuContent = item.content.replace('📦 ', '')}
                              {@const skuData = skuPriceData.find(d => d.sku === skuContent)}
                          <div class="bg-red-100 border border-red-300 rounded p-2 text-xs cursor-move draggable sortable-item flex justify-between items-center relative z-10"
                               role="button"
                               tabindex="0"
                               draggable="true"
                               data-item-id={item.id}
                               data-level3-id={level3.id}
                               data-target-item-id={item.id}
                               data-from-level2-id={level2.id}
                               data-from-level1-id={level1.id}
                               data-level1-id={level1.id}
                               data-level2-id={level2.id}
                               on:dragstart={handleDragStart}
                               on:dragend={handleDragEnd}
                               on:dragover={handleDragOver}
                               on:drop={handleDrop}>
                                <div class="flex-1">
                                  <div class="font-medium">{skuData?.name || skuContent}</div>
                                  <div class="text-xs text-gray-600">{item.content.replace('📦 ', '')} • ${skuData?.price || '0.00'}</div>
                                </div>
                            <button
                              on:click={() => {
                                removeItem(level1.id, level2.id, level3.id, item.id);
                              }}
                              class="text-red-600 hover:text-red-800 ml-1"
                              title="Remove Item"
                            >
                              ×
                            </button>
                              </div>
                            {/each}
                          {/each}

                          <!-- Empty state message when no items -->
                          {#if level2.level3Items.length === 0 || level2.level3Items.every(level3 => level3.items.length === 0)}
                            <div class="text-center py-4 text-gray-500 text-sm">
                              Drop items here to add to this catalogue
                            </div>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/each}
              </div>
            </div>

            <!-- Right Column - Saved Sessions -->
            <div class="col-span-3">
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <h3 class="text-lg font-semibold text-gray-800">Saved Sessions</h3>
                  <button
                    on:click={loadSavedSessions}
                    disabled={loadingSessions}
                    class="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 transition-colors disabled:opacity-50"
                    title="Refresh Sessions"
                  >
                    🔄 {loadingSessions ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {#if loadingSessions}
                  <div class="bg-gray-50 rounded-lg p-4 text-center">
                    <div class="text-gray-600">Loading sessions...</div>
                  </div>
                {:else if savedSessions.length === 0}
                  <div class="bg-gray-50 rounded-lg p-4 text-center">
                    <div class="text-gray-600 mb-2">No saved sessions yet</div>
                    <div class="text-sm text-gray-500">Save your catalogue to create sessions</div>
                  </div>
                {:else}
                  <div class="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div class="space-y-2">
                      {#each savedSessions as session (session.id)}
                        <div class="border border-gray-200 rounded p-3 hover:bg-gray-50 transition-colors">
                          <div class="flex justify-between items-start mb-2">
                            <div class="flex-1 min-w-0">
                              <div class="font-medium text-gray-900 truncate" title={session.session_name}>
                                {session.session_name}
                              </div>
                              <div class="text-xs text-gray-500">
                                {new Date(session.created_at).toLocaleDateString()}
                                {#if session.is_template}
                                  <span class="ml-1 px-1 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Template</span>
                                {/if}
                              </div>
                            </div>
                            <div class="flex space-x-1 ml-2">
                              <button
                                on:click={() => loadCatalogueSession(session.id)}
                                class="text-blue-600 hover:text-blue-800 p-1"
                                title="Load Session"
                              >
                                📂
                              </button>
                              <button
                                on:click={() => deleteSession(session.id, session.session_name)}
                                class="text-red-600 hover:text-red-800 p-1"
                                title="Delete Session"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                          {#if currentSessionId === session.id}
                            <div class="text-xs text-green-600 font-medium">
                              ✓ Currently loaded
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="px-8 py-4 border-t border-gray-200 bg-gray-50">
          <div class="flex justify-between items-center">
            <div class="flex items-center space-x-2">
              {#if currentSessionId}
                <span class="text-sm text-gray-600">Current Session: <strong>{currentSessionName}</strong></span>
              {/if}
            </div>
            <div class="flex space-x-3">
              <button
                on:click={openSaveDialog}
                class="bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors font-semibold shadow-md hover:shadow-lg"
              >
                💾 Save Session
              </button>
              <button
                on:click={submitCatalogue}
                class="bg-[rgb(148,186,77)] text-white px-6 py-3 rounded-lg hover:bg-[rgb(122,157,61)] transition-colors font-semibold text-lg shadow-md hover:shadow-lg"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Save Session Dialog -->
  {#if showSaveDialog}
    <div class="fixed inset-0 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1" on:keydown={(e) => { if (e.key === 'Escape') closeSaveDialog(); }}>
      <button class="absolute inset-0 bg-black bg-opacity-50" on:click={closeSaveDialog} aria-label="Close dialog"></button>
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative z-10" role="document">
        <h3 id="dialog-title" class="text-lg font-semibold text-gray-800 mb-4">Save Catalogue Session</h3>

        <div class="mb-4">
          <label for="sessionName" class="block text-sm font-medium text-gray-700 mb-2">
            Session Name
          </label>
          <input
            id="sessionName"
            type="text"
            bind:value={currentSessionName}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter session name..."
            on:keydown={(e) => {
              if (e.key === 'Enter') {
                handleSaveSession();
              }
            }}
          />
        </div>

        <div class="flex justify-end space-x-3">
          <button
            on:click={closeSaveDialog}
            class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            on:click={handleSaveSession}
            class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors font-semibold"
          >
            Save Session
          </button>
        </div>
      </div>
    </div>
  {/if}

