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

## Roadmap

No native iOS/Android/Expo work is planned. Future work targets responsive web only (PWA/offline not in this step).
