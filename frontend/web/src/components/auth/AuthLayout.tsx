import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { DURATIONS, EASE } from '@/components/motion';
import { Card, CardContent } from '@/components/ui/card';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const BRAND_POINTS = [
  { title: 'Interactive 3D anatomy', body: 'Nine body systems across male and female models.' },
  { title: 'Progress that syncs', body: 'Studied structures and quiz attempts on any device.' },
  { title: 'Built for learning', body: 'Cohorts, dashboards, and guided review.' },
];

/**
 * STEP 8.24 shared auth composition — responsive split: a clinical brand
 * panel on large screens, a compact brand mark above a focused form column
 * on small screens. Same title/subtitle/children/footer contract, so all
 * five auth pages inherit the redesign with zero behavior change.
 */
export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps): JSX.Element {
  return (
    <main className="ax-app-bg flex min-h-screen flex-col text-slate-100">
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-16">
        {/* Brand panel — large screens only; complementary copy, hidden from AT
            because the form column carries the real title/subtitle. */}
        <div className="hidden lg:block" aria-hidden="true">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATIONS.base, ease: EASE.standard }}
          >
            <p className="ax-kicker">AnatomiaX</p>
            <p className="mt-3 max-w-md text-3xl font-bold leading-tight tracking-tight text-slate-50">
              The human body,
              <br />
              <span className="text-teal-300">brought to life.</span>
            </p>
            <dl className="mt-8 flex max-w-md flex-col gap-5">
              {BRAND_POINTS.map(point => (
                <div key={point.title} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400 shadow-glow-sm" />
                  <div>
                    <dt className="text-sm font-semibold text-slate-100">{point.title}</dt>
                    <dd className="mt-0.5 text-sm leading-6 text-slate-400">{point.body}</dd>
                  </div>
                </div>
              ))}
            </dl>
            <div className="mt-8 flex flex-wrap gap-2">
              {['9 body systems', 'Male + female', 'Meshopt 3D'].map(chip => (
                <span
                  key={chip}
                  className="rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1 text-[0.7rem] font-medium tracking-widest text-slate-400"
                >
                  {chip.toUpperCase()}
                </span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Form column — identical contract: brand, h1, subtitle, card, footer. */}
        <div className="mx-auto w-full max-w-md">
          <p className="text-xs uppercase tracking-widest text-slate-500">
            <Link
              to="/"
              className="inline-block rounded-lg px-2 py-2 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              AnatomiaX
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
            {title}
          </h1>
          {subtitle ? <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p> : null}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATIONS.base, ease: EASE.standard, delay: 0.06 }}
          >
            <Card className="mt-6 shadow-lift">
              <CardContent className="p-4 sm:p-6">{children}</CardContent>
            </Card>
          </motion.div>
          {footer ? <div className="mt-4 text-center text-sm text-slate-400">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
