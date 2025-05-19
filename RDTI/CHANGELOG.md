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

**Lessons Learned:**
- Firebase Auth is best handled on the client in SvelteKit; SSR route guards are not compatible with client-only auth.
- Always wrap navigation (`goto`) in a browser check to avoid SSR errors.
- Manual user creation in Firebase Console is a reliable fallback if Admin SDK seeding fails.
- Keep a changelog to track all major pivots and experiments for future maintainers. 