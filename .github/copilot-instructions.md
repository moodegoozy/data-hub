# Copilot Instructions for data-hub

## Architecture Overview

This is a **React/TypeScript web application** for managing internet service provider (ISP) customer subscriptions across multiple cities. The app is built with Vite and uses **Firebase Authentication + Firestore** for data persistence and multi-user access control.

### Core Architecture
- **Single-page app** (`src/App.tsx`): Monolithic component (~880 lines) handling authentication, city management, customer CRUD, invoice generation, and payment tracking
- **Firebase backend** (`src/firebase.ts`): 
  - Authentication: Email/password login with session persistence via `onAuthStateChanged`
  - Firestore: Two collections (`cities`, `customers`) with real-time listeners (`onSnapshot`)
  - Security: Read/write access restricted to authenticated users only (see `firestore.rules`)
- **Build chain**: Vite (dev server) → React Fast Refresh → static dist/ for Firebase Hosting
- **UI language**: Fully Arabic with `dir="rtl"` and Cairo font; dates formatted with `'ar-EG'` locale

### Data Model
Two Firestore collections with real-time sync:
```typescript
type City { id, name }
type Customer {
  id, cityId, name, phone?, subscriptionValue?, 
  setupFeeTotal?, setupFeePaid?, ipNumber?, userName?,
  additionalRouters?: { userName, ipNumber }[],
  lap?, site?, notes?, paymentStatus?: 'paid' | 'unpaid'
}
```
**Key patterns**: 
- Customers belong to a city (foreign key: `cityId`)
- Deleting a city cascades to all its customers
- Payment status tracks monthly subscription state (paid/unpaid)
- Additional routers array supports multiple network devices per customer

## Developer Workflows

### Local Development
```bash
npm run dev          # Start Vite dev server (hot reload enabled)
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
npm run lint         # Type-check only (tsc --noEmit, no eslint)
```
**Note**: Firebase packages are NOT in package.json but imported in code - they're CDN-loaded or externally managed. Check imports if build fails.

### Deployment
- **Firebase Hosting**: `firebase.json` configured for SPA routing (all paths → /index.html)
- **Pre-deployment steps**:
  1. `npm run build` to generate `dist/` directory
  2. Verify Firebase config in `src/firebase.ts` matches production project
  3. `firebase deploy` (requires Firebase CLI and authenticated session)
- **Firestore rules**: Deployed separately via `firestore.rules` - all authenticated users have full read/write access

## Key Conventions & Patterns

### Firestore Real-time Sync Strategy
- **onSnapshot listeners**: Two active listeners (cities, customers) established in `useEffect` when `isAuthenticated` becomes true
- **Automatic UI updates**: State updates (`setCities`, `setCustomers`) trigger re-renders; no manual polling needed
- **Cleanup pattern**: Return unsubscribe functions in useEffect to prevent memory leaks on unmount
- **Write operations**: All use `setDoc(doc(db, collection, id), data)` for creates/updates, `deleteDoc` for deletes
- **Undefined handling**: Firestore rejects `undefined` values - all writes build clean objects excluding undefined/null/empty strings

### Payment Status Tracking
- **paymentStatus field**: Enum `'paid' | 'unpaid'` stored per customer
- **Confirmation pattern**: Status changes trigger a confirmation modal (`confirmStatusChange` state) before updating Firestore
- **Default state**: New customers default to `'unpaid'` status

### Form Patterns
- All form submissions use `preventDefault()` on FormEvent
- Input values stored in individual `useState` hooks, then batch-written to Firestore on submit
- Toast notifications (`toastMessage` state) auto-dismiss after 2.2s
- **Additional routers**: Dynamic form inputs managed via `additionalRouterCount` state with array of router objects

### Localization
- **Arabic-first UI**: Date formatting uses `'ar-EG'` locale exclusively (`formatDate()` function)
- All user-facing strings are in Arabic; error handling includes localized Firebase auth error codes
- ISO date format (YYYY-MM-DD) used for internal date operations via `todayISO()` helper

### Invoice Generation
- **Dynamic import**: `html2pdf.js` loaded on-demand in `generateInvoicePDF()`
- **Template**: Inline HTML string with embedded CSS (Cairo font, RTL layout, A4 dimensions)
- **Customer data**: Includes all fields, additional routers, and calculated setup fee balance

## TypeScript Setup

- **Strict mode enabled**: No implicit any, strict null checks required
- **JSX factory**: `react-jsx` (import React not required in .tsx files)
- **Target**: ES2020 with dom libraries
- **Linting**: `npm run lint` runs tsc type-checking only; no eslint configured

## Critical Integration Points

### Firebase Authentication Flow
- `onAuthStateChanged` listener establishes session on app load (persists across refreshes)
- Login errors mapped to Arabic messages (see `handleLogin` error codes)
- All UI content gated behind `isAuthenticated` state - unauthenticated users see login screen only
- `authLoading` state prevents flash of wrong UI during initial auth check

### State Management Pattern
- **No state management library**: All state in App.tsx via `useState` hooks
- **Derived state**: Use `useMemo` for filtered lists (`filteredCustomers`, `invoiceFilteredCustomers`)
- **Modal state**: Separate boolean flags (`showCustomerModal`, `showEditModal`, `confirmStatusChange`)
- **Form state**: Each input field has its own state hook (not using form libraries)

## When Extending This Codebase

1. **Adding features**: Keep them in App.tsx unless file exceeds ~1000 LOC (currently at 880)
2. **New Firestore fields**: Update TypeScript types first, then ensure write operations exclude undefined values
3. **Date handling**: Use ISO format internally via `todayISO()`, format with `'ar-EG'` locale for display via `formatDate()`
4. **Forms**: Follow existing pattern (state per input → build clean object → Firestore write → toast feedback)
5. **Real-time updates**: Don't call `getDocs` manually - rely on `onSnapshot` listeners for automatic UI sync
6. **Testing**: Manual (no test framework installed); verify Firebase writes and auth flow in browser
7. **Security**: Modify `firestore.rules` when adding new collections or changing access patterns
