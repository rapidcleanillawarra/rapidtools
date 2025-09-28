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

      <div class="px-6 py-8">
        <div class="grid md:grid-cols-2 gap-8">
          <div class="bg-gray-50 p-6 rounded-lg">
            <h2 class="text-2xl font-semibold text-gray-800 mb-4">🛍️ Browse Products</h2>
            <p class="text-gray-600 mb-4">
              Explore our extensive range of cleaning and laundry solutions, organized by category and brand.
            </p>
            <ul class="space-y-2 text-gray-600">
              <li class="flex items-center">
                <span class="text-green-500 mr-2">✓</span>
                Search and filter products
              </li>
              <li class="flex items-center">
                <span class="text-green-500 mr-2">✓</span>
                View detailed specifications
              </li>
              <li class="flex items-center">
                <span class="text-green-500 mr-2">✓</span>
                Compare prices and options
              </li>
            </ul>
          </div>

          <div class="bg-gray-50 p-6 rounded-lg">
            <h2 class="text-2xl font-semibold text-gray-800 mb-4">📊 Product Information</h2>
            <p class="text-gray-600 mb-4">
              Access comprehensive product data including pricing, availability, and technical details.
            </p>
            <ul class="space-y-2 text-gray-600">
              <li class="flex items-center">
                <span class="text-blue-500 mr-2">✓</span>
                Real-time pricing information
              </li>
              <li class="flex items-center">
                <span class="text-blue-500 mr-2">✓</span>
                Stock availability status
              </li>
              <li class="flex items-center">
                <span class="text-blue-500 mr-2">✓</span>
                Detailed product specifications
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-8 text-center">
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-yellow-800 mb-2">🚧 Coming Soon</h3>
            <p class="text-yellow-700">
              The full catalogue functionality is currently under development. This page will soon include:
            </p>
            <div class="mt-4 grid md:grid-cols-3 gap-4 text-sm text-yellow-700">
              <div>
                <strong>Advanced Search</strong><br>
                Filter by brand, category, price range
              </div>
              <div>
                <strong>Product Comparison</strong><br>
                Compare multiple products side-by-side
              </div>
              <div>
                <strong>Bulk Actions</strong><br>
                Export data and bulk operations
              </div>
            </div>
          </div>
        </div>

        {#if user && profile}
          <div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-blue-800 mb-2">👤 Welcome, {profile.firstName}!</h3>
            <p class="text-blue-700">
              You're logged in as {profile.firstName} {profile.lastName} ({user.email}).
              The catalogue will show personalized pricing based on your account settings.
            </p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

