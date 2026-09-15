import { motion } from 'motion/react';
import { SPRING_SOFT } from './motion-tokens';

/**
 * STEP 8.23 animated active-route indicator — a shared-layout pill that
 * glides between nav links (`layoutId`). Rendered only inside the active
 * link behind its label; `aria-current` stays on the link itself, so
 * semantics, testids, and keyboard behavior are unchanged.
 *
 * Each mounted nav instance (desktop bar, mobile sheet) needs its OWN id —
 * duplicate layoutIds across simultaneously-mounted instances conflict.
 */
export function ActiveNavPill({ id = 'ax-nav-active' }: { id?: string }): JSX.Element {
  return (
    <motion.span
      layoutId={id}
      aria-hidden="true"
      transition={SPRING_SOFT}
      className="absolute inset-0 rounded-lg bg-teal-400/15 shadow-glow-sm ring-1 ring-inset ring-teal-300/20"
    />
  );
}
