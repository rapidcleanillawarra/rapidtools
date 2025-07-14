<script lang="ts">
  export let type: 'card' | 'text' | 'circle' | 'button' = 'card';
  export let width: string = '100%';
  export let height: string = '1rem';
  export let className: string = '';
</script>

{#if type === 'card'}
  <div class="skeleton-card {className}" style="width: {width}; height: {height};">
    <div class="skeleton-shimmer"></div>
  </div>
{:else if type === 'text'}
  <div class="skeleton-text {className}" style="width: {width}; height: {height};">
    <div class="skeleton-shimmer"></div>
  </div>
{:else if type === 'circle'}
  <div class="skeleton-circle {className}" style="width: {width}; height: {height};">
    <div class="skeleton-shimmer"></div>
  </div>
{:else if type === 'button'}
  <div class="skeleton-button {className}" style="width: {width}; height: {height};">
    <div class="skeleton-shimmer"></div>
  </div>
{/if}

<style>
  .skeleton-card,
  .skeleton-text,
  .skeleton-circle,
  .skeleton-button {
    position: relative;
    overflow: hidden;
    background: #f3f4f6;
    border-radius: 0.5rem;
    animation: skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .skeleton-circle {
    border-radius: 50%;
  }

  .skeleton-button {
    border-radius: 0.375rem;
  }

  .skeleton-shimmer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.4),
      transparent
    );
    animation: skeleton-shimmer 1.5s infinite;
  }

  @keyframes skeleton-pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @keyframes skeleton-shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
</style> 