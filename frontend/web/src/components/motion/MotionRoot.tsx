import type { ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

/**
 * STEP 8.23 global motion provider — `reducedMotion="user"` disables all
 * Motion transform/layout animation for users who prefer reduced motion
 * (complements the CSS kill-switch in index.css). Wrap once at the app root.
 */
export function MotionRoot({ children }: { children: ReactNode }): JSX.Element {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
