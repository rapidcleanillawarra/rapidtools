<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { fade, fly } from 'svelte/transition';
    import type { Customer, ApiResponse } from '../customers/types';
    import {
        getCompanyName,
        getPersonName,
        getCustomerName,
        getAccountManagerName
    } from '../customers/utils';

    const CUSTOMER_API_ENDPOINT =
        'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';
    /** Max usernames per GetCustomer request (avoids huge payloads). */
    const USERNAME_CHUNK = 100;
    /** Require this many dispatched orders in the last-12-months (DatePlaced) window to list a customer. */
    const MIN_DISPATCHED_ORDERS = 2;

    /** `YYYY-MM-DD HH:mm:ss` for the Logic App, same format as rebates GetOrder. */
    function toApiDateTimeString(d: Date, endOfDay: boolean): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return endOfDay ? `${y}-${m}-${day} 23:59:59` : `${y}-${m}-${day} 00:00:00`;
    }

    /** Last 12 months by calendar through end of today (local). */
    function getLast12MonthsOrderDateRange(): { dateFrom: string; dateTo: string } {
        const to = new Date();
        to.setHours(23, 59, 59, 999);
        const from = new Date(to);
        from.setMonth(from.getMonth() - 12);
        from.setHours(0, 0, 0, 0);
        return { dateFrom: toApiDateTimeString(from, false), dateTo: toApiDateTimeString(to, true) };
    }

    interface GetOrderListResponse {
        Ack?: string;
        Order?: { Username?: string }[];
    }

    let customers = $state<Customer[]>([]);
    let customersLoading = $state(true);
    let customersError = $state('');
    let searchQuery = $state('');
    let copyStatus = $state<'idle' | 'copied' | 'error'>('idle');
    let copyMessage = $state('');
    let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

    const filteredCustomers = $derived.by(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return customers;
        return customers.filter(
            (c) =>
                c.Username.toLowerCase().includes(q) ||
                (c.displayName ?? '').toLowerCase().includes(q) ||
                (c.company ?? '').toLowerCase().includes(q) ||
                (c.customerName ?? '').toLowerCase().includes(q) ||
                (c.EmailAddress ?? '').toLowerCase().includes(q)
        );
    });

    const validEmailCount = $derived(
        customers.filter((c) => Boolean(c.EmailAddress?.trim())).length
    );

    /** Unique customer email addresses (case-insensitive dedupe), preserving original casing and order. */
    const uniqueCustomerEmails = $derived.by(() => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const c of customers) {
            const e = c.EmailAddress?.trim();
            if (!e) continue;
            const key = e.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(e);
        }
        return out;
    });

    async function copyAllEmailsToClipboard() {
        if (copyResetTimer) {
            clearTimeout(copyResetTimer);
            copyResetTimer = null;
        }
        const emails = uniqueCustomerEmails;
        if (emails.length === 0) {
            copyStatus = 'error';
            copyMessage = 'No email addresses to copy.';
            copyResetTimer = setTimeout(() => {
                copyStatus = 'idle';
                copyMessage = '';
            }, 2000);
            return;
        }
        const text = emails.join('; ');
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                if (!ok) throw new Error('execCommand copy failed');
            }
            copyStatus = 'copied';
            copyMessage = `Copied ${emails.length} email${emails.length === 1 ? '' : 's'} to clipboard.`;
        } catch (err) {
            copyStatus = 'error';
            copyMessage = err instanceof Error ? `Copy failed: ${err.message}` : 'Copy failed.';
        } finally {
            copyResetTimer = setTimeout(() => {
                copyStatus = 'idle';
                copyMessage = '';
            }, 2500);
        }
    }

    async function fetchUsernamesWithRecentOrders(
        dateFrom: string,
        dateTo: string
    ): Promise<string[]> {
        const orderPayload = {
            Filter: {
                OrderStatus: ['Dispatched'],
                DatePlacedFrom: dateFrom,
                DatePlacedTo: dateTo,
                OutputSelector: ['Username']
            },
            action: 'GetOrder'
        };

        const response = await fetch(CUSTOMER_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });

        if (!response.ok) {
            throw new Error(`GetOrder failed: HTTP ${response.status}`);
        }

        const data: GetOrderListResponse = await response.json();
        if (data.Ack && data.Ack !== 'Success') {
            throw new Error('GetOrder did not return success');
        }
        const rows = Array.isArray(data.Order) ? data.Order : [];
        const countByUser = new Map<string, number>();
        for (const o of rows) {
            const u = o.Username?.trim();
            if (!u) continue;
            countByUser.set(u, (countByUser.get(u) ?? 0) + 1);
        }
        return [...countByUser.entries()]
            .filter(([, n]) => n >= MIN_DISPATCHED_ORDERS)
            .map(([u]) => u);
    }

    function mapCustomerRows(data: ApiResponse['Customer']): Customer[] {
        return data.map((customer) => ({
            ...customer,
            company: getCompanyName(customer),
            customerName: getPersonName(customer),
            displayName: getCustomerName(customer),
            managerName: getAccountManagerName(customer.AccountManager)
        }));
    }

    async function fetchCustomers() {
        customersLoading = true;
        customersError = '';
        try {
            const { dateFrom, dateTo } = getLast12MonthsOrderDateRange();
            const usernames = await fetchUsernamesWithRecentOrders(dateFrom, dateTo);

            if (usernames.length === 0) {
                customers = [];
                return;
            }

            const out: Customer[] = [];
            for (let i = 0; i < usernames.length; i += USERNAME_CHUNK) {
                const chunk = usernames.slice(i, i + USERNAME_CHUNK);
                const response = await fetch(CUSTOMER_API_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        Filter: {
                            Active: true,
                            Username: chunk,
                            OutputSelector: [
                                'Username',
                                'EmailAddress',
                                'BillingAddress',
                                'AccountManager',
                                'OnCreditHold',
                                'DefaultInvoiceTerms',
                                'AccountBalance'
                            ]
                        },
                        action: 'GetCustomer'
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data: ApiResponse = await response.json();
                if (data.Ack !== 'Success' || !Array.isArray(data.Customer)) {
                    throw new Error('API returned unsuccessful acknowledgment');
                }
                out.push(...mapCustomerRows(data.Customer));
            }

            out.sort((a, b) =>
                (a.displayName ?? a.Username).localeCompare(b.displayName ?? b.Username, undefined, {
                    sensitivity: 'base'
                })
            );
            customers = out;
        } catch (err) {
            customersError = err instanceof Error ? err.message : 'Failed to fetch customers';
            console.error('Error fetching customers:', err);
        } finally {
            customersLoading = false;
        }
    }

    onMount(() => {
        fetchCustomers();
    });

    function parseBalance(value: unknown): number {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const cleaned = value.replace(/[$,]/g, '');
            const n = parseFloat(cleaned);
            return Number.isFinite(n) ? n : 0;
        }
        return 0;
    }

    function isOnHold(c: Customer): boolean {
        const v = (c.OnCreditHold ?? '').toString().toLowerCase().trim();
        return v === 'true' || v === 'yes' || v === '1' || v === 'y';
    }

    function statusFor(c: Customer): 'active' | 'on-hold' | 'no-email' {
        if (!c.EmailAddress?.trim()) return 'no-email';
        if (isOnHold(c)) return 'on-hold';
        return 'active';
    }

    function statusLabel(status: 'active' | 'on-hold' | 'no-email'): string {
        switch (status) {
            case 'on-hold': return 'on hold';
            case 'no-email': return 'no email';
            default: return 'active';
        }
    }

    function getStatusColor(status: string) {
        switch (status) {
            case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'on-hold': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'no-email': return 'bg-rose-100 text-rose-700 border-rose-200';
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
            <div class="header-actions-row">
                <button
                    type="button"
                    class="btn-secondary"
                    onclick={copyAllEmailsToClipboard}
                    disabled={customersLoading || uniqueCustomerEmails.length === 0}
                    title={uniqueCustomerEmails.length > 0
                        ? `Copy ${uniqueCustomerEmails.length} unique email address${uniqueCustomerEmails.length === 1 ? '' : 'es'} to clipboard`
                        : 'No email addresses available to copy'}
                >
                    {#if copyStatus === 'copied'}
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        Copied
                    {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        Copy Email Addresses
                    {/if}
                </button>
                <button
                    type="button"
                    class="btn-primary"
                    onclick={() => goto(`${base}/email-sender/create`)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    Create new email
                </button>
            </div>
            {#if copyMessage}
                <p
                    class="copy-feedback"
                    class:copy-feedback-success={copyStatus === 'copied'}
                    class:copy-feedback-error={copyStatus === 'error'}
                    role="status"
                    aria-live="polite"
                    transition:fade={{ duration: 200 }}
                >
                    {copyMessage}
                </p>
            {/if}
        </div>
    </header>

    <div class="content-card" in:fade={{ duration: 800, delay: 200 }}>
        <div class="card-header">
            <div class="search-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                    type="text"
                    placeholder="Search customers by name, company, or email..."
                    bind:value={searchQuery}
                    class="search-input"
                    disabled={customersLoading}
                />
            </div>
            <div class="stats">
                {#if customersLoading}
                    <span class="stat-item">Loading customers…</span>
                {:else}
                    <span class="stat-item">Showing: <strong>{filteredCustomers.length}</strong></span>
                    <span class="stat-item">With email: <strong>{validEmailCount}</strong></span>
                {/if}
            </div>
        </div>

        {#if customersError}
            <div class="error-banner" role="alert">
                <p>Could not load customers: {customersError}</p>
                <button type="button" class="btn-retry" onclick={() => fetchCustomers()}>
                    Try again
                </button>
            </div>
        {/if}

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
                    {#if customersLoading}
                        <tr>
                            <td colspan="6" class="empty-state">
                                Loading customers with recent orders…
                            </td>
                        </tr>
                    {:else if filteredCustomers.length === 0}
                        <tr>
                            <td colspan="6" class="empty-state">
                                {#if customers.length === 0}
                                    No customers with 2+ dispatched orders in the last 12 months.
                                {:else}
                                    No customers found matching your search.
                                {/if}
                            </td>
                        </tr>
                    {:else}
                        {#each filteredCustomers as customer (customer.Username)}
                            {@const status = statusFor(customer)}
                            {@const balance = parseBalance(customer.AccountBalance)}
                            {@const hasEmail = Boolean(customer.EmailAddress?.trim())}
                            <tr in:fade={{ duration: 300 }}>
                                <td class="customer-cell">
                                    <span class="customer-name">{customer.displayName ?? customer.Username}</span>
                                    {#if customer.company && customer.company !== 'N/A' && customer.company !== customer.displayName}
                                        <span class="customer-sub">{customer.company}</span>
                                    {/if}
                                </td>
                                <td class="text-slate-500 email-cell">
                                    {#if hasEmail}
                                        <a class="email-link" href="mailto:{customer.EmailAddress}">{customer.EmailAddress}</a>
                                    {:else}
                                        <span class="email-missing">No email on file</span>
                                    {/if}
                                </td>
                                <td>
                                    {#if customer.managerName && customer.managerName !== 'N/A'}
                                        <div class="manager-chip">
                                            <div class="avatar">{customer.managerName.charAt(0)}</div>
                                            {customer.managerName}
                                        </div>
                                    {:else}
                                        <span class="text-slate-400">—</span>
                                    {/if}
                                </td>
                                <td class="font-mono {balance > 1000 ? 'text-rose-600 font-bold' : 'text-slate-700'}">
                                    ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td>
                                    <span class="status-badge {getStatusColor(status)}">
                                        {statusLabel(status)}
                                    </span>
                                </td>
                                <td class="text-right">
                                    <button
                                        type="button"
                                        class="action-btn"
                                        title={hasEmail ? 'Compose email' : 'No email on file'}
                                        disabled={!hasEmail}
                                        onclick={() =>
                                            goto(
                                                `${base}/email-sender/create?to=${encodeURIComponent(customer.EmailAddress)}`
                                            )}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.2 8.4c.5.5.8 1.2.8 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10.4"/><path d="m16 2 5.2 5.2c.2.2.3.4.3.7 0 .3-.1.5-.3.7L10 20.1l-5 1 1-5L17.5 4.6c.2-.2.4-.3.7-.3.3 0 .5.1.7.3Z"/></svg>
                                    </button>
                                </td>
                            </tr>
                        {/each}
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
        display: flex;
        align-items: center;
        gap: 1.25rem;
        flex-shrink: 0;
    }

    .stat-item strong {
        color: #1e293b;
        font-weight: 700;
    }

    .error-banner {
        margin: 0 2rem;
        margin-top: 1rem;
        padding: 0.875rem 1rem;
        border-radius: 0.75rem;
        background: #fff1f2;
        color: #be123c;
        border: 1px solid #fecdd3;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        font-size: 0.9rem;
    }

    .error-banner p {
        margin: 0;
    }

    .btn-retry {
        background: #be123c;
        color: white;
        border: none;
        border-radius: 0.5rem;
        padding: 0.4rem 0.85rem;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
    }

    .btn-retry:hover {
        background: #9f1239;
    }

    .customer-cell {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
    }

    .customer-name {
        font-weight: 700;
        color: #1e293b;
    }

    .customer-sub {
        font-size: 0.8rem;
        color: #94a3b8;
    }

    .email-cell {
        max-width: 18rem;
    }

    .email-link {
        color: #3b82f6;
        text-decoration: none;
        word-break: break-all;
    }

    .email-link:hover {
        text-decoration: underline;
    }

    .email-missing {
        color: #cbd5e1;
        font-style: italic;
        font-size: 0.85rem;
    }

    .text-slate-400 { color: #94a3b8; }
    .text-slate-500 { color: #64748b; }
    .text-slate-700 { color: #334155; }
    .text-slate-800 { color: #1e293b; }
    .text-rose-600 { color: #e11d48; }

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

    .header-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.5rem;
    }

    .header-actions-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .btn-secondary {
        background: white;
        color: #334155;
        padding: 0.75rem 1.25rem;
        border-radius: 1rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid #e2e8f0;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        font-size: 0.95rem;
    }

    .btn-secondary:hover:not(:disabled) {
        background: #f8fafc;
        border-color: #cbd5e1;
        color: #1e293b;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.08);
    }

    .btn-secondary:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }

    .copy-feedback {
        margin: 0;
        font-size: 0.8rem;
        color: #64748b;
        max-width: 22rem;
        text-align: right;
        line-height: 1.3;
    }

    .copy-feedback-success {
        color: #047857;
    }

    .copy-feedback-error {
        color: #be123c;
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

    .action-btn:hover:not(:disabled) {
        background: white;
        color: #3b82f6;
        border-color: #e2e8f0;
        transform: rotate(15deg);
    }

    .action-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
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
