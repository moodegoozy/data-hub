# Copilot Instructions for data-hub

## Architecture Overview

This is a **React/TypeScript web application** for managing internet service subscriptions across multiple cities. The app is built with Vite and uses Firebase for potential backend integration, with localStorage as the current primary data persistence layer.

### Core Architecture
- **Single-page app** (`src/App.tsx`): Monolithic component handling authentication, city management, and customer subscription tracking
- **Client-side state**: All data persists to `localStorage` under the key `STORAGE_KEY = 'internet-admin-data-v1'`
- **Firebase integration** (`src/firebase.ts`): Currently initialized but not actively used in the app; available for future Realtime Database or Firestore integration
- **Build chain**: Vite (dev server) → React Fast Refresh → static dist/ for Firebase Hosting

### Data Model
Three core types persist together in localStorage:
```typescript
type City { id, name }
type Customer { id, cityId, name, startDate, lastPayment }
type StoredData { cities, customers, selectedCityId }
```
**Key pattern**: Customers are always associated with a city. Deleting a city soft-deletes customers (filters them out).

## Developer Workflows

### Local Development
```bash
npm run dev          # Start Vite dev server (hot reload enabled)
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
npm run lint         # Type-check only (tsc --noEmit)
```

### Deployment
- **Firebase Hosting**: `firebase.json` configured for SPA routing (all paths → /index.html)
- **Pre-deployment**: Run `npm run build` to generate `dist/` directory
- **Deployment command**: `firebase deploy` (requires Firebase CLI)

## Key Conventions & Patterns

### localStorage Strategy
- **Single serialization point**: `useEffect` in App.tsx saves entire data object whenever `data` state changes
- **Load on mount**: `loadStoredData()` called in `useState` initializer to hydrate from localStorage
- **Error handling**: Catches JSON parse errors, falls back to empty state
- When modifying stored data, always update the `data` state object (let useEffect handle persistence)

### Subscription Status Computation
The `computeStatus()` function is **business logic critical**: 
- Calculates days remaining from `lastPayment` date (1 month = expiration window)
- Returns status enum: `'active'` | `'warning'` (≤5 days left) | `'expired'`
- Used to render UI indicators and determine user visibility; changes here impact user experience significantly

### Form Patterns
- All form submissions use `preventDefault()` on FormEvent
- Input values stored in individual `useState` hooks, then batch-written to `data` state on submit
- Toast notifications (`toastMessage` state) auto-dismiss after 2.2s

### Localization
- **Arabic-first UI**: Date formatting uses `'ar-EG'` locale exclusively
- All user-facing strings are in Arabic (console errors bilingual)
- Date strings in localStorage are ISO format (YYYY-MM-DD) for consistency

## TypeScript Setup

- **Strict mode enabled**: No implicit any, strict null checks required
- **JSX factory**: `react-jsx` (import React not required in .tsx files)
- **Target**: ES2020 with dom libraries
- **Linting**: `npm run lint` runs tsc type-checking only; no eslint configured

## Critical Integration Points

### Firebase (Initialized but Unused)
- `src/firebase.ts` exports `firebaseApp` singleton
- Currently no authentication, database reads, or sync implemented
- Future: Can extend with Realtime Database or Firestore for multi-device sync
- App currently offline-first by design

### State Mutation Pattern
- Use functional setState: `setData(prev => ({ ...prev, ...changes }))`
- Never mutate nested objects directly before setState
- `useMemo` filters selectedCity to avoid re-renders

## When Extending This Codebase

1. **Adding features**: Keep them in App.tsx unless file exceeds 500 LOC
2. **New data types**: Always add to `StoredData` type and extend the localStorage save effect
3. **Date handling**: Use ISO format in storage, format with ar-EG locale for display
4. **Forms**: Follow existing pattern (state per input → batch setState on submit → auto-toast feedback)
5. **Testing**: Manual (no test framework installed); verify localStorage persistence and status computation
