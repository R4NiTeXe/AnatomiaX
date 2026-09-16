import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { ActiveNavPill } from '@/components/motion';
import { RivePlayer, animationSrc } from '@/components/animation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, X } from 'lucide-react';

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  `relative inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isActive ? 'text-teal-100' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'}`;

function navLink(
  to: string,
  testId: string,
  label: string,
  pillId: string,
  end?: boolean
): JSX.Element {
  return (
    <NavLink to={to} end={end} className={linkClass} data-testid={testId}>
      {({ isActive }) => (
        <>
          {isActive ? <ActiveNavPill id={pillId} /> : null}
          <span className="relative">{label}</span>
        </>
      )}
    </NavLink>
  );
}

// One link set per mounted nav instance — desktop bar and mobile sheet each
// get their own pill id because both stay mounted (CSS-hidden switches).
function NavLinkSet({ pillId }: { pillId: string }): JSX.Element {
  const { user, status } = useAuth();
  return (
    <>
      {navLink('/', 'nav-home', 'Home', pillId, true)}
      {navLink('/human', 'nav-anatomy', 'Anatomy', pillId)}
      {navLink('/learn', 'nav-learn', 'Progress', pillId)}
      {status === 'authenticated' && user
        ? navLink('/cohorts', 'nav-cohorts', 'Cohorts', pillId)
        : null}
      {status === 'authenticated' && user
        ? navLink('/account', 'nav-account', 'Account', pillId)
        : navLink('/login', 'nav-login', 'Sign in', pillId)}
    </>
  );
}

export default function SiteNav(): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <nav
      aria-label="Primary"
      // STEP 8.23: sticky clinical glass — hairline border, backdrop blur.
      className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 text-slate-100 backdrop-blur-md"
      data-testid="site-nav"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link
          to="/"
          className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-widest text-slate-400 transition-colors hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          AnatomiaX
        </Link>
        <div className="hidden items-center gap-1 sm:flex">
          <NavLinkSet pillId="ax-nav-active-desktop" />
        </div>
        <div className="sm:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <span className="h-5 w-5" aria-hidden="true">
                  {/* STEP 8.28: React (`mobileOpen`) is the source of truth.
                      The asset exposes no verifiable state-machine/input
                      binding (binary inspection only shows unverified
                      "switch"/"toggleX" strings of unknown type), so no
                      input is wired. The `key` remount replays the toggle
                      timeline to mirror the actual nav state; the Lucide
                      poster is the reduced-motion/failure equivalent and
                      Rive can never block navigation (see RivePlayer). */}
                  <RivePlayer
                    key={mobileOpen ? 'open' : 'closed'}
                    src={animationSrc('menu-close-toggle')}
                    autoplay
                    width={20}
                    height={20}
                    ariaLabel={mobileOpen ? 'Close navigation' : 'Open navigation'}
                    poster={mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  />
                </span>
                <span className="sr-only">
                  {mobileOpen ? 'Close navigation' : 'Open navigation'}
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 bg-slate-950">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-1">
                <NavLinkSet pillId="ax-nav-active-mobile" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
