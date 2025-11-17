<script lang="ts">
  import type { LayoutData } from './$types';
  export let data: LayoutData;
</script>

<div class="print-layout">
  <slot />
</div>

<style>
  .print-layout {
    margin: 0;
    padding: 0;
    background: white;
    font-family: Arial, sans-serif;
    min-height: 100vh;
  }

  /* Print styles */
  @media print {
    .print-layout {
      margin: 0;
      padding: 0;
      background: white;
    }

    :global(body) {
      margin: 0;
      padding: 0;
    }
  }
</style> 