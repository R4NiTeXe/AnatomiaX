import { Link } from 'react-router-dom';
import { parseStudiedKey } from '@anatomiax/anatomy-core';
import { getAnatomyInformationByStructureKey } from '@anatomiax/anatomy-core';
import { useAuth } from '@/components/auth/AuthProvider';
import { Stagger, StaggerItem } from '@/components/motion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useProgressSnapshot } from '@/hooks/useProgress';
import { buildHumanFocusUrl } from '@/lib/humanLink';

export function displayNameForStudiedKey(key: string): string {
  const info = getAnatomyInformationByStructureKey(key);
  if (info?.canonicalName) return info.canonicalName;
  const parsed = parseStudiedKey(key);
  return parsed?.name ?? key;
}

function displayNameFor(key: string): string {
  return displayNameForStudiedKey(key);
}

export default function StudiedStructures({
  preview = false,
}: {
  preview?: boolean;
}): JSX.Element | null {
  const { status } = useAuth();
  const snapshotQuery = useProgressSnapshot();

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
      <Stagger>
        <ul className="flex flex-col gap-1.5" data-testid="studied-list">
          {visible.map((key, index) => {
            const label = displayNameFor(key);
            const href = buildHumanFocusUrl(key);
            return (
              <StaggerItem as="li" key={key} data-testid="studied-item">
                <Card className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    aria-hidden="true"
                    className="w-6 shrink-0 text-center text-xs font-bold tabular-nums text-teal-300/80"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <Link
                    to={href}
                    data-testid="studied-open-label"
                    aria-label={`Open ${label} in 3D viewer`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                  >
                    {label}
                  </Link>
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <Link to={href} data-testid="studied-open">
                      Open in 3D
                    </Link>
                  </Button>
                </Card>
              </StaggerItem>
            );
          })}
        </ul>
      </Stagger>
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
