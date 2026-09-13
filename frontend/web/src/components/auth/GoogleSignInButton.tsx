import { googleLoginUrl } from '@/lib/auth';

const inputClass =
  'flex min-h-[44px] w-full items-center justify-center rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';

/** Full-page navigation to the existing backend Google entrypoint. */
export default function GoogleSignInButton({
  testId = 'google-signin',
}: {
  testId?: string;
}): JSX.Element {
  return (
    <a href={googleLoginUrl()} data-testid={testId} className={inputClass}>
      Continue with Google
    </a>
  );
}
