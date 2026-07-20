# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Arabic (RTL) subscriber-management dashboard for a small ISP ("Data Hub" / "Servox"). It tracks
customer cities, subscriptions, monthly payment/collection status, expenses, manual incomes, and
prepaid card sales — plus a live MikroTik RouterOS control panel. Data lives in Firebase Firestore;
the UI is a React SPA hosted on Firebase Hosting.

Keep all user-facing UI text in Arabic and preserve RTL behavior.

## Repository layout (important)

This is a monorepo with two independent projects, each with its own `package.json`, dependencies,
and build pipeline:

- `frontend/` — React + TypeScript + Vite SPA. **This is where nearly all product logic lives.**
- `backend/` — Express + TypeScript service that proxies to MikroTik routers. Deployed to Google Cloud Run.

The **root** `package.json`, `index.html`, `vite.config.ts`, `assets/`, and `src/` are **legacy**.
Treat them as dead unless a task explicitly targets them — real work happens under `frontend/` and `backend/`.

## Commands

Run these from inside the respective subdirectory.

```bash
# frontend/
npm install
npm run dev      # Vite dev server on http://localhost:5173 (auto-opens)
npm run build    # production build -> frontend/dist
npm run preview
npm run lint     # NOTE: this is `tsc --noEmit` type-checking, not ESLint

# backend/
npm install
npm run dev      # ts-node-dev, respawns on change
npm run build    # tsc -> dist/
npm start        # node dist/index.js  (PORT env, default 8080)
```

There are **no automated tests** in this repo. "Lint" means TypeScript type-checking only.

Deploy: frontend builds to `frontend/dist` and is served by Firebase Hosting (`firebase.json`,
project `datahub-44154`). Backend deploys to Cloud Run via `backend/Dockerfile`.

## Architecture

### Data flow
```
Frontend ── Firebase Auth ──> Firestore collections: cities, customers, expenses, incomes, cards
Frontend ── HTTP (VITE_BACKEND_URL) ──> Backend ── node-routeros ──> MikroTik RouterOS device
```

### Frontend
- `frontend/src/App.tsx` is a **single ~4900-line component** holding essentially all state, CRUD,
  tab routing, Firestore subscriptions, financial calculations, MikroTik UI, and PDF report
  generation. Expect large single-file surfaces; keep changes minimal and localized rather than
  refactoring broadly. Use Grep to locate sections instead of reading the whole file.
- `frontend/src/firebase.ts` initializes Firebase (config is inlined; not secret for a web client)
  and exports `auth` and `db`.
- Tabs are a `useState` union (`dashboard | invoices | yearly | revenues | discounts | suspended |
  expenses | microtik | customers-db | cards`), not a router.

### Backend
- `backend/src/index.ts` is a single Express app. It is a **stateless RouterOS proxy** — it holds no
  Firestore logic and no persistent router connection. Every endpoint receives MikroTik connection
  credentials (`host`, `username`, `password`, optional `port` default 8728) in the **request body**,
  opens a fresh `RouterOSAPI` connection, does its work, and closes it.
- `GET /ip` returns the Cloud Run egress IP (Cloud NAT) so the operator can whitelist it on the router.
- CORS is an **explicit allowlist** (`allowedOrigins` array). Add origins deliberately when
  environments change.

## Conventions and gotchas

- **Firestore writes use `setDoc` with a manually generated document ID**, never `addDoc`. IDs are
  generated as `Date.now().toString(36) + Math.random().toString(36).slice(2)`.
- **Reads merge the Firestore doc key as `id`** at read time (`{ id: doc.id, ...doc.data() }`).
  Preserve this shape when editing CRUD code.
- **Destructive / financial actions require re-authentication.** Deletes and edits of expenses,
  incomes, cards, discounts, cities, and customers gate the action behind
  `reauthenticateWithCredential` (the user re-enters their password) before executing. Follow this
  existing pattern for any new sensitive action.
- **Payment model:** a customer's `monthlyPayments` maps `"YYYY-MM"` → `paid | partial | pending |
  discount`, with parallel `monthlyPartialAmounts` / `monthlyDiscountAmounts`. Revenue/collection
  calculations **exclude** customers where `isSuspended` or `isExempt` is true. Preserve these
  exclusions when touching financial aggregation.
- **Backend base URL fallback is duplicated across ~8 call sites** in `App.tsx`:
  `(import.meta.env.VITE_BACKEND_URL as string) || 'https://mikrotik-api-923854285496.europe-west1.run.app'`.
  If you change how the API base is resolved, update every occurrence.
- **PDF reports** (cards report, customer database) are built as inline HTML strings and rendered
  via `html2pdf.js`, which is **dynamically imported** on demand. Dark theme is temporarily stripped
  from `<html data-theme>` during generation, then restored.
- Firestore security rules (`firestore.rules`) allow read/write to any authenticated user across all
  collections — there is no per-document ownership model.
