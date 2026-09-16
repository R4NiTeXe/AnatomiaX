import { useEffect, useState } from 'react';

/**
 * Shared reduced-motion hook for the animation layer (STEP 8.29).
 * Lazy initializer reads the media query synchronously so reduced-motion
 * users never flash the animated path — which would also lazy-load the
 * animation runtime unnecessarily. Guarded for non-DOM environments.
 */
export default function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
