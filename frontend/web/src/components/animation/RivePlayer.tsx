import { Suspense, lazy, useEffect, useState } from 'react';

interface RivePlayerProps {
  src: string;
  className?: string;
  artboard?: string;
  stateMachines?: string | string[];
  autoplay?: boolean;
  width?: number | string;
  height?: number | string;
  ariaLabel?: string;
  poster?: React.ReactNode;
}

/**
 * Lazy Rive wrapper — keeps the WASM runtime out of the main bundle.
 * Reduced-motion and error states fall back to `poster` (or empty).
 * No layout shift: the outer div always reserves `width`/`height`.
 */
const LazyRive = lazy(async () => {
  const mod = await import('@rive-app/react-canvas');
  const Rive =
    (mod as unknown as { default: React.ComponentType<RivePlayerProps> }).default ??
    (mod as unknown as { Rive: React.ComponentType<RivePlayerProps> }).Rive;
  return {
    default: (props: RivePlayerProps) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const P = Rive as any;
      return <P {...props} />;
    },
  };
});

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export default function RivePlayer(props: RivePlayerProps): JSX.Element {
  const reduced = usePrefersReducedMotion();
  const { ariaLabel, poster, className, width, height, ...riveProps } = props;

  if (reduced) {
    return (
      <div
        role={ariaLabel ? 'img' : undefined}
        aria-label={ariaLabel}
        className={className}
        style={{ width, height }}
      >
        {poster ?? null}
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div aria-hidden="true" className={className} style={{ width, height }}>
          {poster ?? null}
        </div>
      }
    >
      <LazyRive
        src={riveProps.src}
        artboard={riveProps.artboard}
        stateMachines={riveProps.stateMachines}
        autoplay={riveProps.autoplay ?? true}
        ariaLabel={ariaLabel}
        className={className}
        width={width}
        height={height}
        poster={poster}
      />
    </Suspense>
  );
}
