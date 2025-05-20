# RDTI Changelog

This file logs all major changes, experiments, and pivots made during the development of authentication and related features for the RDTI module.

---

## 2025-05-19

### Initial Setup
- Created SvelteKit project in the root directory.
- Added folders: `RDTI/logs` and `RDTI/changes` for organization.

### Auth0 Integration (Experiment)
- Integrated Auth0 authentication (login/logout) with SvelteKit.
- Created `.env` for Auth0 credentials.
- Implemented login/logout and route protection using Auth0.
- **Pivot:** Removed Auth0 integration after requirements changed.

### Simple Local Auth (Experiment)
- Implemented a simple local Svelte store for mock login/logout.
- Used for initial prototyping before moving to a real backend.
- **Pivot:** Replaced with Firebase authentication for production-ready solution.

### Firebase Authentication & Firestore
- Set up Firebase project and enabled Email/Password authentication.
- Created `.env` with Firebase config variables.
- Installed Firebase client SDK and removed `simpleAuth.ts`.
- Implemented login/logout and dashboard protection using Firebase Auth.
- Created Svelte stores for user state, loading, and error handling.

### Seeder Script (Experiment)
- Attempted to use Firebase Admin SDK and a Node.js seeder script to programmatically create users and Firestore documents.
- Encountered persistent configuration errors (`There is no configuration corresponding to the provided identifier`).
- Verified service account, IAM roles, and project ID; issue remained unresolved.
- **Pivot:** Decided to manually create test users in Firebase Console and focus on client-side auth.
- Cleaned up by removing seeder script, Admin SDK, and service account key from the project.

### Finalized Client-Side Auth Flow
- Login page uses Firebase Auth for email/password login.
- Dashboard is protected on the client side; redirects to login if not authenticated.
- All navigation and redirects are browser-only to avoid SSR errors.
- Added clear commit messages and documentation for future reference.

---

## 2025-05-19

### Header Navigation Improvements
- Implemented responsive header with mobile-friendly design using Tailwind CSS
- Added dropdown menus for Products and Orders sections
- Fixed dropdown interaction issues:
  - Improved hover behavior to maintain dropdown visibility
  - Enhanced click handling for better mobile support
  - Adjusted z-index and positioning for proper layering
  - Created larger hover areas for better user experience
- Navigation structure:
  - Home (direct link)
  - Products (dropdown: Product Request, Product Request Approval, Update Product Price, Compare SKU)
  - Orders (dropdown: Gross Profit Calculator)
- All styling implemented using Tailwind utility classes for maintainability

**Lessons Learned:**
- When implementing dropdowns, consider both hover and click interactions for better accessibility
- Use wrapper elements to create larger hover areas for better user experience
- Position dropdowns using `top-full` instead of margins for more reliable placement
- Keep mobile and desktop interactions consistent while maintaining responsive design

---

**Lessons Learned:**
- Firebase Auth is best handled on the client in SvelteKit; SSR route guards are not compatible with client-only auth.
- Always wrap navigation (`goto`) in a browser check to avoid SSR errors.
- Manual user creation in Firebase Console is a reliable fallback if Admin SDK seeding fails.
- Keep a changelog to track all major pivots and experiments for future maintainers.

## 2025-05-20

### Product Request Form Enhancement
- Implemented a modern, responsive data table for product requests using Tailwind CSS
- Added key features:
  - Sticky header with backdrop blur effect for better UX
  - Responsive grid layout (7-column desktop, stacked mobile)
  - Smart form controls with custom styling:
    - Brand and Supplier dropdowns using svelte-select
    - Numeric inputs for prices with proper validation
    - "Apply to All" functionality for Brand and Supplier fields
  - Mobile optimizations:
    - Stacked layout with clear field labels
    - Touch-friendly buttons and controls
    - Converted icon buttons to text buttons for better mobile UX
- Improved accessibility:
  - Screen reader labels
  - Proper heading hierarchy
  - Semantic HTML structure
  - Focus indicators
- Added interactive features:
  - Row hover states
  - Loading indicators
  - Success/error notifications
  - Background processing overlay
- Implemented proper z-index management for dropdowns and overlays
- Added comprehensive error handling and validation
- Integrated with Firebase for data persistence
- Added proper TypeScript interfaces for type safety

**Technical Details:**
- Used CSS Grid for responsive layout management
- Implemented custom styling for svelte-select components
- Added proper error boundaries and loading states
- Optimized performance with transition effects
- Maintained consistent styling with Tailwind utility classes

**Lessons Learned:**
- Proper z-index management is crucial for dropdown components
- Mobile-first design requires careful consideration of touch targets
- TypeScript interfaces help maintain code quality in complex forms
- Proper loading states and error handling improve user experience 

## 2025-05-21

### Route Protection and Authentication Improvements
- Implemented comprehensive route protection system:
  - Created protected route group with dedicated layout
  - Added client-side authentication checks
  - Improved authentication state management
  - Fixed CSS loading issues in protected routes
- Technical improvements:
  - Disabled SSR and prerendering for auth routes
  - Added proper cleanup of auth subscriptions
  - Implemented explicit checks for protected routes
  - Enhanced loading state handling
- Fixed styling issues:
  - Restored CSS imports in root layout
  - Ensured consistent styling across protected routes
  - Maintained responsive design in protected areas

**Lessons Learned:**
- Route protection requires both client and server-side considerations
- CSS loading order is crucial for protected routes
- Authentication state management needs proper cleanup
- Protected routes should have consistent styling with the rest of the app 