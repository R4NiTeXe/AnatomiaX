import { Link, useNavigate } from 'react-router-dom';
import { parseStudiedKey } from '@anatomiax/anatomy-core';
import { getAnatomyInformationByStructureKey } from '@anatomiax/anatomy-core';
import { useAuth } from '@/components/auth/AuthProvider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  const navigate = useNavigate();

  if (status === 'loading') {
    return <Skeleton className="h-10 w-full" data-testid="studied-loading" />;
  }
  if (status !== 'authenticated') return null;
  if (snapshotQuery.isLoading && !snapshotQuery.data) {
    return <Skeleton className="h-10 w-full" data-testid="studied-loading" />;
  }
  if (snapshotQuery.isError) {
    return (
      <div className="flex flex-col gap-2">
        <Alert variant="destructive" data-testid="studied-error">
          <AlertDescription>
            Couldn&apos;t load studied structures.
            {snapshotQuery.error instanceof Error ? ` ${snapshotQuery.error.message}` : ''}
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => snapshotQuery.refetch()}
          data-testid="studied-retry"
        >
          Retry
        </Button>
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
        {visible.map(key => {
          const label = displayNameFor(key);
          const href = buildHumanFocusUrl(key);
          return (
            <li key={key} data-testid="studied-item">
              <Card
                className="flex items-center justify-between gap-2 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                role="button"
                tabIndex={0}
                aria-label={`Open ${label} in 3D viewer`}
                onClick={() => navigate(href)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(href);
                  }
                }}
              >
                <span className="truncate text-sm text-slate-100">{label}</span>
                <Button variant="ghost" size="sm" asChild onClick={e => e.stopPropagation()}>
                  <Link to={href} data-testid="studied-open" onClick={e => e.stopPropagation()}>
                    Open in 3D
                  </Link>
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>
      {preview && keys.length > visible.length ? (
        <Button variant="link" asChild className="w-fit p-0">
          <Link to="/learn" data-testid="studied-view-all">
            View all {keys.length} →
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
