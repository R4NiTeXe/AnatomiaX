import type { ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

export function MotionRoot({ children }: { children: ReactNode }): JSX.Element {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
