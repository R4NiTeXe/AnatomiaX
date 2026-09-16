import type { ReactNode } from 'react';
import LottiePlayer from './LottiePlayer';
import { animationSrc } from './registry';

/**
 * Approved Lottie storytelling assets (STEP 8.29).
 * The union type makes it impossible to wire an unverified asset here —
 * loading/empty/success states keep their lightweight CSS/icon solutions
 * unless a legitimate asset match is approved in the registry.
 */
export type StorytellingAsset = 'body-scan' | 'medical-technology';

const STORY_CAPTIONS: Record<StorytellingAsset, string> = {
  'body-scan': 'Body scan preview',
  'medical-technology': 'Technology preview',
};

interface LottieVisualProps {
  asset: StorytellingAsset;
  /** Accessible name. Omit only when `decorative` is true. */
  label?: string;
  /** Purely decorative: hidden from assistive tech, no role announced. */
  decorative?: boolean;
  /** Default false — looping must be explicitly justified per placement. */
  loop?: boolean;
  /** Default true — justified here as a one-shot/short entrance story. */
  autoplay?: boolean;
  className?: string;
  /** Meaningful static fallback (reduced-motion + load failure). */
  poster?: ReactNode;
  testId?: string;
}

/**
 * Single reusable Lottie storytelling visual (STEP 8.29).
 * Renders LottiePlayer inside a reserved-aspect frame so there is never a
 * layout shift; the frame is slightly shorter on mobile to keep content
 * hierarchy (CTAs stay near the top). Product text always stays primary —
 * this component is visual reinforcement only.
 */
export default function LottieVisual({
  asset,
  label,
  decorative = false,
  loop = false,
  autoplay = true,
  className,
  poster,
  testId,
}: LottieVisualProps): JSX.Element {
  const fallbackPoster = poster ?? (
    <span className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-slate-500">
      {STORY_CAPTIONS[asset]}
    </span>
  );
  return (
    <div
      data-testid={testId}
      aria-hidden={decorative ? 'true' : undefined}
      className={`aspect-[16/9] w-full bg-slate-950/60 sm:aspect-[16/10] ${className ?? ''}`}
    >
      <LottiePlayer
        src={animationSrc(asset)}
        loop={loop}
        autoplay={autoplay}
        ariaLabel={decorative ? undefined : (label ?? STORY_CAPTIONS[asset])}
        poster={fallbackPoster}
        className="h-full w-full"
      />
    </div>
  );
}
