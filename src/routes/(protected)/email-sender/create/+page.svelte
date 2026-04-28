<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { page } from '$app/stores';
    import { SvelteSet } from 'svelte/reactivity';
    import { fade, fly } from 'svelte/transition';
    import type { Customer, ApiResponse } from '../../customers/types';
    import {
        getCompanyName,
        getPersonName,
        getCustomerName,
        getAccountManagerName
    } from '../../customers/utils';

    const CUSTOMER_API_ENDPOINT =
        'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';
    const EMAIL_SEND_ENDPOINT =
        'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/627029398596438db6ca31f6c22f3989/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=FX2y5mXjKmyNB_Yna7ug8cvZdRg1BLt3GMluiB45ozI';
    const DEFAULT_TO_ADDRESS = 'marketing@rapidcleanillawarra.com.au';
    /** Max usernames per GetCustomer request (avoids huge payloads). */
    const USERNAME_CHUNK = 100;
    /** Require this many dispatched orders in the last-12-months (DatePlaced) window to list a customer. */
    const MIN_DISPATCHED_ORDERS = 2;

    const toFromQuery = $derived($page.url.searchParams.get('to') ?? '');

    /** `YYYY-MM-DD HH:mm:ss` for the Logic App, same format as rebates GetOrder. */
    function toApiDateTimeString(d: Date, endOfDay: boolean): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return endOfDay ? `${y}-${m}-${day} 23:59:59` : `${y}-${m}-${day} 00:00:00`;
    }

    /** Last 12 months by calendar (same day/time-of-month, 12 months back) through end of today (local). */
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

    let sender = $state(DEFAULT_TO_ADDRESS);
    let to = $state(DEFAULT_TO_ADDRESS);
    let cc = $state('');
    let bcc = $state('');
    let subject = $state('');
    let body = $state('');
    let attachmentFiles = $state<File[]>([]);
    let sending = $state(false);
    let formError = $state('');
    let successMessage = $state('');

    let customers = $state<Customer[]>([]);
    let customersLoading = $state(true);
    let customersError = $state('');
    let customerFilter = $state('');
    /** Customer usernames selected in the recipients list (checkboxes). */
    let selectedUsernames = $state<string[]>([]);
    /** When true, multiple rows can be checked; when false, only one recipient at a time. */
    let allowMultipleRecipients = $state(true);

    const filteredCustomers = $derived.by(() => {
        const q = customerFilter.trim().toLowerCase();
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

    const selectedCount = $derived(selectedUsernames.length);
    const validEmailCustomerCount = $derived(
        customers.filter((c) => isValidEmail(c.EmailAddress ?? '')).length
    );

    $effect(() => {
        const q = toFromQuery;
        if (q) to = q;
    });

    /** Fill the To field from selected customers' emails (deduplicated). */
    $effect(() => {
        if (!selectedUsernames.length) return;
        const emails: string[] = [];
        const seen = new SvelteSet<string>();
        for (const u of selectedUsernames) {
            const c = customers.find((x) => x.Username === u);
            const e = c?.EmailAddress?.trim();
            if (e) {
                const key = e.toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    emails.push(e);
                }
            }
        }
        if (emails.length) to = emails.join('; ');
    });

    /** Turning off multiple selection keeps at most one checked row. */
    $effect(() => {
        if (allowMultipleRecipients) return;
        if (selectedUsernames.length > 1) {
            selectedUsernames = [selectedUsernames[0]];
        }
    });

    /**
     * Usernames with at least MIN_DISPATCHED_ORDERS orders in the range (by DatePlaced).
     * Each GetOrder row is one order; we count per Username.
     */
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

    function isValidEmail(s: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
    }

    function parseRecipients(raw: string): string[] {
        return raw
            .split(/[;\n]/)
            .map((s) => s.trim())
            .filter(Boolean);
    }

    async function toBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result;
                if (typeof result !== 'string') {
                    reject(new Error(`Unable to encode attachment "${file.name}"`));
                    return;
                }
                const payload = result.split(',', 2)[1] ?? '';
                resolve(payload);
            };
            reader.onerror = () => reject(new Error(`Unable to read attachment "${file.name}"`));
            reader.readAsDataURL(file);
        });
    }

    function toggleCustomerSelection(username: string, checked: boolean) {
        const c = customers.find((x) => x.Username === username);
        if (!c?.EmailAddress?.trim()) return;

        if (!allowMultipleRecipients) {
            selectedUsernames = checked ? [username] : [];
            return;
        }
        const next = new SvelteSet(selectedUsernames);
        if (checked) next.add(username);
        else next.delete(username);
        selectedUsernames = [...next];
    }

    async function handleSend(e: Event) {
        e.preventDefault();
        console.log('Send button clicked, preparing email payload...');
        formError = '';
        successMessage = '';

        const toRecipients = parseRecipients(to);
        const ccRecipients = parseRecipients(cc);
        const bccRecipients = parseRecipients(bcc);
        if (toRecipients.length + ccRecipients.length + bccRecipients.length === 0) {
            formError = 'Enter at least one recipient in To, Cc, or Bcc.';
            return;
        }
        if (!sender.trim()) {
            formError = 'Sender is required.';
            return;
        }
        if (!isValidEmail(sender)) {
            formError = 'Sender must be a valid email address.';
            return;
        }
        const invalid = [...toRecipients, ...ccRecipients, ...bccRecipients].filter((r) => !isValidEmail(r));
        if (invalid.length > 0) {
            formError = `Invalid email(s): ${invalid.join('; ')}`;
            return;
        }
        if (!subject.trim()) {
            formError = 'Subject is required.';
            return;
        }
        if (!body.trim()) {
            formError = 'Message body is required.';
            return;
        }

        sending = true;
        try {
            const attachments = await Promise.all(
                attachmentFiles.map(async (file) => ({
                    name: file.name,
                    contentBytes: await toBase64(file)
                }))
            );

            const response = await fetch(EMAIL_SEND_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sender: sender.trim(),
                    email: {
                        to: toRecipients.join(';'),
                        cc: ccRecipients.join(';'),
                        bcc: bccRecipients.join(';'),
                        subject: subject.trim(),
                        body: body.trim(),
                        attachments
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || `Email send failed with status ${response.status}`);
            }

            successMessage = 'Email sent successfully.';
            body = '';
            subject = '';
            to = DEFAULT_TO_ADDRESS;
            cc = '';
            bcc = '';
            attachmentFiles = [];
            selectedUsernames = [];
            customerFilter = '';
        } catch (err) {
            formError = err instanceof Error ? err.message : 'Failed to send email.';
        } finally {
            sending = false;
        }
    }

    function goBack() {
        goto(`${base}/email-sender`);
    }
</script>

<svelte:head>
    <title>Create email | Email Sender | RapidTools</title>
</svelte:head>

<div class="page-container">
    <header class="page-header" in:fly={{ y: -20, duration: 600 }}>
        <div class="header-content">
            <button type="button" class="back-link" onclick={goBack} aria-label="Back to Email Sender">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                Email Sender
            </button>
            <h1 class="title">Create email</h1>
            <p class="subtitle">Compose a message and send to one or more customers.</p>
        </div>
    </header>

    <form class="content-card form-layout" in:fade={{ duration: 800, delay: 200 }} onsubmit={handleSend}>
        <div class="form-banners">
            {#if formError}
                <p class="banner banner-error" role="alert">{formError}</p>
            {/if}
            {#if successMessage}
                <p class="banner banner-success" role="status">{successMessage}</p>
            {/if}
        </div>

        <div class="form-col form-col-main">
            <div class="field">
                <label for="sender">Sender</label>
                <input
                    id="sender"
                    type="email"
                    class="input"
                    placeholder="sender@example.com"
                    bind:value={sender}
                    autocomplete="email"
                    disabled={sending}
                />
            </div>

            <div class="field">
                <label for="to">To</label>
                <input
                    id="to"
                    type="text"
                    class="input"
                    placeholder="email@example.com or several, separated by semicolons"
                    bind:value={to}
                    autocomplete="email"
                    disabled={sending}
                />
                <span class="hint"
                    >Defaults to marketing. Enter addresses manually and separate multiples with semicolons or new
                    lines.</span
                >
            </div>

            <div class="field">
                <label for="cc">Cc</label>
                <input
                    id="cc"
                    type="text"
                    class="input"
                    placeholder="Optional CC recipients"
                    bind:value={cc}
                    disabled={sending}
                />
            </div>

            <div class="field">
                <label for="bcc">Bcc</label>
                <input
                    id="bcc"
                    type="text"
                    class="input"
                    placeholder="Optional BCC recipients"
                    bind:value={bcc}
                    disabled={sending}
                />
                <span class="hint">Optional field. Selected customers are added to To by default.</span>
            </div>

            <div class="field">
                <label for="subject">Subject</label>
                <input
                    id="subject"
                    type="text"
                    class="input"
                    placeholder="What is this about?"
                    bind:value={subject}
                    disabled={sending}
                />
            </div>

            <div class="field field-grow">
                <label for="body">Message</label>
                <textarea
                    id="body"
                    class="textarea"
                    rows="14"
                    placeholder="Write your message…"
                    bind:value={body}
                    disabled={sending}
                ></textarea>
            </div>

            <div class="field">
                <label for="attachments">Attachments</label>
                <input
                    id="attachments"
                    type="file"
                    class="input"
                    multiple
                    disabled={sending}
                    onchange={(e) =>
                        (attachmentFiles = Array.from((e.currentTarget as HTMLInputElement).files ?? []))}
                />
                <span class="hint">
                    {attachmentFiles.length > 0
                        ? `${attachmentFiles.length} attachment(s) selected`
                        : 'Optional. Selected files are sent as base64 attachments.'}
                </span>
            </div>

            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick={goBack} disabled={sending}>Cancel</button>
                <button type="submit" class="btn-primary" disabled={sending}>
                    {#if sending}
                        Sending…
                    {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                        Send
                    {/if}
                </button>
            </div>
        </div>

        <aside class="form-col form-col-recipients" aria-label="Choose customers as recipients">
            <div class="recipients-header">
                <h2 class="recipients-title">Recipients</h2>
                <label class="option-multiple">
                    <input
                        type="checkbox"
                        bind:checked={allowMultipleRecipients}
                        disabled={sending}
                    />
                    <span>Allow multiple selection</span>
                </label>
            </div>
            <p class="recipients-hint">
                {allowMultipleRecipients
                    ? 'Check one or more customers. Their addresses are added to To.'
                    : 'Check one customer; choosing another replaces the current one.'}
                Only active customers with at least 2 dispatched orders placed in the last 12 months are listed.
            </p>
            {#if customersLoading}
                <p class="customer-status">Loading customers…</p>
            {:else if customersError}
                <div class="customer-error">
                    <p>Could not load customers: {customersError}</p>
                    <button type="button" class="btn-retry" onclick={() => fetchCustomers()}>
                        Try again
                    </button>
                </div>
            {:else}
                <input
                    id="customer-filter"
                    type="search"
                    class="input"
                    placeholder="Filter by name, company, username, or email…"
                    bind:value={customerFilter}
                    disabled={sending}
                    autocomplete="off"
                />
                <div class="recipient-list" role="group" aria-label="Customers">
                    {#if filteredCustomers.length === 0}
                        <p class="recipient-list-empty">
                            {#if customers.length === 0}
                                No customers with 2+ orders in the last 12 months.
                            {:else}
                                No customers match this filter.
                            {/if}
                        </p>
                    {:else}
                        {#each filteredCustomers as c (c.Username)}
                            {@const hasEmail = Boolean(c.EmailAddress?.trim())}
                            {@const checked = selectedUsernames.includes(c.Username)}
                            {@const inputId = `recipient-${c.Username.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                            <div
                                class="recipient-row"
                                class:recipient-row-disabled={!hasEmail}
                            >
                                <input
                                    id={inputId}
                                    type="checkbox"
                                    class="recipient-checkbox"
                                    {checked}
                                    disabled={!hasEmail || sending}
                                    onchange={(e) =>
                                        toggleCustomerSelection(
                                            c.Username,
                                            (e.currentTarget as HTMLInputElement).checked
                                        )}
                                />
                                <label class="recipient-label" for={inputId}>
                                    <span class="recipient-name">{c.displayName ?? c.Username}</span>
                                    <span class="recipient-meta"
                                        >{c.company ?? '—'}{hasEmail ? ` · ${c.EmailAddress}` : ' · (no email)'}</span
                                    >
                                </label>
                            </div>
                        {/each}
                    {/if}
                </div>
                <p class="recipients-footer">
                    {selectedCount} selected
                </p>
                <p class="recipients-footer">
                    {validEmailCustomerCount} customers with valid email
                </p>
            {/if}
        </aside>
    </form>
</div>

<style>
    :global(body) {
        background-color: #f8fafc;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    .page-container {
        padding: 2.5rem;
        max-width: 1200px;
        margin: 0 auto;
    }

    .page-header {
        margin-bottom: 2rem;
    }

    .back-link {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        margin-bottom: 1rem;
        padding: 0.35rem 0.5rem 0.35rem 0;
        border: none;
        background: transparent;
        color: #64748b;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: color 0.2s;
    }

    .back-link:hover {
        color: #3b82f6;
    }

    .title {
        font-size: 2.25rem;
        font-weight: 800;
        background: linear-gradient(135deg, #1e293b 0%, #3b82f6 100%);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.5rem;
    }

    .subtitle {
        color: #64748b;
        font-size: 1.05rem;
    }

    .content-card {
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: 1.5rem;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
        padding: 2rem;
    }

    .form-layout {
        display: grid;
        grid-template-columns: 1fr minmax(300px, 400px);
        gap: 1.75rem 2rem;
        align-items: start;
    }

    .form-banners {
        grid-column: 1 / -1;
    }

    .form-col-main {
        min-width: 0;
    }

    .form-col-recipients {
        position: sticky;
        top: 1rem;
        align-self: start;
        padding: 1.25rem;
        background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
        border: 1px solid #e2e8f0;
        border-radius: 1rem;
        max-height: calc(100vh - 8rem);
        display: flex;
        flex-direction: column;
    }

    .recipients-header {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 0.25rem;
    }

    .recipients-title {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: #1e293b;
    }

    .option-multiple {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        color: #475569;
        cursor: pointer;
        user-select: none;
    }

    .option-multiple input {
        width: 1rem;
        height: 1rem;
        accent-color: #3b82f6;
        cursor: pointer;
    }

    .option-multiple:has(input:disabled) {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .recipients-hint {
        margin: 0 0 0.75rem;
        font-size: 0.78rem;
        color: #94a3b8;
        line-height: 1.35;
    }

    .recipient-list {
        flex: 1;
        min-height: 10rem;
        max-height: min(52vh, 420px);
        overflow-y: auto;
        margin-top: 0.75rem;
        padding-right: 0.35rem;
        border-radius: 0.75rem;
    }

    .recipient-list-empty {
        margin: 1rem 0;
        font-size: 0.9rem;
        color: #94a3b8;
    }

    .recipient-row {
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 0.55rem 0.45rem;
        border-radius: 0.5rem;
        transition: background 0.15s;
    }

    .recipient-row:not(.recipient-row-disabled):hover {
        background: #f1f5f9;
    }

    .recipient-row-disabled {
        opacity: 0.45;
    }

    .recipient-checkbox {
        margin-top: 0.2rem;
        flex-shrink: 0;
        accent-color: #3b82f6;
        cursor: pointer;
    }

    .recipient-row-disabled .recipient-checkbox {
        cursor: not-allowed;
    }

    .recipient-label {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        cursor: pointer;
        font-size: 0.88rem;
        line-height: 1.3;
        min-width: 0;
        flex: 1;
    }

    .recipient-name {
        font-weight: 600;
        color: #334155;
        word-break: break-word;
    }

    .recipient-meta {
        font-size: 0.78rem;
        color: #94a3b8;
        word-break: break-word;
    }

    .recipients-footer {
        margin: 0.75rem 0 0;
        padding-top: 0.6rem;
        border-top: 1px solid #e2e8f0;
        font-size: 0.8rem;
        color: #64748b;
    }

    .field-grow .textarea {
        min-height: 14rem;
    }

    @media (max-width: 960px) {
        .form-layout {
            grid-template-columns: 1fr;
        }

        .form-col-recipients {
            position: static;
            max-height: none;
        }

        .recipient-list {
            max-height: 360px;
        }
    }

    .banner {
        margin: 0 0 1.25rem;
        padding: 0.875rem 1rem;
        border-radius: 0.75rem;
        font-size: 0.9rem;
    }

    .banner-error {
        background: #fff1f2;
        color: #be123c;
        border: 1px solid #fecdd3;
    }

    .banner-success {
        background: #ecfdf5;
        color: #047857;
        border: 1px solid #a7f3d0;
    }

    .field {
        margin-bottom: 1.5rem;
    }

    .field label {
        display: block;
        font-weight: 600;
        color: #334155;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
    }

    .input,
    .textarea {
        width: 100%;
        padding: 0.75rem 1rem;
        border-radius: 1rem;
        border: 1px solid #e2e8f0;
        background: white;
        font-size: 0.95rem;
        transition: border-color 0.2s, box-shadow 0.2s;
    }

    .input:focus,
    .textarea:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
    }

    .input:disabled,
    .textarea:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .textarea {
        resize: vertical;
        min-height: 12rem;
        line-height: 1.5;
    }

    .hint {
        display: block;
        margin-top: 0.4rem;
        font-size: 0.8rem;
        color: #94a3b8;
    }

    .customer-status {
        margin: 0;
        padding: 0.75rem 1rem;
        font-size: 0.9rem;
        color: #64748b;
    }

    .customer-error {
        border-radius: 0.75rem;
        background: #fff1f2;
        border: 1px solid #fecdd3;
        padding: 0.75rem 1rem;
    }

    .customer-error p {
        margin: 0 0 0.5rem;
        color: #be123c;
        font-size: 0.9rem;
    }

    .btn-retry {
        background: #be123c;
        color: white;
        border: none;
        border-radius: 0.5rem;
        padding: 0.35rem 0.75rem;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-retry:hover {
        background: #9f1239;
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 0.5rem;
        padding-top: 0.5rem;
    }

    .btn-primary {
        background: #3b82f6;
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 1rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);
        transition: background 0.2s, transform 0.2s;
    }

    .btn-primary:hover:not(:disabled) {
        background: #2563eb;
        transform: translateY(-1px);
    }

    .btn-primary:disabled {
        opacity: 0.75;
        cursor: not-allowed;
    }

    .btn-secondary {
        background: white;
        color: #475569;
        padding: 0.75rem 1.25rem;
        border-radius: 1rem;
        font-weight: 600;
        border: 1px solid #e2e8f0;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
    }

    .btn-secondary:hover:not(:disabled) {
        background: #f8fafc;
        border-color: #cbd5e1;
    }
</style>
