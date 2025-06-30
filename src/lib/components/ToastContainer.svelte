<script lang="ts">
  import { toasts, removeToast, type Toast } from '$lib/utils/toast';
  import { fly } from 'svelte/transition';

  function handleClose(id: string) {
    removeToast(id);
  }
</script>

<div class="toast-container">
  {#each $toasts as toast (toast.id)}
    <div
      class="toast toast-{toast.type}"
      transition:fly={{ y: -50, duration: 300 }}
      role="alert"
    >
      <div class="toast-content">
        <span class="toast-message">{toast.message}</span>
        <button 
          class="toast-close"
          on:click={() => handleClose(toast.id)}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 2rem;
    right: 2rem;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    min-width: 300px;
    max-width: 500px;
    padding: 1rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    color: white;
    font-weight: 500;
  }

  .toast-success {
    background-color: #22c55e;
  }

  .toast-error {
    background-color: #ef4444;
  }

  .toast-info {
    background-color: #3b82f6;
  }

  .toast-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .toast-message {
    flex: 1;
    font-size: 1rem;
  }

  .toast-close {
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    font-weight: bold;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
  }

  .toast-close:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  @media (max-width: 640px) {
    .toast-container {
      top: 1rem;
      right: 1rem;
      left: 1rem;
    }

    .toast {
      min-width: auto;
      width: 100%;
    }
  }
</style> 