# AnatomiaX UI — shadcn foundation

Minimal shadcn/ui + Tailwind primitives for application surfaces.

**Design tokens:** `src/index.css` (`--background/foreground/card/primary/...` + 8.23 `--surface/*`, `--glow-*`) + Tailwind `anatomia` palette + `surface` colors + `soft/lift/glow` shadows. Dark-only, AnatomiaX-specific. Focus ring `ring: 172 66% 50%`, radius `0.75rem`. Type scale + `.ax-app-bg` ambient + `.ax-shimmer` in `@layer components`.

**Primitives (10):**

- `button` — `cva` variants `default/outline/secondary/destructive/ghost/link`, `size` `default/sm/lg/icon`, `min-h-[44px]` touch target, `focus-visible:ring-2`.
- `card` — `Card/Header/Title/Description/Content/Footer`, `border-slate-800 bg-slate-900/40`.
- `input` — `min-h-[44px]`, `border-input bg-slate-800/50`, `focus-visible:ring-2`.
- `label` — Radix Label, `text-slate-400`.
- `badge` — `cva` `default/secondary/outline/teal/destructive`, uppercase.
- `alert` — `default/destructive/warning/success`, `role=alert`.
- `dialog` — Radix Dialog, `Sheet`-style overlay/content/title/description, `lucide-react` close.
- `sheet` — Radix Dialog drawer, `side` `top/bottom/left/right`, mobile nav.
- `tabs` — Radix Tabs, `List/Trigger/Content`, active `bg-slate-800`.
- `skeleton` — `animate-pulse bg-slate-800`.
- `dropdown-menu` — Radix Dropdown, available for future menus.

Added deps: `class-variance-authority`, `@radix-ui/react-dialog/label/tabs/dropdown-menu/slot`, `lucide-react`, `tailwindcss-animate` (plugin in `tailwind.config.js`).

**Migrated surfaces (behavior unchanged):** auth (`login/register/forgot/reset`), `account`, `home/dashboard`, `learn/progress`, `cohorts` + `cohort detail`, `SiteNav`, `StudiedStructures`, `QuizAttempts`.

**Motion foundation (8.23):** `src/components/motion/` — tokens (`DURATIONS`/`EASE`/`SPRING_SOFT`/variants), `MotionRoot` (`reducedMotion="user"`, wired in `main.tsx`), `PageTransition` (enter-only route fade), `Reveal` (once scroll reveal), `Stagger`/`StaggerItem`, `ActiveNavPill` (shared-layout nav indicator). Radix open/close motion uses `tailwindcss-animate` state classes (no JS lifecycle fights). Import from `@/components/motion` only.

`/human` viewer untouched — no styling/logic change.

**Rules:** Web only, Motion via foundation only, no second UI lib, no backend change, routes unchanged, `data-testid` preserved for tests.
