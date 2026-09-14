'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/', label: 'Overview', testId: 'admin-nav-overview' },
  { href: '/users', label: 'Users', testId: 'admin-nav-users' },
  { href: '/cohorts', label: 'Cohorts', testId: 'admin-nav-cohorts' },
];

export function AdminShell({ children }: { children: React.ReactNode }): JSX.Element {
  const pathname = usePathname();
  const { user, status, logout } = useAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-5xl px-4 py-8" data-testid="admin-loading">
          <div className="h-6 w-32 animate-pulse rounded bg-slate-800" />
          <div className="mt-4 h-20 w-full animate-pulse rounded bg-slate-800" />
        </div>
      </div>
    );
  }

  if (status !== 'authenticated' || user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold" data-testid="admin-unauthorized">
            Admin access required
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {status === 'authenticated'
              ? 'Your account does not have admin privileges.'
              : 'Please sign in with an admin account.'}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link
              href="/"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
              data-testid="admin-home-link"
            >
              Home
            </Link>
            {status === 'authenticated' ? (
              <button
                onClick={() => logout()}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
                data-testid="admin-logout"
              >
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-900 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <Link href="/" className="text-sm font-semibold tracking-tight" data-testid="admin-brand">
            AnatomiaX — Admin
          </Link>
          <nav aria-label="Admin" className="flex items-center gap-1" data-testid="admin-nav">
            {nav.map(item => {
              const active =
                pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={item.testId}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
                    active
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div
            className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"
            data-testid="admin-user"
          >
            <span>{user.email ?? user.name ?? user.id}</span>
            <span className="rounded bg-teal-500/20 px-2 py-0.5 text-teal-300">ADMIN</span>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-slate-900 focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
