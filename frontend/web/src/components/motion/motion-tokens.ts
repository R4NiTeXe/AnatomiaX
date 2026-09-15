import type { Transition, Variants } from 'motion/react';

/**
 * STEP 8.23 shared motion language — the single source for duration, easing,
 * and reusable variants across web. Transform/opacity only (GPU-friendly, no
 * layout thrash). Later Rive/Lottie/GLSL milestones reuse DURATIONS + EASE so
 * authored assets feel native to the app; see EXTENSION POINTS below.
 */
export const DURATIONS = {
  instant: 0.12,
  fast: 0.18,
  base: 0.28,
  slow: 0.45,
  slower: 0.7,
} as const;

/** Restrained clinical easings — decisive entrances, soft landings. */
export const EASE = {
  standard: [0.32, 0.72, 0, 1],
  emphasized: [0.22, 0.9, 0.28, 1],
  snappy: [0.4, 0, 0.2, 1],
} as const;

export const SPRING_SOFT = {
  type: 'spring',
  stiffness: 320,
  damping: 30,
} as const satisfies Transition;

/** Fade + slight rise — default entrance for sections and cards. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

/** Opacity-only entrance for text and overlays. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

/** Subtle scale entrance for panels and dialogs owned by Motion. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  show: { opacity: 1, scale: 1 },
};

/** Stagger parent — children using `staggerChild` reveal in sequence. */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const staggerChild: Variants = fadeUp;

/** Fire scroll reveals once; small negative margin starts just before entry. */
export const VIEWPORT_ONCE = { once: true, margin: '-48px' } as const;

/**
 * EXTENSION POINTS for later milestones (do not implement here):
 * - Rive/Lottie: drive playback from these durations/easings (e.g. map
 *   `DURATIONS.base` to artboard timing) and mount players inside `Reveal`
 *   so scroll-gating + reduced-motion come free.
 * - WebGL/GLSL overlays: reuse `EASE.standard` for uniform transitions and
 *   `.ax-app-bg` layering order (effects render above the ambient wash,
 *   below content) so the backdrop contract stays intact.
 * - 3D presentation: viewer chrome (not the canvas) may adopt `fade`/
 *   `scaleIn`; the /human frameloop and render path stay untouched.
 */
