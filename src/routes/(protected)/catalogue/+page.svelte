<script lang="ts">
  import { fade } from 'svelte/transition';
  import { currentUser } from '$lib/firebase';
  import { userProfile, type UserProfile } from '$lib/userProfile';
  import { onMount } from 'svelte';

  let user: any = null;
  let profile: UserProfile | null = null;

  // Subscribe to user changes
  currentUser.subscribe((u) => {
    user = u;
  });

  // Subscribe to profile changes
  userProfile.subscribe((p) => {
    profile = p;
  });

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
</script>

<div class="container mx-auto px-4 py-8" in:fade>
  <div class="max-w-4xl mx-auto">
    <div class="bg-white shadow-lg rounded-lg overflow-hidden">
      <!-- Page Header -->
      <div class="pl-8 pr-4 py-8 bg-black text-white flex items-center justify-between">
        <img
          src="https://www.rapidsupplies.com.au/assets/images/company_logo_white.png"
          alt="Rapid Supplies Logo"
          class="h-12 w-auto"
        />
        <div class="text-center">
        </div>
        <div class="text-right flex items-center space-x-4">
          <div class="text-sm text-left space-y-1">
            <div class="flex items-center space-x-2">
              <span>📞</span>
              <span>4227 2833</span>
            </div>
            <div class="flex items-center space-x-2">
              <span>📧</span>
              <span>orders@rapidcleanillawarra.com.au</span>
            </div>
          </div>
          <span class="text-4xl font-bold text-white">1</span>
        </div>
      </div>

      <div id="page-content" class="px-6 py-8">
        <div class="flex justify-between items-center mb-8">
          <h2 id="product-range" class="text-3xl font-bold text-[rgb(148,186,77)] underline">CLEANING AND LAUNDRY SOLUTIONS</h2>
          <button
            on:click={printCatalogue}
            class="bg-[rgb(148,186,77)] text-white px-6 py-3 rounded-lg hover:bg-[rgb(122,157,61)] transition-colors font-semibold"
          >
            Print Catalogue
          </button>
        </div>

        <div class="bg-[rgb(30,30,30)] text-white p-3 rounded-lg mb-8">
          <h3 class="text-xl font-semibold">Washroom Cleaner</h3>
        </div>

        <div id="category-content" class="grid grid-cols-12 gap-4 mb-8">
          <div class="col-span-4">
            <!-- Product Image -->
            <div class="bg-gray-100 rounded-lg p-4 text-center mb-4">
              <div class="w-full h-32 bg-gray-200 rounded flex items-center justify-center text-gray-500">
                Product Image
              </div>
            </div>

            <!-- Tags and Certifications -->
            <div class="grid grid-cols-3 gap-2">
              <img
                src="https://www.rapidsupplies.com.au/assets/images/recognized.png"
                alt="Recognized"
                class="w-full h-auto"
              />
              <img
                src="https://www.rapidsupplies.com.au/assets/images/environmentally_friendly.png"
                alt="Environmentally Friendly"
                class="w-full h-auto"
              />
              <img
                src="https://www.rapidsupplies.com.au/assets/images/food_safe.png"
                alt="Food Safe"
                class="w-full h-auto"
              />
            </div>
          </div>
          <div class="col-span-8">
            <!-- Product Name -->
            <div class="bg-[rgb(148,186,77)] text-white rounded-lg p-4 mb-4 flex justify-between items-center">
              <h4 class="text-lg font-semibold">Product Name</h4>
              <div class="text-xl font-bold">$29.99</div>
            </div>

            <!-- Product Description -->
            <div class="bg-gray-50 rounded-lg p-4">
              <h5 class="text-md font-medium text-gray-700 mb-2">Product Description</h5>
              <p class="text-gray-600 leading-relaxed">
                Detailed product description will go here. This section will contain comprehensive information about the product's features, specifications, usage instructions, and benefits. The description should provide all the necessary details that customers need to make an informed purchasing decision.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>

