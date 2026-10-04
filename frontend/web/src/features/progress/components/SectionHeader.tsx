import type { ReactNode } from 'react';

interface SectionHeaderProps {
  kicker: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Shared section heading for student surfaces: kicker + h2 + optional
 * description and trailing action. Keeps heading hierarchy flat (h2 under
 * the page h1) across Home and Learn.
 */
export default function SectionHeader({
  kicker,
  title,
  description,
  action,
}: SectionHeaderProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <p className="ax-kicker">{kicker}</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-100 sm:text-xl">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
