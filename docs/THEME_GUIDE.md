# RapidTools Global Theme Guide

This guide outlines the standard conventions and code patterns used to migrate or build pages matching the RapidTools dark theme.

---

## Key Reference Files

Refer to these files in the codebase as live working examples:

- [`src/app.css`](file:///c:/Users/ASUS/Documents/Rapid%20Clean/rapidtools/src/app.css) – Central stylesheet containing design tokens, global utility classes (`.btn-primary`, `.btn-secondary`, `.rapid-card`), and dark theme overrides for `svelte-select` and toasts.
- [`src/routes/+layout.svelte`](file:///c:/Users/ASUS/Documents/Rapid%20Clean/rapidtools/src/routes/+layout.svelte) – Root layout managing page background (`bg-[#0e1012]`), desktop sidebar margins, and global layout chrome.
- [`src/routes/(protected)/product-request/+page.svelte`](file:///c:/Users/ASUS/Documents/Rapid%20Clean/rapidtools/src/routes/%28protected%29/product-request/+page.svelte) – Full reference implementation of a data table, sticky action bar, form inputs, bulk action banners, and modals.
- [`src/routes/(protected)/product-request/ProductRequestImages.svelte`](file:///c:/Users/ASUS/Documents/Rapid%20Clean/rapidtools/src/routes/%28protected%29/product-request/ProductRequestImages.svelte) – Reference implementation of image uploaders, file drops, and thumbnail badges.
- [`src/routes/(protected)/dashboard/+page.svelte`](file:///c:/Users/ASUS/Documents/Rapid%20Clean/rapidtools/src/routes/%28protected%29/dashboard/+page.svelte) – Reference implementation of hero sections, stat cards, and navigation grids.
- [`src/lib/Header.svelte`](file:///c:/Users/ASUS/Documents/Rapid%20Clean/rapidtools/src/lib/Header.svelte) – Sidebar navigation, collapsible menus, and user profile menus.

---

## 1. Core Color Palette & Design Tokens

| Role | Color / Tailwind Class | Hex / Value | Usage |
| :--- | :--- | :--- | :--- |
| **Page Base** | `bg-[#0e1012]` | `#0e1012` | Default page background |
| **Card / Container** | `bg-[#141619]` | `#141619` | Main content cards, modals |
| **Section / Header** | `bg-[#181b20]` | `#181b20` | Table headers, alternate sections |
| **Input / Inner Surface** | `bg-[#0e1012]` or `bg-[#1f2329]` | `#0e1012` / `#1f2329` | Text fields, badge backgrounds, hover items |
| **Primary Border** | `border-[#262a30]` | `#262a30` | Cards, table dividers, input borders |
| **Secondary Border** | `border-[#333842]` | `#333842` | Buttons, modal dialogs, strong dividers |
| **Accent / Primary** | `bg-lime-500`, `text-lime-400` | `#84cc16` / `#a3e635` | Primary buttons, active states, key labels |
| **Text Primary** | `text-white` / `text-gray-200` | `#ffffff` / `#e5e7eb` | Headings, row data, body text |
| **Text Muted** | `text-gray-400` / `text-gray-500`| `#9ca3af` / `#6b7280` | Subtitles, labels, placeholders |
| **Danger / Delete** | `bg-red-950/20`, `text-red-400` | — | Remove/delete actions |

---

## 2. Global CSS Classes (`src/app.css`)

You can directly use the pre-configured global component classes:

- **`btn-primary`**: Bold lime green action button (`bg-lime-500 text-gray-950 hover:bg-lime-400 rounded-lg`).
- **`btn-secondary`**: Dark button with subtle border and lime hover (`bg-[#1f2329] border-[#333842] text-gray-200 hover:text-lime-300`).
- **`input-field`**: Full-width dark input field with lime focus ring.
- **`form-label`**: Standard label (`text-sm font-medium text-gray-300 mb-1.5`).
- **`rapid-card`**: Card wrapper (`bg-[#141619] border border-[#262a30] rounded-xl shadow-md p-5`).
- **`rapid-table`**: Table base (`min-w-full divide-y divide-[#262a30] text-sm text-gray-200`).

---

## 3. Standard Page Layout Structure

```svelte
<svelte:head>
  <title>Page Title - RapidTools</title>
</svelte:head>

<div class="min-h-screen py-6 px-2 sm:px-4 lg:px-6">
  <div class="w-full bg-[#141619] border border-[#262a30] shadow-xl rounded-2xl p-4 sm:p-6 lg:p-8">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Page Title</h1>
        <p class="mt-1 text-sm text-gray-400">Brief page description</p>
      </div>
      <div class="flex items-center gap-3">
        <!-- Action Buttons -->
        <button class="btn-secondary">Action</button>
        <button class="btn-primary">Save Changes</button>
      </div>
    </div>

    <!-- Page Content / Tables / Forms -->
  </div>
</div>
```

---

## 4. Tables & Lists

```svelte
<div class="rounded-2xl border border-[#262a30] bg-[#141619] shadow-xl overflow-hidden">
  <div class="overflow-x-auto">
    <table class="w-full min-w-full divide-y divide-[#262a30] text-sm text-gray-200">
      <thead class="bg-[#181b20] text-xs font-semibold uppercase tracking-wider text-gray-400">
        <tr>
          <th class="px-4 py-3 text-left">Column 1</th>
          <th class="px-4 py-3 text-left">Column 2</th>
          <th class="px-4 py-3 text-right">Action</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-[#262a30] bg-[#141619]">
        {#each items as item}
          <tr class="even:bg-[#181b20]/50 hover:bg-[#1f2329]/60 transition-colors">
            <td class="px-4 py-3.5">{item.name}</td>
            <td class="px-4 py-3.5 text-gray-400">{item.detail}</td>
            <td class="px-4 py-3.5 text-right">
              <button class="btn-secondary text-xs px-2.5 py-1">Edit</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
```

---

## 5. Form Elements

### Text & Number Inputs
```html
<input
  type="text"
  class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
  placeholder="Enter value"
/>
```

### Checkbox
```html
<input
  type="checkbox"
  class="h-4 w-4 rounded border-[#333842] bg-[#0e1012] text-lime-500 focus:ring-lime-500 focus:ring-offset-[#141619]"
/>
```

### Delete / Remove Buttons
```html
<button
  class="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-30 transition"
>
  Delete
</button>
```

---

## 6. Modals & Overlays

```svelte
{#if showModal}
  <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-[#141619] border border-[#262a30] p-6 rounded-2xl shadow-2xl max-w-md w-full text-gray-200">
      <h3 class="text-lg font-bold text-white mb-2">Modal Title</h3>
      <p class="text-sm text-gray-300 mb-6 leading-relaxed">
        Modal description or prompt text goes here.
      </p>
      <div class="flex justify-end space-x-3">
        <button on:click={() => showModal = false} class="btn-secondary text-sm">Cancel</button>
        <button on:click={handleConfirm} class="btn-primary text-sm">Confirm</button>
      </div>
    </div>
  </div>
{/if}
```

---

## 7. Migration Checklist (What to Replace)

When updating legacy/light-themed pages:

1. **Remove body overrides**: Remove `:global(body) { background-color: #f3f4f6; }` or light background overrides in `<style>`.
2. **Replace backgrounds**:
   - `bg-white`, `bg-gray-50`, `bg-gray-100` -> `bg-[#141619]`, `bg-[#181b20]`, or `bg-[#0e1012]`.
3. **Replace borders**:
   - `border-gray-200`, `border-gray-300` -> `border-[#262a30]` or `border-[#333842]`.
4. **Replace text colors**:
   - `text-gray-900` -> `text-white`
   - `text-gray-600`/`text-gray-700` -> `text-gray-300` or `text-gray-400`
5. **Replace button colors**:
   - `bg-blue-600`, `bg-green-600` -> `btn-primary` (lime) or `btn-secondary` (`#1f2329`).
6. **Replace Select styles**: Use the dark theme CSS variables defined in `app.css` (`--background: #0e1012`, `--border: 1px solid #262a30`, `--item-hover-bg: #1f2329`, `--item-is-active-color: #a3e635`).
