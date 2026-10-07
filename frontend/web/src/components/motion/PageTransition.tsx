import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { DURATIONS, EASE } from './motion-tokens';

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
