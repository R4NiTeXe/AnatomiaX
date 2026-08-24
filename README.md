# AnatomiaX

Interactive 3D human anatomy learning platform for medical education. AnatomiaX combines high-fidelity 3D visualization, simulation, and AI-assisted learning to make anatomy intuitive and clinically relevant.

## Purpose

AnatomiaX helps students and professionals explore human anatomy through interactive 3D models, physiological simulations, and AI-powered knowledge retrieval — with a strong focus on medical accuracy and safety.

## Frontend

- **marketing/** — Public marketing site (11ty + Tailwind CSS + daisyUI + GSAP + Lenis + Barba.js)
- **web/** — Main application (React + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack Query + Three.js / React Three Fiber + GSAP + Lenis)
- **admin/** — Admin dashboard (Next.js + TypeScript + Turbopack + Tailwind CSS + shadcn/ui)
- **packages/** — Shared frontend packages (`ui`, `anatomy-engine`, `simulation-engine`, `ai-core`, `shared-types`)

## Backend

- **api/** — Core API (Node.js + TypeScript + NestJS + MongoDB + Mongoose + Redis + BullMQ)
- **packages/** — Shared backend packages (`ai-core`, `medical-core`, `shared`)

## 3D

3D assets are stored in `3d-assets/` (male, female, organs, systems, pathology, animations) and rendered via Three.js / React Three Fiber / WebGL in `frontend/web` and `frontend/packages/anatomy-engine`.

## AI

AI features use Gemini API with RAG, embeddings, medical knowledge retrieval, and an AI safety layer. Core logic lives in `frontend/packages/ai-core` and `backend/packages/ai-core`.

## Current Status

Initial setup — project structure, npm workspaces, and tooling configured. No features, UI, 3D, AI, auth, or database integration implemented yet.
