import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/components/animation';
import type { BackdropHandle } from './createBackdropRenderer';

interface ShaderBackdropProps {
  className?: string;
  testId?: string;
}

function intensityForViewport(): number {
  if (typeof window === 'undefined') return 1;
  const width = window.innerWidth;
  if (width < 640) return 0.55;
  if (width < 1024) return 0.8;
  return 1;
}

/**
 * Static CSS twin of the shader's resting look (STEP 8.30).
 * Used when WebGL is unavailable or fails — same footprint, same layering,
 * zero GPU cost. Approximation is intentional: it preserves hierarchy and
 * readability, not pixel parity.
 */
function StaticBackdrop({ testId }: { testId?: string }): JSX.Element {
  return (
    <div
      data-testid={testId ? `${testId}-fallback` : undefined}
      aria-hidden="true"
      className="h-full w-full"
      style={{
        backgroundImage:
          'radial-gradient(24rem 12rem at 22% 18%, rgb(45 212 191 / 0.08), transparent 65%),' +
          'radial-gradient(26rem 13rem at 80% 82%, rgb(139 92 246 / 0.07), transparent 65%),' +
          'repeating-linear-gradient(0deg, rgb(148 197 210 / 0.05) 0 1px, transparent 1px 46px),' +
          'repeating-linear-gradient(90deg, rgb(148 197 210 / 0.05) 0 1px, transparent 1px 46px)',
      }}
    />
  );
}

/**
 * Ambient medical-tech backdrop (STEP 8.30) — decorative only.
 * Placement policy: section-level surfaces only (currently the public
 * homepage hero). Never global, never inside /human, never behind focused
 * task flows like auth forms. The renderer module is dynamically imported
 * so this chunk — and any GPU work — only exists while mounted.
 */
export default function ShaderBackdrop({ className, testId }: ShaderBackdropProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let handle: BackdropHandle | null = null;
    let disposed = false;
    let observer: IntersectionObserver | null = null;

    const mount = async (): Promise<void> => {
      if (handle || disposed) return;
      try {
        const { createBackdropRenderer } = await import('./createBackdropRenderer');
        if (disposed) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const created = createBackdropRenderer(canvas, {
          reducedMotion: reduced,
          intensity: intensityForViewport(),
        });
        if (disposed) {
          created?.dispose();
          return;
        }
        if (!created) {
          setFailed(true);
          return;
        }
        handle = created;
      } catch {
        if (!disposed) setFailed(true);
      }
    };

    const onResize = (): void => {
      handle?.setIntensity(intensityForViewport());
    };

    if (reduced) {
      // Above-the-fold static frame: no scroll gating needed, no loop runs.
      void mount();
    } else if (typeof IntersectionObserver === 'undefined') {
      void mount();
    } else if (hostRef.current) {
      observer = new IntersectionObserver(
        entries => {
          const visible = entries.some(entry => entry.isIntersecting);
          if (visible) void mount();
          handle?.setPaused(!visible);
        },
        { threshold: 0 }
      );
      observer.observe(hostRef.current);
    }

    window.addEventListener('resize', onResize);
    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
      handle?.dispose();
      handle = null;
    };
  }, [reduced]);

  return (
    <div
      ref={hostRef}
      data-testid={testId}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ''}`}
    >
      {failed ? (
        <StaticBackdrop testId={testId} />
      ) : (
        <canvas
          ref={canvasRef}
          data-testid={testId ? `${testId}-canvas` : undefined}
          data-static={reduced ? 'true' : undefined}
          className="h-full w-full"
        />
      )}
    </div>
  );
}
