import { Link } from 'react-router-dom';
import { Reveal } from '@/components/motion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { CohortView } from '@/features/cohorts/api';
import { formatDate } from './dashboardFormat';

interface DashboardHeaderProps {
  cohort: CohortView;
  isArchived: boolean;
}

export default function DashboardHeader({ cohort, isArchived }: DashboardHeaderProps): JSX.Element {
  return (
    <>
      <Reveal>
        <div className="flex flex-col gap-4">
          <Link
            to={`/cohorts/${cohort.id}`}
            className="w-fit rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            ← Back to cohort
          </Link>

          <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 p-4 shadow-soft sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="ax-kicker">Teacher dashboard</p>
                <h1
                  className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl"
                  data-testid="dashboard-cohort-name"
                >
                  {cohort.name}
                </h1>
                <p className="mt-1 text-sm text-slate-400" data-testid="dashboard-institution">
                  {cohort.institutionLabel ?? 'No institution'}
                  <span className="mx-2 text-slate-600">·</span>
                  <span className="text-slate-500">Created {formatDate(cohort.createdAt)}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge data-testid="dashboard-role-badge" className="capitalize">
                  {cohort.myRole ?? 'MEMBER'}
                </Badge>
                {isArchived ? (
                  <Badge variant="secondary" data-testid="dashboard-archived-badge">
                    Archived
                  </Badge>
                ) : null}
                {!isArchived ? (
                  <Badge variant="outline" className="border-emerald-900/50 text-emerald-300">
                    Active
                  </Badge>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Cohort progress is server-authorized. Only owners and admins can view member details.
              Studied structures link to <span className="font-mono">/human?focus=</span> where
              available.
            </p>
          </div>
        </div>
      </Reveal>

      {isArchived ? (
        <Reveal delay={0.05}>
          <Alert
            variant="default"
            className="border-amber-900/50 bg-amber-950/30 text-amber-200"
            data-testid="dashboard-archived-notice"
          >
            <AlertDescription>
              This cohort is archived and read-only. Progress is frozen from archive time. Members
              cannot be added and settings cannot be changed.
            </AlertDescription>
          </Alert>
        </Reveal>
      ) : null}
    </>
  );
}
