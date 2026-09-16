import { Component, Suspense, lazy, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface RivePlayerProps {
  src: string;
  className?: string;
  artboard?: string;
  /** Timeline name(s) to play. Only pass values verified against the asset. */
  animations?: string | string[];
  stateMachines?: string | string[];
  autoplay?: boolean;
  width?: number | string;
  height?: number | string;
  ariaLabel?: string;
  poster?: ReactNode;
}

/**
 * Lazy Rive wrapper — keeps the WASM runtime out of the main bundle.
 * Reduced-motion and error states fall back to `poster` (or empty).
 * No layout shift: the outer div always reserves `width`/`height`.
 * Rive is purely presentational: callers keep React state authoritative and
 * only pass artboard/stateMachines/animations values verified for the asset.
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
  // Lazy initializer reads the media query synchronously so reduced-motion
  // users never flash the animated path (which would also lazy-load the
  // Rive runtime unnecessarily). Guarded for non-DOM environments.
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

/**
 * Isolates Rive runtime/asset failures to the poster fallback so a broken
 * animation can never crash its host UI (e.g. navigation must keep working).
 */
class RiveErrorBoundary extends Component<
  { resetKey: string; fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidUpdate(prevProps: { resetKey: string }): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.failed) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ failed: false });
    }
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
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

  const fallback = (
    <div aria-hidden="true" className={className} style={{ width, height }}>
      {poster ?? null}
    </div>
  );

  return (
    <RiveErrorBoundary resetKey={riveProps.src} fallback={fallback}>
      <Suspense fallback={fallback}>
        <LazyRive
          src={riveProps.src}
          artboard={riveProps.artboard}
          animations={riveProps.animations}
          stateMachines={riveProps.stateMachines}
          autoplay={riveProps.autoplay ?? true}
          ariaLabel={ariaLabel}
          className={className}
          width={width}
          height={height}
          poster={poster}
        />
      </Suspense>
    </RiveErrorBoundary>
  );
}
