import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { DURATIONS, EASE } from './motion-tokens';

/**
 * STEP 8.23 route entrance — replays a short fade/rise on every pathname
 * change. Enter-only by design: no exit unmount delay, so router timing,
 * tests, and Playwright assertions are unaffected. Renders a plain div
 * (never <main>) so page landmarks stay valid.
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  const { pathname } = useLocation();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATIONS.base, ease: EASE.standard }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
