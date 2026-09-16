import { Component, Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import usePrefersReducedMotion from './usePrefersReducedMotion';

interface LottiePlayerProps {
  src: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  /** Default false (STEP 8.29): looping must be explicitly justified. */
  loop?: boolean;
  autoplay?: boolean;
  ariaLabel?: string;
  poster?: ReactNode;
}

// Lazy dotLottie — keeps the player out of the main bundle.
const LazyDotLottie = lazy(async () => {
  const mod = await import('@lottiefiles/dotlottie-react');
  const Comp =
    (
      mod as unknown as {
        DotLottieReact: React.ComponentType<{
          src: string;
          loop?: boolean;
          autoplay?: boolean;
          className?: string;
        }>;
      }
    ).DotLottieReact ??
    (
      mod as unknown as {
        default: React.ComponentType<{
          src: string;
          loop?: boolean;
          autoplay?: boolean;
          className?: string;
        }>;
      }
    ).default;
  return { default: Comp };
});

/**
 * Isolates Lottie runtime/asset failures to the poster fallback so a broken
 * animation can never crash its host UI.
 */
class LottieErrorBoundary extends Component<
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

export default function LottiePlayer({
  src,
  className,
  width,
  height,
  loop = false,
  autoplay = true,
  ariaLabel,
  poster,
}: LottiePlayerProps): JSX.Element {
  const reduced = usePrefersReducedMotion();

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
    <LottieErrorBoundary resetKey={src} fallback={fallback}>
      <Suspense fallback={fallback}>
        <LazyDotLottie src={src} loop={loop} autoplay={autoplay} className={className} />
      </Suspense>
    </LottieErrorBoundary>
  );
}
