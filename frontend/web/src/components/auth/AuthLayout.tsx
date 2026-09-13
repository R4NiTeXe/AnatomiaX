import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <p className="text-xs uppercase tracking-widest text-slate-500">
          <Link
            to="/"
            className="hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            AnatomiaX
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p> : null}
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
          {children}
        </div>
        {footer ? <div className="mt-4 text-center text-sm text-slate-400">{footer}</div> : null}
      </div>
    </main>
  );
}
