# Copilot Instructions for data-hub

## Architecture Overview

This is a **React/TypeScript web application** for managing internet service provider (ISP) customer subscriptions across multiple cities. The app is built with Vite and uses **Firebase Authentication + Firestore** for data persistence and multi-user access control.

### Core Architecture
- **Single-page app** (`src/App.tsx`): Monolithic component (~1,390 lines) handling authentication, city management, customer CRUD, invoice generation, and monthly payment tracking
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
  id, cityId, name, phone?, startDate?, subscriptionValue?, 
  setupFeeTotal?, setupFeePaid?, ipNumber?, userName?,
  additionalRouters?: { userName, ipNumber }[],
  lap?, site?, notes?, paymentStatus?: 'paid' | 'unpaid',
  monthlyPayments?: { [yearMonth: string]: 'paid' | 'partial' | 'pending' }
}
```
**Key patterns**: 
- Customers belong to a city (foreign key: `cityId`)
- Deleting a city cascades to all its customers
- `paymentStatus` tracks historical subscription state (paid/unpaid)
- `monthlyPayments` object tracks granular monthly state (keyed as 'YYYY-MM') with 3 states
- `additionalRouters` array supports multiple network devices per customer
- `startDate` stored as ISO string (YYYY-MM-DD format)

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
- **Query pattern**: No complex queries - all filtering done in React via `useMemo` (e.g., `filteredCustomers` by city)

### Payment Tracking System
- **Two-tier payment model**:
  - `paymentStatus` (enum: 'paid'|'unpaid'): Legacy field tracking overall subscription status
  - `monthlyPayments` (object): Granular monthly tracking with states 'paid'|'partial'|'pending', keyed as 'YYYY-MM'
- **Monthly UI**: "متابعة الاشتراكات" (yearly) tab displays month grid for selected city/year, allowing per-month status edits
- **Status change pattern**: All payment updates require confirmation modal (`confirmStatusChange` state) before Firestore write
- **Default state**: New customers default to `paymentStatus: 'unpaid'` with no monthlyPayments entries

### Form Patterns
- All form submissions use `preventDefault()` on FormEvent
- Input values stored in individual `useState` hooks, then batch-written to Firestore on submit
- Toast notifications (`toastMessage` state) auto-dismiss after 2.2s
- **Additional routers**: Dynamic form inputs managed via `additionalRouterCount` state with array of router objects
- **Password confirmation**: Destructive actions (delete customer/city, edit customer) require password re-auth via `EmailAuthProvider.credential()`

### Localization
- **Arabic-first UI**: Date formatting uses `'ar-EG'` locale exclusively via `formatDate()` function
- **Month array**: MONTHS_AR constant contains Arabic month names (يناير, فبراير, etc.)
- All user-facing strings are in Arabic; error handling includes localized Firebase auth error codes
- ISO date format (YYYY-MM-DD) used for internal date operations via `todayISO()` helper
- Year/month pairs in monthlyPayments use ISO string format 'YYYY-MM'

### Invoice Generation
- **Dynamic import**: `html2pdf.js` loaded on-demand in `generateInvoicePDF()`
- **Template**: Inline HTML string with embedded CSS (Cairo font, RTL layout, A4 dimensions)
- **Customer data**: Includes all fields, additional routers, and calculated setup fee balance
- **Monthly summary**: Invoice tab shows filtered customers by city, with per-invoice PDF download

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

1. **Adding features**: App.tsx is now 1,390 lines; consider splitting into smaller components if adding major features
2. **New Firestore fields**: Update TypeScript types first, then ensure write operations exclude undefined values
3. **Date handling**: Use ISO format internally via `todayISO()`, format with `'ar-EG'` locale for display via `formatDate()`
4. **Forms**: Follow existing pattern (state per input → build clean object → Firestore write → toast feedback)
5. **Real-time updates**: Don't call `getDocs` manually - rely on `onSnapshot` listeners for automatic UI sync
6. **Payment features**: Use `monthlyPayments` object for granular tracking; add confirmation modal for all status changes
7. **Testing**: Manual (no test framework installed); verify Firebase writes and auth flow in browser
8. **Security**: Modify `firestore.rules` when adding new collections or changing access patterns
9. **Tab structure**: App has three main tabs: 'dashboard' (cities/customers), 'invoices' (PDF generation), 'yearly' (monthly payment tracking)
10. **Modals**: Destructive actions should follow the confirm pattern with password re-auth (`EditPasswordModal`, `DeleteConfirm`)
