# Data Hub - Copilot Instructions

## Project Overview
Arabic-language subscriber management dashboard for ISP customers. Manages cities, customer subscriptions, monthly payments, expenses, and MikroTik router integration.

## Architecture

### Monorepo Structure
- **Root** (`/`): Legacy React app (can be ignored - frontend/ is the active version)
- **`frontend/`**: Active React + TypeScript + Vite app, deployed to Firebase Hosting
- **`backend/`**: Express + TypeScript API for MikroTik integration, deployed to Google Cloud Run

### Data Flow
```
Frontend (React) → Firebase Auth → Firestore (cities, customers, expenses, incomes)
Frontend → Backend API → MikroTik routers (via Cloud NAT)
```

### Key Firebase Collections
- `cities` - Customer regions/areas
- `customers` - Subscriber data with `cityId` reference, monthly payment status tracking
- `expenses` / `incomes` - Financial records with month/year indexing

## Development Commands

```bash
# Frontend (in /frontend)
npm install && npm run dev      # Dev server at localhost:5173
npm run build                   # Build to frontend/dist/
npm run lint                    # TypeScript check (tsc --noEmit)

# Backend (in /backend)
npm install && npm run dev      # ts-node-dev with auto-reload
npm run build && npm start      # Production build
```

## Code Patterns

### Single-File Frontend Architecture
The entire frontend lives in [frontend/src/App.tsx](frontend/src/App.tsx) (~2900 lines). When adding features:
- Add state variables to the existing App component
- Use `useMemo` for derived data (see `filteredCustomers`, `invoiceFilteredCustomers`)
- Use Firebase `onSnapshot` for real-time updates

### Type Definitions (in App.tsx)
```typescript
type Customer = {
  id: string; cityId: string; name: string;
  monthlyPayments?: { [yearMonth: string]: 'paid' | 'partial' | 'pending' };
  // ... other fields
};
```

### Arabic UI Conventions
- Month names: Use `MONTHS_AR` array for display
- Date formatting: `formatDate()` uses `'ar-EG'` locale
- RTL layout via CSS (direction handled in index.css)

### Firebase Operations Pattern
```typescript
// Write: Use setDoc with doc reference
await setDoc(doc(db, 'customers', customerId), customerData);
// Delete: Use deleteDoc
await deleteDoc(doc(db, 'customers', customerId));
// Real-time: Use onSnapshot in useEffect
onSnapshot(collection(db, 'cities'), (snapshot) => { ... });
```

### Backend CORS Configuration
Allowed origins in [backend/src/index.ts](backend/src/index.ts): Firebase Hosting domain + localhost ports

## Deployment

- **Frontend**: `firebase deploy --only hosting` (builds from `frontend/dist/`)
- **Backend**: Docker build → Cloud Run (see `backend/Dockerfile`)
- **Environment**: Set `VITE_BACKEND_URL` for Cloud Run API endpoint

## Key Files Reference
| File | Purpose |
|------|---------|
| [frontend/src/firebase.ts](frontend/src/firebase.ts) | Firebase config and exports |
| [firestore.rules](firestore.rules) | Security rules (auth required for all ops) |
| [firebase.json](firebase.json) | Hosting config, SPA rewrites |
