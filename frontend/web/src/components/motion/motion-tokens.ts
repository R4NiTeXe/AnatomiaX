import type { Transition, Variants } from 'motion/react';

export const DURATIONS = {
  instant: 0.12,
  fast: 0.18,
  base: 0.28,
  slow: 0.45,
  slower: 0.7,
} as const;

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

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  show: { opacity: 1, scale: 1 },
};

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const staggerChild: Variants = fadeUp;

export const VIEWPORT_ONCE = { once: true, margin: '-48px' } as const;
