<script lang="ts">
    import { enhance } from '$app/forms';
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
        <div>
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Connect to Xero
            </h2>
            <p class="mt-2 text-center text-sm text-gray-600">
                Click the button below to connect your Xero account
            </p>
        </div>
        <form method="POST" use:enhance>
            <div>
                <button
                    type="submit"
                    class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    Connect Xero Account
                </button>
            </div>
        </form>
    </div>
</div> 