<script lang="ts">
    import { enhance } from '$app/forms';
    import type { ActionData } from './$types';

    export let form: ActionData;

    let loading = false;

    function handleSubmit() {
        loading = true;
        return async ({ update }: { update: () => Promise<void> }) => {
            await update();
            loading = false;
        };
    }
</script>

<div class="container mx-auto p-6 max-w-2xl">
    <div class="bg-white shadow-md rounded-lg p-6">
        <h1 class="text-2xl font-bold mb-6 text-gray-800">Generate Invoice PDF</h1>

        <form method="POST" use:enhance={handleSubmit} class="space-y-4">
            <div>
                <label for="order_id" class="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
                <input
                    type="text"
                    id="order_id"
                    name="order_id"
                    required
                    placeholder="e.g. 26-0012128"
                    class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                class="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
                {loading ? 'Generating...' : 'Generate PDF'}
            </button>
        </form>

        {#if form?.error}
            <div class="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <p class="text-red-700 font-medium">Error: {form.error}</p>
                {#if form.details}
                    <pre class="mt-2 text-xs text-red-600 whitespace-pre-wrap">{form.details}</pre>
                {/if}
            </div>
        {/if}

        {#if form?.success && form?.data}
            <div class="mt-8 border-t pt-6">
                <h2 class="text-lg font-semibold mb-4 text-green-700 flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Invoice Generated Successfully
                </h2>
                
                <div class="grid grid-cols-1 gap-4 bg-gray-50 p-4 rounded-md">
                    <div class="grid grid-cols-3 gap-2">
                        <span class="text-gray-500 text-sm font-medium">Execution By:</span>
                        <span class="col-span-2 text-gray-800 text-sm">{form.data.created_by}</span>
                    </div>
                     <div class="grid grid-cols-3 gap-2">
                        <span class="text-gray-500 text-sm font-medium">Customer:</span>
                        <span class="col-span-2 text-gray-800 text-sm">{form.data.customer_username}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                        <span class="text-gray-500 text-sm font-medium">Created At:</span>
                        <span class="col-span-2 text-gray-800 text-sm">{new Date(form.data.created_at).toLocaleString()}</span>
                    </div>
                     <div class="grid grid-cols-3 gap-2">
                        <span class="text-gray-500 text-sm font-medium">File Name:</span>
                        <span class="col-span-2 text-gray-800 text-sm break-all">{form.data.file_name}</span>
                    </div>
                </div>

                <div class="mt-6">
                    <a
                        href={form.data.onedrive_id}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center justify-center w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
                    >
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open in OneDrive
                    </a>
                </div>
            </div>
        {/if}
    </div>
</div>
