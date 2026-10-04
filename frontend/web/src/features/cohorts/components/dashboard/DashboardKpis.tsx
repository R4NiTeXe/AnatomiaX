import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardKpisProps {
  totalMembers: number | null;
  aggregateStudied: number;
  aggregateQuizzes: number;
  bestOverall: string;
  latestOverall: string;
  progressLoaded: boolean;
  isArchived: boolean;
}

export default function DashboardKpis({
  totalMembers,
  aggregateStudied,
  aggregateQuizzes,
  bestOverall,
  latestOverall,
  progressLoaded,
  isArchived,
}: DashboardKpisProps): JSX.Element {
  return (
    <Reveal delay={0.05}>
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          Cohort overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="dashboard-summary">
          <Card className="border-teal-900/30 bg-gradient-to-br from-teal-950/20 via-slate-900/60 to-slate-900/40 shadow-glow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-teal-300/80">
                Members
              </CardTitle>
              <CardDescription>Total enrolled</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tracking-tight" data-testid="dashboard-member-count">
                {totalMembers ?? '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {isArchived ? 'Archived · read-only' : 'Active cohort'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Studied
              </CardTitle>
              <CardDescription>Structures explored</CardDescription>
            </CardHeader>
            <CardContent>
              <p
                className="text-3xl font-bold tracking-tight"
                data-testid="dashboard-studied-total"
              >
                {progressLoaded ? aggregateStudied : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {progressLoaded && totalMembers
                  ? `avg ${(aggregateStudied / Math.max(1, totalMembers)).toFixed(1)} / member`
                  : 'across members'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Quizzes
              </CardTitle>
              <CardDescription>Completed attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <p
                className="text-3xl font-bold tracking-tight"
                data-testid="dashboard-quizzes-total"
              >
                {progressLoaded ? aggregateQuizzes : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {progressLoaded && totalMembers
                  ? `avg ${(aggregateQuizzes / Math.max(1, totalMembers)).toFixed(1)} / member`
                  : 'total'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-700/50 bg-slate-900/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Performance
              </CardTitle>
              <CardDescription>Best · Latest</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight" data-testid="dashboard-best">
                {progressLoaded ? bestOverall : '—'}
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span>Latest</span>
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {progressLoaded ? latestOverall : '—'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </Reveal>
  );
}
