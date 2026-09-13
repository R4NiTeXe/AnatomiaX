import { Link } from 'react-router-dom';
import { parseStudiedKey } from '@anatomiax/anatomy-core';
import { getAnatomyInformationByStructureKey } from '@anatomiax/anatomy-core';
import { useAuth } from '@/components/auth/AuthProvider';
import { useProgressSnapshot } from '@/hooks/useProgress';
import { buildHumanFocusUrl } from '@/lib/humanLink';

function displayNameFor(key: string): string {
  const info = getAnatomyInformationByStructureKey(key);
  if (info?.canonicalName) return info.canonicalName;
  const parsed = parseStudiedKey(key);
  return parsed?.name ?? key;
}

export default function StudiedStructures({
  preview = false,
}: {
  preview?: boolean;
}): JSX.Element | null {
  const { status } = useAuth();
  const snapshotQuery = useProgressSnapshot();

  if (status === 'loading') {
    return (
      <p className="text-sm text-slate-500" data-testid="studied-loading">
        Loading studied structures…
      </p>
    );
  }
  if (status !== 'authenticated') return null;
  if (snapshotQuery.isLoading && !snapshotQuery.data) {
    return (
      <p className="text-sm text-slate-500" data-testid="studied-loading">
        Loading studied structures…
      </p>
    );
  }
  if (snapshotQuery.isError) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-red-300" role="alert" data-testid="studied-error">
          Couldn&apos;t load studied structures.
          {snapshotQuery.error instanceof Error ? ` ${snapshotQuery.error.message}` : ''}
        </p>
        <button
          type="button"
          onClick={() => snapshotQuery.refetch()}
          data-testid="studied-retry"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          Retry
        </button>
      </div>
    );
  }

  const keys = snapshotQuery.data?.studiedKeys ?? [];
  if (keys.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-testid="studied-empty">
        No structures studied yet. Open the 3D viewer and select a structure to begin.
      </p>
    );
  }

  const visible = preview ? keys.slice(0, 6) : keys;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-300" data-testid="studied-count">
        {keys.length} {keys.length === 1 ? 'structure' : 'structures'} studied
      </p>
      <ul className="flex flex-col gap-1" data-testid="studied-list">
        {visible.map(key => (
          <li
            key={key}
            data-testid="studied-item"
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
          >
            <span className="truncate text-sm text-slate-100">{displayNameFor(key)}</span>
            <Link
              to={buildHumanFocusUrl(key)}
              data-testid="studied-open"
              className="shrink-0 rounded px-2 py-1 text-xs text-teal-300 hover:bg-teal-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              Open in 3D
            </Link>
          </li>
        ))}
      </ul>
      {preview && keys.length > visible.length ? (
        <Link
          to="/learn"
          data-testid="studied-view-all"
          className="text-sm text-teal-300 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          View all {keys.length} →
        </Link>
      ) : null}
    </div>
  );
}
