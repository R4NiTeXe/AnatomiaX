import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { DURATIONS, EASE, staggerChild, staggerParent } from './motion-tokens';

/**
 * STEP 8.23 list reveal — children wrapped in <StaggerItem> inside <Stagger>
 * cascade in sequence on mount. For scroll-gated lists, compose with <Reveal>
 * around <Stagger> instead.
 */
export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={staggerParent}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  as = 'div',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** Render as `li` for staggered lists so `ul > li` stays valid HTML. */
  as?: 'div' | 'li';
  [key: `data-${string}`]: unknown;
}): JSX.Element {
  const Tag = as === 'li' ? motion.li : motion.div;
  return (
    <Tag
      className={className}
      variants={staggerChild}
      transition={{ duration: DURATIONS.fast, ease: EASE.standard }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
