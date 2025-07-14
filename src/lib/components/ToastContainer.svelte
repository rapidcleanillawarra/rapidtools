<script lang="ts">
  import { toasts, removeToast, type Toast } from '$lib/utils/toast';
  import { fly, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  function handleClose(id: string) {
    removeToast(id);
  }
</script>

<div class="toast-container">
  {#each $toasts as toast (toast.id)}
    <div
      class="toast toast-{toast.type}"
      in:fly={{ y: -50, duration: 400, easing: quintOut }}
      out:scale={{ duration: 300, start: 1, opacity: 1 }}
      role="alert"
    >
      <div class="toast-content">
        <div class="toast-icon">
          {toast.icon || getDefaultIcon(toast.type)}
        </div>
        <div class="toast-text">
          {#if toast.title}
            <div class="toast-title">{toast.title}</div>
          {/if}
          <div class="toast-message">{toast.message}</div>
        </div>
        <button 
          class="toast-close"
          on:click={() => handleClose(toast.id)}
          aria-label="Close notification"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="toast-progress"></div>
    </div>
  {/each}
</div>

<script context="module">
  function getDefaultIcon(type: string): string {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  }
</script>

<style>
  .toast-container {
    position: fixed;
    top: 2rem;
    right: 2rem;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    pointer-events: none;
    max-width: 400px;
  }

  .toast {
    pointer-events: auto;
    min-width: 320px;
    max-width: 400px;
    padding: 1rem;
    border-radius: 0.75rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    color: white;
    font-weight: 500;
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .toast-success {
    background: linear-gradient(135deg, #22c55e, #16a34a);
  }

  .toast-error {
    background: linear-gradient(135deg, #ef4444, #dc2626);
  }

  .toast-info {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
  }

  .toast-warning {
    background: linear-gradient(135deg, #f59e0b, #d97706);
  }

  .toast-content {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    position: relative;
    z-index: 2;
  }

  .toast-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .toast-text {
    flex: 1;
    min-width: 0;
  }

  .toast-title {
    font-weight: 600;
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
    opacity: 0.9;
  }

  .toast-message {
    font-size: 0.875rem;
    line-height: 1.4;
    opacity: 0.95;
  }

  .toast-close {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.25rem;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .toast-close:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }

  .toast-close:active {
    transform: scale(0.95);
  }

  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.3);
    animation: toast-progress 5s linear;
  }

  @keyframes toast-progress {
    from {
      width: 100%;
    }
    to {
      width: 0%;
    }
  }

  @media (max-width: 640px) {
    .toast-container {
      top: 1rem;
      right: 1rem;
      left: 1rem;
      max-width: none;
    }

    .toast {
      min-width: auto;
      width: 100%;
    }
  }
</style> 