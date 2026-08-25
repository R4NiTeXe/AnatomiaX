import { Link } from 'react-router-dom';

export interface PagePlaceholderProps {
  title: string;
  description: string;
}

export default function PagePlaceholder({ title, description }: PagePlaceholderProps): JSX.Element {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-slate-500">AnatomiaX</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-slate-400">{description}</p>
        <Link
          to="/"
          className="mt-8 inline-block rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
        >
          Back to 3D engine preview
        </Link>
      </div>
    </main>
  );
}
