import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { DURATIONS, EASE, VIEWPORT_ONCE } from './motion-tokens';

/**
 * STEP 8.23 scroll reveal for below-fold sections — fires once, just before
 * entry. Transform/opacity only. Content stays in the DOM at all times, so
 * screen readers, tests, and no-JS fallbacks are unaffected.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}): JSX.Element {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_ONCE}
      transition={{ duration: DURATIONS.base, ease: EASE.standard, delay }}
    >
      {children}
    </motion.div>
  );
}
