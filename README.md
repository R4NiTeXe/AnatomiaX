# AnatomiaX

Interactive 3D human anatomy learning platform for medical education. AnatomiaX combines high-fidelity 3D visualization, simulation, and AI-assisted learning to make anatomy intuitive and clinically relevant.

## Platform Strategy — Responsive Web ONLY

Supported:

- desktop browser
- tablet browser
- mobile browser (responsive web)

Not supported / permanently dropped:

- native iOS
- native Android
- Expo / React Native

Native mobile development was evaluated through 8.19.x and permanently removed. All anatomy, learning, auth, cohort, progress, and notification features are delivered as responsive web. No native-mobile runtime, SDK, or build pipeline remains.

## Purpose

AnatomiaX helps students and professionals explore human anatomy through interactive 3D models, physiological simulations, and AI-powered knowledge retrieval — with a strong focus on medical accuracy and safety.

## Frontend — Responsive Web Only

- **marketing/** — Public marketing site (11ty + Tailwind CSS + daisyUI + GSAP + Lenis + Barba.js)
- **web/** — Main application (React + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack Query + Three.js / React Three Fiber + GSAP + Lenis) — responsive on desktop, tablet, and mobile browsers
- **admin/** — Admin dashboard (Next.js + TypeScript + Turbopack + Tailwind CSS + shadcn/ui)
- **packages/** — Shared frontend packages (`shared-types`, `anatomy-core` — platform-neutral, web-consumed)

## Backend

- **api/** — Core API (Node.js + TypeScript + NestJS)
- **packages/** — Shared backend packages (`shared`)

## 3D

3D assets are stored in `3d-assets/` (male, female, organs, systems, pathology, animations) and rendered via Three.js / React Three Fiber / WebGL in `frontend/web`. The verified asset manifest (`@anatomiax/anatomy-core/assetManifest`) and SHA-256 integrity are web-consumed; no native-mobile GL/meshopt pipeline remains.

## AI

AI-assisted learning (knowledge retrieval with a medical safety layer) is planned for a later phase. No AI implementation exists yet.

## Current Status

Responsive web platform with working anatomy viewer (male/female, 9 systems, Meshopt-optimized GLBs), learning/quiz/progress, auth, RBAC, cohorts, notifications (web push), and admin. Native mobile has been permanently dropped — no Expo/React Native workspace remains.

## Getting Started

Requires Node.js >=24 <25 (see `engines` in `package.json`).

```bash
npm ci
cp backend/api/.env.example backend/api/.env        # DATABASE_URL, JWT_SECRET, ...
cp frontend/web/.env.example frontend/web/.env      # VITE_API_BASE_URL=http://localhost:3000
npx prisma migrate deploy --schema backend/api/prisma/schema.prisma
```

Run the API (`backend/api`, port 3000) and the web app (`frontend/web`, port 5173)
in separate terminals, or by workspace script (`npm run dev -w @anatomiax/web`).

Quality gates (same as CI in `.github/workflows/ci.yml`):

```bash
npm run format:check
npm run typecheck --workspaces --if-present
npm run test --workspaces --if-present
npm run build --workspaces --if-present
npx playwright test
```

Production builds bake in `VITE_API_BASE_URL` (origin only, e.g.
`https://anatomiax-api.onrender.com` — the frontend appends `/api/v1/...`
itself). A production web build without it fails fast instead of shipping a
bundle that calls `localhost:3000`. Full deploy contract:
`docs/deployment/README.md`.

## Roadmap

No native iOS/Android/Expo work is planned. Future work targets responsive web only (PWA/offline not in this step).
