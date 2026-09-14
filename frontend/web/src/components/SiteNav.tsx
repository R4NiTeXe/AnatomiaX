import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  `inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${isActive ? 'bg-teal-500/20 text-teal-200' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`;

export default function SiteNav(): JSX.Element {
  const { user, status } = useAuth();

  const links = (
    <>
      <NavLink to="/" end className={linkClass} data-testid="nav-home">
        Home
      </NavLink>
      <NavLink to="/human" className={linkClass} data-testid="nav-anatomy">
        Anatomy
      </NavLink>
      <NavLink to="/learn" className={linkClass} data-testid="nav-learn">
        Progress
      </NavLink>
      {status === 'authenticated' && user ? (
        <NavLink to="/cohorts" className={linkClass} data-testid="nav-cohorts">
          Cohorts
        </NavLink>
      ) : null}
      {status === 'authenticated' && user ? (
        <NavLink to="/account" className={linkClass} data-testid="nav-account">
          Account
        </NavLink>
      ) : (
        <NavLink to="/login" className={linkClass} data-testid="nav-login">
          Sign in
        </NavLink>
      )}
    </>
  );

  return (
    <nav
      aria-label="Primary"
      className="border-b border-slate-900 bg-slate-950 text-slate-100"
      data-testid="site-nav"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link
          to="/"
          className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          AnatomiaX
        </Link>
        <div className="hidden items-center gap-1 sm:flex">{links}</div>
        <div className="sm:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 bg-slate-950">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-1">{links}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
