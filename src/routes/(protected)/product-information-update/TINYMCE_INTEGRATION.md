# TinyMCE Integration for Product Information Update

## Overview
This document describes the TinyMCE rich text editor integration for the Product Information Update module. TinyMCE has been applied to the Description, Specifications, and Features fields in the product edit modal.

## Files Modified/Created

### New Files
1. **TinyMCEEditor.svelte** - Reusable TinyMCE editor component
   - Location: `src/routes/(protected)/product-information-update/TinyMCEEditor.svelte`
   - Features:
     - Dynamic import of TinyMCE to reduce initial bundle size
     - Browser-only rendering (SSR-safe)
     - Configurable height and placeholder
     - Two-way data binding with parent component
     - Disabled state support
     - Custom toolbar with essential formatting options

### Modified Files
1. **ProductEditModal.svelte**
   - Replaced textarea fields for Description, Specifications, and Features with TinyMCEEditor component
   - Maintains two-way binding with `bind:value`
   - Supports disabled state during save operations

2. **vite.config.ts**
   - Added custom plugin to copy TinyMCE skins to static folder during build
   - Added TinyMCE to optimizeDeps for better development performance
   - Imports: `path`, `fs` modules for file operations

3. **package.json**
   - Added dependencies:
     - `tinymce@^8.2.2`
     - `@tinymce/tinymce-svelte@^3.2.0`

## TinyMCE Configuration

### Toolbar Features
- **Undo/Redo**: History navigation
- **Blocks**: Paragraph formatting (H1, H2, etc.)
- **Text Formatting**: Bold, Italic, Text Color
- **Alignment**: Left, Center, Right, Justify
- **Lists**: Bullet lists, Numbered lists, Indent/Outdent
- **Code View**: HTML source code editing

### Plugins Enabled
- `advlist` - Advanced list styles
- `autolink` - Automatic link detection
- `lists` - List functionality
- `link` - Link insertion/editing
- `charmap` - Special character insertion
- `preview` - Content preview
- `searchreplace` - Find and replace
- `visualblocks` - Visual block boundaries
- `code` - HTML code editing
- `fullscreen` - Fullscreen editing mode
- `table` - Table insertion/editing
- `wordcount` - Word/character count

**Note**: The `help` plugin was removed due to asset loading issues in TinyMCE 8.x

## Static Assets

### TinyMCE Skins Location
The TinyMCE UI skins and content styles are located in:
```
static/tinymce/skins/
  ├── content/
  │   └── default/
  └── ui/
      └── oxide/
```

These files are:
- Copied from `node_modules/tinymce/skins` during build
- Served statically by SvelteKit
- Referenced using the `base` path for production compatibility

## Usage Example

```svelte
<script lang="ts">
  import TinyMCEEditor from './TinyMCEEditor.svelte';
  
  let content = '';
</script>

<TinyMCEEditor
  id="my-editor"
  bind:value={content}
  disabled={false}
  placeholder="Enter text here..."
  height={300}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | `''` | Editor content (HTML) |
| `disabled` | `boolean` | `false` | Readonly mode |
| `placeholder` | `string` | `''` | Placeholder text |
| `height` | `number` | `300` | Editor height in pixels |
| `id` | `string` | Random | Unique editor ID |

## Development Setup

1. **Install Dependencies**
   ```powershell
   npm install tinymce @tinymce/tinymce-svelte
   ```

2. **Copy Skins to Static Folder**
   ```powershell
   New-Item -ItemType Directory -Path "static\tinymce" -Force
   Copy-Item -Path "node_modules\tinymce\skins" -Destination "static\tinymce\" -Recurse -Force
   ```

3. **Run Development Server**
   ```powershell
   npm run dev
   ```

## Production Deployment

The Vite config automatically handles copying TinyMCE skins during the build process. The editor uses the `base` path from `$app/paths` to ensure correct asset loading in production.

## License

TinyMCE is used under the GPL license (configured with `license_key: 'gpl'`). For commercial projects, you may need to purchase a TinyMCE license.

## Notes

- The editor is SSR-safe and only initializes in the browser
- Editor instances are properly cleaned up on component destroy
- The editor maintains reactivity with Svelte stores and parent components
- Content is saved as HTML and should be sanitized on the backend if needed
- **TinyMCE 8.x Compatibility**: Some plugins may attempt to load additional assets that aren't included in the static build. If you encounter similar errors with other plugins, they may need to be removed or configured differently

