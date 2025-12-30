# Data Hub - Copilot Instructions

## Project Overview
Arabic-language ISP subscriber management dashboard. Manages cities, customer subscriptions, monthly payments, expenses, and MikroTik router integration.

## Architecture

### Monorepo Structure
- **Root (`/`)**: Legacy files - IGNORE (active code is in `frontend/`)
- **`frontend/`**: React + TypeScript + Vite → Firebase Hosting
- **`backend/`**: Express + TypeScript API for MikroTik → Google Cloud Run

### Data Flow
```
Frontend → Firebase Auth → Firestore (cities, customers, expenses, incomes)
Frontend → Backend API → MikroTik routers (via Cloud NAT)
```

## Development

```bash
# Frontend (cd frontend/)
npm install && npm run dev    # localhost:5173
npm run build                 # builds to frontend/dist/
npm run lint                  # tsc --noEmit

# Backend (cd backend/)
npm install && npm run dev    # ts-node-dev, auto-reload
npm run build && npm start    # production
```

## Critical Code Patterns

### Single-File Architecture
**ALL frontend logic lives in `frontend/src/App.tsx` (~3300 lines)**. When adding features:
1. Add state with `useState` at component top (lines 60-150)
2. Use `useMemo` for derived data (see `filteredCustomers`, `revenuesData`, `dueInvoices`)
3. Subscribe to Firestore with `onSnapshot` in the auth-gated `useEffect` (lines 588-620)

### Type Definitions (in App.tsx, lines 6-55)
```typescript
type Customer = {
  id: string; cityId: string; name: string;
  monthlyPayments?: { [yearMonth: string]: 'paid' | 'partial' | 'pending' };
  isSuspended?: boolean; subscriptionValue?: number;
};
type City = { id: string; name: string; };
type Expense/Income = { id, name, amount, date, month, year };
```

### Firebase Pattern
```typescript
// Real-time subscription (cleanup returned)
onSnapshot(collection(db, 'customers'), (snap) => 
  setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)))
);
// Write with random ID
await setDoc(doc(db, 'customers', Math.random().toString(36).slice(2)), data);
// Delete
await deleteDoc(doc(db, 'customers', id));
```

### Arabic UI Conventions
- Months: `MONTHS_AR` array (يناير، فبراير، ...)
- Dates: `formatDate()` with `'ar-EG'` locale
- RTL: CSS at `index.css:2481` - `direction: rtl`
- Font: Cairo (Google Fonts)

### Backend API Endpoints (`backend/src/index.ts`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mikrotik/dashboard` | POST | Connect & fetch router info |
| `/mikrotik/secrets` | POST | Add PPPoE user |
| `/mikrotik/secrets/:id` | DELETE | Remove PPPoE user |
| `/mikrotik/secrets/:id/toggle` | POST | Enable/disable user |
| `/mikrotik/active/:id/disconnect` | POST | Disconnect active session |
| `/ip` | GET | Get egress IP (Cloud NAT test) |

All MikroTik endpoints require `{ host, username, password, port? }` in body.

### Environment Variables
- `VITE_BACKEND_URL`: Cloud Run API URL (defaults to production)
- Backend uses `PORT` env (default 8080)

## Deployment

```bash
# Frontend
cd frontend && npm run build
firebase deploy --only hosting

# Backend  
cd backend
docker build -t mikrotik-api .
# Deploy to Cloud Run with Cloud NAT for static egress IP
```

## Key Files
| File | Purpose |
|------|---------|
| `frontend/src/App.tsx` | Entire UI + business logic |
| `frontend/src/firebase.ts` | Firebase SDK initialization |
| `backend/src/index.ts` | All API routes |
| `firestore.rules` | Auth-required security rules |
| `firebase.json` | Hosting config (SPA rewrites) |
