import { Suspense, lazy, useEffect, useState } from 'react';

interface LottiePlayerProps {
  src: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  loop?: boolean;
  autoplay?: boolean;
  ariaLabel?: string;
  poster?: React.ReactNode;
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

export default function LottiePlayer({
  src,
  className,
  width,
  height,
  loop = true,
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

  return (
    <Suspense
      fallback={
        <div aria-hidden="true" className={className} style={{ width, height }}>
          {poster ?? null}
        </div>
      }
    >
      <LazyDotLottie src={src} loop={loop} autoplay={autoplay} className={className} />
    </Suspense>
  );
}
