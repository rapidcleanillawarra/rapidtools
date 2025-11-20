<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { base } from '$app/paths';

  export let value: string = '';
  export let disabled: boolean = false;
  export let placeholder: string = '';
  export let height: number = 300;
  export let id: string = `editor-${Math.random().toString(36).substr(2, 9)}`;

  let editorElement: HTMLElement;
  let editor: any = null;
  let isInitialized = false;

  async function initEditor() {
    if (!browser || !editorElement || isInitialized) return;

    try {
      // Dynamically import TinyMCE
      const tinymce = (await import('tinymce/tinymce')).default;
      
      // Import theme and plugins
      await Promise.all([
        import('tinymce/models/dom'),
        import('tinymce/themes/silver'),
        import('tinymce/icons/default'),
        import('tinymce/plugins/advlist'),
        import('tinymce/plugins/autolink'),
        import('tinymce/plugins/lists'),
        import('tinymce/plugins/link'),
        import('tinymce/plugins/charmap'),
        import('tinymce/plugins/preview'),
        import('tinymce/plugins/searchreplace'),
        import('tinymce/plugins/visualblocks'),
        import('tinymce/plugins/code'),
        import('tinymce/plugins/fullscreen'),
        import('tinymce/plugins/table'),
        import('tinymce/plugins/help'),
        import('tinymce/plugins/wordcount')
      ]);

      await tick();

      // Initialize TinyMCE
      const editors = await tinymce.init({
        target: editorElement,
        height: height,
        menubar: false,
        plugins: [
          'advlist', 'autolink', 'lists', 'link', 'charmap', 'preview',
          'searchreplace', 'visualblocks', 'code', 'fullscreen',
          'table', 'help', 'wordcount'
        ],
        toolbar: 'undo redo | blocks | ' +
          'bold italic forecolor | alignleft aligncenter ' +
          'alignright alignjustify | bullist numlist outdent indent | ' +
          'removeformat | code | help',
        content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size:14px; padding: 10px; }',
        placeholder: placeholder,
        readonly: disabled,
        branding: false,
        promotion: false,
        license_key: 'gpl',
        skin_url: `${base}/tinymce/skins/ui/oxide`,
        content_css: `${base}/tinymce/skins/content/default/content.min.css`,
        setup: (ed: any) => {
          editor = ed;
          
          ed.on('init', () => {
            if (value) {
              ed.setContent(value);
            }
          });

          ed.on('change keyup', () => {
            value = ed.getContent();
          });
        }
      });

      if (editors && editors.length > 0) {
        editor = editors[0];
        isInitialized = true;
      }
    } catch (error) {
      console.error('Failed to initialize TinyMCE:', error);
    }
  }

  onMount(() => {
    if (browser) {
      initEditor();
    }
  });

  onDestroy(() => {
    if (editor && browser) {
      try {
        editor.destroy();
      } catch (e) {
        console.error('Error destroying editor:', e);
      }
    }
  });

  // Update editor content when value prop changes externally
  $: if (editor && isInitialized && value !== editor.getContent()) {
    editor.setContent(value || '');
  }

  // Update disabled state
  $: if (editor && isInitialized) {
    editor.mode.set(disabled ? 'readonly' : 'design');
  }
</script>

<div class="tinymce-wrapper">
  <div bind:this={editorElement} {id}></div>
</div>

<style>
  .tinymce-wrapper {
    width: 100%;
  }
  
  .tinymce-wrapper :global(.tox-tinymce) {
    border-radius: 0.375rem;
    border-color: #d1d5db;
  }
  
  .tinymce-wrapper :global(.tox-tinymce:focus-within) {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
  }
</style>

