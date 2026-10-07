import { motion } from 'motion/react';
import { SPRING_SOFT } from './motion-tokens';

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
