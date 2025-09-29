<slot />

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    background: white;
    font-family: Arial, sans-serif;
  }

  :global(header), :global(nav), :global(.header) {
    display: none !important;
  }

  /* Print styles */
  @media print {
    :global(body) {
      margin: 0;
      padding: 0;
      background: white;
    }

    :global(header), :global(nav), :global(.header) {
      display: none !important;
    }
  }
</style>
