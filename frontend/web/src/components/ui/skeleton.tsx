import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // STEP 8.23: shimmer sweep over the pulse base — GPU-cheap background
  // animation, silenced by the global reduced-motion rule.
  return (
    <div className={cn('ax-shimmer animate-pulse rounded-md bg-slate-800', className)} {...props} />
  );
}

export { Skeleton };
