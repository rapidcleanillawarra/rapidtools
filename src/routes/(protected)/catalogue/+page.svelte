  <script lang="ts">
    import { fade } from 'svelte/transition';
    import { currentUser } from '$lib/firebase';
    import { userProfile, type UserProfile } from '$lib/userProfile';
    import { onMount } from 'svelte';
    import { toastSuccess, toastInfo, toastWarning } from '$lib/utils/toast';

    let user: any = null;
    let profile: UserProfile | null = null;
    let draggedElement: HTMLElement | null = null;
    let draggedOverElement: HTMLElement | null = null;
    let skuText = '';
    let skuList: string[] = [];

    // Dynamic hierarchy data structure
    let hierarchy: Array<{
      id: number;
      title: string;
      level2Items: Array<{
        id: number;
        title: string;
        level3Items: Array<{
          id: number;
          title: string;
          items: Array<{
            id: number;
            content: string;
          }>;
        }>;
      }>;
    }> = [
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

    // Function to print catalogue with JSON data
    async function printCatalogue() {
      try {
        // Fetch the catalogue data from the JSON file
        const response = await fetch('/catalogue-data.json');
        const catalogueData = await response.json();
        const encodedData = encodeURIComponent(JSON.stringify(catalogueData));
        window.open(`/catalogue/print?data=${encodedData}`, '_blank');
      } catch (error) {
        console.error('Error loading catalogue data:', error);
        // Fallback: redirect without data
        window.open('/catalogue/print', '_blank');
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
      draggedOverElement = null;
    }

    function handleDragOver(event: DragEvent) {
      event.preventDefault();
      draggedOverElement = event.currentTarget as HTMLElement;
    }

    function handleDrop(event: DragEvent) {
      event.preventDefault();
      draggedOverElement = event.currentTarget as HTMLElement;

      if (draggedElement && draggedOverElement && draggedElement !== draggedOverElement) {
        const skuContent = draggedElement.dataset.sku;
        const toLevel1Id = parseInt(draggedOverElement.dataset.level1Id || '0');
        const toLevel2Id = parseInt(draggedOverElement.dataset.level2Id || '0');

        // If dropping a SKU from the list to a catalogue
        if (skuContent && toLevel1Id && toLevel2Id) {
          addSKUToCatalogue(toLevel1Id, toLevel2Id, skuContent);
        } else {
          // Moving an item from one catalogue to another
          const fromItemId = parseInt(draggedElement.dataset.itemId || '0');
          const fromLevel3Id = parseInt(draggedElement.dataset.level3Id || '0');
          const fromLevel2Id = parseInt(draggedElement.dataset.fromLevel2Id || '0');
          const fromLevel1Id = parseInt(draggedElement.dataset.fromLevel1Id || '0');

          if (fromItemId && fromLevel3Id && fromLevel2Id && fromLevel1Id && toLevel1Id && toLevel2Id) {
            // Only move if it's to a different catalogue
            if (fromLevel1Id !== toLevel1Id || fromLevel2Id !== toLevel2Id) {
              moveItemToCatalogue(fromLevel1Id, fromLevel2Id, fromLevel3Id, fromItemId, toLevel1Id, toLevel2Id);
            }
          }
        }
      }
      draggedOverElement = null;
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
    function processSKUs() {
      if (skuText.trim()) {
        // Split by newlines, commas, or spaces and filter out empty items
        let processedSKUs = skuText
          .split(/[\n,]+/)
          .map(sku => sku.trim())
          .filter(sku => sku.length > 0);

        // Filter out duplicates and SKUs that already exist in catalogues
        const uniqueSKUs: string[] = [];
        const duplicateSKUs: string[] = [];
        const existingSKUs: string[] = [];

        for (const sku of processedSKUs) {
          if (uniqueSKUs.includes(sku)) {
            duplicateSKUs.push(sku);
          } else if (skuExistsInCatalogue(sku)) {
            existingSKUs.push(sku);
          } else {
            uniqueSKUs.push(sku);
          }
        }

        skuList = uniqueSKUs;
        skuText = ''; // Clear the textarea after processing

        if (uniqueSKUs.length > 0) {
          toastSuccess(`Processed ${uniqueSKUs.length} SKU${uniqueSKUs.length > 1 ? 's' : ''} successfully!`, 'SKUs Processed');
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
    }

    // Move item from one catalogue to another
    function moveItemToCatalogue(fromLevel1Id: number, fromLevel2Id: number, fromLevel3Id: number, fromItemId: number, toLevel1Id: number, toLevel2Id: number) {
      let itemToMove: any = null;

      // First, find and remove the item from the source catalogue
      hierarchy = hierarchy.map(level1 => {
        if (level1.id === fromLevel1Id) {
          return {
            ...level1,
            level2Items: level1.level2Items.map(level2 => {
              if (level2.id === fromLevel2Id) {
                return {
                  ...level2,
                  level3Items: level2.level3Items.map(level3 => {
                    if (level3.id === fromLevel3Id) {
                      const itemIndex = level3.items.findIndex(item => item.id === fromItemId);
                      if (itemIndex !== -1) {
                        itemToMove = level3.items[itemIndex];
                        const newItems = [...level3.items];
                        newItems.splice(itemIndex, 1);
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
        return level1;
      });

      // Then, add the item to the target catalogue
      if (itemToMove) {
        // Extract SKU from the item content
        const itemSku = itemToMove.content.replace('📦 ', '');

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
        hierarchy = hierarchy.map(level1 => {
          if (level1.id === toLevel1Id) {
            return {
              ...level1,
              level2Items: level1.level2Items.map(level2 => {
                if (level2.id === toLevel2Id) {
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

                  // Add item to the target level 3 container
                  level3Items[targetLevel3Index] = {
                    ...level3Items[targetLevel3Index],
                    items: [...level3Items[targetLevel3Index].items, itemToMove]
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

        toastInfo(`Item moved to catalogue`, 'Item Moved');
      }
    }
  </script>

  <div class="container mx-auto px-4 py-8" in:fade>
    <div class="max-w-4xl mx-auto">
      <div class="bg-white shadow-lg rounded-lg overflow-hidden">
        <!-- Page Header -->
        <div class="px-6 py-6 border-b border-gray-200">
          <h2 class="text-2xl font-bold text-gray-800">Create Product Catalogue</h2>
        </div>

        <div id="page-content" class="px-6 py-8">
          <div class="grid grid-cols-12 gap-6">
            <!-- Left Column - SKUs -->
            <div class="col-span-4">
              <div class="space-y-4">
                <!-- SKUs Textarea -->
                <div class="bg-gray-50 rounded-lg p-4">
                  <label for="skus" class="block text-sm font-medium text-gray-700 mb-2">SKUs</label>
                  <textarea
                    id="skus"
                    rows="8"
                    bind:value={skuText}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(148,186,77)] focus:border-[rgb(148,186,77)] resize-none"
                    placeholder="Enter SKUs here... (separate by commas or new lines)"
                  ></textarea>
                  <button
                    on:click={processSKUs}
                    class="mt-2 w-full bg-[rgb(148,186,77)] text-white px-4 py-2 rounded-lg hover:bg-[rgb(122,157,61)] transition-colors font-semibold"
                  >
                    Process SKUs
                  </button>
                </div>

                <!-- SKU List -->
                {#if skuList.length > 0}
                  <div class="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Available SKUs</h4>
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                      {#each skuList as sku, i (i)}
                        <div
                          class="bg-orange-100 border border-orange-300 rounded p-2 text-sm cursor-move draggable flex justify-between items-center"
                          role="button"
                          tabindex="0"
                          draggable="true"
                          data-sku={sku}
                          on:dragstart={handleDragStart}
                          on:dragend={handleDragEnd}
                        >
                          <span>{sku}</span>
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
              </div>
            </div>

            <!-- Right Column - Dynamic Draggable Multi-level Divs -->
            <div class="col-span-8">
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
                        <div class="space-y-1">
                          {#each level2.level3Items as level3 (level3.id)}
                            {#each level3.items as item (item.id)}
                          <div class="bg-red-100 border border-red-300 rounded p-2 text-xs cursor-move draggable flex justify-between items-center"
                               role="button"
                               tabindex="0"
                               draggable="true"
                               data-item-id={item.id}
                               data-level3-id={level3.id}
                               data-from-level2-id={level2.id}
                               data-from-level1-id={level1.id}
                               on:dragstart={handleDragStart}
                               on:dragend={handleDragEnd}>
                                <span>{item.content}</span>
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
                        </div>
                      </div>
                    {/each}
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

