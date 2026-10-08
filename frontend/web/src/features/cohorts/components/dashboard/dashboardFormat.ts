export interface DashboardRecentAttempt {
  id: string;
  userId: string;
  name: string | null;
  score: number;
  total: number;
  bodyModel: string;
  completedAt: string;
}

export function formatDate(value: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function bestScoreText(attempts: { score: number; total: number }[]): string {
  if (attempts.length === 0) return '—';
  let best = attempts[0];
  let bestPct = best.score / Math.max(1, best.total);
  for (const a of attempts.slice(1)) {
    const pct = a.score / Math.max(1, a.total);
    if (pct > bestPct || (pct === bestPct && a.score > best.score)) {
      best = a;
      bestPct = pct;
    }
  }
  return `${best.score} / ${best.total}`;
}
