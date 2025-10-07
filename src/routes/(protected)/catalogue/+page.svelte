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
    let skuText = '';
    let skuList: string[] = [];
    let failedSkus: string[] = [];
    let updatingApiData: boolean = false;

    let skuPriceData: any[] = [];
    let inputPrices: { [sku: string]: string } = {}; // Store prices from textarea input
    let skuSearchTerm: string = '';

    // Session management
    let currentSessionId: string | null = null;
    let currentSessionName: string = '';
    let showSaveDialog: boolean = false;

    // Dynamic hierarchy data structure
    let hierarchy: any[] = [
      {
        id: 1,
        type: 'pageHeader',
        title: 'Page Header 1',
        level2Items: []
      },
      {
        id: 2,
        type: 'productRange',
        title: '',
        level2Items: [
          {
            id: 3,
            title: '',
            level3Items: []
          },
          {
            id: 4,
            title: '',
            level3Items: []
          }
        ]
      }
    ];

    let nextId = 5; // For generating unique IDs

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
      for (const item of hierarchy) {
        for (const level2 of item.level2Items) {
          for (const level3 of level2.level3Items) {
            for (const skuItem of level3.items) {
              // Extract SKU from item content (remove the 📦 prefix)
              const itemSku = skuItem.content.replace('📦 ', '');
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
        if (!user?.uid) {
          throw new Error('User not authenticated');
        }

        const pageHeaders = hierarchy.filter(item => item.type === 'pageHeader');
        const productRanges = hierarchy.filter(item => item.type === 'productRange');

        const catalogueData = {
          pageHeaders: pageHeaders.map(header => ({
            title: header.title || 'Unnamed Page Header',
            categories: header.level2Items.map(level2 => ({
              name: level2.title || 'Unnamed Category',
              products: level2.level3Items.flatMap(level3 =>
                level3.items.map(item => {
                  const skuContent = item.content.replace('📦 ', '');
                  const skuData = skuPriceData.find(d => d.sku === skuContent);
                  return {
                    sku: skuContent,
                    name: skuData?.name || skuContent.toUpperCase(),
                    price: (() => {
                      const inputPrice = inputPrices[skuContent];
                      const displayPrice = inputPrice || skuData?.price || '0.00';
                      return `$${displayPrice}`;
                    })(),
                    image: skuData?.image || null,
                    description: skuData?.description || '',
                    certifications: skuData?.certifications || []
                  };
                })
              )
            }))
          })),
          productRanges: productRanges.map(range => ({
            title: range.title || 'Unnamed Range',
            categories: range.level2Items.map(level2 => ({
              name: level2.title || 'Unnamed Category',
              products: level2.level3Items.flatMap(level3 =>
                level3.items.map(item => {
                  const skuContent = item.content.replace('📦 ', '');
                  const skuData = skuPriceData.find(d => d.sku === skuContent);
                  return {
                    sku: skuContent,
                    name: skuData?.name || skuContent.toUpperCase(),
                    price: (() => {
                      const inputPrice = inputPrices[skuContent];
                      const displayPrice = inputPrice || skuData?.price || '0.00';
                      return `$${displayPrice}`;
                    })(),
                    image: skuData?.image || null,
                    description: skuData?.description || '',
                    certifications: skuData?.certifications || []
                  };
                })
              )
            }))
          }))
        };

        const { data, error } = await supabase
          .from('catalogue_sessions')
          .insert({
            user_id: user.uid, // Use Firebase UID directly
            session_name: sessionName,
            catalogue_data: catalogueData,
            available_skus: skuPriceData,
            input_prices: inputPrices,
            is_template: isTemplate
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
        if (!user?.uid) {
          throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
          .from('catalogue_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', user.uid)
          .single();

        if (error) throw error;

        // Set current session info
        currentSessionId = data.id;
        currentSessionName = data.session_name;

        // Restore catalogue data
        const catalogueData = data.catalogue_data;

        // Restore available SKUs
        skuPriceData = data.available_skus || [];

        // Restore input prices
        inputPrices = data.input_prices || {};

        // Reconstruct hierarchy from catalogue data
        if (catalogueData && (catalogueData.pageHeaders || catalogueData.productRanges)) {
          const newHierarchy = [];

          // Add page headers
          if (catalogueData.pageHeaders) {
            catalogueData.pageHeaders.forEach((pageHeader, headerIndex) => {
              const pageHeaderId = nextId++;
              newHierarchy.push({
                id: pageHeaderId,
                type: 'pageHeader',
                title: pageHeader.title || `Page Header ${headerIndex + 1}`,
                level2Items: pageHeader.categories.map((category, categoryIndex) => {
                  const level2Id = nextId++;
                  // Group products into level3 containers (max 10 per container)
                  const level3Items = [];
                  const products = category.products || [];

                  for (let i = 0; i < products.length; i += 10) {
                    const level3Id = nextId++;
                    const productsSlice = products.slice(i, i + 10);
                    level3Items.push({
                      id: level3Id,
                      title: 'Level 3',
                      items: productsSlice.map(product => ({
                        id: nextId++,
                        content: `📦 ${product.sku}`
                      }))
                    });
                  }

                  return {
                    id: level2Id,
                    title: category.name || 'Unnamed Category',
                    level3Items
                  };
                })
              });
            });
          }

          // Add product ranges
          if (catalogueData.productRanges) {
            catalogueData.productRanges.forEach((range, rangeIndex) => {
              const productRangeId = nextId++;
              newHierarchy.push({
                id: productRangeId,
                type: 'productRange',
                title: range.title || 'Unnamed Range',
                level2Items: range.categories.map((category, categoryIndex) => {
                  const level2Id = nextId++;
                  // Group products into level3 containers (max 10 per container)
                  const level3Items = [];
                  const products = category.products || [];

                  for (let i = 0; i < products.length; i += 10) {
                    const level3Id = nextId++;
                    const productsSlice = products.slice(i, i + 10);
                    level3Items.push({
                      id: level3Id,
                      title: 'Level 3',
                      items: productsSlice.map(product => ({
                        id: nextId++,
                        content: `📦 ${product.sku}`
                      }))
                    });
                  }

                  return {
                    id: level2Id,
                    title: category.name || 'Unnamed Category',
                    level3Items
                  };
                })
              });
            });
          }

          hierarchy = newHierarchy;
        } else {
          // If no catalogue data, reset to default hierarchy
          hierarchy = [
            {
              id: nextId++,
              type: 'pageHeader',
              title: 'Page Header 1',
              level2Items: []
            },
            {
              id: nextId++,
              type: 'productRange',
              title: '',
              level2Items: [
                {
                  id: nextId++,
                  title: '',
                  level3Items: []
                },
                {
                  id: nextId++,
                  title: '',
                  level3Items: []
                }
              ]
            }
          ];
        }
        
        console.log('Reconstructed hierarchy:', hierarchy);

        // Update skuList to only include SKUs that are not in the catalogue
        const skusInCatalogue = new Set();
        hierarchy.forEach(item => {
          item.level2Items.forEach(level2 => {
            level2.level3Items.forEach(level3 => {
              level3.items.forEach(skuItem => {
                const sku = skuItem.content.replace('📦 ', '');
                skusInCatalogue.add(sku);
              });
            });
          });
        });

        // Filter out SKUs that are already in the catalogue
        skuList = skuPriceData
          .map(item => item.sku)
          .filter(sku => !skusInCatalogue.has(sku));

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
      // Don't pre-fill with current session name for "Save as" functionality
      currentSessionName = `Catalogue ${timestamp}`;
      showSaveDialog = true;
    }

    // Close save dialog
    function closeSaveDialog() {
      showSaveDialog = false;
    }

    // Handle update current session
    async function handleUpdateSession() {
      if (!currentSessionId) {
        toastWarning('No current session to update', 'No Session');
        return;
      }

      try {
        // Update the existing session with current data
        const { data, error } = await supabase
          .from('catalogue_sessions')
          .update({
            catalogue_data: (() => {
              // Build JSON structure matching catalogue-data.json format
              const pageHeaders = hierarchy.filter(item => item.type === 'pageHeader');
              const productRanges = hierarchy.filter(item => item.type === 'productRange');

              return {
                pageHeaders: pageHeaders.map(header => ({
                  title: header.title || 'Unnamed Page Header',
                  categories: header.level2Items.map(level2 => ({
                    name: level2.title || 'Unnamed Category',
                    products: level2.level3Items.flatMap(level3 =>
                      level3.items.map(item => {
                        const skuContent = item.content.replace('📦 ', '');
                        const skuData = skuPriceData.find(d => d.sku === skuContent);
                        return {
                          sku: skuContent,
                          name: skuData?.name || skuContent.toUpperCase(),
                          price: (() => {
                            const inputPrice = inputPrices[skuContent];
                            const displayPrice = inputPrice || skuData?.price || '0.00';
                            return `$${displayPrice}`;
                          })(),
                          image: skuData?.image || null,
                          description: skuData?.description || '',
                          certifications: skuData?.certifications || []
                        };
                      })
                    )
                  }))
                })),
                productRanges: productRanges.map(range => ({
                  title: range.title || 'Unnamed Range',
                  categories: range.level2Items.map(level2 => ({
                    name: level2.title || 'Unnamed Category',
                    products: level2.level3Items.flatMap(level3 =>
                      level3.items.map(item => {
                        const skuContent = item.content.replace('📦 ', '');
                        const skuData = skuPriceData.find(d => d.sku === skuContent);
                        return {
                          sku: skuContent,
                          name: skuData?.name || skuContent.toUpperCase(),
                          price: (() => {
                            const inputPrice = inputPrices[skuContent];
                            const displayPrice = inputPrice || skuData?.price || '0.00';
                            return `$${displayPrice}`;
                          })(),
                          image: skuData?.image || null,
                          description: skuData?.description || '',
                          certifications: skuData?.certifications || []
                        };
                      })
                    )
                  }))
                }))
              };
            })(),
            available_skus: skuPriceData,
            input_prices: inputPrices,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentSessionId)
          .select()
          .single();

        if (error) throw error;

        toastSuccess(`Session "${currentSessionName}" updated successfully!`, 'Session Updated');
        await loadSavedSessions(); // Refresh the sessions list
      } catch (error) {
        console.error('Error updating session:', error);
        toastWarning('Failed to update session', 'Update Error');
      }
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
          .eq('user_id', user.uid)
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
        if (!user?.uid) {
          throw new Error('User not authenticated');
        }

        const { error } = await supabase
          .from('catalogue_sessions')
          .delete()
          .eq('id', sessionId)
          .eq('user_id', user.uid);

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

    // Function to submit catalogue data for printing
    async function submitCatalogue() {
      try {
        // Auto-save if not already saved
        if (!currentSessionId) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const defaultName = `Catalogue ${timestamp}`;
          await saveCatalogueSession(defaultName);
        }

        // Navigate to print page with session ID
        const printUrl = `/catalogue/print?sessionId=${currentSessionId}`;
        window.open(printUrl, '_blank');
      } catch (error) {
        console.error('Error during print process:', error);
        toastWarning('Failed to prepare catalogue for printing', 'Print Error');
      }
    }

    // Move item up in the catalogue
    function moveItemUp(itemId: number, level2Id: number, level3Id: number, itemToMoveId: number) {
      hierarchy = hierarchy.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            level2Items: item.level2Items.map(level2 => {
              if (level2.id === level2Id) {
                return {
                  ...level2,
                  level3Items: level2.level3Items.map(level3 => {
                    if (level3.id === level3Id) {
                      const itemIndex = level3.items.findIndex(item => item.id === itemToMoveId);
                      if (itemIndex > 0) {
                        // Move within the same level3 container
                        const newItems = [...level3.items];
                        [newItems[itemIndex - 1], newItems[itemIndex]] = [newItems[itemIndex], newItems[itemIndex - 1]];
                        return {
                          ...level3,
                          items: newItems
                        };
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
        return item;
      });
    }

    // Move page header up
    function movePageHeaderUp(pageHeaderId: number) {
      const headerIndex = hierarchy.findIndex(item => item.id === pageHeaderId && item.type === 'pageHeader');
      if (headerIndex > 0) {
        const newHierarchy = [...hierarchy];
        [newHierarchy[headerIndex - 1], newHierarchy[headerIndex]] = [newHierarchy[headerIndex], newHierarchy[headerIndex - 1]];
        hierarchy = newHierarchy;
      }
    }

    // Move page header down
    function movePageHeaderDown(pageHeaderId: number) {
      const headerIndex = hierarchy.findIndex(item => item.id === pageHeaderId && item.type === 'pageHeader');
      if (headerIndex < hierarchy.length - 1) {
        const newHierarchy = [...hierarchy];
        [newHierarchy[headerIndex], newHierarchy[headerIndex + 1]] = [newHierarchy[headerIndex + 1], newHierarchy[headerIndex]];
        hierarchy = newHierarchy;
      }
    }

    // Move product range up
    function moveProductRangeUp(productRangeId: number) {
      const rangeIndex = hierarchy.findIndex(item => item.id === productRangeId && item.type === 'productRange');
      if (rangeIndex > 0) {
        const newHierarchy = [...hierarchy];
        [newHierarchy[rangeIndex - 1], newHierarchy[rangeIndex]] = [newHierarchy[rangeIndex], newHierarchy[rangeIndex - 1]];
        hierarchy = newHierarchy;
      }
    }

    // Move product range down
    function moveProductRangeDown(productRangeId: number) {
      const rangeIndex = hierarchy.findIndex(item => item.id === productRangeId && item.type === 'productRange');
      if (rangeIndex < hierarchy.length - 1) {
        const newHierarchy = [...hierarchy];
        [newHierarchy[rangeIndex], newHierarchy[rangeIndex + 1]] = [newHierarchy[rangeIndex + 1], newHierarchy[rangeIndex]];
        hierarchy = newHierarchy;
      }
    }

    // Move level2 item up within a product range
    function moveLevel2Up(itemId: number, level2Id: number) {
      hierarchy = hierarchy.map(item => {
        if (item.id === itemId) {
          const level2Index = item.level2Items.findIndex(level2 => level2.id === level2Id);
          if (level2Index > 0) {
            const newLevel2Items = [...item.level2Items];
            [newLevel2Items[level2Index - 1], newLevel2Items[level2Index]] = [newLevel2Items[level2Index], newLevel2Items[level2Index - 1]];
            return {
              ...item,
              level2Items: newLevel2Items
            };
          }
        }
        return item;
      });
    }

    // Move level2 item down within a product range
    function moveLevel2Down(itemId: number, level2Id: number) {
      hierarchy = hierarchy.map(item => {
        if (item.id === itemId) {
          const level2Index = item.level2Items.findIndex(level2 => level2.id === level2Id);
          if (level2Index < item.level2Items.length - 1) {
            const newLevel2Items = [...item.level2Items];
            [newLevel2Items[level2Index], newLevel2Items[level2Index + 1]] = [newLevel2Items[level2Index + 1], newLevel2Items[level2Index]];
            return {
              ...item,
              level2Items: newLevel2Items
            };
          }
        }
        return item;
      });
    }

    // Move item down in the catalogue
    function moveItemDown(itemId: number, level2Id: number, level3Id: number, itemToMoveId: number) {
      hierarchy = hierarchy.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            level2Items: item.level2Items.map(level2 => {
              if (level2.id === level2Id) {
                return {
                  ...level2,
                  level3Items: level2.level3Items.map(level3 => {
                    if (level3.id === level3Id) {
                      const itemIndex = level3.items.findIndex(item => item.id === itemToMoveId);
                      if (itemIndex < level3.items.length - 1) {
                        // Move within the same level3 container
                        const newItems = [...level3.items];
                        [newItems[itemIndex], newItems[itemIndex + 1]] = [newItems[itemIndex + 1], newItems[itemIndex]];
                        return {
                          ...level3,
                          items: newItems
                        };
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
        return item;
      });
    }

    // Add new page header
    function addPageHeader() {
      const pageHeaderCount = hierarchy.filter(item => item.type === 'pageHeader').length + 1;
      hierarchy = [...hierarchy, {
        id: nextId++,
        type: 'pageHeader',
        title: `Page Header ${pageHeaderCount}`,
        level2Items: []
      }];
    }

    // Remove page header
    function removePageHeader(pageHeaderId: number) {
      hierarchy = hierarchy.filter(header => header.id !== pageHeaderId);
    }

    // Add new product range
    function addProductRange() {
      const productRangeCount = hierarchy.filter(item => item.type === 'productRange').length + 1;
      hierarchy = [...hierarchy, {
        id: nextId++,
        type: 'productRange',
        title: `Product Range ${productRangeCount}`,
        level2Items: []
      }];
    }

    // Remove product range
    function removeProductRange(productRangeId: number) {
      hierarchy = hierarchy.filter(item => item.id !== productRangeId);
    }


    // Add level 2 container to an item (page header or product range)
    function addLevel2(itemId: number) {
      hierarchy = hierarchy.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            level2Items: [...item.level2Items, {
              id: nextId++,
              title: '',
              level3Items: []
            }]
          };
        }
        return item;
      });
    }

    // Remove level 2 container
    function removeLevel2(itemId: number, level2Id: number) {
      hierarchy = hierarchy.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            level2Items: item.level2Items.filter(level2 => level2.id !== level2Id)
          };
        }
        return item;
      });
    }


    // Add item to level 2 container (creates level 3 if needed)
    function addItemToLevel2(itemId: number, level2Id: number) {
      hierarchy = hierarchy.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            level2Items: item.level2Items.map(level2 => {
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
        return item;
      });
    }

    // Add item to level 3 container (legacy function, keeping for compatibility)
    function addItem(itemId: number, level2Id: number, level3Id: number) {
      hierarchy = hierarchy.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            level2Items: item.level2Items.map(level2 => {
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
        return item;
      });
    }

    // Remove item from level 3 container
    function removeItem(parentItemId: number, level2Id: number, level3Id: number, itemId: number) {
      let removedItem: any = null;

      // First, find the item to be removed
      hierarchy.forEach(item => {
        if (item.id === parentItemId) {
          item.level2Items.forEach(level2 => {
            if (level2.id === level2Id) {
              level2.level3Items.forEach(level3 => {
                if (level3.id === level3Id) {
                  level3.items.forEach(skuItem => {
                    if (skuItem.id === itemId) {
                      removedItem = skuItem;
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
      hierarchy = hierarchy.map(item => {
        if (item.id === parentItemId) {
          return {
            ...item,
            level2Items: item.level2Items.map(level2 => {
              if (level2.id === level2Id) {
                return {
                  ...level2,
                  level3Items: level2.level3Items.map(level3 => {
                    if (level3.id === level3Id) {
                      return {
                        ...level3,
                        items: level3.items.filter(skuItem => skuItem.id !== itemId)
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
        return item;
      });
    }

    // Process SKUs from textarea
    async function processSKUs() {
      if (skuText.trim()) {
        // Split by newlines first to get each line
        const lines = skuText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        const skusToProcess: string[] = [];
        const errors: string[] = [];
        const newInputPrices: { [sku: string]: string } = {};

        for (const line of lines) {
          // Accept either just SKU or SKU,price format
          const parts = line.split(',').map(part => part.trim());
          const sku = parts[0];
          const price = parts[1]; // Price from textarea input

          if (sku) {
            skusToProcess.push(sku);
            // Store input price if provided - this will be used instead of API price
            if (price && !isNaN(parseFloat(price))) {
              newInputPrices[sku] = price;
            }
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

        // Always fetch API data for all SKUs to get accurate API prices
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
            const sku = skusToProcess[index];
            // If input price was provided, keep the API data but we'll override display price later
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
        inputPrices = newInputPrices; // Store the input prices
        skuList = uniqueData.map(item => item.sku); // Keep skuList for backward compatibility
        failedSkus = apiErrors; // Store failed SKUs for display
        skuText = ''; // Clear the textarea after processing

        // Build JSON structure matching catalogue-data.json format
        const pageHeaders = hierarchy.filter(item => item.type === 'pageHeader');
        const productRanges = hierarchy.filter(item => item.type === 'productRange');

        const jsonData = {
          pageHeaders: pageHeaders.map(header => ({
            title: header.title || 'Unnamed Page Header',
            categories: header.level2Items.map(level2 => ({
              name: level2.title || 'Unnamed Category',
              products: level2.level3Items.flatMap(level3 =>
                level3.items.map(item => {
                  const skuContent = item.content.replace('📦 ', '');
                  const skuData = uniqueData.find(d => d.sku === skuContent);
                  return {
                    sku: skuContent,
                    name: skuData?.name || skuContent.toUpperCase(),
                    price: (() => {
                      const inputPrice = inputPrices[skuContent];
                      const displayPrice = inputPrice || skuData?.price || '0.00';
                      return `$${displayPrice}`;
                    })(),
                    image: skuData?.image || null,
                    description: skuData?.description || '',
                    certifications: skuData?.certifications || []
                  };
                })
              )
            }))
          })),
          productRanges: productRanges.map(range => ({
            title: range.title || 'Unnamed Range',
            categories: range.level2Items.map(level2 => ({
              name: level2.title || 'Unnamed Category',
              products: level2.level3Items.flatMap(level3 =>
                level3.items.map(item => {
                  const skuContent = item.content.replace('📦 ', '');
                  const skuData = uniqueData.find(d => d.sku === skuContent);
                  return {
                    sku: skuContent,
                    name: skuData?.name || skuContent.toUpperCase(),
                    price: (() => {
                      const inputPrice = inputPrices[skuContent];
                      const displayPrice = inputPrice || skuData?.price || '0.00';
                      return `$${displayPrice}`;
                    })(),
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

    // Update API data for existing SKUs
    async function updateApiData() {
      // Collect all unique SKUs from both available list and hierarchy
      const allSkus = new Set([...skuList]);

      // Add SKUs from hierarchy
      hierarchy.forEach(item => {
        item.level2Items.forEach(level2 => {
          level2.level3Items.forEach(level3 => {
            level3.items.forEach(skuItem => {
              const sku = skuItem.content.replace('📦 ', '');
              allSkus.add(sku);
            });
          });
        });
      });

      const uniqueSkus = Array.from(allSkus);

      if (uniqueSkus.length === 0) {
        toastWarning('No SKUs available to update', 'No SKUs');
        return;
      }

      updatingApiData = true;
      try {
        toastInfo(`Updating API data for ${uniqueSkus.length} SKU${uniqueSkus.length > 1 ? 's' : ''}...`, 'Updating');

        // Fetch updated data for all SKUs
        const fetchPromises = uniqueSkus.map(sku => fetchProductData(sku));
        const fetchResults = await Promise.all(fetchPromises);

        const updatedData: Array<{
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
            updatedData.push(result);
          } else {
            apiErrors.push(uniqueSkus[index]);
          }
        });

        // Update skuPriceData with new information
        updatedData.forEach(newData => {
          const existingIndex = skuPriceData.findIndex(d => d.sku === newData.sku);
          if (existingIndex !== -1) {
            // Preserve input prices if they exist
            const inputPrice = inputPrices[newData.sku];
            skuPriceData[existingIndex] = newData;
            // Re-apply input price if it was set
            if (inputPrice) {
              inputPrices[newData.sku] = inputPrice;
            }
          } else {
            skuPriceData.push(newData);
          }
        });

        // Trigger reactivity
        skuPriceData = [...skuPriceData];
        inputPrices = { ...inputPrices };

        if (updatedData.length > 0) {
          toastSuccess(`Successfully updated API data for ${updatedData.length} SKU${updatedData.length > 1 ? 's' : ''}!`, 'API Data Updated');
        }

        if (apiErrors.length > 0) {
          toastWarning(`${apiErrors.length} SKU${apiErrors.length > 1 ? 's' : ''} failed to update from API: ${apiErrors.join(', ')}`, 'Update Errors');
        }

      } catch (error) {
        console.error('Error updating API data:', error);
        toastWarning('Failed to update API data', 'Update Error');
      } finally {
        updatingApiData = false;
      }
    }

    // Add SKU to a catalogue
    function addSKUToCatalogue(itemId: number, level2Id: number, skuContent: string) {
      // Check if SKU already exists in any catalogue
      if (skuExistsInCatalogue(skuContent)) {
        toastWarning(`SKU "${skuContent}" already exists in catalogue`, 'Duplicate SKU');
        skuList = skuList.filter(sku => sku !== skuContent);
        return;
      }

      hierarchy = hierarchy.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            level2Items: item.level2Items.map(level2 => {
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

                // Add to the first available level 3 container that has space
                let added = false;
                for (let i = 0; i < level3Items.length; i++) {
                  if (level3Items[i].items.length < 10) {
                    level3Items[i] = {
                      ...level3Items[i],
                      items: [...level3Items[i].items, {
                        id: nextId++,
                        content: `📦 ${skuContent}`
                      }]
                    };
                    added = true;
                    break;
                  }
                }

                // If all containers are full, create a new one
                if (!added) {
                  level3Items = [...level3Items, {
                    id: nextId++,
                    title: 'Level 3',
                    items: [{
                      id: nextId++,
                      content: `📦 ${skuContent}`
                    }]
                  }];
                }

                return {
                  ...level2,
                  level3Items
                };
              }
              return level2;
            })
          };
        }
        return item;
      });

      // Remove the SKU from the list
      skuList = skuList.filter(sku => sku !== skuContent);
      toastInfo(`SKU "${skuContent}" added to catalogue`, 'SKU Added');
    }

  </script>

  <style>
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
                  <div class="flex justify-between items-center mb-2">
                    <label for="skus" class="block text-sm font-medium text-gray-700">SKUs (API Lookup)</label>
                    <button
                      on:click={updateApiData}
                      disabled={updatingApiData}
                      class="px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Update API data for all SKUs"
                    >
                      {updatingApiData ? '🔄 Updating...' : '🔄 Update API Data'}
                    </button>
                  </div>
                  <textarea
                    id="skus"
                    rows="8"
                    bind:value={skuText}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(148,186,77)] focus:border-[rgb(148,186,77)] resize-none"
                    placeholder="Enter SKUs here... (one per line, optional: SKU,price - API will fetch details, input price will override)"
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
                    <div class="flex justify-between items-center mb-2">
                      <h4 class="text-sm font-medium text-gray-700">Available SKUs</h4>
                      <input
                        type="text"
                        bind:value={skuSearchTerm}
                        class="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Search by name or SKU..."
                      />
                    </div>
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                      {#each skuList.filter(sku => {
                        if (!skuSearchTerm) return true;
                        const skuData = skuPriceData.find(d => d.sku === sku);
                        const searchLower = skuSearchTerm.toLowerCase();
                        const nameMatch = skuData?.name?.toLowerCase().includes(searchLower);
                        const skuMatch = sku.toLowerCase().includes(searchLower);
                        return nameMatch || skuMatch;
                      }) as sku, i (i)}
                        {@const skuData = skuPriceData.find(d => d.sku === sku)}
                        {@const inputPrice = inputPrices[sku]}
                        {@const displayPrice = inputPrice || skuData?.price || '0.00'}
                        {@const apiPrice = parseFloat(skuData?.price || '0')}
                        {@const inputPriceNum = parseFloat(inputPrice || '0')}
                        {@const isApiHigher = apiPrice > inputPriceNum && inputPrice}
                        {@const hasIncompleteData = !skuData?.image || !skuData?.description || skuData?.description?.trim() === ''}
                        <div
                          class="bg-orange-100 border border-orange-300 rounded p-2 text-sm flex justify-between items-center"
                        >
                          <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                              <a
                                href="https://www.rapidsupplies.com.au/_cpanel/products/view?sku={sku}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="font-medium hover:text-blue-600 hover:underline transition-colors"
                              >
                                {skuData?.name || sku}
                              </a>
                              {#if hasIncompleteData}
                                <span class="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-full font-medium">
                                  Incomplete
                                </span>
                              {/if}
                            </div>
                            <div class="text-xs text-gray-600">
                              {sku} •
                              <span class={isApiHigher ? 'text-green-600 font-semibold' : ''}>
                                ${displayPrice}
                              </span>
                              {#if inputPrice && skuData?.price}
                                <span class="text-gray-400">(API: ${skuData.price})</span>
                              {/if}
                            </div>
                          </div>
                          <div class="flex items-center gap-1 ml-2">
                            <select
                              class="text-xs px-2 py-1 border border-gray-300 rounded"
                              on:change={(e) => {
                                const target = e.target as HTMLSelectElement;
                                const catalogueId = parseInt(target.value);
                                if (catalogueId) {
                                  const productRange = hierarchy.find(item => item.type === 'productRange');
                                  if (productRange) {
                                    const catalogue = productRange.level2Items.find(l2 => l2.id === catalogueId);
                                    if (catalogue) {
                                      addSKUToCatalogue(productRange.id, catalogueId, sku);
                                      target.value = ''; // Reset dropdown
                                    }
                                  }
                                }
                              }}
                            >
                              <option value="">Add to...</option>
                              {#each hierarchy.filter(item => item.type === 'productRange') as productRange}
                                {#each productRange.level2Items as level2}
                                  <option value={level2.id}>{level2.title || 'Unnamed Catalogue'}</option>
                                {/each}
                              {/each}
                            </select>
                            <button
                              on:click={(e) => {
                                e.stopPropagation();
                                toastWarning(`SKU "${sku}" removed from list`, 'SKU Removed');
                                skuList = skuList.filter(s => s !== sku);
                                delete inputPrices[sku]; // Also remove from input prices
                                inputPrices = { ...inputPrices }; // Trigger reactivity
                              }}
                              class="text-orange-600 hover:text-orange-800"
                              title="Remove SKU"
                            >
                              ×
                            </button>
                          </div>
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
              <div class="space-y-4 max-h-[70vh] overflow-y-auto">
                <div class="flex justify-between items-center">
                  <h3 class="text-lg font-semibold text-gray-800">Dynamic Hierarchy</h3>
                </div>

                {#each hierarchy as item, itemIndex (item.id)}
                  {@const isPageHeader = item.type === 'pageHeader'}
                  {@const isProductRange = item.type === 'productRange'}
                  {@const pageHeaderCount = hierarchy.slice(0, itemIndex + 1).filter(h => h.type === 'pageHeader').length}
                  <div class="{isPageHeader ? 'bg-purple-50 border-purple-200 min-h-[80px]' : 'bg-blue-50 border-blue-200 min-h-[150px]'} border-2 rounded-lg p-4"
                       role="region">

                    <div class="flex justify-between items-center mb-3">
                      {#if isPageHeader}
                        <div class="flex items-center gap-2">
                          <span class="text-lg font-bold text-purple-800">
                            Page {pageHeaderCount}
                          </span>
                        </div>
                      {:else}
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-800">
                            Product Range
                          </span>
                          <input
                            type="text"
                            bind:value={item.title}
                            class="flex-1 text-md font-medium text-blue-800 bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-400 rounded px-2 py-1"
                            placeholder="Product Range"
                          />
                        </div>
                      {/if}
                      <div class="flex space-x-1 ml-2">
                        <button
                          on:click={() => isPageHeader ? movePageHeaderUp(item.id) : moveProductRangeUp(item.id)}
                          class="text-gray-600 hover:text-gray-800 text-xs px-1"
                          title="Move Up"
                          disabled={hierarchy.findIndex(h => h.id === item.id) === 0}
                        >
                          ▲
                        </button>
                        <button
                          on:click={() => isPageHeader ? movePageHeaderDown(item.id) : moveProductRangeDown(item.id)}
                          class="text-gray-600 hover:text-gray-800 text-xs px-1"
                          title="Move Down"
                          disabled={hierarchy.findIndex(h => h.id === item.id) === hierarchy.length - 1}
                        >
                          ▼
                        </button>
                        <button
                          on:click={() => isPageHeader ? removePageHeader(item.id) : removeProductRange(item.id)}
                          class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition-colors"
                          title={isPageHeader ? 'Remove Page Header' : 'Remove Product Range'}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {#if item.type === 'productRange'}
                      {#each item.level2Items as level2 (level2.id)}
                      <div
                        class="bg-green-50 border-2 border-green-200 rounded-lg p-3 mb-3 min-h-[120px]"
                        role="region"
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
                                          price: (() => {
                      const inputPrice = inputPrices[skuContent];
                      const displayPrice = inputPrice || skuData?.price || '0.00';
                      return `$${displayPrice}`;
                    })(),
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
                              on:click={() => moveLevel2Up(item.id, level2.id)}
                              class="text-gray-600 hover:text-gray-800 text-xs px-1"
                              title="Move Up"
                              disabled={item.level2Items.findIndex(l2 => l2.id === level2.id) === 0}
                            >
                              ▲
                            </button>
                            <button
                              on:click={() => moveLevel2Down(item.id, level2.id)}
                              class="text-gray-600 hover:text-gray-800 text-xs px-1"
                              title="Move Down"
                              disabled={item.level2Items.findIndex(l2 => l2.id === level2.id) === item.level2Items.length - 1}
                            >
                              ▼
                            </button>
                            <button
                              on:click={() => removeLevel2(item.id, level2.id)}
                              class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition-colors"
                              title="Remove Catalogue"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        <!-- Items in this catalogue -->
                        <div class="space-y-1 min-h-[40px]">

                          {#each level2.level3Items as level3 (level3.id)}
                            {#each level3.items as skuItem (skuItem.id)}
                              {@const skuContent = skuItem.content.replace('📦 ', '')}
                              {@const skuData = skuPriceData.find(d => d.sku === skuContent)}
                              {@const inputPrice = inputPrices[skuContent]}
                              {@const displayPrice = inputPrice || skuData?.price || '0.00'}
                              {@const apiPrice = parseFloat(skuData?.price || '0')}
                              {@const inputPriceNum = parseFloat(inputPrice || '0')}
                              {@const isApiHigher = apiPrice > inputPriceNum && inputPrice}
                              {@const hasIncompleteData = !skuData?.image || !skuData?.description || skuData?.description?.trim() === ''}
                          {@const currentIndex = level3.items.findIndex(i => i.id === skuItem.id)}
                          <div class="bg-red-100 border border-red-300 rounded p-2 text-xs flex justify-between items-center">
                                <div class="flex-1">
                                  <div class="flex items-center gap-2 mb-1">
                                    <a
                                      href="https://www.rapidsupplies.com.au/_cpanel/products/view?sku={skuContent}"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      class="font-medium hover:text-blue-600 hover:underline transition-colors"
                                    >
                                      {skuData?.name || skuContent}
                                    </a>
                                    {#if hasIncompleteData}
                                      <span class="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-full font-medium">
                                        Incomplete
                                      </span>
                                    {/if}
                                  </div>
                                  <div class="text-xs text-gray-600">
                                    {skuItem.content.replace('📦 ', '')} •
                                    <span class={isApiHigher ? 'text-green-600 font-semibold' : ''}>
                                      ${displayPrice}
                                    </span>
                                    {#if inputPrice && skuData?.price}
                                      <span class="text-gray-400">(API: ${skuData.price})</span>
                                    {/if}
                                  </div>
                                </div>
                            <div class="flex flex-col gap-1 ml-2">
                              <button
                                on:click={() => moveItemUp(item.id, level2.id, level3.id, skuItem.id)}
                                class="text-gray-600 hover:text-gray-800 text-xs px-1"
                                title="Move Up"
                                disabled={currentIndex === 0}
                              >
                                ▲
                              </button>
                              <button
                                on:click={() => moveItemDown(item.id, level2.id, level3.id, skuItem.id)}
                                class="text-gray-600 hover:text-gray-800 text-xs px-1"
                                title="Move Down"
                                disabled={currentIndex === level3.items.length - 1}
                              >
                                ▼
                              </button>
                              <button
                                on:click={() => {
                                  removeItem(item.id, level2.id, level3.id, skuItem.id);
                                }}
                                class="text-red-600 hover:text-red-800 text-xs px-1"
                                title="Remove Item"
                              >
                                ×
                              </button>
                            </div>
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

                      <!-- Add Catalogue button at the bottom (only for product ranges) -->
                      {#if item.type === 'productRange'}
                        <div class="mt-3 text-center">
                          <button
                            on:click={() => addLevel2(item.id)}
                            class="bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600 transition-colors font-medium"
                            title="Add Catalogue"
                          >
                            + Add Catalogue
                          </button>
                        </div>
                      {/if}
                    {/if}
                  </div>
                {/each}

                <!-- Add buttons at the bottom -->
                <div class="flex justify-center gap-4 pt-4 border-t border-gray-200">
                  <button
                    on:click={addPageHeader}
                    class="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors font-semibold"
                  >
                    + Add Page Header
                  </button>
                  <button
                    on:click={addProductRange}
                    class="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-semibold"
                  >
                    + Add Product Range
                  </button>
                </div>
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
              {#if currentSessionId}
                <button
                  on:click={handleUpdateSession}
                  class="bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 transition-colors font-semibold shadow-md hover:shadow-lg"
                  title="Update the current session"
                >
                  🔄 Update Session
                </button>
              {/if}
              <button
                on:click={submitCatalogue}
                class="bg-[rgb(148,186,77)] text-white px-6 py-3 rounded-lg hover:bg-[rgb(122,157,61)] transition-colors font-semibold text-lg shadow-md hover:shadow-lg"
              >
                Print
              </button>
              <button
                on:click={openSaveDialog}
                class="bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors font-semibold shadow-md hover:shadow-lg"
                title="Save as new session"
              >
                💾 Save as
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
        <h3 id="dialog-title" class="text-lg font-semibold text-gray-800 mb-4">Save Catalogue Session As</h3>

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

