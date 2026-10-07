import type { ReactNode } from 'react';
import LottiePlayer from './LottiePlayer';
import { animationSrc } from './registry';

export type StorytellingAsset = 'body-scan' | 'medical-technology';

const STORY_CAPTIONS: Record<StorytellingAsset, string> = {
  'body-scan': 'Body scan preview',
  'medical-technology': 'Technology preview',
};

interface LottieVisualProps {
  asset: StorytellingAsset;
  label?: string;
  decorative?: boolean;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  poster?: ReactNode;
  testId?: string;
}

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
