<script lang="ts">
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { page } from '$app/stores';
    import { fade, fly } from 'svelte/transition';

    const toFromQuery = $derived($page.url.searchParams.get('to') ?? '');

    let to = $state('');
    let subject = $state('');
    let body = $state('');
    let sending = $state(false);
    let formError = $state('');
    let successMessage = $state('');

    $effect(() => {
        const q = toFromQuery;
        if (q) to = q;
    });

    function isValidEmail(s: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
    }

    function parseRecipients(raw: string): string[] {
        return raw
            .split(/[,;\n]/)
            .map((s) => s.trim())
            .filter(Boolean);
    }

    async function handleSend(e: Event) {
        e.preventDefault();
        formError = '';
        successMessage = '';

        const recipients = parseRecipients(to);
        if (recipients.length === 0) {
            formError = 'Enter at least one recipient email.';
            return;
        }
        const invalid = recipients.filter((r) => !isValidEmail(r));
        if (invalid.length > 0) {
            formError = `Invalid email(s): ${invalid.join(', ')}`;
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
            await new Promise((r) => setTimeout(r, 600));
            successMessage =
                'Draft validated. Wire up your send endpoint (e.g. Logic App or API) in this page to deliver mail.';
            body = '';
            subject = '';
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

    <form class="content-card" in:fade={{ duration: 800, delay: 200 }} onsubmit={handleSend}>
        {#if formError}
            <p class="banner banner-error" role="alert">{formError}</p>
        {/if}
        {#if successMessage}
            <p class="banner banner-success" role="status">{successMessage}</p>
        {/if}

        <div class="field">
            <label for="to">To</label>
            <input
                id="to"
                type="text"
                class="input"
                placeholder="email@example.com or several, separated by commas"
                bind:value={to}
                autocomplete="email"
                disabled={sending}
            />
            <span class="hint">Separate multiple addresses with commas, semicolons, or new lines.</span>
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

        <div class="field">
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
    </form>
</div>

<style>
    :global(body) {
        background-color: #f8fafc;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    .page-container {
        padding: 2.5rem;
        max-width: 900px;
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
