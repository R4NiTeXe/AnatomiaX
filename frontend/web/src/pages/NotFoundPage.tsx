import { Link } from 'react-router-dom';

export default function NotFoundPage(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100">
      <p className="text-xs uppercase tracking-widest text-slate-500">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Page not found</h1>
      <p className="mt-4 max-w-md text-center text-sm leading-6 text-slate-400">
        The page you are looking for does not exist.
      </p>
      <Link
        to="/"
        className="mt-8 inline-block rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
      >
        Go home
      </Link>
    </main>
  );
}
