# Data Hub - Workspace Instructions

## Code Style
- Keep all user-facing UI text in Arabic and preserve RTL behavior.
- Follow existing patterns in `frontend/src/App.tsx` and avoid introducing broad refactors unless requested.
- Keep changes minimal and localized; this project has large single-file surfaces in both UI and API layers.

## Architecture

### Monorepo Boundaries
- Active code is in `frontend/` and `backend/`.
- Treat root app files (`index.html`, `package.json`, `vite.config.ts`) as legacy unless a task explicitly targets them.
- Frontend and backend are independent projects with separate dependencies and build pipelines.

### Frontend
- React + TypeScript + Vite app in `frontend/`.
- Most app logic is centralized in `frontend/src/App.tsx` (state, CRUD, tabs, Firestore subscriptions, MikroTik UI actions).
- Firebase setup is in `frontend/src/firebase.ts`.

### Backend
- Express + TypeScript service in `backend/src/index.ts`.
- Backend acts as a RouterOS integration API (via `node-routeros`) and does not host Firestore logic.

### Data Flow
Frontend -> Firebase Auth -> Firestore collections (`cities`, `customers`, `expenses`, `incomes`)
Frontend -> Backend API -> MikroTik RouterOS

## Build and Test

### Frontend
```bash
cd frontend
npm install
npm run dev
npm run build
npm run lint
```

### Backend
```bash
cd backend
npm install
npm run dev
npm run build
npm start
```

- There are currently no automated tests in this repository.
- `frontend` lint command is TypeScript type-checking (`tsc --noEmit`).

## Conventions
- Firestore writes use `setDoc` with manually generated document IDs (not `addDoc`).
- Destructive or sensitive financial actions in frontend follow a re-authentication flow before execution.
- Firestore reads merge document key as `id` at read time; preserve existing shape expectations when editing CRUD code.
- MikroTik backend endpoints expect connection credentials in request body (`host`, `username`, `password`, optional `port`).
- CORS in backend is explicit allowlist; add origins intentionally when environments change.

## Pitfalls
- In `frontend/index.html`, legacy stylesheet loading exists alongside modern app styles; avoid accidental CSS behavior changes.
- Backend base URL fallback is repeated in multiple frontend call sites; update carefully if changing API base handling.
- Some docs in root/frontend/backend README files are brief and may lag implementation details; validate against source files.

## Key References
- Project overview: `README.md`
- Frontend quick commands: `frontend/README.md`
- Backend quick commands/deploy note: `backend/README.md`
- Frontend source of truth: `frontend/src/App.tsx`, `frontend/src/firebase.ts`, `frontend/src/index.css`
- Backend source of truth: `backend/src/index.ts`
- Platform config: `firestore.rules`, `firebase.json`
