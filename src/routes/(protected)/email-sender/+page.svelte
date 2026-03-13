<script lang="ts">
    import { onMount } from 'svelte';
    import { fade, fly } from 'svelte/transition';

    interface Customer {
        username: string;
        email: string;
        balance: number;
        manager: string;
        status: 'active' | 'on-hold' | 'inactive';
    }

    // Sample data
    let customers = $state<Customer[]>([
        { username: 'Global Solutions', email: 'billing@globalsolutions.com', balance: 1250.50, manager: 'John Smith', status: 'active' },
        { username: 'Lumina Tech', email: 'accounts@lumina.io', balance: 450.00, manager: 'Sarah Johnson', status: 'active' },
        { username: 'Velocity Logistics', email: 'finance@velocity.com', balance: 0, manager: 'Mark Wilson', status: 'active' },
        { username: 'Starlight Retail', email: 'payables@starlight.co', balance: 3200.75, manager: 'John Smith', status: 'on-hold' },
        { username: 'Evergreen Organics', email: 'hello@evergreen.com', balance: 15.20, manager: 'Emma Davis', status: 'active' },
        { username: 'Nexus Core', email: 'admin@nexus.com', balance: 890.30, manager: 'Sarah Johnson', status: 'inactive' },
    ]);

    let searchQuery = $state('');
    
    let filteredCustomers = $derived(
        customers.filter(c => 
            c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email.toLowerCase().includes(searchQuery.toLowerCase())
        )
    );

    function getStatusColor(status: string) {
        switch (status) {
            case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'on-hold': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'inactive': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    }
</script>

<svelte:head>
    <title>Email Sender | RapidTools</title>
</svelte:head>

<div class="page-container">
    <header class="page-header" in:fly={{ y: -20, duration: 600 }}>
        <div class="header-content">
            <h1 class="title">Email Sender</h1>
            <p class="subtitle">Broadcast updates and invoices to your customers with style.</p>
        </div>
        <div class="header-actions">
            <button class="btn-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                Send Batch Email
            </button>
        </div>
    </header>

    <div class="content-card" in:fade={{ duration: 800, delay: 200 }}>
        <div class="card-header">
            <div class="search-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input 
                    type="text" 
                    placeholder="Search customers by name or email..." 
                    bind:value={searchQuery}
                    class="search-input"
                />
            </div>
            <div class="stats">
                <span class="stat-item">Total: <strong>{filteredCustomers.length}</strong></span>
            </div>
        </div>

        <div class="table-container">
            <table class="premium-table">
                <thead>
                    <tr>
                        <th>Customer</th>
                        <th>Email Address</th>
                        <th>Account Manager</th>
                        <th>Balance</th>
                        <th>Status</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#each filteredCustomers as customer (customer.email)}
                        <tr in:fade={{ duration: 300 }}>
                            <td class="font-bold text-slate-800">{customer.username}</td>
                            <td class="text-slate-500">{customer.email}</td>
                            <td>
                                <div class="manager-chip">
                                    <div class="avatar">{customer.manager.charAt(0)}</div>
                                    {customer.manager}
                                </div>
                            </td>
                            <td class="font-mono ${customer.balance > 1000 ? 'text-rose-600 font-bold' : 'text-slate-700'}">
                                ${customer.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td>
                                <span class="status-badge {getStatusColor(customer.status)}">
                                    {customer.status}
                                </span>
                            </td>
                            <td class="text-right">
                                <button class="action-btn" title="Compose Email">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.2 8.4c.5.5.8 1.2.8 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10.4"/><path d="m16 2 5.2 5.2c.2.2.3.4.3.7 0 .3-.1.5-.3.7L10 20.1l-5 1 1-5L17.5 4.6c.2-.2.4-.3.7-.3.3 0 .5.1.7.3Z"/></svg>
                                </button>
                            </td>
                        </tr>
                    {/each}
                    {#if filteredCustomers.length === 0}
                        <tr>
                            <td colspan="6" class="empty-state">
                                No customers found matching your search.
                            </td>
                        </tr>
                    {/if}
                </tbody>
            </table>
        </div>
    </div>
</div>

<style>
    :global(body) {
        background-color: #f8fafc;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    .page-container {
        padding: 2.5rem;
        max-width: 1400px;
        margin: 0 auto;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-bottom: 2.5rem;
    }

    .title {
        font-size: 2.25rem;
        font-weight: 800;
        background: linear-gradient(135deg, #1e293b 0%, #3b82f6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.5rem;
    }

    .subtitle {
        color: #64748b;
        font-size: 1.1rem;
    }

    .content-card {
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: 1.5rem;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
        overflow: hidden;
    }

    .card-header {
        padding: 1.5rem 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #f1f5f9;
        background: rgba(255, 255, 255, 0.5);
    }

    .search-wrapper {
        position: relative;
        flex: 1;
        max-width: 400px;
    }

    .search-icon {
        position: absolute;
        left: 1rem;
        top: 50%;
        transform: translateY(-50%);
        color: #94a3b8;
    }

    .search-input {
        width: 100%;
        padding: 0.75rem 1rem 0.75rem 3rem;
        border-radius: 1rem;
        border: 1px solid #e2e8f0;
        background: white;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-size: 0.95rem;
    }

    .search-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        width: 110%;
    }

    .stats {
        color: #64748b;
        font-size: 0.9rem;
    }

    .table-container {
        overflow-x: auto;
    }

    .premium-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
    }

    .premium-table th {
        background: #f8fafc;
        padding: 1.25rem 2rem;
        text-align: left;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.05em;
        color: #475569;
        border-bottom: 1px solid #f1f5f9;
    }

    .premium-table td {
        padding: 1.5rem 2rem;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.95rem;
        transition: background 0.2s ease;
    }

    .premium-table tr:hover td {
        background: #f1f5f9;
    }

    .premium-table tr:last-child td {
        border-bottom: none;
    }

    .status-badge {
        padding: 0.375rem 1rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        border: 1px solid transparent;
    }

    .manager-chip {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: #475569;
    }

    .avatar {
        width: 1.75rem;
        height: 1.75rem;
        background: #3b82f6;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        font-weight: 700;
    }

    .btn-primary {
        background: #3b82f6;
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 1rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2), 0 2px 4px -2px rgba(59, 130, 246, 0.1);
    }

    .btn-primary:hover {
        background: #2563eb;
        transform: translateY(-2px);
        box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
    }

    .action-btn {
        padding: 0.5rem;
        border-radius: 0.75rem;
        color: #64748b;
        background: transparent;
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.2s;
    }

    .action-btn:hover {
        background: white;
        color: #3b82f6;
        border-color: #e2e8f0;
        transform: rotate(15deg);
    }

    .empty-state {
        text-align: center;
        padding: 4rem !important;
        color: #94a3b8;
        font-style: italic;
    }

    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
</style>
